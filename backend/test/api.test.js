// Базові регресійні тести API (node --test). Потребують запущеного сервера
// та налаштованої БД. Запуск: npm test (стартує сервер автоматично).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { pool, closePool } from '../src/config/database.js';
import { env } from '../src/config/env.js';

let server, base, token;
const created = { ownerIds: [], patientIds: [], drugIds: [], invoiceIds: [], apptIds: [], serviceIds: [] };

async function api(method, path, body, tok = token) {
  const resp = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, ...json };
}

before(async () => {
  const app = createApp();
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}/api`;
  const login = await api('POST', '/auth/login', { identifier: env.seed.adminEmail, password: env.seed.adminPassword });
  assert.equal(login.success, true, 'login має успіх');
  token = login.data.accessToken;
});

after(async () => {
  // прибрати створене
  const c = await pool.connect();
  try {
    for (const id of created.invoiceIds) {
      await c.query('DELETE FROM payments WHERE invoice_id=$1', [id]);
      await c.query('DELETE FROM debts WHERE invoice_id=$1', [id]);
      await c.query('DELETE FROM invoice_items WHERE invoice_id=$1', [id]);
      await c.query('DELETE FROM invoices WHERE id=$1', [id]);
    }
    for (const id of created.apptIds) {
      await c.query('DELETE FROM appointment_services WHERE appointment_id=$1', [id]);
      await c.query('DELETE FROM appointment_drugs WHERE appointment_id=$1', [id]);
      await c.query('DELETE FROM appointments WHERE id=$1', [id]);
    }
    for (const id of created.drugIds) {
      await c.query('DELETE FROM stock_movements WHERE drug_id=$1', [id]);
      await c.query('DELETE FROM stock_batches WHERE drug_id=$1', [id]);
      await c.query('DELETE FROM drugs WHERE id=$1', [id]);
    }
    for (const id of created.serviceIds) await c.query('DELETE FROM services WHERE id=$1', [id]);
    for (const id of created.patientIds) {
      await c.query('DELETE FROM reminders WHERE patient_id=$1', [id]);
      await c.query('DELETE FROM vaccinations WHERE patient_id=$1', [id]);
      await c.query('DELETE FROM patients WHERE id=$1', [id]);
    }
    for (const id of created.ownerIds) await c.query('DELETE FROM owners WHERE id=$1', [id]);
  } finally { c.release(); }
  await new Promise((r) => server.close(r));
  await closePool();
});

test('auth: невірний пароль → 401', async () => {
  const r = await api('POST', '/auth/login', { identifier: env.seed.adminEmail, password: 'wrong' });
  assert.equal(r.status, 401);
  assert.equal(r.success, false);
});

test('auth: /me повертає користувача', async () => {
  const r = await api('GET', '/auth/me');
  assert.equal(r.success, true);
  assert.equal(r.data.email, env.seed.adminEmail);
});

test('auth: запит без токена → 401', async () => {
  const r = await api('GET', '/owners', null, null);
  assert.equal(r.status, 401);
});

test('owners: створення з невалідним email → 422', async () => {
  const r = await api('POST', '/owners', { firstName: 'X', phone: '+380000000001', email: 'not-an-email' });
  assert.equal(r.status, 422);
  assert.ok(r.error.fields.email);
});

test('owners: CRUD', async () => {
  const create = await api('POST', '/owners', { firstName: 'Тест', lastName: 'Регрес', phone: '+380501234599' });
  assert.equal(create.status, 201);
  const id = create.data.id; created.ownerIds.push(id);

  const get = await api('GET', `/owners/${id}`);
  assert.equal(get.data.first_name, 'Тест');

  const upd = await api('PUT', `/owners/${id}`, { firstName: 'Тест2', phone: '+380501234599' });
  assert.equal(upd.data.first_name, 'Тест2');

  const list = await api('GET', '/owners?search=Регрес');
  assert.ok(list.data.items.some((o) => o.id === id));
});

test('patients: створення під власника', async () => {
  const owner = await api('POST', '/owners', { firstName: 'Влас', phone: '+380501234588' });
  created.ownerIds.push(owner.data.id);
  const pat = await api('POST', '/patients', { ownerId: owner.data.id, name: 'Мурчик', species: 'Кіт' });
  assert.equal(pat.status, 201);
  created.patientIds.push(pat.data.id);
  assert.equal(pat.data.name, 'Мурчик');
});

test('вакцинації: створення з нагадуванням → список → видалення', async () => {
  const owner = await api('POST', '/owners', { firstName: 'Вакц', phone: '+380501234511' });
  created.ownerIds.push(owner.data.id);
  const pat = await api('POST', '/patients', { ownerId: owner.data.id, name: 'Барсік', species: 'Кіт' });
  created.patientIds.push(pat.data.id);

  const next = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const v = await api('POST', '/vaccinations', {
    patientId: pat.data.id, vaccineName: 'Нобівак', vaccinationDate: '2026-01-10',
    nextVaccinationDate: next, manufacturer: 'MSD', batchNumber: 'B-42',
  });
  assert.equal(v.status, 201, 'вакцинацію створено');

  const list = await api('GET', `/vaccinations?patientId=${pat.data.id}`);
  assert.equal(list.success, true);
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].vaccine_name, 'Нобівак');

  // авто-нагадування створене (ТЗ §12.5)
  const { rows: rem } = await pool.query(
    `SELECT count(*) FROM reminders WHERE patient_id=$1 AND type='vaccination'`, [pat.data.id]);
  assert.equal(Number(rem[0].count), 1, 'нагадування про вакцинацію створено');

  const del = await api('DELETE', `/vaccinations/${v.data.id}`);
  assert.equal(del.success, true);
});

test('вакцинації: без обовʼязкових полів → 422', async () => {
  const r = await api('POST', '/vaccinations', { vaccineName: 'X' }); // без patientId і дати
  assert.equal(r.status, 422);
});

test('warehouse: прихід збільшує залишок, FEFO списання зменшує', async () => {
  const drug = await api('POST', '/drugs', { name: 'Тест-Препарат-Регрес', unit: 'мл', sellingPrice: 100, minStock: 2 });
  const did = drug.data.id; created.drugIds.push(did);

  await api('POST', '/warehouse/income', { drugId: did, quantity: 10, purchasePrice: 50 });
  let list = await api('GET', '/drugs?search=Тест-Препарат-Регрес');
  assert.equal(Number(list.data[0].stock_qty), 10);

  await api('POST', '/warehouse/write-off', { drugId: did, quantity: 4 });
  list = await api('GET', '/drugs?search=Тест-Препарат-Регрес');
  assert.equal(Number(list.data[0].stock_qty), 6);
});

test('warehouse: списання понад залишок → помилка', async () => {
  const drug = await api('POST', '/drugs', { name: 'Тест-Мало-Регрес', unit: 'шт' });
  created.drugIds.push(drug.data.id);
  await api('POST', '/warehouse/income', { drugId: drug.data.id, quantity: 2 });
  const r = await api('POST', '/warehouse/write-off', { drugId: drug.data.id, quantity: 5 });
  assert.equal(r.status, 400);
});

test('фінанси: рахунок → часткова оплата → борг', async () => {
  const owner = await api('POST', '/owners', { firstName: 'Платник', phone: '+380501234577' });
  created.ownerIds.push(owner.data.id);
  const inv = await api('POST', '/invoices', {
    ownerId: owner.data.id,
    items: [{ type: 'service', name: 'Огляд', quantity: 1, unitPrice: 500 }],
  });
  assert.equal(inv.status, 201);
  created.invoiceIds.push(inv.data.id);
  assert.equal(Number(inv.data.total), 500);

  const pay = await api('POST', `/invoices/${inv.data.id}/pay`, { amount: 200, method: 'cash' });
  assert.equal(pay.success, true);
  assert.equal(Number(pay.data.debt), 300);
  assert.equal(pay.data.status, 'partial');

  // переплата заборонена
  const over = await api('POST', `/invoices/${inv.data.id}/pay`, { amount: 9999, method: 'cash' });
  assert.equal(over.status, 400);
});

test('appointments: повний цикл start→complete формує рахунок', async () => {
  const owner = await api('POST', '/owners', { firstName: 'Прийом', phone: '+380501234566' });
  created.ownerIds.push(owner.data.id);
  const pat = await api('POST', '/patients', { ownerId: owner.data.id, name: 'Шарік' });
  created.patientIds.push(pat.data.id);
  const appt = await api('POST', '/appointments', { ownerId: owner.data.id, patientId: pat.data.id });
  created.apptIds.push(appt.data.id);

  await api('POST', `/appointments/${appt.data.id}/services`, { name: 'Консультація', price: 300, quantity: 1 });
  await api('POST', `/appointments/${appt.data.id}/start`);
  const done = await api('POST', `/appointments/${appt.data.id}/complete`);
  assert.equal(done.success, true);
  assert.ok(done.data.invoice, 'має сформуватися рахунок');
  assert.equal(Number(done.data.invoice.total), 300);
  created.invoiceIds.push(done.data.invoice.id);
});

test('права: перевірка permission працює (admin = owner role, повний доступ)', async () => {
  const r = await api('GET', '/reports/revenue');
  assert.equal(r.success, true);
});

test('клієнт: вхід за телефоном демо-кодом', async () => {
  // використовуємо щойно створеного власника-«Платник»
  const phone = '+380501234577';
  const login = await api('POST', '/client/login', { phone });
  assert.equal(login.success, true);
  const verify = await api('POST', '/client/verify', { phone, code: '0000' });
  assert.equal(verify.success, true);
  assert.ok(verify.data.accessToken);
  const pets = await api('GET', '/client/pets', null, verify.data.accessToken);
  assert.equal(pets.success, true);
});

test('відновлення пароля: forgot повертає токен (dev), reset змінює пароль', async () => {
  const forgot = await api('POST', '/auth/forgot-password', { email: env.seed.adminEmail });
  assert.equal(forgot.success, true);
  assert.ok(forgot.data.resetToken, 'у dev має бути resetToken');
  // змінюємо на той самий пароль, щоб не зламати інші тести/демо
  const reset = await api('POST', '/auth/reset-password', { token: forgot.data.resetToken, newPassword: env.seed.adminPassword });
  assert.equal(reset.success, true);
});

test('конструктор звітів: схема + run з групуванням і підсумками', async () => {
  const schema = await api('GET', '/reports/builder/schema');
  assert.equal(schema.success, true);
  assert.ok(schema.data.datasets.payments, 'є набір payments');
  assert.ok(schema.data.datasets.appointments.dimensions.doctor, 'є вимір doctor');

  const run = await api('POST', '/reports/builder/run', {
    dataset: 'appointments', dimensions: ['status'], measures: ['count'],
    orderBy: { key: 'count', dir: 'desc' },
  });
  assert.equal(run.success, true);
  assert.ok(Array.isArray(run.data.rows));
  assert.ok(run.data.columns.some((c) => c.key === 'count' && c.role === 'measure'));
  assert.ok('count' in run.data.totals, 'є підсумок по count');
});

test('конструктор звітів: відхиляє невідомі ключі та SQL-ін\'єкцію', async () => {
  const badDs = await api('POST', '/reports/builder/run', { dataset: 'x; DROP TABLE owners', measures: ['count'] });
  assert.equal(badDs.status, 422);

  const badDim = await api('POST', '/reports/builder/run', {
    dataset: 'payments', dimensions: ['method);--'], measures: ['count'],
  });
  assert.equal(badDim.status, 422);

  const noMeasure = await api('POST', '/reports/builder/run', { dataset: 'payments', dimensions: ['method'], measures: [] });
  assert.equal(noMeasure.status, 422);
});
