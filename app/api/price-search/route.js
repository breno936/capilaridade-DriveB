const SERPAPI_URL = 'https://serpapi.com/search';
const MAX_CONCURRENCY = 4;

function parsePrice(value) {
  if (typeof value === 'number') return value;
  const number = Number(String(value ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

async function searchOne(query, apiKey) {
  const url = new URL(SERPAPI_URL);
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', query);
  url.searchParams.set('gl', 'br');
  url.searchParams.set('hl', 'pt-br');
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`SerpApi respondeu ${response.status}`);
  }

  const data = await response.json();
  return (data.shopping_results || [])
    .map((item) => ({
      source: item.source || 'Google Shopping',
      title: item.title,
      price: parsePrice(item.extracted_price ?? item.price),
      link: item.product_link || item.link || '',
    }))
    .filter((offer) => Number.isFinite(offer.price) && offer.price > 0);
}

// Roda no maximo MAX_CONCURRENCY buscas em paralelo, em vez de disparar tudo de uma vez -
// evita estourar o rate limit do plano do SerpApi quando a planilha tem muitas linhas.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

export async function POST(request) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return Response.json({ error: 'SERPAPI_KEY nao configurada no servidor.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const queries = Array.isArray(body?.queries) ? body.queries : [];
  if (!queries.length) {
    return Response.json({ error: 'Nenhuma consulta enviada.' }, { status: 400 });
  }

  const results = await mapWithConcurrency(queries, MAX_CONCURRENCY, async (item) => {
    try {
      const offers = await searchOne(item.query, apiKey);
      return { id: item.id, offers };
    } catch (error) {
      return { id: item.id, offers: [], error: error.message };
    }
  });

  return Response.json({ results });
}
