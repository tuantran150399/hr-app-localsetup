/**
 * End-to-end workflow proof script.
 * Run:  npx ts-node scripts/e2e-workflow.ts
 *
 * Flow:
 *   1. Login as admin → get JWT
 *   2. Create a Job
 *   3. Create a Revenue entry (DRAFT)
 *   4. Create a Cost entry (DRAFT)
 *   5. Post all entries in one atomic call
 *   6. Get profit summary
 *   7. Close the job
 *   8. Verify CANCELLED-job guard (create new job, cancel it, try to post → expect 400)
 */

const BASE = 'http://localhost:3000/api/v1';

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
    throw new Error(
      `[${method} ${path}] HTTP ${res.status}: ${JSON.stringify(json)}`,
    );
  }
  return json as T;
}

function pass(msg: string) {
  console.log(`  ✅ ${msg}`);
}
function fail(msg: string, err?: unknown) {
  console.error(`  ❌ ${msg}`, err ?? '');
}

async function main() {
  console.log('\n=== ERP Logistics E2E Workflow ===\n');
  let token: string;
  let jobId: number;
  let revId: number;
  let costId: number;

  // ── Step 1: Login ──────────────────────────────────────────────────────────
  try {
    const r = await req<{ accessToken: string }>('POST', '/auth/login', {
      username: 'admin',
      password: 'Admin@123',
    });
    token = r.accessToken;
    pass('Login → JWT received');
  } catch (e) {
    fail('Login failed', e);
    process.exit(1);
  }

  // ── Step 2: Create Job ─────────────────────────────────────────────────────
  try {
    const job = await req<{ id: number }>(
      'POST',
      '/jobs',
      {
        jobCode: `E2E-${Date.now()}`,
        jobType: 'IMPORT',
        shipmentMode: 'SEA_FCL',
        status: 'DRAFT',
        origin: 'Shanghai',
        destination: 'Ho Chi Minh',
      },
      token,
    );
    jobId = job.id;
    pass(`Create Job → id=${jobId}`);
  } catch (e) {
    fail('Create Job failed', e);
    process.exit(1);
  }

  // ── Step 3: Create Revenue entry ──────────────────────────────────────────
  try {
    const rev = await req<{ id: number }>(
      'POST',
      '/accounting/revenue',
      {
        jobId,
        description: 'Ocean freight revenue',
        currency: 'USD',
        amount: 1000,
        exchangeRate: 25000,
        localAmount: 25000000,
      },
      token,
    );
    revId = rev.id;
    pass(`Create Revenue entry → id=${revId} (DRAFT)`);
  } catch (e) {
    fail('Create Revenue entry failed', e);
    process.exit(1);
  }

  // ── Step 4: Create Cost entry ──────────────────────────────────────────────
  try {
    const cost = await req<{ id: number }>(
      'POST',
      '/accounting/cost',
      {
        jobId,
        description: 'Trucking cost',
        currency: 'VND',
        amount: 5000000,
        exchangeRate: 1,
        localAmount: 5000000,
      },
      token,
    );
    costId = cost.id;
    pass(`Create Cost entry → id=${costId} (DRAFT)`);
  } catch (e) {
    fail('Create Cost entry failed', e);
    process.exit(1);
  }

  // ── Step 5: Post all entries atomically ───────────────────────────────────
  try {
    const result = await req<{
      postedRevenue: number;
      postedCost: number;
      message: string;
    }>('POST', `/accounting/post-all/job/${jobId}`, undefined, token);
    if (result.postedRevenue !== 1 || result.postedCost !== 1)
      throw new Error(`Expected 1+1, got ${result.postedRevenue}+${result.postedCost}`);
    pass(`Post all entries → ${result.message}`);
  } catch (e) {
    fail('Post all entries failed', e);
    process.exit(1);
  }

  // ── Step 6: Profit summary ────────────────────────────────────────────────
  try {
    const summary = await req<{
      profit: number;
      totalRevenue: number;
      totalCost: number;
    }>('GET', `/accounting/profit/job/${jobId}`, undefined, token);
    const expectedProfit = 25000000 - 5000000;
    if (summary.profit !== expectedProfit)
      throw new Error(
        `Expected profit ${expectedProfit}, got ${summary.profit}`,
      );
    pass(
      `Profit summary → revenue=${summary.totalRevenue} cost=${summary.totalCost} profit=${summary.profit}`,
    );
  } catch (e) {
    fail('Profit summary failed', e);
    process.exit(1);
  }

  // ── Step 7: Close the job ─────────────────────────────────────────────────
  try {
    const closed = await req<{ status: string }>(
      'PATCH',
      `/jobs/${jobId}/close`,
      undefined,
      token,
    );
    if (closed.status !== 'CLOSED') throw new Error(`Job status = ${closed.status}`);
    pass(`Close Job → status=CLOSED`);
  } catch (e) {
    fail('Close job failed', e);
    process.exit(1);
  }

  // ── Step 8: Guard — cannot post entries for CANCELLED job ─────────────────
  let guardJobId: number;
  let guardRevId: number;
  try {
    const gj = await req<{ id: number }>(
      'POST',
      '/jobs',
      {
        jobCode: `E2E-GUARD-${Date.now()}`,
        jobType: 'EXPORT',
        shipmentMode: 'AIR',
        origin: 'Hanoi',
        destination: 'Tokyo',
      },
      token,
    );
    guardJobId = gj.id;

    const gr = await req<{ id: number }>(
      'POST',
      '/accounting/revenue',
      {
        jobId: guardJobId,
        description: 'Test guard revenue',
        currency: 'USD',
        amount: 100,
        exchangeRate: 25000,
        localAmount: 2500000,
      },
      token,
    );
    guardRevId = gr.id;

    await req('PATCH', `/jobs/${guardJobId}/cancel`, undefined, token);

    // This should throw 400
    try {
      await req('PATCH', `/accounting/revenue/${guardRevId}/post`, undefined, token);
      fail('Expected 400 for CANCELLED job but got success');
      process.exit(1);
    } catch (guardErr: any) {
      if (guardErr.message.includes('HTTP 400')) {
        pass('CANCELLED-job guard → correctly rejected with 400');
      } else {
        fail('Unexpected error from guard test', guardErr);
        process.exit(1);
      }
    }

    // Cleanup
    await req('DELETE', `/accounting/revenue/${guardRevId}`, undefined, token).catch(() => {});
  } catch (e) {
    fail('Guard setup failed', e);
    process.exit(1);
  }

  console.log('\n=== All checks passed ✅ ===\n');
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
