import { app } from './app';
import { env } from './config/env';

if (require.main === module) {
  const server = app.listen(env.PORT, () => {
    console.log(
      `[Azatech API] Server running on http://localhost:${env.PORT} (${env.NODE_ENV})`
    );
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

export default app;
