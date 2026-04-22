/**
 * Chạy TRÊN PLESK SERVER (nơi MariaDB là localhost).
 * Bước 1: Upload toàn bộ project lên Plesk
 * Bước 2: Tạo .env với DB_HOST=localhost (hoặc 127.0.0.1)
 * Bước 3: node scripts/run-on-server.js
 *
 * Script này sẽ:
 *   1. Chạy Phase 1 + Phase 2 migration
 *   2. Seed data cơ bản (branches, permissions, roles, admin user, partners)
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(cmd) {
  console.log(`\n▶  ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

try {
  console.log('=== Phase 1+2 Migration + Seed trên Plesk ===\n');

  // Migration
  run('npx ts-node -r tsconfig-paths/register scripts/migrate-prod.ts');

  // Seed
  run('npx ts-node -r tsconfig-paths/register scripts/seed-prod.ts');

  console.log('\n✅ Hoàn tất!');
} catch (e) {
  console.error('\n❌ Lỗi:', e.message);
  process.exit(1);
}
