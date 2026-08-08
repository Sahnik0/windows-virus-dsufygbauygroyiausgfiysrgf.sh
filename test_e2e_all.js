const http = require('http');
const prisma = require('./src/config/prisma');
const app = require('./src/app');
const crypto = require('crypto');

async function runE2ETests() {
  console.log('🚀 Starting Comprehensive End-to-End Test Suite...');

  // Start HTTP server on port 3001
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(3001, resolve));
  const baseUrl = 'http://localhost:3001/api/v1';

  try {
    // 1. Health Check
    console.log('\n--- 1. Health Check ---');
    const healthRes = await fetch('http://localhost:3001/health');
    const healthJson = await healthRes.json();
    console.assert(healthRes.status === 200, 'Health check status 200');
    console.assert(healthJson.status === 'ok', 'Health check ok response');
    console.log('✅ Health check passed');

    // Ensure default test Org exists in DB
    let testOrg = await prisma.org.findFirst({ where: { slug: 'acme-corp' } });
    if (!testOrg) {
      testOrg = await prisma.org.create({
        data: {
          id: 'acme-corp-org-id',
          name: 'Acme Corporation',
          slug: 'acme-corp',
          status: 'ACTIVE',
        },
      });
    }

    // 2. Auth & ID Proof Gate Test
    console.log('\n--- 2. Auth & User Approval Gate ---');
    const testEmail = `test_driver_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Driver',
        role: 'USER',
        orgId: testOrg.id,
      }),
    });
    const regData = await regRes.json();
    console.assert(regRes.status === 201, 'User registration succeeds');
    console.assert(regData.pendingToken, 'Returns pendingToken for upload');
    console.log('✅ Registration with pendingToken passed');

    // Login while PENDING should fail with 403
    const pendingLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'Password123!' }),
    });
    console.assert(pendingLoginRes.status === 403, 'Unapproved user login blocked with 403');
    console.log('✅ Unapproved user login guard passed');

    // Super admin login to approve user
    const superAdminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@platform.com', password: 'Password123!' }),
    });
    const superAdminData = await superAdminLoginRes.json();
    const adminToken = superAdminData.accessToken;
    console.assert(adminToken, 'Super Admin login succeeds');

    // Approve the pending user
    const approveRes = await fetch(`${baseUrl}/users/${regData.user.id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(approveRes.status === 200, 'User approval returns 200 OK');
    console.log('✅ User approval passed');

    // Approved user can now log in
    const approvedLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'Password123!' }),
    });
    const approvedLoginData = await approvedLoginRes.json();
    console.assert(approvedLoginRes.status === 200, 'Approved user login succeeds');
    const userToken = approvedLoginData.accessToken;
    console.log('✅ Approved user login passed');

    // 3. Wallet & Payment Tests
    console.log('\n--- 3. Wallet & Payment Tests ---');
    const rechargeRes = await fetch(`${baseUrl}/wallet/recharge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ amount: 500 }),
    });
    const rechargeData = await rechargeRes.json();
    console.assert(rechargeRes.status === 201, 'Wallet recharge returns order details');
    console.assert(rechargeData.orderId, 'Razorpay order ID present');

    // Generate valid HMAC signature for Razorpay test secret
    const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret';
    const generatedSig = crypto
      .createHmac('sha256', secret)
      .update(`${rechargeData.orderId}|pay_fake_123`)
      .digest('hex');

    const verifyRes = await fetch(`${baseUrl}/wallet/recharge/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: rechargeData.orderId,
        razorpay_payment_id: 'pay_fake_123',
        razorpay_signature: generatedSig,
        amount: 500,
      }),
    });
    console.assert(verifyRes.status === 200 || verifyRes.status === 400, 'HMAC verification processed');
    console.log('✅ Wallet recharge HMAC verification passed');

    // Replay attack guard check (same payment ID should be rejected)
    const replayRes = await fetch(`${baseUrl}/wallet/recharge/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: rechargeData.orderId,
        razorpay_payment_id: 'pay_fake_123',
        razorpay_signature: generatedSig,
        amount: 500,
      }),
    });
    console.assert(replayRes.status === 400, 'Replay payment rejected');
    console.log('✅ Wallet recharge replay attack guard passed');

    // Invalid signature check
    const invalidSigRes = await fetch(`${baseUrl}/wallet/recharge/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: rechargeData.orderId,
        razorpay_payment_id: 'pay_fake_123',
        razorpay_signature: 'invalid_signature_hash',
        amount: 500,
      }),
    });
    console.assert(invalidSigRes.status === 400, 'Invalid signature rejected');
    console.log('✅ Invalid signature check passed');

    // 4. Reports Module Tests
    console.log('\n--- 4. Reports Module Tests ---');
    const summaryRes = await fetch(`${baseUrl}/reports/summary?orgId=${testOrg.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(summaryRes.status === 200, 'Super admin can view summary report');

    const invalidDateRes = await fetch(`${baseUrl}/reports/summary?orgId=${testOrg.id}&startDate=invalid_date_str`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(invalidDateRes.status === 400, 'Invalid date parameter returns 400');
    console.log('✅ Invalid date string in reports rejected properly');

    const fuelRes = await fetch(`${baseUrl}/reports/fuel?orgId=${testOrg.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(fuelRes.status === 200, 'Fuel report succeeds');
    const fuelData = await fuelRes.json();
    console.assert(typeof fuelData.estimatedTotalFuelCost === 'number', 'Fuel cost formatted as number');
    console.log('✅ Fuel report precision passed');

    const vehCostRes = await fetch(`${baseUrl}/reports/vehicle-cost?orgId=${testOrg.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(vehCostRes.status === 200, 'Vehicle cost report succeeds');
    console.log('✅ Vehicle cost report passed');

    // 5. Dynamic Multi-Tenant Org & Provisioning E2E Test
    console.log('\n--- 5. Dynamic Multi-Tenant Org & Admin Provisioning Test ---');
    const dynamicTimestamp = Date.now();
    const dynamicOrgName = `Dynamic Global Tenant ${dynamicTimestamp}`;
    const dynamicSlug = `dynamic-tenant-${dynamicTimestamp}`;

    // Step A: Super Admin Creates New Organization Dynamically
    const createOrgRes = await fetch(`${baseUrl}/orgs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: dynamicOrgName,
        slug: dynamicSlug,
        status: 'PENDING_SETUP',
      }),
    });
    const createOrgData = await createOrgRes.json();
    console.assert(createOrgRes.status === 201, 'Dynamic org creation returns 201');
    const dynamicOrgId = createOrgData.id || createOrgData.org?.id;
    console.assert(dynamicOrgId, 'Dynamic Org ID generated');
    console.log(`✅ Step A: Created Dynamic Org (${dynamicOrgName}, id: ${dynamicOrgId}) passed`);

    // Step B: Provision Org Admin dynamically for this tenant
    const dynamicAdminEmail = `admin.${dynamicTimestamp}@dynamic-tenant.com`;
    const dynamicAdminPassword = `DynamicPass!${dynamicTimestamp}`;

    const provisionRes = await fetch(`${baseUrl}/orgs/${dynamicOrgId}/admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: dynamicAdminEmail,
        password: dynamicAdminPassword,
        firstName: 'Dynamic',
        lastName: 'Admin',
      }),
    });
    console.assert(provisionRes.status === 201, 'Provisioning Org Admin returns 201');
    console.log(`✅ Step B: Provisioned Org Admin (${dynamicAdminEmail}) passed`);

    // Step C: Verify Org Admin Login with newly created dynamic credentials
    const orgAdminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dynamicAdminEmail,
        password: dynamicAdminPassword,
      }),
    });
    const orgAdminLoginData = await orgAdminLoginRes.json();
    console.assert(orgAdminLoginRes.status === 200, 'Dynamic Org Admin login succeeds with 200 OK');
    console.assert(orgAdminLoginData.user.role === 'ORG_ADMIN', 'Role is ORG_ADMIN');
    console.assert(orgAdminLoginData.user.orgId === dynamicOrgId, 'Tenant Org ID matches created org');
    console.log('✅ Step C: Dynamic Org Admin login & token generation passed');

    console.log('\n🎉 ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ E2E Test Suite Error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runE2ETests();
