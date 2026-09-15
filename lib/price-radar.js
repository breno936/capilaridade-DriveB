export const MOCK_SOURCES = [
  'Mercado Livre',
  'Distribuidora Rota Pecas',
  'AutoParts Center',
  'Loja Turbo Autopecas',
  'Atacado PecasBR',
];

export const STATUS_LABELS = {
  muito_abaixo: 'Muito abaixo',
  abaixo: 'Abaixo',
  na_media: 'Na media',
  acima: 'Acima',
  muito_acima: 'Muito acima',
  sem_referencia: 'Sem referencia',
};

// Grupos de 3 tons reaproveitados do resto do app: "ideal" para o que favorece o DriveB
// (pagando abaixo do mercado), neutro para na media, "attention"/"critical" para sobrepreco.
export const STATUS_CHIP_TONE = {
  muito_abaixo: 'ideal',
  abaixo: 'ideal',
  na_media: '',
  acima: 'attention',
  muito_acima: 'critical',
  sem_referencia: '',
};

function fnv1aHash(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Gera ofertas simuladas e deterministicas (mesma peca sempre retorna as mesmas ofertas),
// a partir de uma referencia de preco independente do preco proposto pelo DriveB - assim a
// classificacao final varia de forma realista em vez de ficar sempre "na media".
export function searchMarketOffers(part) {
  const seedText = `${part.code}|${part.description}|${part.brand}|${part.vehicle}`.toLowerCase();
  const rand = mulberry32(fnv1aHash(seedText));
  const basePrice = 40 + rand() * 460;
  const offerCount = 2 + Math.floor(rand() * 4);
  const matchedByCode = Boolean(part.code);

  const offers = [];
  for (let i = 0; i < offerCount; i++) {
    const noise = 0.82 + rand() * 0.36;
    const confidence = (matchedByCode ? 0.78 : 0.55) + rand() * 0.2;
    offers.push({
      source: MOCK_SOURCES[Math.floor(rand() * MOCK_SOURCES.length)],
      price: Math.round(basePrice * noise * 100) / 100,
      confidence: Math.min(confidence, 0.98),
      matchType: matchedByCode ? 'codigo' : 'descricao',
    });
  }

  return offers;
}

function buildPartQuery(part) {
  const text = [part.brand, part.description, part.vehicle].filter(Boolean).join(' ').trim();
  return text || part.description || part.code || '';
}

// Consulta a rota server-side /api/price-search (Google Shopping via SerpApi), que por sua vez
// esconde a chave da API. Se a rota nao tiver SERPAPI_KEY configurada ou a chamada falhar,
// retorna null e quem chamou cai de volta para o gerador de ofertas simuladas.
export async function fetchRealOffers(rows) {
  const queries = rows.map((row, index) => ({ id: index, query: buildPartQuery(row) })).filter((item) => item.query);
  if (!queries.length) return null;

  let response;
  try {
    response = await fetch('/api/price-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
    });
  } catch (networkError) {
    return null;
  }

  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data?.results) return null;

  const offersById = new Map();
  data.results.forEach((item) => offersById.set(item.id, item.offers || []));
  return offersById;
}

export function classifyPriceDiff(driveBPrice, referenceMedian) {
  if (!Number.isFinite(driveBPrice) || !Number.isFinite(referenceMedian) || referenceMedian <= 0) return null;
  const diffPercent = ((driveBPrice - referenceMedian) / referenceMedian) * 100;

  let status;
  if (diffPercent <= -15) status = 'muito_abaixo';
  else if (diffPercent <= -5) status = 'abaixo';
  else if (diffPercent < 5) status = 'na_media';
  else if (diffPercent < 15) status = 'acima';
  else status = 'muito_acima';

  return { diffPercent, status };
}

export function generatePriceRadarStudy({ rows, realOffersById }) {
  const results = rows.map((row, index) => {
    const realOffers = realOffersById?.get(index);
    const isMock = !realOffers || !realOffers.length;
    const offers = isMock ? searchMarketOffers(row) : realOffers;

    const prices = offers.map((offer) => offer.price);
    const referenceMedian = median(prices);
    const classification = classifyPriceDiff(row.price, referenceMedian);
    const status = classification?.status || 'sem_referencia';
    const confidencePercent = !offers.length ? 0
      : isMock ? Math.round((offers.reduce((sum, offer) => sum + offer.confidence, 0) / offers.length) * 100)
      : Math.min(95, 55 + offers.length * 10);

    return {
      ...row,
      offers,
      offerCount: offers.length,
      median: referenceMedian,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      diffPercent: classification?.diffPercent ?? null,
      confidencePercent,
      status,
      statusLabel: STATUS_LABELS[status],
      isMock,
    };
  });

  const summary = {
    total: results.length,
    realCount: results.filter((row) => !row.isMock).length,
    mockCount: results.filter((row) => row.isMock).length,
    muito_abaixo: results.filter((row) => row.status === 'muito_abaixo').length,
    abaixo: results.filter((row) => row.status === 'abaixo').length,
    na_media: results.filter((row) => row.status === 'na_media').length,
    acima: results.filter((row) => row.status === 'acima').length,
    muito_acima: results.filter((row) => row.status === 'muito_acima').length,
    semReferencia: results.filter((row) => row.status === 'sem_referencia').length,
  };

  return { results, summary };
}

export function formatCurrency(value) {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1).replace('.', ',')}%`;
}
