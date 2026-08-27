// Phase 1.2 — shared Postgres pool. Uses node-postgres (pg) which is already
// a devDependency from Phase 1.1. Single process-wide pool; in dev hot-reload
// we re-use the existing instance on `globalThis` to avoid leaking sockets.

import pg from "pg";

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var __recap_pg_pool__: pg.Pool | undefined;
}

function getPool(): pg.Pool {
  if (globalThis.__recap_pg_pool__) return globalThis.__recap_pg_pool__;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString: url, max: 5 });
  globalThis.__recap_pg_pool__ = pool;
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}

export async function closePool(): Promise<void> {
  if (globalThis.__recap_pg_pool__) {
    await globalThis.__recap_pg_pool__.end();
    globalThis.__recap_pg_pool__ = undefined;
  }
}
