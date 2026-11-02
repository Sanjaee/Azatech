import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { env } from '../config/env';

export type Database = NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __azatechPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __azatechDbOverride: Database | undefined;
}

export function getPool(): Pool {
  if (!global.__azatechPgPool) {
    const isSsl =
      env.DATABASE_URL.includes('neon.tech') ||
      env.DATABASE_URL.includes('sslmode=require');

    global.__azatechPgPool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      max: env.NODE_ENV === 'production' ? 5 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return global.__azatechPgPool;
}

export function getDb(): Database {
  if (global.__azatechDbOverride) {
    return global.__azatechDbOverride;
  }
  return drizzle(getPool(), { schema });
}

export function setDbOverride(customDb: Database | undefined): void {
  global.__azatechDbOverride = customDb;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const activeDb = getDb();
    const value = Reflect.get(activeDb, prop, receiver);
    return typeof value === 'function' ? value.bind(activeDb) : value;
  },
});

