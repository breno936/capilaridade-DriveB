import { getSql } from '../../../../../lib/db';

export async function POST(request, { params }) {
  const sql = getSql();
  const clientId = Number(params.id);
  if (!Number.isInteger(clientId)) {
    return Response.json({ error: 'Cliente invalido.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const { fileName, inputRows, settings, results, summary } = body || {};
  if (!Array.isArray(inputRows) || !results || !summary) {
    return Response.json({ error: 'Dados do estudo incompletos.' }, { status: 400 });
  }

  const inserted = await sql`
    INSERT INTO capillarity_studies (client_id, file_name, input_rows, settings, results, summary)
    VALUES (
      ${clientId}, ${fileName || null},
      ${JSON.stringify(inputRows)}::jsonb, ${JSON.stringify(settings || {})}::jsonb,
      ${JSON.stringify(results)}::jsonb, ${JSON.stringify(summary)}::jsonb
    )
    RETURNING id, file_name, input_rows, settings, results, summary, created_at
  `;

  return Response.json({ study: inserted[0] }, { status: 201 });
}
