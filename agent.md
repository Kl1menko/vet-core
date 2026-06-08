# AGENT.md

## Проєкт npm install && npm run db:migrate && npm run db:seed && npm start


Розробити вебзастосунок для автоматизації роботи ветеринарної клініки, приватного ветеринара, ветеринарної аптеки, зоомагазину або грумінг-салону.

Frontend потрібно писати на **чистому JavaScript**, без React, Vue, Angular, Svelte або jQuery як основи застосунку.

Система має реалізовувати функціонал CRM/ERP для ветеринарного бізнесу:

- облік власників тварин;
- облік пацієнтів;
- електронні медичні картки;
- календар записів;
- регістратуру;
- прийоми лікарів;
- вакцинації;
- процедури та маніпуляції;
- діагнози;
- рекомендації;
- файли та аналізи;
- прайс-лист;
- аптеку;
- склад;
- постачальників;
- продажі;
- касу;
- рахунки;
- оплати;
- борги;
- фінансову статистику;
- зарплати співробітників;
- нагадування;
- ролі та права доступу;
- клієнтський кабінет власника тварини;
- дисконтні карти;
- філії;
- audit log;
- імпорт та експорт;
- базову offline-поведінку.

---

# 1. Технологічні вимоги

## 1.1. Frontend

Використовувати:

- HTML5;
- CSS3;
- Vanilla JavaScript;
- ES6 modules;
- Fetch API;
- DOM API;
- Custom Events;
- LocalStorage;
- SessionStorage;
- IndexedDB за потреби;
- History API;
- CSS Grid;
- Flexbox;
- native drag-and-drop;
- Service Worker за потреби;
- WebSocket за потреби.

Заборонено:

- React;
- Vue;
- Angular;
- Svelte;
- jQuery як основа застосунку;
- генерація UI через сторонній SPA-фреймворк.

Допускаються точкові бібліотеки за потреби:

- календар;
- PDF;
- XLSX/CSV;
- графіки;
- маски вводу;
- друк;
- робота з файлами.

## 1.2. Backend

Рекомендовано:

- Node.js;
- Express або Fastify;
- PostgreSQL;
- JWT;
- REST API;
- WebSocket для real-time;
- файлове сховище локальне або S3-compatible;
- транзакції для фінансів і складу.

## 1.3. База даних

Рекомендована СУБД: **PostgreSQL**.

Причини:

- багато реляційних зв’язків;
- складська логіка;
- фінансові транзакції;
- звіти;
- ролі та права;
- JSONB для налаштувань;
- audit log.

---

# 2. Архітектура frontend

Рекомендована структура:

```text
/frontend
  index.html
  /assets
    /icons
    /images
  /css
    reset.css
    variables.css
    layout.css
    components.css
    pages.css
  /js
    app.js
    router.js
    api.js
    auth.js
    store.js
    permissions.js

    /components
      modal.js
      table.js
      form.js
      calendar.js
      toast.js
      dropdown.js
      tabs.js
      pagination.js
      fileUploader.js
      searchSelect.js
      sidebar.js
      header.js

    /pages
      loginPage.js
      dashboardPage.js
      ownersPage.js
      ownerProfilePage.js
      patientsPage.js
      patientProfilePage.js
      calendarPage.js
      receptionPage.js
      appointmentPage.js
      pharmacyPage.js
      warehousePage.js
      suppliersPage.js
      pricePage.js
      invoicesPage.js
      reportsPage.js
      salaryPage.js
      remindersPage.js
      staffPage.js
      settingsPage.js
      clientPortalPage.js

    /services
      ownerService.js
      patientService.js
      appointmentService.js
      calendarService.js
      drugService.js
      warehouseService.js
      supplierService.js
      invoiceService.js
      reportService.js
      salaryService.js
      notificationService.js
      templateService.js

    /utils
      date.js
      validators.js
      formatters.js
      masks.js
      storage.js
      printer.js
```

---

# 3. Архітектура backend

```text
/backend
  /src
    /config
      database.js
      auth.js
      storage.js

    /middlewares
      authMiddleware.js
      permissionMiddleware.js
      errorMiddleware.js
      validationMiddleware.js

    /modules
      /auth
        auth.routes.js
        auth.controller.js
        auth.service.js
      /clinics
      /branches
      /users
      /roles
      /owners
      /patients
      /calendar
      /appointments
      /vaccinations
      /files
      /services
      /drugs
      /warehouse
      /suppliers
      /invoices
      /payments
      /debts
      /reports
      /salary
      /reminders
      /templates
      /client
      /settings
      /audit

    /utils
      generateId.js
      validate.js
      auditLog.js
      pagination.js
      date.js

    app.js
    server.js
```

---

# 4. Ролі користувачів

## 4.1. Суперадміністратор

Має доступ до всіх клінік, тарифів, оплат, логів і технічних налаштувань.

Права:

- створення клінік;
- блокування клінік;
- перегляд тарифів;
- керування оплатами;
- перегляд логів;
- технічна підтримка;
- глобальні налаштування.

## 4.2. Власник клініки

Має повний доступ у межах своєї клініки або мережі.

Права:

- керування співробітниками;
- перегляд фінансів;
- перегляд статистики;
- налаштування зарплат;
- керування складом;
- керування прайсом;
- налаштування шаблонів;
- перегляд усіх прийомів;
- експорт даних;
- налаштування клініки.

## 4.3. Адміністратор / реєстратор

Права:

- створення власників;
- створення пацієнтів;
- запис на прийом;
- редагування календаря;
- перегляд графіка лікарів;
- створення рахунків;
- прийом оплат;
- друк чеків;
- перегляд базової інформації пацієнта;
- робота з чергою.

Обмеження:

- не бачить повну фінансову аналітику;
- не змінює зарплати;
- не видаляє критичні медичні записи без дозволу.

## 4.4. Лікар

Права:

- перегляд власних прийомів;
- створення та редагування прийому;
- додавання діагнозів;
- додавання процедур;
- додавання рекомендацій;
- призначення вакцинацій;
- завантаження файлів;
- перегляд медичної історії пацієнта;
- створення наступного візиту.

## 4.5. Працівник складу / аптеки

Права:

- перегляд препаратів;
- додавання препаратів;
- редагування залишків;
- прихід товару;
- списання товару;
- продаж товару;
- робота з постачальниками;
- контроль термінів придатності.

## 4.6. Бухгалтер

Права:

- фінансові звіти;
- касові операції;
- боржники;
- зарплати;
- експорт звітів;
- перегляд платежів.

## 4.7. Власник тварини

Права у клієнтському кабінеті:

- перегляд своїх тварин;
- перегляд медичної картки;
- перегляд рекомендацій лікаря;
- перегляд вакцинацій;
- перегляд майбутніх прийомів;
- перегляд рахунків;
- отримання нагадувань;
- перегляд файлів та аналізів;
- запис на прийом, якщо функція ввімкнена.

---

# 5. Основні сторінки системи

```text
/login
/forgot-password
/reset-password
/profile
/dashboard
/owners
/owners/:id
/patients
/patients/:id
/calendar
/reception
/appointments/:id
/pharmacy
/warehouse
/suppliers
/price
/invoices
/reports
/salary
/reminders
/staff
/settings
/settings/templates
/settings/roles
/settings/clinic
/client
/client/pets
/client/pets/:id
/client/appointments
/client/invoices
/client/discount-card
```

---

# 6. Основні модулі

## 6.1. Авторизація

Функціонал:

- вхід за email/телефоном і паролем;
- вихід;
- відновлення пароля;
- зміна пароля;
- оновлення токена;
- перевірка ролі;
- перевірка permissions;
- автоматичний logout після завершення сесії;
- збереження токена в localStorage або sessionStorage.

Модель користувача:

```js
User {
  id: string,
  clinicId: string,
  branchId: string,
  firstName: string,
  lastName: string,
  middleName: string,
  phone: string,
  email: string,
  role: string,
  permissions: string[],
  isActive: boolean,
  createdAt: string,
  updatedAt: string
}
```

## 6.2. Dashboard

Показувати:

- кількість прийомів на сьогодні;
- кількість нових клієнтів;
- кількість активних пацієнтів;
- поточну виручку за день;
- майбутні записи;
- прострочені вакцинації;
- препарати з малим залишком;
- препарати з наближенням терміну придатності;
- боржників;
- завантаження лікарів;
- швидкі кнопки створення.

## 6.3. Власники тварин

Функції:

- таблиця власників;
- пошук;
- фільтрація;
- сортування;
- пагінація;
- створення;
- редагування;
- архівація;
- перегляд тварин;
- швидкий запис на прийом;
- швидкий дзвінок;
- історія відвідувань.

Пошук за:

- телефоном;
- іменем;
- прізвищем;
- email;
- кличкою тварини;
- ID тварини.

Модель:

```js
Owner {
  id: string,
  clinicId: string,
  firstName: string,
  lastName: string,
  middleName: string,
  phone: string,
  secondaryPhone: string,
  email: string,
  address: string,
  comment: string,
  discountPercent: number,
  balance: number,
  isDebtor: boolean,
  animals: Patient[],
  createdAt: string,
  updatedAt: string
}
```

## 6.4. Пацієнти

Функції:

- таблиця пацієнтів;
- пошук;
- фільтрація;
- сортування;
- створення;
- редагування;
- архівація;
- перегляд картки;
- швидкий запис;
- вакцинація;
- історія.

Модель:

```js
Patient {
  id: string,
  clinicId: string,
  ownerId: string,
  name: string,
  photoUrl: string,
  species: string,
  breed: string,
  color: string,
  sex: 'male' | 'female' | 'unknown',
  isSterilized: boolean,
  birthDate: string,
  age: string,
  weight: number,
  chipNumber: string,
  passportNumber: string,
  notes: string,
  status: 'active' | 'archived' | 'deceased',
  createdAt: string,
  updatedAt: string
}
```

Вкладки картки пацієнта:

1. Загальна інформація.
2. Історія прийомів.
3. Вакцинації.
4. Аналізи.
5. Файли.
6. Рахунки.
7. Нагадування.
8. Примітки.

## 6.5. Календар

Режими:

- день;
- тиждень;
- місяць;
- список;
- розклад конкретного лікаря;
- розклад усіх лікарів.

Модель:

```js
CalendarEvent {
  id: string,
  clinicId: string,
  branchId: string,
  patientId: string,
  ownerId: string,
  doctorId: string,
  appointmentId: string,
  title: string,
  type: 'appointment' | 'note' | 'vaccination' | 'procedure' | 'reminder',
  status: 'planned' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show',
  startAt: string,
  endAt: string,
  comment: string,
  color: string,
  createdBy: string,
  createdAt: string,
  updatedAt: string
}
```

Функції:

- створення події;
- редагування;
- видалення;
- клонування;
- drag-and-drop;
- зміна тривалості;
- фільтр за лікарем;
- фільтр за типом;
- фільтр за статусом;
- створення пацієнта з календаря;
- створення власника;
- прив’язка до прийому;
- нагадування;
- кольорове маркування;
- друк розкладу;
- перегляд завантаженості.

Бізнес-правила:

- не можна створити прийом без власника;
- пацієнт може бути доданий пізніше;
- не можна створювати два прийоми одному лікарю на один і той самий час, якщо паралельні прийоми не дозволені;
- подія типу note може не мати пацієнта;
- завершений прийом не можна редагувати без спеціального права.

## 6.6. Регістратура

Функції:

- перегляд записів на сьогодні;
- сортування за часом;
- пошук клієнта;
- створення клієнта;
- створення пацієнта;
- запис на прийом;
- зміна статусу прийому;
- позначка «клієнт прийшов»;
- передача пацієнта лікарю;
- створення рахунку;
- прийом оплати;
- друк чека;
- перегляд боргу клієнта;
- перегляд майбутніх записів;
- швидке додавання коментаря.

## 6.7. Прийом лікаря

Модель:

```js
Appointment {
  id: string,
  clinicId: string,
  branchId: string,
  patientId: string,
  ownerId: string,
  doctorId: string,
  calendarEventId: string,
  status: 'draft' | 'planned' | 'in_progress' | 'completed' | 'cancelled',
  reason: string,
  anamnesis: string,
  symptoms: string,
  diagnosis: string,
  treatment: string,
  recommendations: string,
  nextVisitAt: string,
  weight: number,
  temperature: number,
  startedAt: string,
  completedAt: string,
  createdAt: string,
  updatedAt: string
}
```

Функції:

- почати прийом;
- завершити прийом;
- зберегти чернетку;
- додати скарги;
- додати анамнез;
- додати симптоми;
- додати діагноз;
- додати лікування;
- додати рекомендації;
- додати процедури;
- додати препарати;
- додати вакцинацію;
- додати файли;
- додати аналізи;
- створити рахунок;
- створити наступний візит;
- роздрукувати висновок;
- надіслати рекомендації клієнту;
- використовувати шаблони.

Спільний прийом:

```js
AppointmentDoctor {
  id: string,
  appointmentId: string,
  doctorId: string,
  role: 'main' | 'assistant' | 'consultant',
  salaryPercent: number
}
```

## 6.8. Інші модулі

Система також повинна включати:

- шаблони прийомів, діагнозів, процедур, вакцинацій, рекомендацій, аналізів, повідомлень, рахунків і документів;
- вакцинації з автоматичними нагадуваннями;
- файли та аналізи з preview і контролем типу/розміру;
- прайс-лист послуг;
- аптеку і препарати;
- склад з партіями, рухами, списанням і контролем терміну придатності;
- постачальників;
- рахунки, оплати, повернення, борги;
- касовий модуль і друк чеків;
- фінансові, складські та лікарські звіти;
- зарплати;
- клієнтський кабінет;
- дисконтні карти;
- філії;
- налаштування клініки.

---

# 7. Права доступу

Приклади permissions:

```js
permissions = [
  'owners.view',
  'owners.create',
  'owners.edit',
  'owners.delete',

  'patients.view',
  'patients.create',
  'patients.edit',
  'patients.delete',

  'appointments.view',
  'appointments.create',
  'appointments.edit',
  'appointments.complete',

  'calendar.view',
  'calendar.manage',

  'warehouse.view',
  'warehouse.manage',

  'finance.view',
  'finance.manage',

  'reports.view',
  'salary.view',
  'salary.manage',

  'settings.view',
  'settings.manage'
]
```

Frontend має приховувати недоступні кнопки та сторінки.

Backend має завжди повторно перевіряти права.

---

# 8. Глобальний пошук

Пошук має знаходити:

- власників;
- пацієнтів;
- телефони;
- прийоми;
- рахунки;
- препарати;
- послуги.

Вимоги:

- debounce 300 мс;
- мінімум 2 символи;
- групування результатів;
- клік відкриває картку;
- клавіатурна навігація.

---

# 9. База даних

Усі основні таблиці повинні мати:

```sql
id UUID PRIMARY KEY,
clinic_id UUID,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
deleted_at TIMESTAMP NULL
```

Медичні, фінансові та складські записи не видаляти фізично. Використовувати soft delete.

## 9.1. Основні таблиці

```sql
CREATE TABLE clinics (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  timezone VARCHAR(100) DEFAULT 'Europe/Kyiv',
  currency VARCHAR(10) DEFAULT 'UAH',
  language VARCHAR(10) DEFAULT 'uk',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE branches (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  working_hours JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  clinic_id UUID REFERENCES clinics(id),
  branch_id UUID REFERENCES branches(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  role_id UUID,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE roles (
  id UUID PRIMARY KEY,
  clinic_id UUID REFERENCES clinics(id),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id)
);
```

## 9.2. CRM і пацієнти

```sql
CREATE TABLE owners (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  middle_name VARCHAR(100),
  phone VARCHAR(50) NOT NULL,
  secondary_phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  comment TEXT,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  balance NUMERIC(12,2) DEFAULT 0,
  is_debtor BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_owners_clinic_id ON owners(clinic_id);
CREATE INDEX idx_owners_phone ON owners(phone);
CREATE INDEX idx_owners_name ON owners(first_name, last_name);

CREATE TABLE patients (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  owner_id UUID NOT NULL REFERENCES owners(id),
  name VARCHAR(100) NOT NULL,
  photo_url TEXT,
  species VARCHAR(100),
  breed VARCHAR(100),
  color VARCHAR(100),
  sex VARCHAR(20) CHECK (sex IN ('male', 'female', 'unknown')),
  is_sterilized BOOLEAN DEFAULT false,
  birth_date DATE,
  weight NUMERIC(8,3),
  chip_number VARCHAR(100),
  passport_number VARCHAR(100),
  notes TEXT,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX idx_patients_owner_id ON patients(owner_id);
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_patients_chip_number ON patients(chip_number);
```

## 9.3. Календар і прийоми

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  branch_id UUID REFERENCES branches(id),
  owner_id UUID REFERENCES owners(id),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES users(id),
  appointment_id UUID,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'planned',
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  comment TEXT,
  color VARCHAR(20),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  branch_id UUID REFERENCES branches(id),
  owner_id UUID NOT NULL REFERENCES owners(id),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID REFERENCES users(id),
  calendar_event_id UUID REFERENCES calendar_events(id),
  status VARCHAR(50) DEFAULT 'draft',
  reason TEXT,
  anamnesis TEXT,
  symptoms TEXT,
  diagnosis TEXT,
  treatment TEXT,
  recommendations TEXT,
  weight NUMERIC(8,3),
  temperature NUMERIC(5,2),
  next_visit_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE appointment_doctors (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  doctor_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(50) DEFAULT 'main',
  salary_percent NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointment_services (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  service_id UUID NOT NULL,
  doctor_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  price NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointment_drugs (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  drug_id UUID NOT NULL,
  batch_id UUID,
  name VARCHAR(255) NOT NULL,
  quantity NUMERIC(10,3) NOT NULL,
  unit VARCHAR(50),
  price NUMERIC(12,2),
  total NUMERIC(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 9.4. Медичні дані, прайс, склад, фінанси

```sql
CREATE TABLE vaccinations (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  doctor_id UUID REFERENCES users(id),
  vaccine_name VARCHAR(255) NOT NULL,
  batch_number VARCHAR(100),
  manufacturer VARCHAR(255),
  vaccination_date DATE NOT NULL,
  next_vaccination_date DATE,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE files (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  owner_id UUID REFERENCES owners(id),
  patient_id UUID REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  file_url TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'other',
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE service_categories (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  name VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  category_id UUID REFERENCES service_categories(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2) DEFAULT 0,
  duration_minutes INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE drug_categories (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE drugs (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  category_id UUID REFERENCES drug_categories(id),
  name VARCHAR(255) NOT NULL,
  active_substance VARCHAR(255),
  manufacturer VARCHAR(255),
  barcode VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_price NUMERIC(12,2) DEFAULT 0,
  min_stock NUMERIC(12,3) DEFAULT 0,
  is_prescription_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  comment TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE stock_batches (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  branch_id UUID REFERENCES branches(id),
  drug_id UUID NOT NULL REFERENCES drugs(id),
  supplier_id UUID REFERENCES suppliers(id),
  batch_number VARCHAR(100),
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  initial_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit VARCHAR(50),
  purchase_price NUMERIC(12,2),
  selling_price NUMERIC(12,2),
  expiration_date DATE,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  branch_id UUID REFERENCES branches(id),
  drug_id UUID NOT NULL REFERENCES drugs(id),
  batch_id UUID REFERENCES stock_batches(id),
  type VARCHAR(50) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  reason TEXT,
  related_appointment_id UUID REFERENCES appointments(id),
  related_invoice_id UUID,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  branch_id UUID REFERENCES branches(id),
  owner_id UUID NOT NULL REFERENCES owners(id),
  patient_id UUID REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  status VARCHAR(50) DEFAULT 'draft',
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  debt_amount NUMERIC(12,2) DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  type VARCHAR(50) NOT NULL,
  item_id UUID,
  name VARCHAR(255) NOT NULL,
  quantity NUMERIC(12,3) DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  branch_id UUID REFERENCES branches(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  owner_id UUID NOT NULL REFERENCES owners(id),
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'completed',
  fiscal_receipt_id VARCHAR(255),
  comment TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 9.5. Додаткові таблиці

```sql
CREATE TABLE debts (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  owner_id UUID NOT NULL REFERENCES owners(id),
  invoice_id UUID REFERENCES invoices(id),
  amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  due_date DATE,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reminders (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  owner_id UUID REFERENCES owners(id),
  patient_id UUID REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  type VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  message TEXT,
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE templates (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE salary_rules (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  fixed_amount NUMERIC(12,2) DEFAULT 0,
  service_percent NUMERIC(5,2) DEFAULT 0,
  drug_percent NUMERIC(5,2) DEFAULT 0,
  profit_percent NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE salary_payments (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  user_id UUID NOT NULL REFERENCES users(id),
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  details JSONB,
  status VARCHAR(50) DEFAULT 'calculated',
  paid_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE discount_cards (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  owner_id UUID NOT NULL REFERENCES owners(id),
  card_number VARCHAR(100) UNIQUE NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  bonus_balance NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bonus_transactions (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  discount_card_id UUID NOT NULL REFERENCES discount_cards(id),
  invoice_id UUID REFERENCES invoices(id),
  type VARCHAR(50) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  clinic_id UUID REFERENCES clinics(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clinic_settings (
  id UUID PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  key VARCHAR(100) NOT NULL,
  value JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 10. API

Base URL:

```text
/api
```

Усі запити, крім auth, мають містити:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Успішна відповідь:

```json
{
  "success": true,
  "data": {},
  "message": "OK"
}
```

Помилка:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Помилка валідації",
    "fields": {}
  }
}
```

## 10.1. Endpoints

```http
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me

GET    /api/owners
POST   /api/owners
GET    /api/owners/:id
PUT    /api/owners/:id
DELETE /api/owners/:id

GET    /api/patients
POST   /api/patients
GET    /api/patients/:id
PUT    /api/patients/:id
DELETE /api/patients/:id

GET    /api/calendar/events
POST   /api/calendar/events
GET    /api/calendar/events/:id
PUT    /api/calendar/events/:id
DELETE /api/calendar/events/:id
POST   /api/calendar/events/:id/clone

GET    /api/appointments
POST   /api/appointments
GET    /api/appointments/:id
PUT    /api/appointments/:id
POST   /api/appointments/:id/start
POST   /api/appointments/:id/complete
POST   /api/appointments/:id/cancel
POST   /api/appointments/:id/services
DELETE /api/appointments/:id/services/:serviceItemId
POST   /api/appointments/:id/drugs

GET    /api/vaccinations
POST   /api/vaccinations
PUT    /api/vaccinations/:id
DELETE /api/vaccinations/:id

POST   /api/files/upload
GET    /api/files
DELETE /api/files/:id

GET    /api/services
POST   /api/services
GET    /api/services/:id
PUT    /api/services/:id
DELETE /api/services/:id

GET    /api/drugs
POST   /api/drugs
GET    /api/drugs/:id
PUT    /api/drugs/:id
DELETE /api/drugs/:id

GET  /api/warehouse/stock
POST /api/warehouse/income
POST /api/warehouse/write-off
POST /api/warehouse/correction
GET  /api/warehouse/movements

GET    /api/suppliers
POST   /api/suppliers
GET    /api/suppliers/:id
PUT    /api/suppliers/:id
DELETE /api/suppliers/:id

GET  /api/invoices
POST /api/invoices
GET  /api/invoices/:id
PUT  /api/invoices/:id
POST /api/invoices/:id/pay
POST /api/invoices/:id/refund

GET /api/reports/revenue
GET /api/reports/profit
GET /api/reports/doctors
GET /api/reports/warehouse
GET /api/reports/debtors
GET /api/reports/services
GET /api/reports/drugs

GET  /api/salary/rules
POST /api/salary/rules
PUT  /api/salary/rules/:id
POST /api/salary/calculate
POST /api/salary/payments

GET  /api/reminders
POST /api/reminders
GET  /api/reminders/:id
PUT  /api/reminders/:id
POST /api/reminders/:id/send
POST /api/reminders/:id/cancel

GET    /api/templates
POST   /api/templates
GET    /api/templates/:id
PUT    /api/templates/:id
DELETE /api/templates/:id

POST /api/client/login
POST /api/client/verify
GET  /api/client/pets
GET  /api/client/pets/:id
GET  /api/client/appointments
GET  /api/client/invoices
GET  /api/client/discount-card

GET /api/settings
PUT /api/settings
```

---

# 11. Frontend Vanilla JS patterns

## 11.1. Router

```js
const routes = {
  '/dashboard': renderDashboardPage,
  '/owners': renderOwnersPage,
  '/patients': renderPatientsPage,
  '/calendar': renderCalendarPage,
  '/reception': renderReceptionPage,
  '/reports': renderReportsPage,
  '/settings': renderSettingsPage
};

function navigate(path) {
  history.pushState({}, '', path);
  renderRoute(path);
}

function renderRoute(path) {
  const app = document.querySelector('#app');
  app.innerHTML = '';

  const page = routes[path] || renderNotFoundPage;
  page(app);
}

window.addEventListener('popstate', () => {
  renderRoute(location.pathname);
});
```

## 11.2. Store

```js
const Store = {
  state: {
    user: null,
    clinic: null,
    notifications: [],
    selectedDate: new Date()
  },

  set(key, value) {
    this.state[key] = value;
    document.dispatchEvent(new CustomEvent('state:update', {
      detail: { key, value }
    }));
  },

  get(key) {
    return this.state[key];
  }
};
```

## 11.3. API wrapper

```js
const API_BASE_URL = '/api';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('accessToken');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw result.error || new Error('API request failed');
  }

  return result.data;
}

const Api = {
  get(endpoint) {
    return apiRequest(endpoint, { method: 'GET' });
  },

  post(endpoint, data) {
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  put(endpoint, data) {
    return apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(endpoint) {
    return apiRequest(endpoint, { method: 'DELETE' });
  }
};
```

## 11.4. Services examples

```js
const OwnerService = {
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return Api.get(`/owners?${query}`);
  },
  getById(id) {
    return Api.get(`/owners/${id}`);
  },
  create(data) {
    return Api.post('/owners', data);
  },
  update(id, data) {
    return Api.put(`/owners/${id}`, data);
  },
  remove(id) {
    return Api.delete(`/owners/${id}`);
  }
};

const PatientService = {
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return Api.get(`/patients?${query}`);
  },
  getById(id) {
    return Api.get(`/patients/${id}`);
  },
  create(data) {
    return Api.post('/patients', data);
  },
  update(id, data) {
    return Api.put(`/patients/${id}`, data);
  },
  remove(id) {
    return Api.delete(`/patients/${id}`);
  }
};

const CalendarService = {
  getEvents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return Api.get(`/calendar/events?${query}`);
  },
  createEvent(data) {
    return Api.post('/calendar/events', data);
  },
  updateEvent(id, data) {
    return Api.put(`/calendar/events/${id}`, data);
  },
  deleteEvent(id) {
    return Api.delete(`/calendar/events/${id}`);
  },
  cloneEvent(id) {
    return Api.post(`/calendar/events/${id}/clone`, {});
  }
};

const AppointmentService = {
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return Api.get(`/appointments?${query}`);
  },
  getById(id) {
    return Api.get(`/appointments/${id}`);
  },
  create(data) {
    return Api.post('/appointments', data);
  },
  update(id, data) {
    return Api.put(`/appointments/${id}`, data);
  },
  start(id) {
    return Api.post(`/appointments/${id}/start`, {});
  },
  complete(id, data) {
    return Api.post(`/appointments/${id}/complete`, data);
  },
  cancel(id, data = {}) {
    return Api.post(`/appointments/${id}/cancel`, data);
  },
  addService(id, data) {
    return Api.post(`/appointments/${id}/services`, data);
  },
  addDrug(id, data) {
    return Api.post(`/appointments/${id}/drugs`, data);
  }
};
```

---

# 12. Бізнес-сценарії

## 12.1. Новий клієнт записується на прийом

1. Адміністратор відкриває календар.
2. Натискає «Новий запис».
3. Шукає власника за телефоном.
4. Якщо власника немає — створює нового.
5. Додає тварину або залишає поле порожнім.
6. Обирає лікаря.
7. Обирає дату й час.
8. Вказує причину звернення.
9. Зберігає запис.
10. Система створює подію в календарі.
11. Система створює прийом.
12. Система створює нагадування клієнту.

## 12.2. Лікар проводить прийом

1. Лікар відкриває список прийомів.
2. Натискає на потрібний прийом.
3. Натискає «Почати прийом».
4. Заповнює анамнез.
5. Додає симптоми.
6. Додає діагноз.
7. Додає процедури.
8. Додає препарати.
9. Система списує препарати зі складу.
10. Лікар додає рекомендації.
11. Створює наступний візит.
12. Завершує прийом.
13. Система формує рахунок.
14. Клієнт отримує рекомендації в кабінеті.

## 12.3. Оплата в касі

1. Адміністратор відкриває рахунок.
2. Перевіряє послуги та товари.
3. Додає знижку, якщо потрібно.
4. Обирає спосіб оплати.
5. Приймає оплату.
6. Система змінює статус рахунку.
7. Система друкує чек.
8. Система оновлює фінансову статистику.
9. Якщо оплата часткова — створюється борг.

## 12.4. Прихід товару на склад

1. Працівник складу відкриває модуль складу.
2. Натискає «Новий прихід».
3. Обирає постачальника.
4. Додає препарат.
5. Вказує партію.
6. Вказує кількість.
7. Вказує закупівельну ціну.
8. Вказує термін придатності.
9. Зберігає.
10. Система оновлює залишки.
11. Система створює складський рух.

## 12.5. Автоматичне нагадування про вакцинацію

1. Лікар додає вакцинацію.
2. Вказує дату наступної вакцинації.
3. Система створює нагадування.
4. За заданий час до дати система надсилає повідомлення.
5. У клієнтському кабінеті з’являється нагадування.

---

# 13. Критичні бізнес-правила

## 13.1. Створення запису

Backend повинен:

1. перевірити права користувача;
2. перевірити існування власника;
3. перевірити доступність лікаря;
4. створити calendar_event;
5. створити appointment;
6. зв’язати їх;
7. створити reminder;
8. записати audit log.

## 13.2. Завершення прийому

Backend повинен:

1. змінити appointment.status на completed;
2. змінити calendar_event.status на completed;
3. додати послуги до рахунку;
4. додати препарати до рахунку;
5. списати препарати зі складу;
6. створити або оновити invoice;
7. створити вакцинації;
8. створити нагадування;
9. зробити рекомендації доступними клієнту;
10. записати audit log.

## 13.3. Оплата рахунку

Backend повинен:

1. створити payment;
2. оновити paid_amount;
3. оновити debt_amount;
4. змінити статус рахунку;
5. оновити баланс власника;
6. створити борг, якщо оплата часткова;
7. надрукувати чек, якщо ввімкнено;
8. записати audit log.

## 13.4. Списання препарату

Backend повинен:

1. перевірити залишок;
2. вибрати партію з найближчим терміном придатності;
3. зменшити залишок у stock_batches;
4. створити stock_movement;
5. створити internal notification, якщо залишок нижче мінімального;
6. заборонити продаж простроченого препарату без спеціального права.

---

# 14. Безпека

Система повинна мати:

- HTTPS;
- JWT або session auth;
- ролі;
- permissions;
- захист від XSS;
- захист від CSRF, якщо cookies;
- frontend і backend валідацію;
- логування критичних дій;
- захист файлів;
- обмеження розміру файлів;
- audit log;
- резервне копіювання;
- автоматичний logout;
- хешування паролів на backend.

Audit log має фіксувати:

- створення;
- редагування;
- видалення;
- оплату;
- повернення;
- зміну залишків;
- зміну прав;
- завершення прийому;
- видалення файлів;
- зміну зарплат.

---

# 15. Імпорт та експорт

Імпорт:

- власники;
- пацієнти;
- прайс;
- препарати;
- залишки складу.

Формати:

- CSV;
- XLSX.

Експорт:

- власники;
- пацієнти;
- прийоми;
- фінансові звіти;
- склад;
- боржники;
- зарплати.

Формати:

- CSV;
- XLSX;
- PDF.

---

# 16. Offline / нестабільний інтернет

Передбачити:

- кешування довідників;
- локальні чернетки прийомів;
- повторну відправку після відновлення мережі;
- попередження про втрату з’єднання.

Frontend:

```js
window.addEventListener('online', syncOfflineData);
window.addEventListener('offline', showOfflineWarning);
```

---

# 17. Real-time notification events

Для WebSocket:

```js
socket.on('appointment.created')
socket.on('appointment.updated')
socket.on('invoice.paid')
socket.on('stock.low')
socket.on('reminder.sent')
```

Внутрішні повідомлення:

- новий запис;
- зміна запису;
- скасування прийому;
- борг клієнта;
- малий залишок препарату;
- прострочений препарат;
- новий файл;
- завершення прийому;
- помилки каси.

---

# 18. Адаптивність

Система має працювати на:

- desktop;
- laptop;
- tablet;
- mobile.

На мобільних:

- меню згортається;
- таблиці переходять у картки;
- календар має спрощений режим;
- кнопки зручні для натискання;
- форми адаптивні;
- телефон клієнта клікабельний.

---

# 19. MVP

У першій версії реалізувати:

1. Авторизацію.
2. Ролі.
3. Permissions.
4. Власників.
5. Пацієнтів.
6. Календар.
7. Регістратуру.
8. Прийоми.
9. Прайс.
10. Рахунки.
11. Оплати.
12. Борги.
13. Базовий склад.
14. Препарати.
15. Постачальники.
16. Вакцинації.
17. Файли.
18. Нагадування.
19. Базові звіти.
20. Налаштування клініки.
21. Audit log.

---

# 20. Друга черга

Після MVP:

- клієнтський кабінет;
- SMS/email/push;
- зарплати;
- конструктор звітів;
- касові інтеграції;
- дисконтні карти;
- мережа філій;
- складна аналітика;
- offline mode;
- PWA;
- імпорт/експорт;
- WebSocket.

---

# 21. Критерії готовності

Система готова, якщо:

- користувач може увійти;
- права доступу працюють;
- можна створити власника;
- можна створити пацієнта;
- можна записати пацієнта на прийом;
- прийом відображається в календарі;
- лікар може провести прийом;
- можна додати діагноз, процедури, препарати й рекомендації;
- можна створити рахунок;
- можна прийняти оплату;
- склад оновлюється після використання препарату;
- вакцинації зберігаються;
- нагадування створюються;
- звіти показують коректні дані;
- система працює на desktop і mobile;
- критичні дії логуються;
- помилки показуються зрозуміло.

---

# 22. Порядок розробки

## Етап 1 — ядро

1. Auth.
2. Users.
3. Roles.
4. Permissions.
5. Clinics.
6. Branches.
7. Layout frontend.
8. Router на чистому JS.
9. API wrapper.
10. Dashboard skeleton.

## Етап 2 — CRM

1. Owners.
2. Patients.
3. Пошук.
4. Картка власника.
5. Картка пацієнта.

## Етап 3 — календар і прийоми

1. Calendar.
2. Reception.
3. Appointments.
4. Services in appointment.
5. Drugs in appointment.
6. Завершення прийому.

## Етап 4 — фінанси

1. Price.
2. Invoices.
3. Payments.
4. Debts.
5. Basic reports.

## Етап 5 — склад

1. Drugs.
2. Suppliers.
3. Stock batches.
4. Stock movements.
5. Income.
6. Write-off.
7. Low stock alerts.

## Етап 6 — медичні додаткові модулі

1. Vaccinations.
2. Files.
3. Templates.
4. Reminders.

## Етап 7 — розширення

1. Client portal.
2. Salary.
3. Discount cards.
4. Advanced reports.
5. Fiscal integrations.
6. WebSocket.
7. PWA/offline.

---

# 23. Правила для агента-розробника

1. Писати frontend тільки на чистому JavaScript.
2. Не використовувати React, Vue, Angular, Svelte.
3. Дотримуватись модульної архітектури.
4. Не змішувати DOM-рендеринг, бізнес-логіку та API-запити в одному файлі.
5. Для кожної сторінки створювати окремий модуль.
6. Для повторюваних елементів створювати компоненти.
7. Усі запити робити через єдиний API wrapper.
8. Усі помилки показувати через Toast або inline validation.
9. Усі критичні дії логувати на backend.
10. Soft delete використовувати для важливих даних.
11. Усі фінансові та складські операції виконувати в транзакціях.
12. Не довіряти frontend permissions — backend перевіряє права повторно.
13. Всі форми мають мати валідацію.
14. Всі таблиці мають мати loading state та empty state.
15. Усі сторінки мають бути адаптивними.
16. Усі дати зберігати в UTC або чітко нормалізованому timezone.
17. У frontend показувати дату відповідно до timezone клініки.
18. Для грошей не використовувати float на backend.
19. Для складських залишків використовувати decimal/numeric.
20. Перед оплатою, списанням і завершенням прийому перевіряти актуальність даних.

---

# 24. Перший код, який потрібно створити

Почати зі скелета frontend:

```text
/frontend
  index.html
  /css
    reset.css
    variables.css
    layout.css
    components.css
    pages.css
  /js
    app.js
    router.js
    api.js
    auth.js
    store.js
    permissions.js
    /components
      table.js
      modal.js
      toast.js
      form.js
      sidebar.js
      header.js
    /pages
      loginPage.js
      dashboardPage.js
      ownersPage.js
      patientsPage.js
      calendarPage.js
    /services
      ownerService.js
      patientService.js
      calendarService.js
```

Перші реалізовані сторінки:

1. Login.
2. Dashboard.
3. Owners.
4. Patients.
5. Calendar.

Перші backend-модулі:

1. Auth.
2. Users.
3. Roles.
4. Permissions.
5. Owners.
6. Patients.
7. Calendar.
8. Appointments.

---

# 25. Мета

Створити повноцінну ветеринарну CRM/ERP-систему, яка працює як вебзастосунок, має чистий Vanilla JS frontend, REST API backend, PostgreSQL базу даних, підтримує клініки, філії, лікарів, власників, пацієнтів, календар, медичні прийоми, склад, аптеку, фінанси, касу, звіти, нагадування, клієнтський кабінет і гнучку систему прав доступу.
