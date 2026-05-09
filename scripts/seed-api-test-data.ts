import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

const envPath = process.argv[2] ?? '.env';
dotenv.config({ path: envPath, override: true });

type Db = mysql.Connection;

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

async function query<T extends any[] = any[]>(db: Db, sql: string, params: any[] = []): Promise<T> {
  const [rows] = await db.query(sql, params);
  return rows as T;
}

async function tableExists(db: Db, tableName: string) {
  const rows = await query<any[]>(db, 'SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
}

async function columnExists(db: Db, tableName: string, columnName: string) {
  const rows = await query<any[]>(db, `SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function getId(db: Db, table: string, column: string, value: string): Promise<number> {
  const rows = await query<any[]>(db, `SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`, [value]);
  if (!rows.length) throw new Error(`Missing ${table}.${column}=${value}`);
  return Number(rows[0].id);
}

async function upsertPermission(db: Db, name: string, description: string) {
  await query(
    db,
    `INSERT INTO permissions (name, description)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE description = VALUES(description)`,
    [name, description],
  );
}

async function upsertRole(db: Db, name: string, description: string) {
  await query(
    db,
    `INSERT INTO roles (name, description)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE description = VALUES(description)`,
    [name, description],
  );
}

async function grantRolePermissions(db: Db, roleName: string, permissionNames: string[]) {
  await query(
    db,
    `INSERT IGNORE INTO role_permissions (role_id, permission_id)
     SELECT r.id, p.id
     FROM roles r
     JOIN permissions p ON p.name IN (${permissionNames.map(() => '?').join(',')})
     WHERE r.name = ?`,
    [...permissionNames, roleName],
  );
}

async function upsertBranch(db: Db, code: string, name: string) {
  await query(
    db,
    `INSERT INTO branches (code, name, address, isActive, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), address = VALUES(address), isActive = 1, updated_at = VALUES(updated_at)`,
    [code, name, `${name} API test address`, now(), now()],
  );
  return getId(db, 'branches', 'code', code);
}

async function upsertPartner(db: Db, code: string, name: string, partnerType: string) {
  await query(
    db,
    `INSERT INTO partners
       (code, name, partnerType, contactPerson, phone, email, address, taxCode, isActive, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       partnerType = VALUES(partnerType),
       contactPerson = VALUES(contactPerson),
       phone = VALUES(phone),
       email = VALUES(email),
       address = VALUES(address),
       taxCode = VALUES(taxCode),
       isActive = 1,
       updated_at = VALUES(updated_at)`,
    [
      code,
      name,
      partnerType,
      'API Test Contact',
      '0900000000',
      `${code.toLowerCase()}@example.com`,
      `${name} API test address`,
      `${code}-TAX`,
      now(),
      now(),
    ],
  );
  return getId(db, 'partners', 'code', code);
}

async function upsertUser(db: Db, username: string, email: string, fullName: string, roleName: string, branchId: number) {
  const password = await bcrypt.hash('ApiTest@123', 12);
  await query(
    db,
    `INSERT INTO users (username, email, password, full_name, branch_id, isActive, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       full_name = VALUES(full_name),
       branch_id = VALUES(branch_id),
       isActive = 1,
       updated_at = VALUES(updated_at)`,
    [username, email, password, fullName, branchId, now(), now()],
  );
  const userId = await getId(db, 'users', 'username', username);
  const roleId = await getId(db, 'roles', 'name', roleName);
  await query(db, 'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
  return userId;
}

async function upsertJob(
  db: Db,
  jobCode: string,
  status: string,
  partnerId: number,
  branchId: number,
  assignedUserId: number,
  agentId: number,
) {
  const optionalColumns = [
    ['agent_id', agentId],
    ['shipper', 'API Test Shipper'],
    ['consignee', 'API Test Consignee'],
    ['declaration_no', `${jobCode}-DECL`],
    ['business_type', 'Forwarding'],
    ['customs_lane', 'GREEN'],
    ['cargo_type', 'GENERAL'],
    ['booking_ref', `${jobCode}-BOOK`],
    ['vessel_name', 'API TEST VESSEL'],
    ['voyage_no', 'V001'],
    ['hbl', `${jobCode}-HBL`],
    ['mbl', `${jobCode}-MBL`],
    ['container_no', `${jobCode}-CONT`],
    ['seal_no', `${jobCode}-SEAL`],
    ['atd', null],
    ['ata', null],
    ['actual_delivery_date', null],
    ['pol', 'CNSHA'],
    ['pod', 'VNSGN'],
    ['archived_at', null],
    ['archived_by', null],
  ] as const;
  const existingOptional = [];
  for (const [column, value] of optionalColumns) {
    if (await columnExists(db, 'jobs', column)) existingOptional.push([column, value] as const);
  }

  const baseColumns = [
    'jobCode',
    'status',
    'jobType',
    'shipmentMode',
    'partner_id',
    'branch_id',
    'assigned_user_id',
    'etd',
    'eta',
    'origin',
    'destination',
    'notes',
    'created_by',
    'updated_by',
    'created_at',
    'updated_at',
    'closed_at',
    'closed_by',
  ];
  const baseValues = [
    jobCode,
    status,
    'IMPORT',
    'SEA_FCL',
    partnerId,
    branchId,
    assignedUserId,
    '2026-05-10',
    '2026-05-20',
    'Shanghai',
    'Ho Chi Minh City',
    'Seeded API test job',
    assignedUserId,
    assignedUserId,
    now(),
    now(),
    status === 'CLOSED' ? now() : null,
    status === 'CLOSED' ? assignedUserId : null,
  ];
  const columns = [...baseColumns, ...existingOptional.map(([column]) => column)];
  const values = [...baseValues, ...existingOptional.map(([, value]) => value)];
  const updateColumns = [
    'status',
    'partner_id',
    'branch_id',
    'assigned_user_id',
    'updated_by',
    'updated_at',
    'closed_at',
    'closed_by',
    ...existingOptional
      .map(([column]) => column)
      .filter((column) => !['archived_at', 'archived_by', 'atd', 'ata', 'actual_delivery_date'].includes(column)),
  ];
  const nullOnUpdate = existingOptional
    .map(([column]) => column)
    .filter((column) => ['archived_at', 'archived_by'].includes(column));

  await query(
    db,
    `INSERT INTO jobs (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE
       ${[
         ...updateColumns.map((column) => `${column} = VALUES(${column})`),
         ...nullOnUpdate.map((column) => `${column} = NULL`),
       ].join(', ')}`,
    values,
  );
  return getId(db, 'jobs', 'jobCode', jobCode);
}

async function upsertRevenue(db: Db, jobId: number, description: string, status: 'DRAFT' | 'POSTED', amount: number) {
  await query(db, 'DELETE FROM revenue_entries WHERE job_id = ? AND description = ?', [jobId, description]);
  const optionalColumns = [
    ['payment_status', status === 'POSTED' ? 'UNPAID' : 'UNPAID'],
    ['ref_number', `REV-${jobId}`],
    ['invoice_number', `INV-${jobId}`],
    ['doc_date', '2026-05-01'],
    ['due_date', '2026-06-01'],
  ] as const;
  const existingOptional = [];
  for (const [column, value] of optionalColumns) {
    if (await columnExists(db, 'revenue_entries', column)) existingOptional.push([column, value] as const);
  }
  const columns = [
    'job_id',
    'description',
    'currency',
    'amount',
    'exchange_rate',
    'local_amount',
    'status',
    ...existingOptional.map(([column]) => column),
    'posted_at',
    'posted_by',
    'notes',
    'created_by',
    'updated_by',
    'created_at',
    'updated_at',
  ];
  const values = [
    jobId,
    description,
    'VND',
    amount,
    1,
    amount,
    status,
    ...existingOptional.map(([, value]) => value),
    status === 'POSTED' ? now() : null,
    status === 'POSTED' ? 1 : null,
    'Seeded API revenue',
    1,
    1,
    now(),
    now(),
  ];
  await query(
    db,
    `INSERT INTO revenue_entries (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values,
  );
}

async function upsertCost(db: Db, jobId: number, vendorId: number, description: string, status: 'DRAFT' | 'POSTED', amount: number) {
  await query(db, 'DELETE FROM cost_entries WHERE job_id = ? AND description = ?', [jobId, description]);
  const optionalColumns = [
    ['payment_status', status === 'POSTED' ? 'UNPAID' : 'UNPAID'],
    ['ref_number', `COST-${jobId}`],
    ['invoice_number', `BILL-${jobId}`],
    ['doc_date', '2026-05-02'],
    ['due_date', '2026-06-02'],
  ] as const;
  const existingOptional = [];
  for (const [column, value] of optionalColumns) {
    if (await columnExists(db, 'cost_entries', column)) existingOptional.push([column, value] as const);
  }
  const columns = [
    'job_id',
    'vendor_id',
    'description',
    'currency',
    'amount',
    'exchange_rate',
    'local_amount',
    'status',
    ...existingOptional.map(([column]) => column),
    'posted_at',
    'posted_by',
    'notes',
    'created_by',
    'updated_by',
    'created_at',
    'updated_at',
  ];
  const values = [
    jobId,
    vendorId,
    description,
    'VND',
    amount,
    1,
    amount,
    status,
    ...existingOptional.map(([, value]) => value),
    status === 'POSTED' ? now() : null,
    status === 'POSTED' ? 1 : null,
    'Seeded API cost',
    1,
    1,
    now(),
    now(),
  ];
  await query(
    db,
    `INSERT INTO cost_entries (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values,
  );
}

async function seedOptionalPhase2(db: Db, customerId: number, vendorId: number, jobId: number) {
  if (await tableExists(db, 'debt_policies')) {
    const activeColumn = await columnExists(db, 'debt_policies', 'is_active') ? 'is_active' : 'isActive';
    await query(
      db,
      `INSERT INTO debt_policies
         (partner_id, max_debt_amount, max_debt_age_days, ${activeColumn}, created_by, updated_by, created_at, updated_at)
       VALUES (?, 9999999999, 3650, 1, 1, 1, ?, ?)
       ON DUPLICATE KEY UPDATE
         max_debt_amount = VALUES(max_debt_amount),
         max_debt_age_days = VALUES(max_debt_age_days),
         ${activeColumn} = 1,
         updated_at = VALUES(updated_at)`,
      [customerId, now(), now()],
    );
  }

  if (await tableExists(db, 'payment_requests')) {
    await query(db, 'DELETE FROM payment_requests WHERE vendor_id = ? AND reason = ?', [
      vendorId,
      'Seeded API payment request',
    ]);
    await query(
      db,
      `INSERT INTO payment_requests
         (job_id, vendor_id, currency, amount, requested_payment_date, reason, status,
          created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, 'VND', 1500000, '2026-05-15', 'Seeded API payment request',
         'PENDING_DEPARTMENT_APPROVAL', 1, 1, ?, ?)`,
      [jobId, vendorId, now(), now()],
    );
  }

}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  try {
    console.log(`Seeding API test data into ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME} using ${envPath}`);

    const permissions = [
      ['user:manage', 'Create/edit/deactivate users'],
      ['role:manage', 'Create/edit roles and assign permissions'],
      ['branch:manage', 'Create/edit branches'],
      ['partner:manage', 'Create/edit partners'],
      ['job:create', 'Create new jobs'],
      ['job:edit', 'Edit job details and status'],
      ['job:close', 'Close or cancel jobs'],
      ['accounting:view', 'View accounting entries and reports'],
      ['accounting:create', 'Create and edit accounting entries'],
      ['accounting:post', 'Post accounting entries'],
      ['auditlog:view', 'View audit logs'],
      ['report:view', 'View reports'],
    ];
    for (const [name, description] of permissions) await upsertPermission(db, name, description);

    await upsertRole(db, 'SUPER_ADMIN', 'Full system access');
    await upsertRole(db, 'ACCOUNTANT', 'Accounting and finance access');
    await upsertRole(db, 'OPERATION', 'Operations and jobs access');
    await grantRolePermissions(db, 'SUPER_ADMIN', permissions.map(([name]) => name));
    await grantRolePermissions(db, 'ACCOUNTANT', ['accounting:view', 'accounting:create', 'accounting:post', 'auditlog:view', 'report:view']);
    await grantRolePermissions(db, 'OPERATION', ['partner:manage', 'job:create', 'job:edit', 'job:close']);

    const branchId = await upsertBranch(db, 'API-HCM', 'API Test HCM Branch');
    const customerId = await upsertPartner(db, 'API-CUST-01', 'API Test Customer', 'CUSTOMER');
    const vendorId = await upsertPartner(db, 'API-VEND-01', 'API Test Vendor', 'VENDOR');
    const agentId = await upsertPartner(db, 'API-AGENT-01', 'API Test Agent', 'BOTH');
    const userId = await upsertUser(db, 'api.tester', 'api.tester@example.com', 'API Test User', 'SUPER_ADMIN', branchId);

    const draftJobId = await upsertJob(db, 'API-JOB-DRAFT-001', 'DRAFT', customerId, branchId, userId, agentId);
    const activeJobId = await upsertJob(db, 'API-JOB-ACTIVE-001', 'IN_PROGRESS', customerId, branchId, userId, agentId);
    const closedJobId = await upsertJob(db, 'API-JOB-CLOSED-001', 'CLOSED', customerId, branchId, userId, agentId);

    await upsertRevenue(db, draftJobId, 'API TEST Draft Revenue', 'DRAFT', 5000000);
    await upsertCost(db, draftJobId, vendorId, 'API TEST Draft Cost', 'DRAFT', 2500000);
    await upsertRevenue(db, activeJobId, 'API TEST Posted Revenue', 'POSTED', 12000000);
    await upsertCost(db, activeJobId, vendorId, 'API TEST Posted Cost', 'POSTED', 7000000);
    await upsertRevenue(db, closedJobId, 'API TEST Closed Revenue', 'POSTED', 20000000);
    await upsertCost(db, closedJobId, vendorId, 'API TEST Closed Cost', 'POSTED', 11000000);

    await seedOptionalPhase2(db, customerId, vendorId, activeJobId);

    console.log('Seed complete.');
    console.log(`Login user: api.tester / ApiTest@123`);
    console.log(`Jobs: API-JOB-DRAFT-001=${draftJobId}, API-JOB-ACTIVE-001=${activeJobId}, API-JOB-CLOSED-001=${closedJobId}`);
    console.log(`Partners: API-CUST-01=${customerId}, API-VEND-01=${vendorId}, API-AGENT-01=${agentId}`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
