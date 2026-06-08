import { pool, closePool, withTransaction } from '../src/config/database.js';
import { hashPassword } from '../src/config/auth.js';
import { env } from '../src/config/env.js';
import { PERMISSIONS, SYSTEM_ROLES } from '../db/permissions.js';

async function seed() {
  await withTransaction(async (c) => {
    // 1. Permissions (ідемпотентно)
    for (const [code, name] of PERMISSIONS) {
      await c.query(
        `INSERT INTO permissions (code, name) VALUES ($1,$2)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
        [code, name],
      );
    }

    // 2. Демо-клініка
    let clinicId = (
      await c.query(`SELECT id FROM clinics WHERE name = $1 LIMIT 1`, ['VetCore Демо'])
    ).rows[0]?.id;
    if (!clinicId) {
      clinicId = (
        await c.query(
          `INSERT INTO clinics (name, phone, email, address)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          ['VetCore Демо', '+380000000000', 'clinic@vetcore.local', 'м. Київ'],
        )
      ).rows[0].id;
    }

    // 2.1 Філія
    let branchId = (
      await c.query(`SELECT id FROM branches WHERE clinic_id = $1 LIMIT 1`, [clinicId])
    ).rows[0]?.id;
    if (!branchId) {
      branchId = (
        await c.query(
          `INSERT INTO branches (clinic_id, name, address) VALUES ($1,$2,$3) RETURNING id`,
          [clinicId, 'Головна філія', 'м. Київ'],
        )
      ).rows[0].id;
    }

    // 3. Системні ролі + role_permissions
    const allPerms = (await c.query(`SELECT id, code FROM permissions`)).rows;
    const permByCode = Object.fromEntries(allPerms.map((p) => [p.code, p.id]));
    const roleIds = {};

    for (const [code, def] of Object.entries(SYSTEM_ROLES)) {
      let roleId = (
        await c.query(`SELECT id FROM roles WHERE clinic_id = $1 AND code = $2`, [clinicId, code])
      ).rows[0]?.id;
      if (!roleId) {
        roleId = (
          await c.query(
            `INSERT INTO roles (clinic_id, name, code, is_system) VALUES ($1,$2,$3,true) RETURNING id`,
            [clinicId, def.name, code],
          )
        ).rows[0].id;
      }
      roleIds[code] = roleId;

      const codes = def.permissions === '*' ? allPerms.map((p) => p.code) : def.permissions;
      await c.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
      for (const pcode of codes) {
        if (permByCode[pcode]) {
          await c.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2)
             ON CONFLICT DO NOTHING`,
            [roleId, permByCode[pcode]],
          );
        }
      }
    }

    // 4. Адмін (власник клініки)
    const exists = (
      await c.query(`SELECT id FROM users WHERE email = $1`, [env.seed.adminEmail])
    ).rows[0];
    if (!exists) {
      const hash = await hashPassword(env.seed.adminPassword);
      await c.query(
        `INSERT INTO users (clinic_id, branch_id, first_name, last_name, email, password_hash, role_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [clinicId, branchId, 'Адмін', 'Клініки', env.seed.adminEmail, hash, roleIds.owner],
      );
      console.log(`[seed] адмін: ${env.seed.adminEmail} / ${env.seed.adminPassword}`);
    } else {
      console.log('[seed] адмін уже існує — пропускаю');
    }

    // 5. Кілька лікарів для календаря
    const doctorsCount = Number(
      (await c.query(`SELECT count(*) FROM users WHERE role_id = $1`, [roleIds.doctor])).rows[0].count,
    );
    if (doctorsCount === 0) {
      const hash = await hashPassword('doctor12345');
      for (const [fn, ln, em] of [
        ['Олена', 'Коваль', 'doctor1@vetcore.local'],
        ['Ігор', 'Шевченко', 'doctor2@vetcore.local'],
      ]) {
        await c.query(
          `INSERT INTO users (clinic_id, branch_id, first_name, last_name, email, password_hash, role_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO NOTHING`,
          [clinicId, branchId, fn, ln, em, hash, roleIds.doctor],
        );
      }
      console.log('[seed] додано 2 лікарів (пароль doctor12345)');
    }

    // 6. Демо прайс
    const svcCount = Number(
      (await c.query(`SELECT count(*) FROM services WHERE clinic_id = $1`, [clinicId])).rows[0].count,
    );
    if (svcCount === 0) {
      for (const [name, price, dur] of [
        ['Первинний огляд', 350, 30],
        ['Повторний огляд', 250, 20],
        ['УЗД черевної порожнини', 600, 30],
        ['Вакцинація комплексна', 450, 15],
      ]) {
        await c.query(
          `INSERT INTO services (clinic_id, name, price, duration_minutes) VALUES ($1,$2,$3,$4)`,
          [clinicId, name, price, dur],
        );
      }
      console.log('[seed] додано демо-прайс');
    }
  });

  console.log('[seed] готово.');
}

seed()
  .catch((err) => {
    console.error('[seed] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(closePool);
