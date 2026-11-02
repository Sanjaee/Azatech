import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import { Database, getDb, setDbOverride } from './index';
import { runSeed } from './seed';
import { env } from '../config/env';

let pgliteInstance: PGlite | null = null;
let initialized = false;

export async function canConnectToPostgres(connectionString: string): Promise<boolean> {
  const testPool = new Pool({
    connectionString,
    connectionTimeoutMillis: 1500,
    max: 1,
  });
  try {
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch {
    return false;
  } finally {
    await testPool.end().catch(() => {});
  }
}

export async function ensureDatabaseReady(options?: {
  forceInMemory?: boolean;
  seed?: boolean;
}): Promise<{ mode: 'postgres' | 'pglite'; db: Database }> {
  if (initialized && !options?.forceInMemory) {
    return { mode: pgliteInstance ? 'pglite' : 'postgres', db: getDb() };
  }

  const migrationsFolder = path.resolve(__dirname, './migrations');
  const useInMemory =
    options?.forceInMemory || !(await canConnectToPostgres(env.DATABASE_URL));

  if (!useInMemory) {
    const db = getDb();
    await migrateNodePg(db, { migrationsFolder });
    if (options?.seed) {
      await runSeed(db);
    }
    initialized = true;
    return { mode: 'postgres', db };
  }

  // Fallback to embedded PostgreSQL (PGlite WASM engine) for local/test environments without Docker running
  const dataDir =
    options?.forceInMemory || env.NODE_ENV === 'test'
      ? undefined
      : path.resolve(__dirname, '../../.pgdata');

  if (dataDir && !fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (pgliteInstance) {
    await pgliteInstance.close().catch(() => {});
  }

  pgliteInstance = new PGlite(dataDir);
  const pgDb = drizzlePglite(pgliteInstance, { schema });
  await migratePglite(pgDb, { migrationsFolder });

  const castedDb = pgDb as unknown as Database;
  setDbOverride(castedDb);

  if (options?.seed) {
    await runSeed(castedDb);
  }

  initialized = true;
  return { mode: 'pglite', db: castedDb };
}

export async function closeDatabase(): Promise<void> {
  if (pgliteInstance) {
    await pgliteInstance.close().catch(() => {});
    pgliteInstance = null;
  }
  setDbOverride(undefined);
  initialized = false;
}
