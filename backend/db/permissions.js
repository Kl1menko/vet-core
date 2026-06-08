/** Каталог permissions (ТЗ §7). code → людська назва. */
export const PERMISSIONS = [
  ['owners.view', 'Перегляд власників'],
  ['owners.create', 'Створення власників'],
  ['owners.edit', 'Редагування власників'],
  ['owners.delete', 'Видалення власників'],

  ['patients.view', 'Перегляд пацієнтів'],
  ['patients.create', 'Створення пацієнтів'],
  ['patients.edit', 'Редагування пацієнтів'],
  ['patients.delete', 'Видалення пацієнтів'],

  ['appointments.view', 'Перегляд прийомів'],
  ['appointments.create', 'Створення прийомів'],
  ['appointments.edit', 'Редагування прийомів'],
  ['appointments.complete', 'Завершення прийомів'],

  ['calendar.view', 'Перегляд календаря'],
  ['calendar.manage', 'Керування календарем'],

  ['warehouse.view', 'Перегляд складу'],
  ['warehouse.manage', 'Керування складом'],

  ['finance.view', 'Перегляд фінансів'],
  ['finance.manage', 'Керування фінансами'],

  ['reports.view', 'Перегляд звітів'],
  ['salary.view', 'Перегляд зарплат'],
  ['salary.manage', 'Керування зарплатами'],

  ['settings.view', 'Перегляд налаштувань'],
  ['settings.manage', 'Керування налаштуваннями'],

  ['staff.view', 'Перегляд співробітників'],
  ['staff.manage', 'Керування співробітниками'],
];

/** Системні ролі та їхні набори дозволів. */
export const SYSTEM_ROLES = {
  superadmin: { name: 'Суперадміністратор', permissions: '*' },
  owner: { name: 'Власник клініки', permissions: '*' },
  admin: {
    name: 'Адміністратор / реєстратор',
    permissions: [
      'owners.view', 'owners.create', 'owners.edit',
      'patients.view', 'patients.create', 'patients.edit',
      'appointments.view', 'appointments.create',
      'calendar.view', 'calendar.manage',
      'finance.view',
    ],
  },
  doctor: {
    name: 'Лікар',
    permissions: [
      'owners.view', 'patients.view', 'patients.edit',
      'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.complete',
      'calendar.view',
    ],
  },
  warehouse: {
    name: 'Працівник складу / аптеки',
    permissions: ['warehouse.view', 'warehouse.manage'],
  },
  accountant: {
    name: 'Бухгалтер',
    permissions: ['finance.view', 'finance.manage', 'reports.view', 'salary.view', 'salary.manage'],
  },
};
