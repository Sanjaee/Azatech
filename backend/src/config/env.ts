import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,https://azatech-web.vercel.app'),
  SEED_ADMIN_NAME: z.string().default('Azatech Administrator'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@azatech.id'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@Azatech2026!'),
});

const defaultTestEnv = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '4000',
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://azatech:azatech_password@localhost:5432/azatech_oms',
  DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
  JWT_SECRET:
    process.env.JWT_SECRET ||
    'azatech-dev-super-secret-jwt-key-change-in-production-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  CORS_ALLOWED_ORIGINS:
    process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,https://azatech-web.vercel.app',
  SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME || 'Azatech Administrator',
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || 'admin@azatech.id',
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || 'Admin@Azatech2026!',
};

// In production, require explicit DATABASE_URL and JWT_SECRET
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL) {
    throw new Error('FATAL: DATABASE_URL environment variable is required in production.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('FATAL: A strong JWT_SECRET (>= 32 chars) is required in production.');
  }
}

export const env = envSchema.parse(defaultTestEnv);

export const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
