import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../db/schema.sql');

const DROP = process.argv.includes('--drop');

async function run() {
  if (DROP) {
    console.log('[migrate] DROP SCHEMA public CASCADE ...');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('[migrate] applying schema.sql ...');
  await pool.query(sql);
  console.log('[migrate] done.');
}

run()
  .catch((err) => {
    console.error('[migrate] FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(closePool);
