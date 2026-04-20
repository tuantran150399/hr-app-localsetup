# API Reference — hr-duongminh ERP Backend

**Base URL:** `http://localhost:3000/api/v1`  
**Auth:** All endpoints (except `POST /auth/login`) require `Authorization: Bearer <token>`  
**Content-Type:** `application/json`

---

## Quick Start — Get a Token

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq .accessToken
```

Store as `TOKEN=<value>` and use `-H "Authorization: Bearer $TOKEN"` in every subsequent call.

---

## Module Index

| Module | Base path | Permission required |
|--------|-----------|-------------------|
| [Auth](#1-auth) | `/auth` | none (login) |
| [Users](#2-users) | `/users` | `user:manage` |
| [Roles](#3-roles) | `/roles` | `role:manage` |
| [Branches](#4-branches) | `/branches` | `branch:manage` (write) |
| [Partners](#5-partners) | `/partners` | `partner:manage` (write) |
| [Jobs](#6-jobs) | `/jobs` | `job:create`, `job:edit`, `job:close` |
| [Accounting](#7-accounting) | `/accounting` | `accounting:create`, `accounting:post` |
| [Audit Logs](#8-audit-logs) | `/audit-logs` | `auditlog:view` |
| [Health](#9-health) | `/health` | none (no JWT required) |

---

## 1. Auth

### `POST /auth/login`
No auth required.

**Body:**
```json
{ "username": "admin", "password": "Admin@123" }
```
**Response:**
```json
{ "accessToken": "eyJ..." }
```

---

### `GET /auth/me`
Returns the current user's full profile (roles + permissions).

```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 2. Users

All require `user:manage` except `GET /users/me` and `PATCH /users/me/password`.

### `POST /users`
```json
{
  "username": "john",
  "email": "john@example.com",
  "password": "Secret@123",
  "fullName": "John Doe",
  "branchId": 1,
  "roleIds": [2]
}
```
> `branchId` is validated — must exist in `branches` table.

### `GET /users`
Returns all users with roles.

### `GET /users/me`
Returns own profile (no `user:manage` required).

### `GET /users/:id`

### `PATCH /users/:id`
```json
{
  "fullName": "John Updated",
  "branchId": 2,
  "roleIds": [1, 2]
}
```

### `PATCH /users/me/password`
```json
{ "currentPassword": "Secret@123", "newPassword": "NewPass@456" }
```

### `DELETE /users/:id`
Soft-deactivates the user (`isActive = false`). Writes `DEACTIVATE` audit log.

---

## 3. Roles

All require `role:manage`.

### `GET /roles/permissions`
Returns all available permissions.

### `POST /roles`
```json
{
  "name": "DISPATCHER",
  "description": "Can create and manage jobs",
  "permissionIds": [5, 6]
}
```

### `GET /roles`
### `GET /roles/:id`

### `PATCH /roles/:id`
```json
{ "description": "Updated desc", "permissionIds": [5, 6, 7] }
```

---

## 4. Branches

Write operations require `branch:manage`. Read operations are public (JWT still required).

### `POST /branches`
```json
{ "code": "HAN", "name": "Hanoi Branch", "address": "123 Tran Hung Dao, Hanoi" }
```

### `GET /branches`
### `GET /branches/:id`

### `PATCH /branches/:id`
```json
{ "name": "Hanoi HQ", "isActive": false }
```

---

## 5. Partners

Write operations require `partner:manage`.

### `POST /partners`
```json
{
  "code": "COSCO",
  "name": "COSCO Shipping Lines",
  "partnerType": "VENDOR",
  "contactEmail": "cosco@example.com",
  "contactPhone": "0123456789"
}
```
> `partnerType` enum: `CUSTOMER` | `VENDOR` | `BOTH`

### `GET /partners`
### `GET /partners?type=CUSTOMER`
Filter by `CUSTOMER`, `VENDOR`, or `BOTH`.

### `GET /partners/:id`

### `PATCH /partners/:id`
```json
{ "partnerType": "BOTH", "isActive": true }
```

---

## 6. Jobs

### Permission map

| Action | Permission |
|--------|-----------|
| Create | `job:create` |
| Update / Cancel / Start | `job:edit` |
| Close | `job:close` |
| Read | any valid JWT |

### `POST /jobs`
```json
{
  "jobCode": "JOB-2026-001",
  "jobType": "IMPORT",
  "shipmentMode": "SEA_FCL",
  "origin": "Shanghai",
  "destination": "Ho Chi Minh City",
  "partnerId": 1,
  "branchId": 1,
  "assignedUserId": 2,
  "notes": "Urgent shipment"
}
```
> **Enums:**  
> `jobType`: `IMPORT` | `EXPORT` | `DOMESTIC`  
> `shipmentMode`: `SEA_FCL` | `SEA_LCL` | `AIR` | `ROAD` | `RAIL`  
> `partnerId`, `branchId`, `assignedUserId` all validated against DB.  
> `assignedUserId` must also be `isActive = true`.  
> Created with `status: DRAFT`.

### `GET /jobs`
### `GET /jobs/:id`

### `PATCH /jobs/:id`
Updates editable fields. Blocked if status is `CLOSED` or `CANCELLED`.
```json
{ "destination": "Da Nang", "assignedUserId": 3 }
```

### `PATCH /jobs/:id/start`
Transitions `DRAFT` → `IN_PROGRESS`.

### `PATCH /jobs/:id/close`
Transitions → `CLOSED`. Sets `closedAt` and `closedBy`.

### `PATCH /jobs/:id/cancel`
Transitions → `CANCELLED`.

> All status transitions are blocked if job is already `CLOSED` or `CANCELLED`.

---

## 7. Accounting

### Permission map

| Action | Permission |
|--------|-----------|
| Create / Update / Delete entries | `accounting:create` |
| Post entries | `accounting:post` |
| Read entries / profit | any valid JWT |

---

### Revenue Entries

### `POST /accounting/revenue`
```json
{
  "jobId": 1,
  "description": "Ocean freight revenue",
  "currency": "USD",
  "amount": 1000,
  "exchangeRate": 25000,
  "localAmount": 25000000,
  "notes": "Invoice #INV-001"
}
```
> Entry created with `status: DRAFT`. `jobId` must exist.

### `GET /accounting/revenue/job/:jobId`
Returns all revenue entries for a job.

### `PATCH /accounting/revenue/:id`
Blocked if entry status is `POSTED`.
```json
{ "amount": 1200, "localAmount": 30000000 }
```

### `PATCH /accounting/revenue/:id/post`
Posts a single entry in a DB transaction.  
Blocked if: entry already POSTED, or parent job is `CANCELLED`.

### `DELETE /accounting/revenue/:id`
Blocked if entry is `POSTED`.

---

### Cost Entries

### `POST /accounting/cost`
```json
{
  "jobId": 1,
  "description": "Trucking cost",
  "currency": "VND",
  "amount": 5000000,
  "exchangeRate": 1,
  "localAmount": 5000000,
  "vendorId": 2
}
```

### `GET /accounting/cost/job/:jobId`
### `PATCH /accounting/cost/:id`
### `PATCH /accounting/cost/:id/post`
### `DELETE /accounting/cost/:id`

Same rules as revenue entries above.

---

### Batch & Summary

### `POST /accounting/post-all/job/:jobId`
**Atomically posts all DRAFT revenue + cost entries** for the job in a single transaction.  
Returns:
```json
{
  "jobId": 1,
  "postedRevenue": 2,
  "postedCost": 1,
  "message": "Posted 2 revenue and 1 cost entries"
}
```
> Throws `400` if no DRAFT entries exist, or if job is `CANCELLED`.

### `GET /accounting/profit/job/:jobId`
Returns profit summary of **POSTED** entries only:
```json
{
  "jobId": 1,
  "totalRevenue": 25000000,
  "totalCost": 5000000,
  "profit": 20000000,
  "revenueEntries": 1,
  "costEntries": 1
}
```

---

## 8. Audit Logs

Requires `auditlog:view`.

### `GET /audit-logs`
### `GET /audit-logs?limit=50`
Returns latest N log entries (default 100).

### `GET /audit-logs/:entity/:id`
Returns all logs for a specific record.

```bash
# All logs for Job #5
curl "http://localhost:3000/api/v1/audit-logs/Job/5" \
  -H "Authorization: Bearer $TOKEN"
```

**Logged actions by entity:**

| Entity | Actions |
|--------|---------|
| `Job` | `CREATE`, `UPDATE`, `STATUS_CHANGE`, `POST_ALL` |
| `User` | `CREATE`, `UPDATE`, `DEACTIVATE` |
| `RevenueEntry` | `POST_REVENUE` |
| `CostEntry` | `POST_COST` |

---

## Testing

### Option A — Run the e2e script
Starts the server first, then runs the full 8-step workflow:

```bash
# Terminal 1 — start server
npm run start:dev

# Terminal 2 — run e2e
npx ts-node -r tsconfig-paths/register scripts/e2e-workflow.ts
```

Expected output:
```
=== ERP Logistics E2E Workflow ===

  ✅ Login → JWT received
  ✅ Create Job → id=N
  ✅ Create Revenue entry → id=N (DRAFT)
  ✅ Create Cost entry → id=N (DRAFT)
  ✅ Post all entries → Posted 1 revenue and 1 cost entries
  ✅ Profit summary → revenue=25000000 cost=5000000 profit=20000000
  ✅ Close Job → status=CLOSED
  ✅ CANCELLED-job guard → correctly rejected with 400

=== All checks passed ✅ ===
```

---

### Option B — curl / HTTP client (manual)

**Step 1 — Login**
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | jq -r .accessToken)
```

**Step 2 — Create a Job**
```bash
JOB=$(curl -s -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jobCode":"TEST-001","jobType":"IMPORT","shipmentMode":"SEA_FCL","origin":"Shanghai","destination":"HCMC"}')
JOB_ID=$(echo $JOB | jq .id)
```

**Step 3 — Add Revenue & Cost**
```bash
curl -s -X POST http://localhost:3000/api/v1/accounting/revenue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"jobId\":$JOB_ID,\"description\":\"Freight\",\"currency\":\"USD\",\"amount\":1000,\"exchangeRate\":25000,\"localAmount\":25000000}"
```

**Step 4 — Post all & check profit**
```bash
curl -s -X POST "http://localhost:3000/api/v1/accounting/post-all/job/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN"

curl -s "http://localhost:3000/api/v1/accounting/profit/job/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Step 5 — Close the job**
```bash
curl -s -X PATCH "http://localhost:3000/api/v1/jobs/$JOB_ID/close" \
  -H "Authorization: Bearer $TOKEN"
```

**Step 6 — Check audit log**
```bash
curl -s "http://localhost:3000/api/v1/audit-logs/Job/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '[.[] | {action, userId, newValues}]'
```

---

### Option C — VS Code REST Client

Install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension and create a `.http` file:

```http
@base = http://localhost:3000/api/v1
@token = <paste token here>

### Login
POST {{base}}/auth/login
Content-Type: application/json

{"username":"admin","password":"Admin@123"}

### Get my profile
GET {{base}}/auth/me
Authorization: Bearer {{token}}

### Create job
POST {{base}}/jobs
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "jobCode": "TEST-001",
  "jobType": "IMPORT",
  "shipmentMode": "SEA_FCL",
  "origin": "Shanghai",
  "destination": "Ho Chi Minh City"
}
```

---

## 9. Health Check

**No authentication required.** Intended for load balancers, uptime monitors, and deployment pipelines.

### Endpoints overview

| Endpoint | Purpose | Use when |
|----------|---------|----------|
| `GET /health/live` | Liveness — process is running | Kubernetes `livenessProbe`, Plesk uptime monitor |
| `GET /health/db` | DB ping only — lightweight | Load-balancer readiness probe |
| `GET /health` | Full check — DB + memory + disk | Post-deploy smoke test, dashboards |

---

### `GET /health/live`
Liveness probe. Returns instantly with no DB call.

```bash
curl http://localhost:3000/api/v1/health/live
```

**Response `200`:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-20T08:00:00.000Z",
  "uptime": 3600,
  "pid": 12345,
  "nodeVersion": "v20.20.2",
  "environment": "production"
}
```

---

### `GET /health/db`
Readiness probe — pings the MariaDB connection (3 s timeout).

```bash
curl http://localhost:3000/api/v1/health/db
```

**Response `200` (healthy):**
```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" } }
}
```

**Response `503` (DB down):**
```json
{
  "status": "error",
  "info": {},
  "error": { "database": { "status": "down", "message": "connect ECONNREFUSED 127.0.0.1:3306" } },
  "details": { "database": { "status": "down" } }
}
```

---

### `GET /health`
Full system check — database + heap memory (≤ 512 MB) + RSS memory (≤ 768 MB) + disk (≤ 90% used).

```bash
curl http://localhost:3000/api/v1/health
```

**Response `200` (all healthy):**
```json
{
  "status": "ok",
  "info": {
    "database":     { "status": "up" },
    "memory_heap":  { "status": "up" },
    "memory_rss":   { "status": "up" },
    "disk":         { "status": "up" }
  },
  "error": {},
  "details": { ... }
}
```

**Response `503`** if any indicator fails — the `error` key shows which one and why.

---

### Thresholds (configurable in `health.controller.ts`)

| Indicator | Threshold |
|-----------|-----------|
| `memory_heap` | ≤ 512 MB |
| `memory_rss` | ≤ 768 MB |
| `disk` | ≤ 90% used (`thresholdPercent: 0.9`) |
| `database` | ping timeout ≤ 3 000 ms |

---

### Dùng với Plesk / monitoring tools

**Plesk Node.js health URL** — set startup check URL to:
```
http://localhost:3000/api/v1/health/live
```

**Uptime Robot / Better Uptime** — monitor `GET /health/db` (returns 200/503 correctly).

**Post-deploy check script:**
```bash
curl -sf http://localhost:3000/api/v1/health | jq .status
# prints "ok" or exits non-zero on error
```

---

## Common Error Responses

| HTTP | Meaning |
|------|---------|
| `400` | Validation error, business rule violation (e.g. editing CLOSED job, posting for CANCELLED job) |
| `401` | Missing or invalid JWT |
| `403` | Valid JWT but missing required permission |
| `404` | Entity not found |
| `409` | Duplicate unique field (job code, username, email) |
