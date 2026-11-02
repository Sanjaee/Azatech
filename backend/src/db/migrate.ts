import 'dotenv/config';
import path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env } from '../config/env';

export async function runMigrations(customDb?: ReturnType<typeof drizzle>): Promise<void> {
  const migrationsFolder = path.resolve(__dirname, './migrations');
  if (customDb) {
    await migrate(customDb, { migrationsFolder });
    return;
  }

  const connectionString = env.DIRECT_DATABASE_URL || env.DATABASE_URL;
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const migrationDb = drizzle(pool);
    console.log('Running PostgreSQL migrations...');
    await migrate(migrationDb, { migrationsFolder });
    console.log('Migrations completed successfully.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
