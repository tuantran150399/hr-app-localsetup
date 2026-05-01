# Phase 2 Backend Validation

## 1. Overview

This document validates Phase 2 backend completeness for the ERP Logistics system.

The system is a Mini ERP for logistics and forwarding operations. It covers job management, accounting and finance, audit tracking, reporting, and document attachments.

Tech stack:

- Backend: NestJS
- Database access: TypeORM
- Frontend: Next.js
- API base path: `/api/v1`

Phase 2 scope reviewed:

- Job Management
- Accounting: revenue, cost, profit, posting, void/reversal
- Audit Log
- Search, filter, and pagination
- Reporting
- Attachments and documents

## 2. API Inventory

### 2.1 Frontend Requested APIs

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `GET /jobs`
- `GET /jobs/:id`
- `POST /jobs`
- `PUT /jobs/:id`
- `DELETE /jobs/:id`
- `GET /partners`
- `GET /partners/:id`
- `POST /partners`
- `PUT /partners/:id`
- `DELETE /partners/:id`
- `GET /accounting/revenue`
- `GET /accounting/revenue/job/:jobId`
- `GET /accounting/cost`
- `GET /accounting/cost/job/:jobId`
- `GET /accounting/profit/job/:jobId`
- `GET /dashboard/stats`
- `GET /accounting/revenue/chart`
- `GET /accounting/cost/chart`

### 2.2 Backend Implemented APIs

- `POST /auth/login`
- `GET /auth/me`
- `POST /users`
- `GET /users`
- `GET /users/me`
- `GET /users/:id`
- `PATCH /users/:id`
- `PATCH /users/me/password`
- `DELETE /users/:id`
- `POST /roles`
- `GET /roles`
- `GET /roles/permissions`
- `GET /roles/:id`
- `PATCH /roles/:id`
- `POST /branches`
- `GET /branches`
- `GET /branches/:id`
- `PATCH /branches/:id`
- `POST /partners`
- `GET /partners`
- `GET /partners/:id`
- `PATCH /partners/:id`
- `POST /jobs`
- `GET /jobs`
- `GET /jobs/:id`
- `PATCH /jobs/:id`
- `PATCH /jobs/:id/start`
- `PATCH /jobs/:id/close`
- `PATCH /jobs/:id/cancel`
- `GET /jobs/:id/milestones`
- `POST /jobs/:id/milestones`
- `PATCH /jobs/:id/milestones/:milestoneId`
- `DELETE /jobs/:id/milestones/:milestoneId`
- `POST /accounting/revenue`
- `GET /accounting/revenue`
- `GET /accounting/revenue/job/:jobId`
- `PATCH /accounting/revenue/:id`
- `PATCH /accounting/revenue/:id/post`
- `POST /accounting/revenue/:id/void`
- `PATCH /accounting/revenue/:id/payment-status`
- `DELETE /accounting/revenue/:id`
- `POST /accounting/cost`
- `GET /accounting/cost`
- `GET /accounting/cost/job/:jobId`
- `PATCH /accounting/cost/:id`
- `PATCH /accounting/cost/:id/post`
- `POST /accounting/cost/:id/void`
- `PATCH /accounting/cost/:id/payment-status`
- `DELETE /accounting/cost/:id`
- `POST /accounting/post-all/job/:jobId`
- `GET /accounting/profit/job/:jobId`
- `GET /accounting/periods`
- `POST /accounting/periods/lock`
- `POST /accounting/periods/unlock`
- `POST /attachments/upload`
- `GET /attachments`
- `GET /attachments/:id`
- `GET /attachments/:id/download`
- `DELETE /attachments/:id`
- `GET /reports/profit/job/:jobId`
- `GET /reports/branch-summary`
- `GET /reports/customer-summary`
- `GET /reports/job-status-summary`
- `GET /reports/receivables`
- `GET /reports/payables`
- `GET /reports/overdue-receivables`
- `GET /reports/overdue-payables`
- `GET /audit-logs`
- `GET /audit-logs/:entity/:id`
- `GET /health`
- `GET /health/db`
- `GET /health/live`

## 3. API Gap Analysis

### 3.1 Missing APIs (CRITICAL)

- `POST /auth/refresh`
  - Frontend token refresh interceptor calls this endpoint. Backend does not implement refresh tokens.
- `DELETE /jobs/:id`
  - Frontend RTK Query slice defines job deletion. Backend has no job delete/archive endpoint.
- `DELETE /partners/:id`
  - Frontend RTK Query slice defines partner deletion. Backend has no partner delete/archive endpoint.
- `GET /dashboard/stats`
  - Frontend dashboard API slice references this endpoint. Backend does not implement a dashboard controller.
- `GET /accounting/revenue/chart`
  - Frontend dashboard API slice references this endpoint. Backend does not implement chart endpoints.
- `GET /accounting/cost/chart`
  - Frontend dashboard API slice references this endpoint. Backend does not implement chart endpoints.

### 3.2 Mismatched APIs

- FE: `PUT /jobs/:id`
- BE: `PATCH /jobs/:id`
- Issue: HTTP method mismatch.

- FE: `PUT /partners/:id`
- BE: `PATCH /partners/:id`
- Issue: HTTP method mismatch.

- FE: `GET /partners` with pagination params `{ page, limit }`
- BE: `GET /partners` with optional `type` only
- Issue: query and response mismatch. Backend returns an array, not paginated `{ data, meta }`.

### 3.3 Unused Backend APIs

- `POST /users`
- `GET /users`
- `GET /users/me`
- `GET /users/:id`
- `PATCH /users/:id`
- `PATCH /users/me/password`
- `DELETE /users/:id`
- `POST /roles`
- `GET /roles`
- `GET /roles/permissions`
- `GET /roles/:id`
- `PATCH /roles/:id`
- `POST /branches`
- `GET /branches`
- `GET /branches/:id`
- `PATCH /branches/:id`
- `PATCH /jobs/:id/start`
- `PATCH /jobs/:id/close`
- `PATCH /jobs/:id/cancel`
- `GET /jobs/:id/milestones`
- `POST /jobs/:id/milestones`
- `PATCH /jobs/:id/milestones/:milestoneId`
- `DELETE /jobs/:id/milestones/:milestoneId`
- `POST /accounting/revenue`
- `PATCH /accounting/revenue/:id`
- `PATCH /accounting/revenue/:id/post`
- `POST /accounting/revenue/:id/void`
- `PATCH /accounting/revenue/:id/payment-status`
- `DELETE /accounting/revenue/:id`
- `POST /accounting/cost`
- `PATCH /accounting/cost/:id`
- `PATCH /accounting/cost/:id/post`
- `POST /accounting/cost/:id/void`
- `PATCH /accounting/cost/:id/payment-status`
- `DELETE /accounting/cost/:id`
- `POST /accounting/post-all/job/:jobId`
- `GET /accounting/periods`
- `POST /accounting/periods/lock`
- `POST /accounting/periods/unlock`
- `POST /attachments/upload`
- `GET /attachments`
- `GET /attachments/:id`
- `GET /attachments/:id/download`
- `DELETE /attachments/:id`
- `GET /reports/profit/job/:jobId`
- `GET /reports/branch-summary`
- `GET /reports/customer-summary`
- `GET /reports/job-status-summary`
- `GET /reports/receivables`
- `GET /reports/payables`
- `GET /reports/overdue-receivables`
- `GET /reports/overdue-payables`
- `GET /audit-logs`
- `GET /audit-logs/:entity/:id`
- `GET /health`
- `GET /health/db`
- `GET /health/live`

## 4. Phase 2 Requirement Coverage

### Feature: Job Management

- Required:
  - Create, edit, cancel, close, and view jobs.
  - Manage unique Job No.
  - Support logistics fields such as shipper, consignee, agent, declaration number, customs lane, vessel/voyage, ETD/ETA, ports, cargo type, container/seal.
  - Track job lifecycle from creation to completion.
- Implemented:
  - `POST /jobs`
  - `GET /jobs`
  - `GET /jobs/:id`
  - `PATCH /jobs/:id`
  - `PATCH /jobs/:id/start`
  - `PATCH /jobs/:id/close`
  - `PATCH /jobs/:id/cancel`
  - `GET /jobs/:id/milestones`
  - `POST /jobs/:id/milestones`
  - `PATCH /jobs/:id/milestones/:milestoneId`
  - `DELETE /jobs/:id/milestones/:milestoneId`
- Status: PARTIAL

### Feature: Accounting

- Required:
  - Create and update revenue entries.
  - Create and update cost entries.
  - Post revenue and cost.
  - Calculate profit by job.
  - Prevent modification of posted or locked financial data.
  - Support reversal or adjustment entries.
  - Track customer payments and vendor payments.
- Implemented:
  - `POST /accounting/revenue`
  - `GET /accounting/revenue`
  - `GET /accounting/revenue/job/:jobId`
  - `PATCH /accounting/revenue/:id`
  - `PATCH /accounting/revenue/:id/post`
  - `POST /accounting/revenue/:id/void`
  - `PATCH /accounting/revenue/:id/payment-status`
  - `DELETE /accounting/revenue/:id`
  - `POST /accounting/cost`
  - `GET /accounting/cost`
  - `GET /accounting/cost/job/:jobId`
  - `PATCH /accounting/cost/:id`
  - `PATCH /accounting/cost/:id/post`
  - `POST /accounting/cost/:id/void`
  - `PATCH /accounting/cost/:id/payment-status`
  - `DELETE /accounting/cost/:id`
  - `POST /accounting/post-all/job/:jobId`
  - `GET /accounting/profit/job/:jobId`
  - `GET /accounting/periods`
  - `POST /accounting/periods/lock`
  - `POST /accounting/periods/unlock`
- Status: PARTIAL

### Feature: Audit / Tracking

- Required:
  - Record important user actions.
  - Track financial data changes.
  - Support filtering by module/entity, user, action, and date.
- Implemented:
  - `GET /audit-logs`
  - `GET /audit-logs/:entity/:id`
  - Service-level logging exists for selected job, accounting posting, voiding, payment status, and user actions.
- Status: PARTIAL

### Feature: Reporting

- Required:
  - Job profit report.
  - Profit and loss by job, customer, and period.
  - Revenue/cost summary.
  - Debt summary.
  - Cash flow report.
  - Date range filtering.
- Implemented:
  - `GET /accounting/profit/job/:jobId`
  - `GET /reports/profit/job/:jobId`
  - `GET /reports/branch-summary`
  - `GET /reports/customer-summary`
  - `GET /reports/job-status-summary`
  - `GET /reports/receivables`
  - `GET /reports/payables`
  - `GET /reports/overdue-receivables`
  - `GET /reports/overdue-payables`
- Status: PARTIAL

### Feature: Search / Filter

- Required:
  - Search jobs by Job No., customer, declaration number, created date, status.
  - Filter accounting entries by job, vendor, status, payment status, and dates.
  - Pagination for list endpoints.
- Implemented:
  - `GET /jobs` supports pagination and filters.
  - `GET /accounting/revenue` supports pagination and filters.
  - `GET /accounting/cost` supports pagination and filters.
  - `GET /audit-logs` supports pagination and filters.
  - `GET /attachments` supports pagination and module/entity filters.
- Status: PARTIAL

### Feature: Attachments

- Required:
  - Upload documents.
  - Download documents.
  - List documents by module/entity.
  - Secure access to document files.
- Implemented:
  - `POST /attachments/upload`
  - `GET /attachments`
  - `GET /attachments/:id`
  - `GET /attachments/:id/download`
  - `DELETE /attachments/:id`
- Status: PARTIAL

## 5. Missing Features Summary

### Jobs

- Job copy/duplicate API.
- Job delete/archive API.
- Several SRS logistics fields are missing from model and DTOs.
- Automatic job timeline from status changes, accounting events, and attachment events.
- Customer-name and declaration-number search.

### Accounting

- Revenue detail API.
- Cost detail API.
- Payment receipt and settlement APIs.
- Cash/bank account and fund balance APIs.
- Approval workflow for payment requests.
- Pricing/rate integration.
- Chi hộ / thu hộ automation.
- Debt limit configuration and automatic customer lock.

### Reports

- Cash flow report.
- Period-based P&L by month, quarter, and year.
- Revenue/cost chart endpoints required by frontend.
- Report export endpoints.
- Consistent report metadata and totals.

### Audit

- Audit logging for financial create/update/delete.
- Audit logging for attachment upload/delete.
- Audit logging for milestones and accounting period lock/unlock.
- IP address capture.
- Audit log detail endpoint by log id.

### Attachments

- Parent entity validation for `moduleName` and `entityId`.
- Module-specific authorization.
- Usage of attachment-specific permissions.
- Attachment audit logging.

## 6. Risk Assessment

### Missing Business Rules

- No debt limit enforcement before creating jobs.
- No customer auto-lock when overdue or over debt limit.
- No payment approval workflow.
- No branch-specific approval workflow.
- No pricing/rate rules.
- No chi hộ / thu hộ automation.

### Missing Validations

- Cost `vendorId` is not validated against partner/vendor records.
- Attachment `moduleName/entityId` is not validated against a real parent entity.
- Partner list is not paginated.
- Job model lacks required SRS fields for customs and logistics operations.

### Missing Transaction Handling

- Posting and voiding use transactions.
- Revenue/cost create, update, delete do not use explicit transactions.
- Period lock validation does not cover all financial mutations.

### Security Risks

- Attachment endpoints use `job:edit` permission instead of seeded `attachment:upload` and `attachment:delete`.
- Attachment download/list/delete do not verify access to the parent entity.
- Branch-level data isolation is not enforced in job, accounting, and report queries.
- Refresh token endpoint is called by frontend but not implemented by backend.

### Data Consistency Risks

- Financial period lock checks are incomplete.
- Posting checks current date, not necessarily document date.
- Audit trail does not cover all critical financial mutations.
- Frontend uses `PUT` for update while backend uses `PATCH`.
- Frontend expects dashboard/chart endpoints that do not exist.
- Phase 2 migration may fail on MariaDB because `revenue_entries` adds `voided_at AFTER voided_by` before adding `voided_by`.

## 7. Recommended Next Actions

### HIGH

- Align frontend and backend update methods for jobs and partners.
- Implement `POST /auth/refresh` or remove frontend refresh-token retry behavior.
- Add missing dashboard/chart endpoints or update frontend to use report APIs.
- Add period-lock validation to revenue/cost create, update, and delete.
- Add audit logging for all financial mutations.
- Fix attachment authorization and parent entity validation.
- Review and fix Phase 2 migration ordering issue.

### MEDIUM

- Add job copy and archive/delete APIs.
- Add revenue and cost detail APIs.
- Add partner pagination and search.
- Add missing job fields from the SRS.
- Add report export endpoints.
- Add period-based P&L reporting.
- Add branch-level data access enforcement.

### LOW

- Add audit log detail endpoint.
- Add attachment metadata update endpoint.
- Normalize report response schemas.
- Add health and deployment smoke-test documentation.

## 8. Suggested Backend Tasks

| API endpoint | Description | Module | Priority |
|---|---|---|---|
| `POST /auth/refresh` | Add refresh-token support or explicitly remove refresh workflow from frontend. | Auth | HIGH |
| `GET /dashboard/stats` | Provide dashboard totals for jobs, revenue, cost, and profit. | Reports/Dashboard | HIGH |
| `GET /accounting/revenue/chart` | Provide revenue chart data for frontend dashboard. | Accounting/Reports | HIGH |
| `GET /accounting/cost/chart` | Provide cost chart data for frontend dashboard. | Accounting/Reports | HIGH |
| `PATCH /jobs/:id` frontend alignment | Change frontend from `PUT` to `PATCH`, or add backend `PUT`. | Jobs | HIGH |
| `PATCH /partners/:id` frontend alignment | Change frontend from `PUT` to `PATCH`, or add backend `PUT`. | Partners | HIGH |
| `GET /accounting/revenue/:id` | Add revenue entry detail endpoint. | Accounting | MEDIUM |
| `GET /accounting/cost/:id` | Add cost entry detail endpoint. | Accounting | MEDIUM |
| `POST /jobs/:id/copy` | Duplicate an existing job with a new unique job code. | Jobs | MEDIUM |
| `DELETE /jobs/:id` | Soft-delete or archive a job with business-rule protection. | Jobs | MEDIUM |
| `DELETE /partners/:id` | Soft-delete/deactivate partner records. | Partners | MEDIUM |
| `GET /partners` | Add pagination, keyword search, active status filter, and consistent `{ data, meta }` response. | Partners | MEDIUM |
| `POST /attachments/upload` | Validate parent entity, use attachment permissions, and audit upload. | Attachments | HIGH |
| `GET /attachments/:id/download` | Enforce parent-entity authorization before file streaming. | Attachments | HIGH |
| `POST /payment-requests` | Create payment request for approval workflow. | Accounting | HIGH |
| `PATCH /payment-requests/:id/approve` | Department-head approval step. | Accounting/Workflow | HIGH |
| `PATCH /payment-requests/:id/reject` | Reject payment request with reason. | Accounting/Workflow | HIGH |
| `PATCH /payment-requests/:id/final-approve` | Director final approval step. | Accounting/Workflow | HIGH |
| `GET /reports/pnl` | Add P&L by job, customer, month, quarter, and year. | Reports | MEDIUM |
| `GET /reports/cash-flow` | Add cash flow report. | Reports | MEDIUM |
| `POST /accounting/payments/receipts` | Record customer receipt with amount, date, method, and account. | Accounting | MEDIUM |
| `POST /accounting/payments/vendor` | Record vendor payment with amount, date, method, and account. | Accounting | MEDIUM |
| `POST /debt-policies` | Configure customer debt amount and debt age limits. | Accounting/Partners | MEDIUM |
| `PATCH /partners/:id/lock` | Lock customer due to debt policy violation. | Partners | MEDIUM |
| `GET /audit-logs/:id` | Retrieve audit log detail by id. | Audit Logs | LOW |
