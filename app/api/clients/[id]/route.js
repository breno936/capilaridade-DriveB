import { getSql } from '../../../../lib/db';

export async function GET(request, { params }) {
  const sql = getSql();
  const clientId = Number(params.id);
  if (!Number.isInteger(clientId)) {
    return Response.json({ error: 'Cliente invalido.' }, { status: 400 });
  }

  const clientRows = await sql`SELECT id, name, created_at FROM clients WHERE id = ${clientId}`;
  if (!clientRows.length) {
    return Response.json({ error: 'Cliente nao encontrado.' }, { status: 404 });
  }

  const studies = await sql`
    SELECT id, file_name, input_rows, settings, results, summary, created_at
    FROM capillarity_studies
    WHERE client_id = ${clientId}
    ORDER BY created_at DESC
  `;

  return Response.json({ client: clientRows[0], studies });
}
