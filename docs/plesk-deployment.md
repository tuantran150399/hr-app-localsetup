# Plesk Deployment Guide

## Backend API

Project path:

`D:\CODE\hr-duongminh\front end\hr-app-localsetup`

Create deployment zip:

```powershell
npm run deploy:zip
```

Generated files:

- `hr-duongminh-api-deploy.zip`
- `hr-duongminh-api-deploy.<timestamp>.zip`

Recommended Plesk target:

- Domain or subdomain: `api.hr.duongminhvn.com`
- Document root / application root: `/httpdocs`
- Node.js mode: production
- Startup file: `app.js`

Deployment steps:

1. Upload `hr-duongminh-api-deploy.zip` to the API site's `httpdocs`.
2. Extract the zip so these files exist in `httpdocs`:
   `dist`, `app.js`, `package.json`, `package-lock.json`, `web.config`, `.env.example`
3. Create a real `.env` in `httpdocs` using your production database and JWT settings.
4. In Plesk Node.js, set:
   `Application root = httpdocs`
   `Application startup file = app.js`
5. Open Plesk terminal in the API app root and run:

```powershell
npm install --omit=dev
npm run migration:run:dist
```

6. Restart the Node.js application in Plesk.

Suggested production `.env` keys:

```env
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
JWT_SECRET=replace_with_long_random_secret
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGINS=https://hr.duongminhvn.com
```

Smoke checks:

- `GET /api/v1/health`
- `GET /api/v1/docs`
- `POST /api/v1/auth/login`
- `GET /api/v1/dashboard/stats`

## Frontend Static Site

Project path:

`D:\CODE\hr-duongminh\front end\hr-duongminh-app-fe`

Create deployment zip:

```powershell
npm run deploy:zip
```

Generated files:

- `erp-logistics-static.zip`
- `erp-logistics-static.<timestamp>.zip`

Recommended Plesk target:

- Domain: `hr.duongminhvn.com`
- Hosting type: static site / standard IIS hosting

Deployment steps:

1. Upload `erp-logistics-static.zip` to the frontend site's `httpdocs`.
2. Remove old static files if needed.
3. Extract the zip directly into `httpdocs`.
4. Confirm `index.html`, `_next`, and `web.config` exist in `httpdocs`.

Frontend API base URL:

`.env.production` already points to:

```env
NEXT_PUBLIC_API_URL=https://api.hr.duongminhvn.com/api/v1
```

Smoke checks:

- Open `/login`
- Login with a real account
- Confirm dashboard, jobs, partners, and accounting pages load
