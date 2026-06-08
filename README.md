# VetCore — CRM/ERP ветеринарної клініки

Вебзастосунок для автоматизації ветклініки: власники, пацієнти, медичні картки,
календар, прийоми, прайс, рахунки, склад, ролі та права. Реалізовано згідно з [agent.md](agent.md).

- **Frontend** — чистий Vanilla JS (ES modules, без фреймворків), History API роутер.
  SVG-іконки, світла/темна тема (перемикач у шапці, збереження вибору), skeleton-завантаження,
  анімовані переходи між сторінками, ілюстровані порожні стани.
- **Backend** — Node.js + Express, REST API, JWT.
- **БД** — PostgreSQL (soft delete, audit log, транзакції для фінансів/складу).

## Запуск

```bash
# 1. Залежності
npm install

# 2. Налаштування (за потреби відредагуй DATABASE_URL / порт)
cp .env.example .env

# 3. Створити БД (один раз)
createdb vetcore

# 4. Міграція + початкові дані
npm run db:migrate
npm run db:seed

# 5. Старт
npm start            # або npm run dev (watch-режим)
```

Застосунок: http://localhost:3000 (порт із `.env`).
Демо-вхід: **admin@vetcore.local / admin12345** (роль «Власник клініки»).
Лікарі: doctor1@vetcore.local, doctor2@vetcore.local / **doctor12345**.

**Клієнтський кабінет** власника тварини: `/client` — вхід за телефоном + код
(демо-код `0000`). Відновлення пароля співробітника: `/forgot-password`
(у dev токен повертається у відповіді й одразу веде на `/reset-password`).

> `npm run db:reset` — повністю перестворити схему й залити seed заново.
> `npm test` — регресійні API-тести (node --test): auth, RBAC, CRUD, склад/FEFO,
> фінанси, повний цикл прийому, клієнтський кабінет, відновлення пароля.

## Структура

```
backend/
  db/         schema.sql, каталог permissions/ролей
  scripts/    migrate.js, seed.js
  src/
    config/       env, database (pool + транзакції), auth (jwt/bcrypt)
    middlewares/  auth, permission, validation, error
    modules/      auth, users, roles, permissions, owners, patients,
                  calendar, appointments, dashboard  (routes/controller/service)
    utils/        ApiError, response, validate, pagination, auditLog
frontend/
  index.html
  css/        reset, variables, layout, components, pages
  js/
    app.js, router.js, api.js, auth.js, store.js, permissions.js
    components/  toast, modal, table, form, sidebar, header
    pages/       login, dashboard, owners(+profile), patients(+profile),
                 calendar, reception, appointments(+detail), staff, settings
    services/    API-обгортки
    utils/       dom, format
```

## Реалізовано

**Ядро (MVP):** авторизація (JWT + refresh), ролі та permissions (перевірка на
frontend і backend); власники й пацієнти (CRUD, пошук, пагінація, картки);
календар (день, фільтр за лікарем, перевірка перетину слотів, створення по
сітці); прийоми (старт → медкарта → послуги/препарати → завершення); дашборд;
глобальний пошук; audit log; soft delete; адаптивний UI; inline-валідація + toast.

**Друга черга (§20):**
- Прайс-лист послуг (категорії, CRUD).
- Аптека/склад: препарати, постачальники, партії, прихід, списання, корекція
  (інвентаризація), журнал рухів, контроль термінів і мінімального залишку.
- **FEFO-списання препаратів зі складу при завершенні прийому** (§13.4) у транзакції.
- Фінанси: рахунки, каса (оплата cash/card/transfer), часткові оплати → борги,
  повернення, баланс/прапорець боржника — усе транзакційно (§13.3).
- Звіти: виручка, лікарі, ТОП послуг/препаратів, вартість складу, боржники.
- **Конструктор звітів**: набір даних (платежі, позиції рахунків, прийоми,
  пацієнти) → виміри/групування + показники + фільтри + період, графік і
  підсумки, експорт CSV. SQL збирається на сервері з білого списку схеми
  (клієнт оперує лише ключами — захист від ін'єкцій).
- Медичні: вакцинації з авто-нагадуванням (§12.5), файли (upload + контроль
  типу/розміру), шаблони, нагадування.
- Зарплати: правила нарахування + розрахунок за період + фіксація виплати.
- Дисконтні карти, налаштування клініки, клієнтський кабінет (`/api/client/*`,
  вхід за телефоном + код, демо-код `0000`).

**Інфраструктурне (наскрізне):**
- **Імпорт/експорт** — експорт CSV (власники, пацієнти, рахунки, склад, боржники)
  з BOM для Excel; PDF рахунку (pdfkit); імпорт CSV (власники, прайс, препарати)
  з порядковою валідацією та звітом про помилки.
- **WebSocket real-time** (`/ws`, auth за токеном, межі клініки) — події
  `appointment.created`, `invoice.created`, `invoice.paid`, `stock.low`; дзвіночок
  сповіщень у шапці + live toast.
- **PWA/offline** — manifest, service worker (кеш app shell; API ніколи не
  кешується), індикатор онлайн/офлайн, попередження про втрату з'єднання.
- UI-доповнення: файли/аналізи у картці пацієнта (upload+preview), редактор
  шаблонів і ролей у Налаштуваннях, вставка шаблонів у медкарту прийому.

## Далі

SMS/email/push-канали для нагадувань, конструктор звітів, фіскальні інтеграції
каси, мережа філій з перемиканням, повний offline-режим із чергою синхронізації.

## API

Базовий шлях `/api`. Формат відповіді: `{ success, data, message }` /
`{ success:false, error:{ code, message, fields } }`. Усі запити (крім `/auth/*`)
потребують `Authorization: Bearer <token>`.
```

> ⚠️ Якщо порт 3000 зайнятий іншим проєктом — задай інший у `.env` (`PORT=3100`).
