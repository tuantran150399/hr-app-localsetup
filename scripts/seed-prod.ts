/**
 * Seed data Phase 1 lên Production DB.
 * Đọc kết nối từ .env.prod — KHÔNG ảnh hưởng .env local.
 *
 * Cách chạy (sau khi điền DB_PASSWORD trong .env.prod):
 *   npx ts-node -r tsconfig-paths/register scripts/seed-prod.ts
 *
 * Script idempotent: dùng INSERT IGNORE — chạy nhiều lần không bị lỗi.
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { join } from 'path';

// Load .env.prod nếu có, fallback về .env (khi chạy trên server)
const envPath = fs.existsSync(path.resolve(__dirname, '../.env.prod'))
  ? path.resolve(__dirname, '../.env.prod')
  : path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });
console.log(`📄 Đọc env từ: ${envPath}`);

const ds = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '../src/**/*.entity.{ts,js}')],
  synchronize: false,
  logging: false,
});

async function main() {
  console.log(`\n🔌 Connecting: ${process.env.DB_HOST}:${process.env.DB_PORT} / ${process.env.DB_NAME}`);
  await ds.initialize();
  console.log('✅ Connected.\n');

  const q = ds.createQueryRunner();
  await q.connect();

  // ─── 1. Branches ──────────────────────────────────────────────────────────
  console.log('📦 Seeding branches...');
  await q.query(`
    INSERT IGNORE INTO branches (code, name, address, isActive, created_at, updated_at)
    VALUES
      ('HAN', 'Chi nhánh Hà Nội',   '123 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội',        1, NOW(), NOW()),
      ('HCM', 'Chi nhánh TP.HCM',   '456 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',       1, NOW(), NOW()),
      ('DAN', 'Chi nhánh Đà Nẵng',  '789 Bạch Đằng, Hải Châu, Đà Nẵng',             1, NOW(), NOW())
  `);

  // ─── 2. Permissions ───────────────────────────────────────────────────────
  console.log('🔑 Seeding permissions...');
  const permissions = [
    'user:create','user:edit','user:view','user:delete',
    'role:manage',
    'job:create','job:edit','job:view','job:close',
    'accounting:create','accounting:post','accounting:view',
    'partner:manage',
    'branch:manage',
    'auditlog:view',
    'attachment:upload','attachment:delete',
    'report:view',
  ];
  for (const name of permissions) {
    await q.query(`INSERT IGNORE INTO permissions (name, created_at, updated_at) VALUES (?, NOW(), NOW())`, [name]);
  }

  // ─── 3. Roles ─────────────────────────────────────────────────────────────
  console.log('👥 Seeding roles...');
  await q.query(`INSERT IGNORE INTO roles (name, created_at, updated_at) VALUES ('SUPER_ADMIN', NOW(), NOW())`);
  await q.query(`INSERT IGNORE INTO roles (name, created_at, updated_at) VALUES ('ACCOUNTANT',  NOW(), NOW())`);
  await q.query(`INSERT IGNORE INTO roles (name, created_at, updated_at) VALUES ('OPERATION',   NOW(), NOW())`);

  // ─── 4. Role-Permission mapping ───────────────────────────────────────────
  console.log('🔗 Mapping role permissions...');

  // SUPER_ADMIN gets all
  await q.query(`
    INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'SUPER_ADMIN'
  `);

  // ACCOUNTANT permissions
  const accountantPerms = ['job:view','accounting:create','accounting:post','accounting:view','auditlog:view','report:view','attachment:upload'];
  for (const perm of accountantPerms) {
    await q.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'ACCOUNTANT' AND p.name = ?
    `, [perm]);
  }

  // OPERATION permissions
  const operationPerms = ['job:create','job:edit','job:view','job:close','partner:manage','attachment:upload'];
  for (const perm of operationPerms) {
    await q.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.name = 'OPERATION' AND p.name = ?
    `, [perm]);
  }

  // ─── 5. Users ─────────────────────────────────────────────────────────────
  console.log('👤 Seeding users...');

  const adminHash   = await bcrypt.hash('Admin@123', 12);
  const accHash     = await bcrypt.hash('Acc@12345', 12);
  const opsHash     = await bcrypt.hash('Ops@12345', 12);

  // Get branch IDs
  const [hanRow] = await q.query(`SELECT id FROM branches WHERE code='HAN' LIMIT 1`);
  const [hcmRow] = await q.query(`SELECT id FROM branches WHERE code='HCM' LIMIT 1`);
  const [danRow] = await q.query(`SELECT id FROM branches WHERE code='DAN' LIMIT 1`);
  const hanId = hanRow?.id ?? 1;
  const hcmId = hcmRow?.id ?? 2;
  const danId = danRow?.id ?? 3;

  const users = [
    { username: 'admin',       email: 'admin@duongminhvn.com',       password: adminHash, fullName: 'Administrator',      branchId: hanId, role: 'SUPER_ADMIN' },
    { username: 'pham.bao',    email: 'pham.bao@duongminhvn.com',    password: adminHash, fullName: 'Phạm Văn Bảo',       branchId: danId, role: 'SUPER_ADMIN' },
    { username: 'nguyen.lan',  email: 'nguyen.lan@duongminhvn.com',  password: accHash,   fullName: 'Nguyễn Thị Lan',     branchId: hcmId, role: 'ACCOUNTANT' },
    { username: 'tran.hung',   email: 'tran.hung@duongminhvn.com',   password: opsHash,   fullName: 'Trần Văn Hùng',      branchId: hcmId, role: 'OPERATION' },
    { username: 'le.mai',      email: 'le.mai@duongminhvn.com',      password: opsHash,   fullName: 'Lê Thị Mai',         branchId: hanId, role: 'OPERATION' },
  ];

  for (const u of users) {
    await q.query(`
      INSERT IGNORE INTO users (username, email, password, full_name, branch_id, isActive, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
    `, [u.username, u.email, u.password, u.fullName, u.branchId]);

    // Assign role
    await q.query(`
      INSERT IGNORE INTO user_roles (user_id, role_id)
        SELECT u.id, r.id FROM users u, roles r
        WHERE u.username = ? AND r.name = ?
    `, [u.username, u.role]);
  }

  // ─── 6. Partners (sample) ─────────────────────────────────────────────────
  console.log('🏢 Seeding partners...');
  const partners = [
    ['KH001', 'Công ty TNHH Xuất Nhập Khẩu An Phát',      'CUSTOMER', 'nguyen.anphat@gmail.com',      '0901234501'],
    ['KH002', 'Công ty CP Thương Mại Bình Minh',           'CUSTOMER', 'contact@binhminhtrading.vn',   '0901234502'],
    ['KH003', 'Công ty TNHH Sản Xuất Minh Khoa',          'CUSTOMER', 'info@minhkhoa.vn',              '0901234503'],
    ['KH004', 'Tập đoàn Logistics Hoàng Gia',              'CUSTOMER', 'admin@hoanggia-logistics.vn',  '0901234504'],
    ['NCC001','Hãng tàu EVERGREEN',                        'VENDOR',   'agent@evergreen.vn',           '0281234501'],
    ['NCC002','Đại lý hải quan Tân Cảng',                  'VENDOR',   'customs@tancang.vn',           '0281234502'],
    ['NCC003','Công ty vận tải Trường Giang',              'VENDOR',   'ops@truonggiang.vn',            '0281234503'],
    ['NCC004','Công ty khai thác cảng Hải Phòng',         'VENDOR',   'info@canghaiphong.vn',          '0225234504'],
    ['NCC005','Forwarder Quốc tế ABC',                     'VENDOR',   'abc@abcforward.vn',             '0281234505'],
    ['KV001', 'Công ty XNK & Vận tải Đại Việt',           'BOTH',     'daiviet@logistics.vn',          '0901234506'],
  ];
  for (const [code, name, type, email, phone] of partners) {
    await q.query(`
      INSERT IGNORE INTO partners (code, name, partnerType, email, phone, isActive, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
    `, [code, name, type, email, phone]);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  const [{ cnt: branchCnt }]  = await q.query(`SELECT COUNT(*) cnt FROM branches`);
  const [{ cnt: partnerCnt }] = await q.query(`SELECT COUNT(*) cnt FROM partners`);
  const [{ cnt: userCnt }]    = await q.query(`SELECT COUNT(*) cnt FROM users`);
  const [{ cnt: permCnt }]    = await q.query(`SELECT COUNT(*) cnt FROM permissions`);
  const [{ cnt: roleCnt }]    = await q.query(`SELECT COUNT(*) cnt FROM roles`);

  console.log('\n─────────────────────────────────────');
  console.log(`  branches:    ${branchCnt}`);
  console.log(`  partners:    ${partnerCnt}`);
  console.log(`  users:       ${userCnt}`);
  console.log(`  permissions: ${permCnt}`);
  console.log(`  roles:       ${roleCnt}`);
  console.log('─────────────────────────────────────');
  console.log('\n✅ Seed prod hoàn tất!\n');
  console.log('📋 Tài khoản mặc định:');
  console.log('  admin       / Admin@123  (SUPER_ADMIN - HN)');
  console.log('  pham.bao    / Admin@123  (SUPER_ADMIN - ĐN)');
  console.log('  nguyen.lan  / Acc@12345  (ACCOUNTANT  - HCM)');
  console.log('  tran.hung   / Ops@12345  (OPERATION   - HCM)');
  console.log('  le.mai      / Ops@12345  (OPERATION   - HN)\n');

  await q.release();
  await ds.destroy();
}

main().catch((err) => {
  console.error('\n❌ Seed thất bại:', err.message);
  process.exit(1);
});
