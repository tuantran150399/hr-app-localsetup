# Phase 2 Backend Validation

Last updated: 2026-05-02

## 1. Current Status

The Phase 2 backend API upgrades are implemented for the ERP Logistics testing flow.

Stack:

- Backend: NestJS monolith
- Database: MariaDB
- ORM: TypeORM
- Frontend: Next.js static export
- API prefix: `/api/v1`
- Swagger:
  - `/docs`
  - `/api/v1/docs`
- Health check:
  - `/api/v1/health`

Production test account seeded by `scripts/seed-api-test-data.js`:

```json
{
  "username": "api.tester",
  "password": "ApiTest@123"
}
```

Login request body for Swagger:

```json
{
  "username": "api.tester",
  "password": "ApiTest@123"
}
```

Use the returned `accessToken` in Swagger `Authorize` as a Bearer JWT.

## 2. Frontend Integration Status

The frontend hardcoded/mock data was removed from the main runtime services.

Frontend project path:

```text
D:\CODE\hr-duongminh\front end\hr-duongminh-app-fe
```

Frontend service changes:

- `services/authService.js`
  - Calls `POST /auth/login`
  - Calls `GET /auth/me`
  - Stores refresh token when backend returns it
  - No longer returns demo token or mock user on login failure
- `services/dashboardService.js`
  - Calls `GET /dashboard/stats`
  - No longer computes dashboard totals from mock/local arrays
- `services/jobService.js`
  - Calls `GET /jobs`
  - Calls `GET /jobs/:id`
  - Calls job accounting endpoints for detail page
- `services/partnerService.js`
  - Calls `GET /partners?page=1&limit=100`
  - Builds partner map from backend response
- `services/accountingService.js`
  - Calls `GET /accounting/revenue?page=1&limit=50`
  - Calls `GET /accounting/cost?page=1&limit=50`
- `utils/apiMappers.js`
  - Maps accounting entries to `job_no`
- `utils/mockData.js`
  - Removed

Frontend deployment zip:

```text
D:\CODE\hr-duongminh\front end\hr-duongminh-app-fe\erp-logistics-static.zip
```

Important build note:

Next.js static export bakes `NEXT_PUBLIC_*` variables into the JS bundle. Because `.env.local` can override production values locally, build production zips with:

```powershell
$env:NEXT_PUBLIC_API_URL='https://api.hr.duongminhvn.com/api/v1'; npm run build
Compress-Archive -Path 'out\*' -DestinationPath 'erp-logistics-static.zip' -Force
```

Verification already performed:

- `npm run lint` passed
- `npm run build` passed
- Generated `out` bundle contained `https://api.hr.duongminhvn.com/api/v1`
- Generated `out` bundle did not contain `localhost:3003`
- Zip contains root-level `index.html`, `_next` assets, and `web.config`

## 3. Implemented API Inventory

All paths below are under `/api/v1`.

### Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Returns access token and refresh token when available |
| `POST` | `/auth/refresh` | Public | Refreshes access token |
| `GET` | `/auth/me` | JWT | Current user profile |

### Dashboard

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/dashboard/stats` | JWT | Totals for jobs, revenue, cost, and profit |

### Jobs

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/jobs` | `job:create` | Create job |
| `GET` | `/jobs` | JWT | Paginated/filterable list |
| `GET` | `/jobs/:id` | JWT | Job detail |
| `PATCH` | `/jobs/:id` | `job:edit` | Update job |
| `PUT` | `/jobs/:id` | `job:edit` | Frontend compatibility alias for update |
| `POST` | `/jobs/:id/copy` | `job:create` | Copy job |
| `DELETE` | `/jobs/:id` | `job:edit` | Archive job |
| `PATCH` | `/jobs/:id/start` | `job:edit` | Set status to in progress |
| `PATCH` | `/jobs/:id/close` | `job:close` | Close job |
| `PATCH` | `/jobs/:id/cancel` | `job:edit` | Cancel job |
| `GET` | `/jobs/:id/milestones` | JWT | List milestones |
| `POST` | `/jobs/:id/milestones` | `job:edit` | Add milestone |
| `PATCH` | `/jobs/:id/milestones/:milestoneId` | `job:edit` | Update milestone |
| `DELETE` | `/jobs/:id/milestones/:milestoneId` | `job:edit` | Delete milestone |

### Partners

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/partners` | `partner:manage` | Create partner |
| `GET` | `/partners` | JWT | Paginated/filterable list |
| `GET` | `/partners/:id` | JWT | Partner detail |
| `PATCH` | `/partners/:id` | `partner:manage` | Update partner |
| `PUT` | `/partners/:id` | `partner:manage` | Frontend compatibility alias for update |
| `DELETE` | `/partners/:id` | `partner:manage` | Deactivate partner |
| `PATCH` | `/partners/:id/lock` | `partner:manage` | Lock partner |

### Accounting

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/accounting/revenue` | `accounting:create` | Create revenue entry |
| `GET` | `/accounting/revenue` | JWT | Paginated/filterable revenue list |
| `GET` | `/accounting/revenue/chart` | JWT | Revenue chart data |
| `GET` | `/accounting/revenue/job/:jobId` | JWT | Revenue entries by job |
| `GET` | `/accounting/revenue/:id` | JWT | Revenue detail |
| `PATCH` | `/accounting/revenue/:id` | `accounting:create` | Update revenue |
| `PATCH` | `/accounting/revenue/:id/post` | `accounting:post` | Post revenue |
| `POST` | `/accounting/revenue/:id/void` | `accounting:post` | Void revenue |
| `PATCH` | `/accounting/revenue/:id/payment-status` | `accounting:post` | Update payment status |
| `DELETE` | `/accounting/revenue/:id` | `accounting:create` | Delete revenue |
| `POST` | `/accounting/cost` | `accounting:create` | Create cost entry |
| `GET` | `/accounting/cost` | JWT | Paginated/filterable cost list |
| `GET` | `/accounting/cost/chart` | JWT | Cost chart data |
| `GET` | `/accounting/cost/job/:jobId` | JWT | Cost entries by job |
| `GET` | `/accounting/cost/:id` | JWT | Cost detail |
| `PATCH` | `/accounting/cost/:id` | `accounting:create` | Update cost |
| `PATCH` | `/accounting/cost/:id/post` | `accounting:post` | Post cost |
| `POST` | `/accounting/cost/:id/void` | `accounting:post` | Void cost |
| `PATCH` | `/accounting/cost/:id/payment-status` | `accounting:post` | Update payment status |
| `DELETE` | `/accounting/cost/:id` | `accounting:create` | Delete cost |
| `POST` | `/accounting/post-all/job/:jobId` | `accounting:post` | Post all entries for a job |
| `GET` | `/accounting/profit/job/:jobId` | JWT | Job profit summary |
| `POST` | `/accounting/payments/receipts` | `accounting:create` | Record customer receipt |
| `POST` | `/accounting/payments/vendor` | `accounting:create` | Record vendor payment |
| `GET` | `/accounting/periods` | `accounting:post` | List accounting periods |
| `POST` | `/accounting/periods/lock` | `accounting:post` | Lock period |
| `POST` | `/accounting/periods/unlock` | `accounting:post` | Unlock period |

### Payment Requests

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/payment-requests` | `accounting:create` | Create payment request |
| `GET` | `/payment-requests` | `accounting:view` | List payment requests |
| `GET` | `/payment-requests/:id` | `accounting:view` | Payment request detail |
| `PATCH` | `/payment-requests/:id/approve` | `accounting:post` | Approval step |
| `PATCH` | `/payment-requests/:id/reject` | `accounting:post` | Reject with reason |
| `PATCH` | `/payment-requests/:id/final-approve` | `accounting:post` | Final approval |

### Debt Policies

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/debt-policies` | `partner:manage` | Upsert debt policy |
| `GET` | `/debt-policies` | `partner:manage` | List debt policies |
| `GET` | `/debt-policies/:id` | `partner:manage` | Debt policy detail |

### Reports

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/reports/profit/job/:jobId` | `accounting:view` | Job profit |
| `GET` | `/reports/branch-summary` | `accounting:view` | Branch summary |
| `GET` | `/reports/customer-summary` | `accounting:view` | Customer summary |
| `GET` | `/reports/pnl` | `accounting:view` | P&L by period |
| `GET` | `/reports/cash-flow` | `accounting:view` | Cash flow |
| `GET` | `/reports/job-status-summary` | `accounting:view` | Job status counts |
| `GET` | `/reports/receivables` | `accounting:view` | Receivables |
| `GET` | `/reports/payables` | `accounting:view` | Payables |
| `GET` | `/reports/overdue-receivables` | `accounting:view` | Overdue receivables |
| `GET` | `/reports/overdue-payables` | `accounting:view` | Overdue payables |

### Attachments

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/attachments/upload` | JWT/permission | Upload file |
| `GET` | `/attachments` | JWT | List attachments |
| `GET` | `/attachments/:id` | JWT | Attachment metadata |
| `GET` | `/attachments/:id/download` | JWT | Download file |
| `DELETE` | `/attachments/:id` | JWT/permission | Delete attachment |

### Audit Logs

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/audit-logs` | JWT | Paginated/filterable audit logs |
| `GET` | `/audit-logs/:id` | JWT | Audit log detail |
| `GET` | `/audit-logs/entry/:id` | JWT | Audit log detail alias |
| `GET` | `/audit-logs/:entity/:id` | JWT | Entity audit history |

### System

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/health` | Public | Full health check |
| `GET` | `/health/db` | Public | DB health |
| `GET` | `/health/live` | Public | Liveness |

## 4. Validation Results

Resolved items from the earlier Phase 2 gap report:

- `POST /auth/refresh` implemented
- `GET /dashboard/stats` implemented
- `GET /accounting/revenue/chart` implemented
- `GET /accounting/cost/chart` implemented
- `PUT /jobs/:id` compatibility route added
- `PUT /partners/:id` compatibility route added
- `DELETE /jobs/:id` archive route added
- `DELETE /partners/:id` deactivate route added
- `GET /partners` now supports frontend pagination shape
- Revenue and cost detail endpoints added
- Payment request endpoints added
- Debt policy endpoints added
- P&L and cash-flow reports added
- Swagger available at both `/docs` and `/api/v1/docs`
- JWT can be temporarily bypassed with `DISABLE_AUTH=true`
- API test seed script exists and has been used against local/prod DBs

## 5. Auth and Swagger Notes

Normal testing flow:

1. Open `/api/v1/docs`.
2. Run `POST /api/v1/auth/login`.
3. Copy `accessToken`.
4. Click Swagger `Authorize`.
5. Paste the token.
6. Call protected APIs.

If `/auth/me` returns `401`, Swagger is working correctly but the request has no valid Bearer token.

Temporary auth bypass exists for server testing:

```env
DISABLE_AUTH=true
DISABLE_AUTH_USER_ID=1
```

Do not leave `DISABLE_AUTH=true` enabled for production use.

## 6. Migration and Seed Notes

Backend commands:

```powershell
npm run migration:run
npm run seed:api-test
```

The seed script:

- Creates or updates the `api.tester` login
- Seeds test branch, partners, jobs, accounting revenue, accounting cost, and optional Phase 2 records
- Can be pointed at prod using `.env.prod`

Use `.env.prod` only as an execution source; do not copy secrets into documentation.

## 7. Deployment Notes

Backend deployment zip:

```text
D:\CODE\hr-duongminh\hr-app-localsetup\hr-duongminh-api-deploy.zip
```

Frontend deployment zip:

```text
D:\CODE\hr-duongminh\front end\hr-duongminh-app-fe\erp-logistics-static.zip
```

Backend post-deploy smoke checks:

```text
GET https://api.hr.duongminhvn.com/api/v1/health
GET https://api.hr.duongminhvn.com/api/v1/docs
POST https://api.hr.duongminhvn.com/api/v1/auth/login
GET https://api.hr.duongminhvn.com/api/v1/auth/me
GET https://api.hr.duongminhvn.com/api/v1/dashboard/stats
GET https://api.hr.duongminhvn.com/api/v1/jobs?page=1&limit=10
GET https://api.hr.duongminhvn.com/api/v1/partners?page=1&limit=10
GET https://api.hr.duongminhvn.com/api/v1/accounting/revenue?page=1&limit=10
GET https://api.hr.duongminhvn.com/api/v1/accounting/cost?page=1&limit=10
```

## 8. Remaining Risks and Follow-Up

Known follow-up items:

- Verify every write endpoint in Swagger against prod data with JWT enabled.
- Confirm Plesk Node process restarts cleanly after zip replacement.
- Confirm frontend pages show backend seed data after static zip deployment.
- Review attachment authorization against final business rules.
- Review branch-level data isolation for jobs, accounting, and reports.
- Review payment workflow roles if production roles differ from seeded test permissions.
- Run a real audit-log check after create/update/post/void/delete flows.
- Fix any remaining README encoding issues if the file is used as customer-facing documentation.

## 9. Suggested Next Test Plan

1. Login as `api.tester`.
2. Open dashboard and confirm totals load from `/dashboard/stats`.
3. Open jobs list and job detail.
4. Open partners list.
5. Open accounting revenue and cost tabs.
6. Test protected write APIs in Swagger:
   - create partner
   - create job
   - create revenue
   - create cost
   - post revenue/cost
   - void revenue/cost
7. Confirm audit logs are created for write operations.
8. Confirm frontend deployment zip calls the production API host, not localhost.
