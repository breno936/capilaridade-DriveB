import { neon } from '@neondatabase/serverless';

let cachedSql = null;

export function getSql() {
  if (!cachedSql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL nao configurada.');
    }
    cachedSql = neon(process.env.DATABASE_URL);
  }
  return cachedSql;
}
