# HR Duong Minh — Internal ERP API

**Tech stack:** NestJS · TypeORM · MariaDB · Node.js 20 · Plesk (Windows)

---

## Project structure

```
src/
├── main.ts                    # Bootstrap — CORS, pipes, global prefix
├── app.module.ts              # Root module
├── data-source.ts             # TypeORM CLI data-source (migrations only)
├── config/
│   └── database.module.ts     # TypeOrmModule.forRootAsync
├── models/                    # TypeORM entities (shared across modules)
│   ├── user.entity.ts
│   ├── role.entity.ts
│   ├── customer.entity.ts
│   ├── vendor.entity.ts
│   ├── job.entity.ts
│   ├── container.entity.ts
│   ├── invoice.entity.ts
│   ├── expense.entity.ts
│   ├── payment.entity.ts
│   └── audit-log.entity.ts
├── business/                  # Feature modules
│   ├── auth/                  # Login, JWT, Guards, RBAC decorators
│   ├── users/
│   ├── roles/
│   ├── customers/
│   ├── vendors/
│   ├── jobs/                  # Core: job → cost/revenue/profit
│   ├── containers/            # Container tracking
│   ├── invoices/              # Invoices + payment recording
│   ├── expenses/
│   └── audit-logs/
└── migrations/                # TypeORM migration files
app.js                         # Plesk startup file  →  require('./dist/main')
```

---

## Local development

### 1 — Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20.x |
| npm | 10.x |
| MariaDB / MySQL | 10.5+ |

### 2 — Environment

Copy and fill in `.env`:

```bash
cp .env .env.local   # optional — .env is gitignored
```

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `DB_HOST` | `localhost` | MariaDB host |
| `DB_PORT` | `3306` | MariaDB port |
| `DB_USER` | `root` | DB username |
| `DB_PASSWORD` | *(empty)* | DB password |
| `DB_NAME` | `hr_duongminh` | Database name |
| `JWT_SECRET` | **change this** | Long random string |
| `JWT_EXPIRES_IN` | `8h` | Token lifetime |
| `CORS_ORIGINS` | `http://localhost,...` | Comma-separated allowed origins |
| `NODE_ENV` | `development` | `development` / `production` |

### 3 — Create the database

```sql
CREATE DATABASE hr_duongminh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4 — Run migrations

```bash
npm run migration:run
```

This creates all tables and seeds 4 default roles: `admin`, `manager`, `staff`, `accountant`.

### 5 — Start dev server

```bash
npm run start:dev
```

API is available at: `http://localhost:3000/api/v1`

---

## API overview

All endpoints are prefixed with `/api/v1`.  
Protected endpoints require the header:

```
Authorization: Bearer <access_token>
```

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | ✗ | Login → returns `accessToken` |
| GET | `/auth/me` | ✓ | Current user info |

### Users
| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/users` | admin | Create user |
| GET | `/users` | admin, manager | List users |
| GET | `/users/:id` | any | Get user |
| PATCH | `/users/:id` | admin | Update user |
| DELETE | `/users/:id` | admin | Delete user |

### Jobs
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/jobs` | ✓ | Create job |
| GET | `/jobs?status=&customerId=` | ✓ | List jobs |
| GET | `/jobs/:id` | ✓ | Job with full relations |
| GET | `/jobs/:id/profit` | ✓ | Revenue / cost / profit summary |
| POST | `/jobs/:id/recalculate` | ✓ | Recalculate financials |
| PATCH | `/jobs/:id` | ✓ | Update job |
| DELETE | `/jobs/:id` | ✓ | Delete job |

### Invoices
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/invoices` | ✓ | Create invoice |
| GET | `/invoices?jobId=&customerId=` | ✓ | List invoices |
| POST | `/invoices/:id/payments` | ✓ | Record payment (auto-updates status) |

### Expenses
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/expenses` | ✓ | Add cost to job |
| GET | `/expenses?jobId=` | ✓ | List expenses |

### Other modules
`/customers`, `/vendors`, `/roles`, `/containers`, `/audit-logs` — all follow the same CRUD pattern.

---

## Build

```bash
npm run build
```

Output goes to `./dist/`.

---

## Plesk deployment

1. **Build locally:**
   ```bash
   npm run build
   ```

2. **Upload via FTP / Git to `/httpdocs`:**
   - `dist/`
   - `app.js`
   - `package.json`
   - `package-lock.json`
   - `.env` (fill in production values)

3. **In Plesk Node.js settings:**
   - Application root: `/httpdocs`
   - Startup file: `app.js`
   - Node.js version: `20`

4. **In Plesk console (or SSH):**
   ```bash
   npm install --omit=dev
   ```

5. **Restart the app** in Plesk.

6. **Run migrations on production:**
   ```bash
   npm run migration:run
   ```

7. **Test:**
   ```
   http://<server-ip>/api/v1/auth/login
   ```

---

## CORS — switching to HTTPS later

Once DNS + SSL are ready, update `.env`:

```env
NODE_ENV=production
CORS_ORIGINS=https://hr.duongminhvn.com
```

Then restart the app — no code changes needed.

---

## Creating the first admin user

After migrations, seed an admin via the API (use a temp insecure route or run directly in DB):

```sql
-- Run this after getting the bcrypt hash of your password
-- (generate with: node -e "const b=require('bcrypt'); b.hash('yourpassword',12).then(console.log)")
INSERT INTO users (email, full_name, password, status)
VALUES ('admin@duongminhvn.com', 'Admin', '<bcrypt_hash>', 'active');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'admin@duongminhvn.com' AND r.name = 'admin';
```

---

## Entity relationship overview

```
Customer ──< Job >── AssignedUser (User)
               │
               ├──< Container    (tracking)
               ├──< Invoice >─── Customer
               │       └──< Payment
               └──< Expense >─── Vendor

User >──< Role   (many-to-many via user_roles)
User ──< AuditLog
```

**Profit formula per job:**
```
totalProfit = totalRevenue (sum of invoice subtotals) − totalCost (sum of expenses)
```

Recalculate on demand: `POST /api/v1/jobs/:id/recalculate`

---

## Empty the database

To delete all business data while preserving tables, columns, indexes, and
relationships:

```bash
npm run db:clear -- <DB_NAME>
```

The TypeORM `migrations` table is preserved so the existing schema remains valid.
Append `INCLUDE_MIGRATIONS` to clear that technical table as well.

To drop every table and view instead, while keeping the database itself so
migrations can recreate the schema:

```bash
npm run db:drop -- <DB_NAME>
npm run migration:run
```

When `NODE_ENV=production`, append `ALLOW_PRODUCTION` after the database name.
Set `DB_ENV_FILE` to explicitly select another environment file.

### Emergency purge API

The emergency API drops every view and table (including `migrations`) from the
database used by the application's current connection. It is excluded from
Swagger and requires one independent admin key plus HTTPS in production. No JWT
or user account is accepted by this endpoint. Enable it only for the maintenance window:

```env
ENABLE_DATABASE_PURGE_API=true
DATABASE_ADMIN_KEY=<at-least-32-random-characters>
```

Disable it and restart the application immediately after use. The database remains,
but its schema is empty; run migrations to recreate it. Existing tokens stop working
because the `users` table is removed.

To run the operation later without signing in to the server, copy
`.env.remote-maintenance.example` to `.env.remote-maintenance` on your computer,
fill in its values, and run:

```bash
npm run db:drop:remote
```

The local file is ignored by Git. The command calls the endpoint using only the
database admin key.
