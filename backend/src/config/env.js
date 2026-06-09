import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .env у корені репозиторію
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,

  databaseUrl: process.env.DATABASE_URL || null,
  pg: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'vetcore',
    user: process.env.PGUSER || undefined,
    password: process.env.PGPASSWORD || undefined,
    ssl: process.env.PGSSL || process.env.POSTGRES_SSL || null,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '30d',
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@vetcore.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'admin12345',
  },
};

export const isProd = env.nodeEnv === 'production';
