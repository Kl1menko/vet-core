import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// Гроші/numeric не парсимо у float — лишаємо рядком, де це важливо.
// pg type OID 1700 = NUMERIC.
pg.types.setTypeParser(1700, (val) => (val === null ? null : val));

const shouldUseSsl = env.pg.ssl
  ? !['0', 'false', 'disable'].includes(String(env.pg.ssl).toLowerCase())
  : Boolean(env.databaseUrl && env.nodeEnv === 'production');

const sslConfig = shouldUseSsl ? { rejectUnauthorized: false } : undefined;

const poolConfig = env.databaseUrl
  ? { connectionString: env.databaseUrl, ...(sslConfig ? { ssl: sslConfig } : {}) }
  : {
      host: env.pg.host,
      port: env.pg.port,
      database: env.pg.database,
      user: env.pg.user,
      password: env.pg.password,
      ...(sslConfig ? { ssl: sslConfig } : {}),
    };

export const pool = new Pool({
  ...poolConfig,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  // Помилка простоюючого клієнта — логуємо, не валимо процес.
  console.error('[db] unexpected idle client error', err);
});

/** Простий запит через пул. */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Виконати функцію в транзакції. cb отримує client із query().
 * Фінансові/складські операції зобов'язані йти через це (ТЗ §23.11).
 */
export async function withTransaction(cb) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await cb(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}
