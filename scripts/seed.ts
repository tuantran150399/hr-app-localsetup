/**
 * Seed script — tạo dữ liệu giả cho toàn bộ DB.
 * Chạy: npx ts-node -r tsconfig-paths/register scripts/seed.ts
 *
 * Dữ liệu được tạo:
 *   - 3 branches (HCM, HAN, DAD)
 *   - 10 partners (khách hàng + nhà cung cấp)
 *   - 5 users (admin đã có, thêm 4 user mới với các role khác nhau)
 *   - 10 jobs (trạng thái hỗn hợp: DRAFT, IN_PROGRESS, CLOSED)
 *   - Revenue + Cost entries cho từng job
 *   - Post tất cả entries của các job CLOSED
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from '../src/data-source';
import * as bcrypt from 'bcrypt';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const q = (sql: string, params: any[] = []) =>
  AppDataSource.query(sql, params);

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

async function getId(table: string, col: string, val: string): Promise<number> {
  const rows = await q(`SELECT id FROM ${table} WHERE ${col} = ? LIMIT 1`, [val]);
  if (!rows.length) throw new Error(`Not found: ${table}.${col}=${val}`);
  return rows[0].id;
}

function log(msg: string) {
  console.log(`  ✔  ${msg}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await AppDataSource.initialize();
  console.log('\n🌱  Seeding database:', process.env.DB_NAME, '\n');

  // ── 1. Branches ─────────────────────────────────────────────────────────────
  console.log('── Branches');
  const branches = [
    { code: 'HCM', name: 'Hồ Chí Minh', address: '123 Nguyễn Huệ, Q.1, TP.HCM' },
    { code: 'HAN', name: 'Hà Nội',      address: '45 Tràng Tiền, Hoàn Kiếm, Hà Nội' },
    { code: 'DAD', name: 'Đà Nẵng',     address: '88 Bạch Đằng, Hải Châu, Đà Nẵng' },
  ];
  for (const b of branches) {
    await q(
      `INSERT IGNORE INTO branches (code, name, address, isActive, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [b.code, b.name, b.address, now(), now()],
    );
    log(`Branch: ${b.name}`);
  }

  const branchHCM = await getId('branches', 'code', 'HCM');
  const branchHAN = await getId('branches', 'code', 'HAN');
  const branchDAD = await getId('branches', 'code', 'DAD');

  // ── 2. Partners ──────────────────────────────────────────────────────────────
  console.log('\n── Partners');
  const partners = [
    // Customers
    { code: 'VINA001', name: 'Vinamilk JSC',              type: 'CUSTOMER', person: 'Nguyễn Thị Lan',   phone: '028-3825-0111', email: 'logistics@vinamilk.com.vn',  tax: '0301243413' },
    { code: 'SARA001', name: 'Saigon Beer JSC (SABECO)',   type: 'CUSTOMER', person: 'Trần Văn Hùng',    phone: '028-3829-4081', email: 'import@sabeco.com.vn',        tax: '0301450905' },
    { code: 'MASAN01', name: 'Masan Consumer Corp',        type: 'CUSTOMER', person: 'Lê Minh Tuấn',     phone: '028-6268-2272', email: 'supply@masangroup.com',       tax: '0302468095' },
    { code: 'VINAST1', name: 'VinaStar Textile Co.',       type: 'CUSTOMER', person: 'Phạm Thu Hương',   phone: '0274-3825-100', email: 'export@vinastar.com',         tax: '3700123456' },
    { code: 'PETRO01', name: 'Petrolimex Group',           type: 'BOTH',     person: 'Đặng Quốc Bảo',   phone: '024-3825-2751', email: 'logistics@petrolimex.com.vn', tax: '0100686209' },
    // Vendors
    { code: 'COSCO01', name: 'COSCO Shipping Lines',       type: 'VENDOR',   person: 'Wang Jian',         phone: '028-3829-9999', email: 'agency.hcmc@cosco.com',      tax: '' },
    { code: 'EVGRN01', name: 'Evergreen Marine Corp',      type: 'VENDOR',   person: 'Chen Li',           phone: '028-3511-9999', email: 'vnm@evergreen-marine.com',   tax: '' },
    { code: 'TRUCK01', name: 'Nam Phát Trucking Co.',      type: 'VENDOR',   person: 'Nguyễn Văn Đức',   phone: '028-3756-8888', email: 'dispatch@namphat.vn',        tax: '0312456789' },
    { code: 'CUST01',  name: 'Tân Cảng Customs Service',  type: 'VENDOR',   person: 'Lê Thị Mai',       phone: '028-3740-7070', email: 'customs@tancang.com.vn',     tax: '0301889012' },
    { code: 'KATO001', name: 'Kato Logistics Japan',       type: 'VENDOR',   person: 'Yamamoto Kenji',    phone: '+81-3-5555-0101', email: 'vietnam@kato-logistics.jp', tax: '' },
  ];
  for (const p of partners) {
    await q(
      `INSERT IGNORE INTO partners
         (code, name, partnerType, contactPerson, phone, email, taxCode, isActive, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [p.code, p.name, p.type, p.person, p.phone, p.email, p.tax, now(), now()],
    );
    log(`Partner: ${p.name} (${p.type})`);
  }

  const [vinamilk, cosco, namphat, tancang] = await Promise.all([
    getId('partners', 'code', 'VINA001'),
    getId('partners', 'code', 'COSCO01'),
    getId('partners', 'code', 'TRUCK01'),
    getId('partners', 'code', 'CUST01'),
  ]);
  const sabeco  = await getId('partners', 'code', 'SARA001');
  const masan   = await getId('partners', 'code', 'MASAN01');
  const evgreen = await getId('partners', 'code', 'EVGRN01');
  const kato    = await getId('partners', 'code', 'KATO001');

  // ── 3. Users (thêm vào role đã seed) ────────────────────────────────────────
  console.log('\n── Users');
  const roleAccountant  = await getId('roles', 'name', 'ACCOUNTANT');
  const roleOperation   = await getId('roles', 'name', 'OPERATION');
  const roleSuperAdmin  = await getId('roles', 'name', 'SUPER_ADMIN');

  const newUsers = [
    { username: 'nguyen.lan',   email: 'lan.nguyen@duongminhvn.com',   full: 'Nguyễn Thị Lan',    branch: branchHCM, role: roleAccountant,  pwd: 'Acc@12345' },
    { username: 'tran.hung',    email: 'hung.tran@duongminhvn.com',    full: 'Trần Văn Hùng',     branch: branchHCM, role: roleOperation,   pwd: 'Ops@12345' },
    { username: 'le.mai',       email: 'mai.le@duongminhvn.com',       full: 'Lê Thị Mai',        branch: branchHAN, role: roleOperation,   pwd: 'Ops@12345' },
    { username: 'pham.bao',     email: 'bao.pham@duongminhvn.com',     full: 'Phạm Quốc Bảo',    branch: branchDAD, role: roleSuperAdmin,  pwd: 'Admin@123' },
  ];

  const userIds: Record<string, number> = {};
  for (const u of newUsers) {
    const hash = await bcrypt.hash(u.pwd, 12);
    await q(
      `INSERT IGNORE INTO users
         (username, email, password, full_name, branch_id, isActive, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [u.username, u.email, hash, u.full, u.branch, now(), now()],
    );
    const uid = await getId('users', 'username', u.username);
    userIds[u.username] = uid;
    await q(
      `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
      [uid, u.role],
    );
    log(`User: ${u.username} (${u.full})`);
  }

  const adminId      = await getId('users', 'username', 'admin');
  const opHCM        = userIds['tran.hung'];
  const opHAN        = userIds['le.mai'];
  const accId        = userIds['nguyen.lan'];

  // ── 4. Jobs ──────────────────────────────────────────────────────────────────
  console.log('\n── Jobs');
  const jobs = [
    // CLOSED — có đủ entries đã POST
    { code: 'IMP-2026-001', type: 'IMPORT',   mode: 'SEA_FCL', status: 'CLOSED',      origin: 'Shanghai, China',       dest: 'TP. Hồ Chí Minh', partner: vinamilk, branch: branchHCM, user: opHCM,  etd: '2026-01-10', eta: '2026-01-28' },
    { code: 'EXP-2026-002', type: 'EXPORT',   mode: 'SEA_LCL', status: 'CLOSED',      origin: 'TP. Hồ Chí Minh',       dest: 'Osaka, Japan',     partner: sabeco,   branch: branchHCM, user: opHCM,  etd: '2026-02-05', eta: '2026-02-20' },
    { code: 'IMP-2026-003', type: 'IMPORT',   mode: 'AIR',     status: 'CLOSED',      origin: 'Frankfurt, Germany',    dest: 'Hà Nội',           partner: masan,    branch: branchHAN, user: opHAN,  etd: '2026-02-15', eta: '2026-02-16' },
    // IN_PROGRESS — entries DRAFT chưa post
    { code: 'IMP-2026-004', type: 'IMPORT',   mode: 'SEA_FCL', status: 'IN_PROGRESS', origin: 'Busan, South Korea',    dest: 'Đà Nẵng',          partner: vinamilk, branch: branchDAD, user: adminId, etd: '2026-03-20', eta: '2026-04-08' },
    { code: 'EXP-2026-005', type: 'EXPORT',   mode: 'AIR',     status: 'IN_PROGRESS', origin: 'Hà Nội',                dest: 'Tokyo, Japan',     partner: masan,    branch: branchHAN, user: opHAN,  etd: '2026-04-01', eta: '2026-04-02' },
    { code: 'DOM-2026-006', type: 'DOMESTIC', mode: 'ROAD',    status: 'IN_PROGRESS', origin: 'TP. Hồ Chí Minh',       dest: 'Hà Nội',           partner: sabeco,   branch: branchHCM, user: opHCM,  etd: '2026-04-05', eta: '2026-04-07' },
    // DRAFT — mới tạo, chưa có entries
    { code: 'IMP-2026-007', type: 'IMPORT',   mode: 'SEA_LCL', status: 'DRAFT',       origin: 'Singapore',             dest: 'TP. Hồ Chí Minh', partner: vinamilk, branch: branchHCM, user: opHCM,  etd: '2026-05-10', eta: '2026-05-25' },
    { code: 'EXP-2026-008', type: 'EXPORT',   mode: 'SEA_FCL', status: 'DRAFT',       origin: 'Đà Nẵng',               dest: 'Los Angeles, USA', partner: sabeco,   branch: branchDAD, user: adminId, etd: '2026-05-15', eta: '2026-06-10' },
    { code: 'IMP-2026-009', type: 'IMPORT',   mode: 'RAIL',    status: 'DRAFT',       origin: 'Chengdu, China',        dest: 'Hà Nội',           partner: masan,    branch: branchHAN, user: opHAN,  etd: '2026-05-20', eta: '2026-05-30' },
    // CANCELLED
    { code: 'IMP-2026-010', type: 'IMPORT',   mode: 'AIR',     status: 'CANCELLED',   origin: 'Dubai, UAE',            dest: 'TP. Hồ Chí Minh', partner: vinamilk, branch: branchHCM, user: opHCM,  etd: '2026-03-01', eta: '2026-03-02' },
  ];

  const jobIds: Record<string, number> = {};
  for (const j of jobs) {
    const closedAt  = j.status === 'CLOSED'    ? now() : null;
    const closedBy  = j.status === 'CLOSED'    ? adminId : null;
    await q(
      `INSERT IGNORE INTO jobs
         (jobCode, status, jobType, shipmentMode, partner_id, branch_id, assigned_user_id,
          etd, eta, origin, destination, created_by, updated_by, created_at, updated_at,
          closed_at, closed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [j.code, j.status, j.type, j.mode, j.partner, j.branch, j.user,
       j.etd, j.eta, j.origin, j.dest, adminId, adminId, now(), now(),
       closedAt, closedBy],
    );
    jobIds[j.code] = await getId('jobs', 'jobCode', j.code);
    log(`Job: ${j.code} [${j.status}]`);
  }

  // ── 5. Revenue & Cost entries ────────────────────────────────────────────────
  console.log('\n── Accounting entries');

  // Helper để insert entry
  async function addRevenue(
    jobCode: string, desc: string, currency: string,
    amount: number, rate: number, postedStatus: 'DRAFT' | 'POSTED',
    vendorNull = true,
  ) {
    const jobId = jobIds[jobCode];
    const localAmount = amount * rate;
    const status = postedStatus;
    const postedAt = status === 'POSTED' ? now() : null;
    const postedBy = status === 'POSTED' ? adminId : null;
    await q(
      `INSERT INTO revenue_entries
         (job_id, description, currency, amount, exchange_rate, local_amount,
          status, posted_at, posted_by, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, desc, currency, amount, rate, localAmount,
       status, postedAt, postedBy, adminId, adminId, now(), now()],
    );
  }

  async function addCost(
    jobCode: string, desc: string, currency: string,
    amount: number, rate: number, vendor: number | null,
    postedStatus: 'DRAFT' | 'POSTED',
  ) {
    const jobId = jobIds[jobCode];
    const localAmount = amount * rate;
    const status = postedStatus;
    const postedAt = status === 'POSTED' ? now() : null;
    const postedBy = status === 'POSTED' ? accId : null;
    await q(
      `INSERT INTO cost_entries
         (job_id, vendor_id, description, currency, amount, exchange_rate, local_amount,
          status, posted_at, posted_by, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, vendor, desc, currency, amount, rate, localAmount,
       status, postedAt, postedBy, adminId, adminId, now(), now()],
    );
  }

  // ── Job IMP-2026-001 (CLOSED, POSTED) ────────────────────────────────────
  await addRevenue('IMP-2026-001', 'Cước vận chuyển biển FCL',   'USD', 1800, 25200, 'POSTED');
  await addRevenue('IMP-2026-001', 'Phí THC cảng đích',          'VND', 4500000, 1, 'POSTED');
  await addRevenue('IMP-2026-001', 'Phí D/O (Delivery Order)',   'USD',  120, 25200, 'POSTED');
  await addCost(   'IMP-2026-001', 'Cước tàu COSCO',             'USD', 1200, 25200, cosco,   'POSTED');
  await addCost(   'IMP-2026-001', 'Phí trucking nội địa',       'VND', 3200000, 1, namphat,  'POSTED');
  await addCost(   'IMP-2026-001', 'Phí hải quan thông quan',    'VND', 1500000, 1, tancang,  'POSTED');
  log('Entries: IMP-2026-001 (6 entries, POSTED)');

  // ── Job EXP-2026-002 (CLOSED, POSTED) ────────────────────────────────────
  await addRevenue('EXP-2026-002', 'Cước vận chuyển biển LCL',   'USD',  950, 25100, 'POSTED');
  await addRevenue('EXP-2026-002', 'Phí đóng gói và kẹp chì',   'VND', 2800000, 1, 'POSTED');
  await addCost(   'EXP-2026-002', 'Cước tàu Evergreen',         'USD',  620, 25100, evgreen, 'POSTED');
  await addCost(   'EXP-2026-002', 'Phí CFS tại cảng',          'VND', 1800000, 1, tancang, 'POSTED');
  log('Entries: EXP-2026-002 (4 entries, POSTED)');

  // ── Job IMP-2026-003 (CLOSED, POSTED) ────────────────────────────────────
  await addRevenue('IMP-2026-003', 'Cước hàng không',            'EUR',  3500, 27500, 'POSTED');
  await addRevenue('IMP-2026-003', 'Phí handling tại kho',       'VND', 3000000, 1, 'POSTED');
  await addCost(   'IMP-2026-003', 'Cước hãng bay Lufthansa',    'EUR',  2400, 27500, kato,    'POSTED');
  await addCost(   'IMP-2026-003', 'Phí giao hàng nội địa',     'VND', 2200000, 1, namphat,  'POSTED');
  log('Entries: IMP-2026-003 (4 entries, POSTED)');

  // ── Job IMP-2026-004 (IN_PROGRESS, DRAFT) ────────────────────────────────
  await addRevenue('IMP-2026-004', 'Cước vận chuyển biển FCL',   'USD', 2100, 25300, 'DRAFT');
  await addRevenue('IMP-2026-004', 'Phí THC cảng Đà Nẵng',      'VND', 3800000, 1, 'DRAFT');
  await addCost(   'IMP-2026-004', 'Cước tàu COSCO',             'USD', 1450, 25300, cosco,   'DRAFT');
  await addCost(   'IMP-2026-004', 'Phí trucking Đà Nẵng',      'VND', 2500000, 1, namphat,  'DRAFT');
  log('Entries: IMP-2026-004 (4 entries, DRAFT)');

  // ── Job EXP-2026-005 (IN_PROGRESS, DRAFT) ────────────────────────────────
  await addRevenue('EXP-2026-005', 'Cước hàng không Hà Nội-Tokyo', 'USD', 1600, 25300, 'DRAFT');
  await addCost(   'EXP-2026-005', 'Cước hãng bay Vietnam Airlines', 'USD', 980, 25300, kato,  'DRAFT');
  log('Entries: EXP-2026-005 (2 entries, DRAFT)');

  // ── Job DOM-2026-006 (IN_PROGRESS, DRAFT) ────────────────────────────────
  await addRevenue('DOM-2026-006', 'Cước vận tải đường bộ HCM-HAN', 'VND', 18000000, 1, 'DRAFT');
  await addCost(   'DOM-2026-006', 'Chi phí xe tải + tài xế',       'VND', 12000000, 1, namphat, 'DRAFT');
  await addCost(   'DOM-2026-006', 'Chi phí xăng dầu',              'VND',  3500000, 1, null,    'DRAFT');
  log('Entries: DOM-2026-006 (3 entries, DRAFT)');

  // Jobs DRAFT (007, 008, 009) và CANCELLED (010) không có entries
  log('Jobs DRAFT/CANCELLED: không có entries (as expected)');

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n── Summary');
  const [branchCount]  = await q('SELECT COUNT(*) as n FROM branches');
  const [partnerCount] = await q('SELECT COUNT(*) as n FROM partners');
  const [userCount]    = await q('SELECT COUNT(*) as n FROM users');
  const [jobCount]     = await q('SELECT COUNT(*) as n FROM jobs');
  const [revCount]     = await q('SELECT COUNT(*) as n FROM revenue_entries');
  const [costCount]    = await q('SELECT COUNT(*) as n FROM cost_entries');

  console.log(`\n  branches:        ${branchCount.n}`);
  console.log(`  partners:        ${partnerCount.n}`);
  console.log(`  users:           ${userCount.n}`);
  console.log(`  jobs:            ${jobCount.n}`);
  console.log(`  revenue_entries: ${revCount.n}`);
  console.log(`  cost_entries:    ${costCount.n}`);
  console.log('\n✅  Seed completed!\n');

  console.log('── Tài khoản test:');
  console.log('  admin        / Admin@123   (SUPER_ADMIN)');
  console.log('  pham.bao     / Admin@123   (SUPER_ADMIN - Đà Nẵng)');
  console.log('  nguyen.lan   / Acc@12345   (ACCOUNTANT  - HCM)');
  console.log('  tran.hung    / Ops@12345   (OPERATION   - HCM)');
  console.log('  le.mai       / Ops@12345   (OPERATION   - HN)\n');

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error('\n❌  Seed failed:', e.message);
  process.exit(1);
});
