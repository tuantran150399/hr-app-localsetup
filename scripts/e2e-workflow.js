"use strict";
const BASE = 'http://localhost:3000/api/v1';
async function req(method, path, body, token) {
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
    return json;
}
function pass(msg) {
    console.log(`  ✅ ${msg}`);
}
function fail(msg, err) {
    console.error(`  ❌ ${msg}`, err ?? '');
}
async function main() {
    console.log('\n=== ERP Logistics E2E Workflow ===\n');
    let token;
    let jobId;
    let revId;
    let costId;
    try {
        const r = await req('POST', '/auth/login', {
            username: 'admin',
            password: 'Admin@123',
        });
        token = r.access_token;
        pass('Login → JWT received');
    }
    catch (e) {
        fail('Login failed', e);
        process.exit(1);
    }
    try {
        const job = await req('POST', '/jobs', {
            jobCode: `E2E-${Date.now()}`,
            jobType: 'IMPORT',
            shipmentMode: 'SEA',
            status: 'DRAFT',
            origin: 'Shanghai',
            destination: 'Ho Chi Minh',
        }, token);
        jobId = job.id;
        pass(`Create Job → id=${jobId}`);
    }
    catch (e) {
        fail('Create Job failed', e);
        process.exit(1);
    }
    try {
        const rev = await req('POST', '/accounting/revenue', {
            jobId,
            description: 'Ocean freight revenue',
            currency: 'USD',
            amount: 1000,
            exchangeRate: 25000,
            localAmount: 25000000,
        }, token);
        revId = rev.id;
        pass(`Create Revenue entry → id=${revId} (DRAFT)`);
    }
    catch (e) {
        fail('Create Revenue entry failed', e);
        process.exit(1);
    }
    try {
        const cost = await req('POST', '/accounting/cost', {
            jobId,
            description: 'Trucking cost',
            currency: 'VND',
            amount: 5000000,
            exchangeRate: 1,
            localAmount: 5000000,
        }, token);
        costId = cost.id;
        pass(`Create Cost entry → id=${costId} (DRAFT)`);
    }
    catch (e) {
        fail('Create Cost entry failed', e);
        process.exit(1);
    }
    try {
        const result = await req('POST', `/accounting/post-all/job/${jobId}`, undefined, token);
        if (result.postedRevenue !== 1 || result.postedCost !== 1)
            throw new Error(`Expected 1+1, got ${result.postedRevenue}+${result.postedCost}`);
        pass(`Post all entries → ${result.message}`);
    }
    catch (e) {
        fail('Post all entries failed', e);
        process.exit(1);
    }
    try {
        const summary = await req('GET', `/accounting/profit/job/${jobId}`, undefined, token);
        const expectedProfit = 25000000 - 5000000;
        if (summary.profit !== expectedProfit)
            throw new Error(`Expected profit ${expectedProfit}, got ${summary.profit}`);
        pass(`Profit summary → revenue=${summary.totalRevenue} cost=${summary.totalCost} profit=${summary.profit}`);
    }
    catch (e) {
        fail('Profit summary failed', e);
        process.exit(1);
    }
    try {
        const closed = await req('PATCH', `/jobs/${jobId}/status`, { status: 'CLOSED' }, token);
        if (closed.status !== 'CLOSED')
            throw new Error(`Job status = ${closed.status}`);
        pass(`Close Job → status=CLOSED`);
    }
    catch (e) {
        fail('Close job failed', e);
        process.exit(1);
    }
    let guardJobId;
    let guardRevId;
    try {
        const gj = await req('POST', '/jobs', {
            jobCode: `E2E-GUARD-${Date.now()}`,
            jobType: 'EXPORT',
            shipmentMode: 'AIR',
            status: 'DRAFT',
            origin: 'Hanoi',
            destination: 'Tokyo',
        }, token);
        guardJobId = gj.id;
        const gr = await req('POST', '/accounting/revenue', {
            jobId: guardJobId,
            description: 'Test guard revenue',
            amount: 100,
            localAmount: 2500000,
        }, token);
        guardRevId = gr.id;
        await req('PATCH', `/jobs/${guardJobId}/status`, { status: 'CANCELLED' }, token);
        try {
            await req('PATCH', `/accounting/revenue/${guardRevId}/post`, undefined, token);
            fail('Expected 400 for CANCELLED job but got success');
            process.exit(1);
        }
        catch (guardErr) {
            if (guardErr.message.includes('HTTP 400')) {
                pass('CANCELLED-job guard → correctly rejected with 400');
            }
            else {
                fail('Unexpected error from guard test', guardErr);
                process.exit(1);
            }
        }
        await req('DELETE', `/accounting/revenue/${guardRevId}`, undefined, token).catch(() => { });
    }
    catch (e) {
        fail('Guard setup failed', e);
        process.exit(1);
    }
    console.log('\n=== All checks passed ✅ ===\n');
}
main().catch((e) => {
    console.error('Unhandled error:', e);
    process.exit(1);
});
//# sourceMappingURL=e2e-workflow.js.map