import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { allowedOrigins } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { productsRouter } from './modules/products/products.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { sendSuccess } from './utils/response';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server requests (like Next.js BFF or Supertest) with no Origin header
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed by CORS policy'));
      },
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    sendSuccess(
      res,
      {
        status: 'healthy',
        service: 'azatech-backend-api',
        variant: 'C',
        timestamp: new Date().toISOString(),
      },
      'OK',
      200
    );
  });

  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/orders', ordersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
