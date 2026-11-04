import { app } from './app';
import { env } from './config/env';
import { ensureDatabaseReady, closeDatabase } from './db/runtime';

async function startServer() {
  try {
    const { mode } = await ensureDatabaseReady({ seed: true });
    console.log(`[Azatech DB] Connected using mode: ${mode.toUpperCase()} (migrations & seed verified)`);
  } catch (err) {
    console.warn('[Azatech DB] Notice during ensureDatabaseReady:', err);
  }

  const server = app.listen(env.PORT, () => {
    console.log(
      `[Azatech API] Server running on http://localhost:${env.PORT} (${env.NODE_ENV})`
    );
  });

  process.on('SIGTERM', async () => {
    await closeDatabase();
    server.close(() => {
      process.exit(0);
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[Azatech API] Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
