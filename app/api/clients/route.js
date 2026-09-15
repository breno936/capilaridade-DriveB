import { getSql } from '../../../lib/db';

export async function GET() {
  const sql = getSql();
  const clients = await sql`
    SELECT c.id, c.name, c.created_at,
      s.summary AS last_summary, s.created_at AS last_study_at
    FROM clients c
    LEFT JOIN LATERAL (
      SELECT summary, created_at FROM capillarity_studies
      WHERE client_id = c.id
      ORDER BY created_at DESC
      LIMIT 1
    ) s ON true
    ORDER BY c.name ASC
  `;
  return Response.json({ clients });
}

export async function POST(request) {
  const sql = getSql();
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) {
    return Response.json({ error: 'Nome do cliente e obrigatorio.' }, { status: 400 });
  }

  const existing = await sql`SELECT id, name, created_at FROM clients WHERE name = ${name}`;
  if (existing.length) {
    return Response.json({ client: existing[0] });
  }

  const inserted = await sql`
    INSERT INTO clients (name) VALUES (${name})
    RETURNING id, name, created_at
  `;
  return Response.json({ client: inserted[0] }, { status: 201 });
}
