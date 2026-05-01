# Next Session Context

Last updated: 2026-05-02

Use this document as the first file to read in a new Codex/session.

## Repositories

Backend:

```text
D:\CODE\hr-duongminh\hr-app-localsetup
```

Frontend:

```text
D:\CODE\hr-duongminh\front end\hr-duongminh-app-fe
```

## Current Goal

The project is in Phase 2 backend/frontend integration testing.

Recent completed work:

- Backend missing APIs were added or aligned.
- Prod migrations and seed were run.
- Swagger is reachable at `/api/v1/docs`.
- Frontend mock/hardcoded runtime data was removed.
- Frontend now calls backend APIs.
- New frontend Plesk zip was built.

## Important Test URLs

Backend:

```text
https://api.hr.duongminhvn.com/api/v1/health
https://api.hr.duongminhvn.com/api/v1/docs
```

Frontend:

```text
https://hr.duongminhvn.com
```

## Test Login

```json
{
  "username": "api.tester",
  "password": "ApiTest@123"
}
```

Expected auth flow:

- `POST /api/v1/auth/login`
- Copy `accessToken`
- Swagger `Authorize`
- Test `GET /api/v1/auth/me`

`401` on `/auth/me` means the request is missing a valid Bearer token.

## Deployment Artifacts

Backend zip:

```text
D:\CODE\hr-duongminh\hr-app-localsetup\hr-duongminh-api-deploy.zip
```

Frontend zip:

```text
D:\CODE\hr-duongminh\front end\hr-duongminh-app-fe\erp-logistics-static.zip
```

Frontend previous backup zip:

```text
D:\CODE\hr-duongminh\front end\hr-duongminh-app-fe\erp-logistics-static.20260502-003402.bak.zip
```

## Backend Commands

```powershell
npm run build
npm run migration:run
npm run seed:api-test
```

For prod DB operations, use `.env.prod` as the environment source. Do not hardcode secrets into docs or scripts.

## Frontend Commands

Run from:

```text
D:\CODE\hr-duongminh\front end\hr-duongminh-app-fe
```

Lint:

```powershell
npm run lint
```

Production static build:

```powershell
$env:NEXT_PUBLIC_API_URL='https://api.hr.duongminhvn.com/api/v1'; npm run build
```

Zip:

```powershell
Compress-Archive -Path 'out\*' -DestinationPath 'erp-logistics-static.zip' -Force
```

Important: do not rely on `.env.production` alone for a local production zip if `.env.local` exists. Static export can bake `.env.local` values like `http://localhost:3003/api/v1` into the bundle.

## Auth Bypass

The backend JWT guard supports temporary auth bypass:

```env
DISABLE_AUTH=true
DISABLE_AUTH_USER_ID=1
```

This is only for short server testing. Disable it for normal Swagger/frontend validation.

## Files Recently Changed

Backend docs:

- `docs/phase2-backend-validation.md`
- `docs/next-session-context.md`

Frontend:

- `services/authService.js`
- `services/dashboardService.js`
- `services/jobService.js`
- `services/partnerService.js`
- `services/accountingService.js`
- `utils/apiMappers.js`
- `app/login/page.js`
- `store/services/dashboardApi.js`
- `store/services/jobsApi.js`
- `store/services/partnersApi.js`
- `package-lock.json`
- `README.md`
- removed `utils/mockData.js`
- rebuilt `erp-logistics-static.zip`

## Verification Already Done

Frontend:

- `npm run lint` passed
- `npm run build` passed
- `out` contains `web.config`
- deployment zip contains root-level `index.html`
- bundle contains production API host
- bundle does not contain `localhost:3003`

Backend:

- Health endpoint accessible in prod
- Swagger endpoint accessible in prod
- Seed test account exists
- Prod migrations and seed were previously run from `.env.prod`

## Next Recommended Work

1. Deploy the new frontend zip to Plesk.
2. Login from the frontend with `api.tester / ApiTest@123`.
3. Confirm dashboard, jobs, partners, revenue, and cost screens show backend data.
4. Use Swagger to test write flows with JWT enabled.
5. Confirm audit logs after write flows.
6. Re-enable/verify JWT if `DISABLE_AUTH=true` was used temporarily.
