/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
/**
 * End-to-end business workflow based on ../../Test_work_flow.txt.
 *
 * Prerequisites:
 *   1. API is running at BASE_URL (default: http://localhost:3000/api/v1)
 *   2. Admin login is available (default: admin / Admin@123)
 *
 * Run:
 *   npm run e2e:business-workflow
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000/api/v1';
const USERNAME = process.env.E2E_USERNAME ?? 'admin';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Admin@123';
const CLEANUP_AFTER_RUN = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.E2E_CLEANUP ?? '').toLowerCase(),
);

type ApiPage<T> = {
  data: T[];
  meta?: { total?: number };
};

type IdStatus = {
  id: number;
  status?: string;
  amount?: number | string;
  balance?: number | string;
};

type Context = {
  token: string;
  runId: string;
  runLabel: string;
  customerId: number;
  vendorId: number;
  employeeId: number;
  cashAccountId: number;
  bankAccountId: number;
  pricingIds: {
    customs: number;
    trucking20: number;
    trucking40: number;
    lcl1t: number;
    lcl3t: number;
    lcl5t: number;
  };
};

type RunArtifacts = {
  partnerIds: number[];
  employeeIds: number[];
  cashAccountIds: number[];
  pricingIds: number[];
  branchIds: number[];
  jobIds: number[];
  advanceIds: number[];
  debitNoteIds: number[];
  revenueIds: number[];
  costIds: number[];
  cobIds: number[];
  transactionIds: number[];
};

type ScenarioOptions = {
  branchCode: string;
  branchName: string;
  jobCount: number;
  debitAmounts: number[];
};

async function req<T = any>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`[${method} ${path}] HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function money(value: number | string | undefined) {
  return Number(value ?? 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pass(message: string) {
  console.log(`  OK ${message}`);
}

function createArtifacts(): RunArtifacts {
  return {
    partnerIds: [],
    employeeIds: [],
    cashAccountIds: [],
    pricingIds: [],
    branchIds: [],
    jobIds: [],
    advanceIds: [],
    debitNoteIds: [],
    revenueIds: [],
    costIds: [],
    cobIds: [],
    transactionIds: [],
  };
}

function remember(list: number[], id?: number) {
  if (id && !list.includes(id)) list.push(id);
}

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^"(.*)"$/, '$1');
    result[key] = value;
  }
  return result;
}

async function login() {
  const auth = await req<{ accessToken: string }>('POST', '/auth/login', {
    username: USERNAME,
    password: PASSWORD,
  });
  assert(auth.accessToken, 'Login did not return accessToken');
  pass('Đăng nhập tài khoản quản trị');
  return auth.accessToken;
}

async function createBaseData(token: string, artifacts: RunArtifacts): Promise<Context> {
  const runId = Date.now().toString();
  const runLabel = `Kịch bản test ${runId}`;

  const customer = await req<IdStatus>('POST', '/partners', {
    code: `WF-CUST-${runId}`,
    name: `Khách hàng test ${runId}`,
    partnerType: 'CUSTOMER',
    contactPerson: 'Liên hệ khách test',
    phone: '0900000000',
    email: `khach-test-${runId}@example.com`,
  }, token);
  remember(artifacts.partnerIds, customer.id);

  const vendor = await req<IdStatus>('POST', '/partners', {
    code: `WF-VEND-${runId}`,
    name: `Nhà cung cấp test ${runId}`,
    partnerType: 'VENDOR',
    contactPerson: 'Liên hệ NCC test',
    phone: '0911111111',
    email: `ncc-test-${runId}@example.com`,
  }, token);
  remember(artifacts.partnerIds, vendor.id);

  const employee = await req<IdStatus>('POST', '/hr/employees', {
    employeeCode: `WF-EMP-${runId}`,
    fullName: `Nhân viên test ${runId}`,
    department: 'Vận hành',
    position: 'Điều phối',
    hireDate: today(),
    status: 'ACTIVE',
    email: `nhan-vien-test-${runId}@example.com`,
  }, token);
  remember(artifacts.employeeIds, employee.id);

  const cash = await req<IdStatus>('POST', '/treasury/accounts', {
    code: `WF-CASH-${runId}`,
    name: `Quỹ tiền mặt test ${runId}`,
    type: 'CASH',
    currency: 'VND',
    balance: 1000000000,
  }, token);
  remember(artifacts.cashAccountIds, cash.id);

  const bank = await req<IdStatus>('POST', '/treasury/accounts', {
    code: `WF-BANK-${runId}`,
    name: `Tài khoản ngân hàng test ${runId}`,
    type: 'BANK',
    currency: 'VND',
    bankName: 'Ngân hàng test',
    accountNumber: runId,
    balance: 0,
  }, token);
  remember(artifacts.cashAccountIds, bank.id);

  const createPrice = (body: Record<string, unknown>) =>
    req<IdStatus>('POST', '/pricing', {
      partnerId: customer.id,
      currency: 'VND',
      effectiveFrom: today(),
      isActive: true,
      ...body,
    }, token);

  const customs = await createPrice({
    serviceType: 'CUSTOMS',
    unit: 'DECLARATION',
    amount: 1000000,
    notes: 'Thủ tục hải quan 1.000.000',
  });
  remember(artifacts.pricingIds, customs.id);
  const trucking20 = await createPrice({
    serviceType: 'TRUCKING',
    shipmentMode: 'SEA_FCL',
    unit: '20',
    amount: 3000000,
    notes: 'Vận chuyển container 20',
  });
  remember(artifacts.pricingIds, trucking20.id);
  const trucking40 = await createPrice({
    serviceType: 'TRUCKING',
    shipmentMode: 'SEA_FCL',
    unit: '40',
    amount: 4000000,
    notes: 'Vận chuyển container 40',
  });
  remember(artifacts.pricingIds, trucking40.id);
  const lcl1t = await createPrice({
    serviceType: 'LCL',
    shipmentMode: 'SEA_LCL',
    unit: 'TON',
    minQuantity: 0,
    maxQuantity: 1,
    amount: 1000000,
    notes: 'Hàng lẻ 1 tấn',
  });
  remember(artifacts.pricingIds, lcl1t.id);
  const lcl3t = await createPrice({
    serviceType: 'LCL',
    shipmentMode: 'SEA_LCL',
    unit: 'TON',
    minQuantity: 1,
    maxQuantity: 3,
    amount: 3000000,
    notes: 'Hàng lẻ trên 1 đến 3 tấn',
  });
  remember(artifacts.pricingIds, lcl3t.id);
  const lcl5t = await createPrice({
    serviceType: 'LCL',
    shipmentMode: 'SEA_LCL',
    unit: 'TON',
    minQuantity: 3,
    maxQuantity: 5,
    amount: 4000000,
    notes: 'Hàng lẻ 3 đến 5 tấn',
  });
  remember(artifacts.pricingIds, lcl5t.id);

  pass('Tạo dữ liệu nền: khách hàng, nhà cung cấp, nhân viên, quỹ và báo giá');

  return {
    token,
    runId,
    runLabel,
    customerId: customer.id,
    vendorId: vendor.id,
    employeeId: employee.id,
    cashAccountId: cash.id,
    bankAccountId: bank.id,
    pricingIds: {
      customs: customs.id,
      trucking20: trucking20.id,
      trucking40: trucking40.id,
      lcl1t: lcl1t.id,
      lcl3t: lcl3t.id,
      lcl5t: lcl5t.id,
    },
  };
}

async function createBranchScenario(ctx: Context, options: ScenarioOptions, artifacts: RunArtifacts) {
  const token = ctx.token;
  const branch = await req<IdStatus>('POST', '/branches', {
    code: `${options.branchCode}-${ctx.runId}`,
    name: `${options.branchName} ${ctx.runId}`,
  }, token);
  remember(artifacts.branchIds, branch.id);

  const jobs: IdStatus[] = [];
  for (let i = 0; i < options.jobCount; i += 1) {
    const job = await req<IdStatus>('POST', '/jobs', {
      jobCode: `${options.branchCode}-JOB-${i + 1}-${ctx.runId}`,
      jobType: 'IMPORT',
      shipmentMode: i % 2 === 0 ? 'SEA_FCL' : 'SEA_LCL',
      partnerId: ctx.customerId,
      branchId: branch.id,
      assignedUserId: 1,
      shipper: 'Người gửi test',
      consignee: 'Người nhận test',
      declarationNo: `${options.branchCode}-DEC-${i + 1}-${ctx.runId}`,
      businessType: 'Giao nhận',
      customsLane: 'GREEN',
      cargoType: i % 2 === 0 ? 'FCL' : 'LCL',
      bookingRef: `${options.branchCode}-BOOK-${i + 1}-${ctx.runId}`,
      containerNo: `${options.branchCode}-CONT-${i + 1}`,
      pol: 'CNSHA',
      pod: 'VNSGN',
      origin: 'Thượng Hải',
      destination: 'Hồ Chí Minh',
      eta: plusDays(7),
      notes: 'Job test theo workflow, công nợ khách 30 ngày',
    }, token);
    jobs.push(job);
    remember(artifacts.jobIds, job.id);
  }
  pass(`${options.branchName}: tạo ${options.jobCount} file hàng`);

  const advance = await req<IdStatus>('POST', '/advances', {
    employeeId: ctx.employeeId,
    jobId: jobs[0].id,
    currency: 'VND',
    amount: 20000000,
    dueDate: plusDays(30),
    purpose: `${options.branchName}: tạm ứng làm hàng cho các file test`,
  }, token);
  remember(artifacts.advanceIds, advance.id);
  await req<IdStatus>('PATCH', `/advances/${advance.id}/approve`, undefined, token);
  const advanceCashTx = await req<IdStatus>('POST', '/treasury/transactions', {
    cashAccountId: ctx.cashAccountId,
    transactionType: 'PAYMENT',
    transactionDate: today(),
    currency: 'VND',
    amount: 20000000,
    description: `${options.branchName}: chi tạm ứng bằng tiền mặt`,
    jobId: jobs[0].id,
    referenceType: 'ADVANCE',
    referenceId: advance.id,
  }, token);
  remember(artifacts.transactionIds, advanceCashTx.id);
  pass(`${options.branchName}: tạo và chi tạm ứng 20.000.000 bằng tiền mặt`);

  const lookup = await req<ApiPage<IdStatus>>(
    'GET',
    `/debit-notes/lookup-pricing?partnerId=${ctx.customerId}&jobId=${jobs[0].id}`,
    undefined,
    token,
  );
  const lookupIds = new Set(lookup.data.map((item) => item.id));
  assert(lookupIds.has(ctx.pricingIds.customs), 'Debit note pricing lookup is missing customs quotation');
  assert(lookupIds.has(ctx.pricingIds.trucking20), 'Debit note pricing lookup is missing trucking 20 quotation');
  assert(lookupIds.has(ctx.pricingIds.trucking40), 'Debit note pricing lookup is missing trucking 40 quotation');

  const revenueIds: number[] = [];
  const testedDebitCount = Math.min(2, jobs.length);
  for (let i = 0; i < testedDebitCount; i += 1) {
    const amount = options.debitAmounts[i] ?? options.debitAmounts[options.debitAmounts.length - 1];
    const job = jobs[i];
    const debit = await req<IdStatus>('POST', '/debit-notes', {
      partnerId: ctx.customerId,
      jobId: job.id,
      currency: 'VND',
      docDate: today(),
      dueDate: plusDays(30),
      description: `${options.branchName}: bảng kê lấy giá từ báo giá`,
      lineItems: [
        {
          serviceType: 'CUSTOMS',
          description: 'Thủ tục hải quan từ báo giá',
          quantity: 1,
          unitPrice: 1000000,
          pricingId: ctx.pricingIds.customs,
        },
        {
          serviceType: 'TRUCKING',
          description: 'Cước vận chuyển từ báo giá, điều chỉnh theo số tiền cần thu',
          quantity: 1,
          unitPrice: amount - 1000000,
          pricingId: i % 2 === 0 ? ctx.pricingIds.trucking20 : ctx.pricingIds.trucking40,
        },
      ],
    }, token);
    remember(artifacts.debitNoteIds, debit.id);
    assert(money(debit.amount) === amount, `${options.branchName}: debit amount should be ${amount}`);
    const postedDebit = await req<IdStatus>('PATCH', `/debit-notes/${debit.id}/post`, undefined, token);
    assert(postedDebit.status === 'POSTED', `${options.branchName}: debit note should be POSTED`);
    const sentDebit = await req<IdStatus>('POST', `/debit-notes/${debit.id}/send`, undefined, token);
    assert(sentDebit.status === 'SENT', `${options.branchName}: debit note should be SENT as SOA-ready`);

    const revenue = await req<IdStatus>('POST', '/accounting/revenue', {
      jobId: job.id,
      description: `${options.branchName}: khoản phải thu theo bảng kê ${debit.id}`,
      currency: 'VND',
      amount,
      exchangeRate: 1,
      localAmount: amount,
      docDate: today(),
      dueDate: plusDays(30),
      refNumber: `DN-${debit.id}`,
    }, token);
    remember(artifacts.revenueIds, revenue.id);
    await req<IdStatus>('PATCH', `/accounting/revenue/${revenue.id}/post`, undefined, token);
    revenueIds.push(revenue.id);
  }
  pass(`${options.branchName}: tạo bảng kê từ báo giá, chốt và gửi khách`);

  const advanceSettlementTx = await req<IdStatus>('POST', '/treasury/transactions', {
    cashAccountId: ctx.cashAccountId,
    transactionType: 'PAYMENT',
    transactionDate: today(),
    currency: 'VND',
    amount: 25000000,
    description: `${options.branchName}: chi hoàn ứng bằng tiền mặt`,
    jobId: jobs[0].id,
    referenceType: 'ADVANCE_SETTLEMENT',
    referenceId: advance.id,
  }, token);
  remember(artifacts.transactionIds, advanceSettlementTx.id);
  const settledAdvance = await req<IdStatus>('PATCH', `/advances/${advance.id}/settle`, {
    amount: 20000000,
  }, token);
  assert(settledAdvance.status === 'SETTLED', `${options.branchName}: advance should be settled`);
  pass(`${options.branchName}: hoàn ứng và ghi nhận chi 25.000.000`);

  for (const job of jobs.slice(0, testedDebitCount)) {
    const coCost = await req<IdStatus>('POST', '/accounting/cost', {
      jobId: job.id,
      vendorId: ctx.vendorId,
      description: `${options.branchName}: chi phí C/O trả trực tiếp`,
      currency: 'VND',
      amount: 500000,
      exchangeRate: 1,
      localAmount: 500000,
      docDate: today(),
      dueDate: today(),
    }, token);
    remember(artifacts.costIds, coCost.id);
    await req<IdStatus>('PATCH', `/accounting/cost/${coCost.id}/post`, undefined, token);
  }
  const coCashTx = await req<IdStatus>('POST', '/treasury/transactions', {
    cashAccountId: ctx.cashAccountId,
    transactionType: 'PAYMENT',
    transactionDate: today(),
    currency: 'VND',
    amount: 1000000,
    description: `${options.branchName}: chi phí C/O bằng tiền mặt`,
    referenceType: 'COST',
  }, token);
  remember(artifacts.transactionIds, coCashTx.id);
  pass(`${options.branchName}: thêm chi phí C/O cho 2 file và chi 1.000.000 tiền mặt`);

  const cobCost = await req<IdStatus>('POST', '/accounting/cost', {
    jobId: jobs[0].id,
    vendorId: ctx.vendorId,
    description: `${options.branchName}: phí nâng hạ chi hộ`,
    currency: 'VND',
    amount: 5000000,
    exchangeRate: 1,
    localAmount: 5000000,
    docDate: today(),
    dueDate: today(),
  }, token);
  remember(artifacts.costIds, cobCost.id);
  await req<IdStatus>('PATCH', `/accounting/cost/${cobCost.id}/post`, undefined, token);
  const cob = await req<{ cobEntry: IdStatus; receivable: IdStatus }>(
    'POST',
    `/accounting/cost/${cobCost.id}/charge-on-behalf`,
    { partnerId: ctx.customerId },
    token,
  );
  remember(artifacts.cobIds, cob.cobEntry.id);
  remember(artifacts.revenueIds, cob.receivable.id);
  assert(cob.receivable.id > 0, `${options.branchName}: marking cost as COB should create receivable`);
  assert(money(cob.receivable.amount) === 5000000, `${options.branchName}: COB receivable should be 5,000,000`);
  pass(`${options.branchName}: chi hộ tự tạo khoản thu hộ tương ứng`);

  const receivables = await req<any>('GET', '/reports/receivables', undefined, token);
  assert(receivables, `${options.branchName}: receivables report should return data`);

  for (const revenueId of revenueIds) {
    await req<IdStatus>('POST', '/accounting/payments/receipts', {
      entryId: revenueId,
      amount: options.debitAmounts[revenueIds.indexOf(revenueId)] ?? options.debitAmounts[0],
      paymentDate: today(),
      method: 'BANK',
      accountRef: `WF-BANK-${ctx.runId}`,
      notes: `${options.branchName}: khách thanh toán qua ngân hàng`,
    }, token);
  }
  const customerBankTx = await req<IdStatus>('POST', '/treasury/transactions', {
    cashAccountId: ctx.bankAccountId,
    transactionType: 'RECEIPT',
    transactionDate: today(),
    currency: 'VND',
    amount: revenueIds.reduce((sum, _, index) => sum + (options.debitAmounts[index] ?? 0), 0),
    description: `${options.branchName}: khách hàng thanh toán qua ngân hàng`,
    partnerId: ctx.customerId,
    referenceType: 'CUSTOMER_PAYMENT',
  }, token);
  remember(artifacts.transactionIds, customerBankTx.id);
  pass(`${options.branchName}: khách hàng thanh toán các file qua ngân hàng`);

  const officeCashTx = await req<IdStatus>('POST', '/treasury/transactions', {
    cashAccountId: ctx.cashAccountId,
    transactionType: 'PAYMENT',
    transactionDate: today(),
    currency: 'VND',
    amount: 2000000,
    description: `${options.branchName}: chi văn phòng phẩm bằng tiền mặt`,
    referenceType: 'OFFICE_SUPPLIES',
  }, token);
  remember(artifacts.transactionIds, officeCashTx.id);
  const officeBankTx = await req<IdStatus>('POST', '/treasury/transactions', {
    cashAccountId: ctx.bankAccountId,
    transactionType: 'PAYMENT',
    transactionDate: today(),
    currency: 'VND',
    amount: 1000000,
    description: `${options.branchName}: chi văn phòng phẩm chuyển khoản`,
    referenceType: 'OFFICE_SUPPLIES',
  }, token);
  remember(artifacts.transactionIds, officeBankTx.id);
  const anhHoaCashTx = await req<IdStatus>('POST', '/treasury/transactions', {
    cashAccountId: ctx.cashAccountId,
    transactionType: 'RECEIPT',
    transactionDate: today(),
    currency: 'VND',
    amount: 10000000,
    description: `${options.branchName}: thu tiền Anh Hòa nhập quỹ`,
    referenceType: 'OTHER_RECEIPT',
  }, token);
  remember(artifacts.transactionIds, anhHoaCashTx.id);
  pass(`${options.branchName}: chi văn phòng phẩm và thu tiền Anh Hòa nhập quỹ`);

  const balances = await req<IdStatus[]>('GET', '/treasury/balances', undefined, token);
  const cashBalance = balances.find((item) => item.id === ctx.cashAccountId);
  const bankBalance = balances.find((item) => item.id === ctx.bankAccountId);
  assert(cashBalance, `${options.branchName}: cash account should be present in balances`);
  assert(bankBalance, `${options.branchName}: bank account should be present in balances`);

  const branchSummary = await req<any>('GET', `/reports/branch-summary?dateFrom=${today()}&dateTo=${plusDays(30)}`, undefined, token);
  assert(branchSummary, `${options.branchName}: branch debt/statistics report should return data`);
  pass(`${options.branchName}: báo cáo công nợ và thống kê có dữ liệu`);

  return { branch, jobs };
}

async function cleanupArtifacts(ctx: Context, artifacts: RunArtifacts) {
  const envFile = join(process.cwd(), '.env');
  const envValues = parseEnvFile(envFile);
  const dbConfig = {
    host: process.env.DB_HOST ?? envValues.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? envValues.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? envValues.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? envValues.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? envValues.DB_NAME,
    multipleStatements: false,
    connectTimeout: 15000,
  };

  let db: mysql.Connection | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      db = await mysql.createConnection(dbConfig);
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(`  WARN Cleanup DB attempt ${attempt} failed. Retrying...`);
        await sleep(2000);
      }
    }
  }

  if (!db) {
    throw new Error(`Không thể kết nối DB để cleanup sau 3 lần thử: ${String(lastError)}`);
  }

  const deleteByIds = async (table: string, ids: number[]) => {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(', ');
    await db.query(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
  };

  const deleteByForeignIds = async (table: string, column: string, ids: number[]) => {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(', ');
    await db.query(`DELETE FROM ${table} WHERE ${column} IN (${placeholders})`, ids);
  };

  try {
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await deleteByIds('cash_transactions', artifacts.transactionIds);
    await deleteByIds('cob_entries', artifacts.cobIds);
    await deleteByForeignIds('debit_note_lines', 'debit_note_id', artifacts.debitNoteIds);
    await deleteByIds('debit_notes', artifacts.debitNoteIds);
    await deleteByIds('revenue_entries', artifacts.revenueIds);
    await deleteByIds('cost_entries', artifacts.costIds);
    await deleteByIds('employee_advances', artifacts.advanceIds);
    await deleteByForeignIds('job_milestones', 'job_id', artifacts.jobIds);
    await deleteByIds('jobs', artifacts.jobIds);
    await deleteByIds('service_prices', artifacts.pricingIds);
    await deleteByIds('cash_accounts', artifacts.cashAccountIds);
    await deleteByIds('employees', artifacts.employeeIds);
    await deleteByIds('partners', artifacts.partnerIds);
    await deleteByIds('branches', artifacts.branchIds);
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    try {
      await db.end();
    } catch {}
  }

  pass(`${ctx.runLabel}: đã xóa dữ liệu test theo cờ E2E_CLEANUP`);
}

async function main() {
  console.log('\n=== Chạy workflow nghiệp vụ từ Test_work_flow.txt ===\n');
  console.log(`Cleanup sau khi test: ${CLEANUP_AFTER_RUN ? 'BẬT' : 'TẮT'}\n`);

  const artifacts = createArtifacts();
  let ctx: Context | null = null;
  let cleanupAttempted = false;

  try {
    const token = await login();
    ctx = await createBaseData(token, artifacts);

    await createBranchScenario(ctx, {
      branchCode: 'WF-HCM',
      branchName: 'Chi nhánh HCM',
      jobCount: 2,
      debitAmounts: [30000000, 25000000],
    }, artifacts);

    await createBranchScenario(ctx, {
      branchCode: 'WF-HN',
      branchName: 'Chi nhánh Hà Nội',
      jobCount: 3,
      debitAmounts: [30000000, 25000000],
    }, artifacts);

    await createBranchScenario(ctx, {
      branchCode: 'WF-CONT',
      branchName: 'Chi nhánh xe container',
      jobCount: 2,
      debitAmounts: [30000000, 25000000],
    }, artifacts);

    await createBranchScenario(ctx, {
      branchCode: 'WF-TRUCK',
      branchName: 'Chi nhánh xe tải',
      jobCount: 2,
      debitAmounts: [30000000, 25000000],
    }, artifacts);

    if (CLEANUP_AFTER_RUN) {
      cleanupAttempted = true;
      await cleanupArtifacts(ctx, artifacts);
    }

    console.log('\n=== Workflow nghiệp vụ đã chạy thành công ===\n');
  } catch (error) {
    if (CLEANUP_AFTER_RUN && ctx && !cleanupAttempted) {
      try {
        await cleanupArtifacts(ctx, artifacts);
      } catch (cleanupError) {
        console.error('\nCleanup thất bại:', cleanupError);
      }
    }
    throw error;
  }
}

main().catch((error) => {
  console.error('\nBusiness workflow failed:', error);
  process.exit(1);
});
