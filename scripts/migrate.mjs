import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const match = envText.match(/^DATABASE_URL=(.*)$/m);
const databaseUrl = match[1].trim().replace(/^"(.*)"$/, '$1');

const sql = neon(databaseUrl);

await sql`
  CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS capillarity_studies (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    file_name TEXT,
    input_rows JSONB NOT NULL,
    settings JSONB NOT NULL,
    results JSONB NOT NULL,
    summary JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS capillarity_studies_client_id_idx
  ON capillarity_studies (client_id, created_at DESC)
`;

console.log('Migracao concluida.');
