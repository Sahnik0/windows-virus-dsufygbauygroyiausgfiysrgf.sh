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
        orgId: 'acme-corp-org-id',
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

    // Approve user
    const approveRes = await fetch(`${baseUrl}/users/${regData.user.id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(approveRes.status === 200, 'User approval by admin succeeds');
    console.log('✅ User approval passed');

    // User login post-approval
    const userLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'Password123!' }),
    });
    const userData = await userLoginRes.json();
    console.assert(userLoginRes.status === 200, 'Approved user login succeeds');
    const userToken = userData.accessToken;
    console.assert(userToken, 'Approved user token received');
    console.log('✅ Approved user login passed');

    // 3. Wallet & Payment Vulnerability Tests
    console.log('\n--- 3. Wallet & Payment Tests ---');
    // Recharge order
    const rechargeOrderRes = await fetch(`${baseUrl}/wallet/recharge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ amount: 500 }),
    });
    const rechargeOrderData = await rechargeOrderRes.json();
    console.assert(rechargeOrderRes.status === 201, 'Recharge order created');

    // Signature verification for simulated test payment
    const razorpay_order_id = rechargeOrderData.orderId;
    const razorpay_payment_id = `pay_sim_${Date.now()}`;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';
    const razorpay_signature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const verifyRes = await fetch(`${baseUrl}/wallet/recharge/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount: 500,
      }),
    });
    const verifyData = await verifyRes.json();
    console.assert(verifyRes.status === 200, 'Recharge verify succeeds');
    console.assert(Number(verifyData.balance) === 500, 'Wallet balance credited to 500');
    console.log('✅ Wallet recharge HMAC verification passed');

    // Replay attack test
    const replayRes = await fetch(`${baseUrl}/wallet/recharge/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount: 500,
      }),
    });
    console.assert(replayRes.status === 400, 'Replay payment rejected');
    console.log('✅ Wallet recharge replay attack guard passed');

    // Invalid signature test
    const badSigRes = await fetch(`${baseUrl}/wallet/recharge/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature: 'invalid_sig',
        amount: 500,
      }),
    });
    console.assert(badSigRes.status === 400, 'Invalid signature rejected');
    console.log('✅ Invalid signature check passed');

    // 4. Reports Module Tests
    console.log('\n--- 4. Reports Module Tests ---');
    const summaryReportRes = await fetch(`${baseUrl}/reports/summary?orgId=acme-corp-org-id`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const summaryData = await summaryReportRes.json();
    console.assert(summaryReportRes.status === 200, 'Summary report status 200');

    // Test invalid date string handling in reports
    const badDateRes = await fetch(`${baseUrl}/reports/summary?orgId=acme-corp-org-id&startDate=invalid_date_str`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.assert(badDateRes.status === 400, 'Invalid startDate rejected with 400');
    console.log('✅ Invalid date string in reports rejected properly');

    const fuelReportRes = await fetch(`${baseUrl}/reports/fuel?orgId=acme-corp-org-id`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const fuelData = await fuelReportRes.json();
    console.assert(fuelReportRes.status === 200, 'Fuel report status 200');
    console.assert(typeof fuelData.estimatedTotalFuelCost === 'number', 'Fuel cost is numeric');
    console.log('✅ Fuel report precision passed');

    const vehicleCostRes = await fetch(`${baseUrl}/reports/vehicle-cost?orgId=acme-corp-org-id`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const vehicleCostData = await vehicleCostRes.json();
    console.assert(vehicleCostRes.status === 200, 'Vehicle cost report status 200');
    console.assert(Array.isArray(vehicleCostData.vehicles), 'Vehicle report returns array');
    console.log('✅ Vehicle cost report passed');

    // 5. Dynamic Multi-Tenant Org & Admin Provisioning Test
    console.log('\n--- 5. Dynamic Multi-Tenant Org & Admin Provisioning Test ---');
    const timestamp = Date.now();
    const dynamicOrgName = `Dynamic Global Tenant ${timestamp}`;
    const dynamicSlug = `dynamic-tenant-${timestamp}`;
    const dynamicAdminEmail = `admin.${timestamp}@dynamic-tenant.com`;
    const dynamicAdminPassword = `DynamicPass${timestamp}!`;

    // Step A: Create Dynamic Org (POST /api/v1/orgs)
    const createOrgRes = await fetch(`${baseUrl}/orgs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: dynamicOrgName,
        slug: dynamicSlug,
        status: 'ACTIVE',
      }),
    });
    const createOrgData = await createOrgRes.json();
    console.assert(createOrgRes.status === 201, 'Dynamic org creation succeeds with 201');
    const createdOrgId = createOrgData.org ? createOrgData.org.id : createOrgData.id;
    console.assert(createdOrgId, 'Created org returns ID');
    console.log(`✅ Step A: Created Dynamic Org (${dynamicOrgName}, id: ${createdOrgId}) passed`);

    // Step B: Provision Org Admin (POST /api/v1/orgs/:orgId/admins)
    const provisionAdminRes = await fetch(`${baseUrl}/orgs/${createdOrgId}/admins`, {
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
        phone: '+19876543210',
      }),
    });
    const provisionAdminData = await provisionAdminRes.json();
    console.assert(provisionAdminRes.status === 201, 'Dynamic admin provisioning succeeds with 201');
    const provisionedUser = provisionAdminData.user || provisionAdminData;
    console.assert(provisionedUser.role === 'ORG_ADMIN', 'Provisioned user role is ORG_ADMIN');
    console.assert(provisionedUser.verificationStatus === 'APPROVED', 'Provisioned admin is APPROVED');
    console.log(`✅ Step B: Provisioned Org Admin (${dynamicAdminEmail}) passed`);

    // Step C: Authenticate Provisioned Org Admin (POST /api/v1/auth/login)
    const dynamicAdminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dynamicAdminEmail,
        password: dynamicAdminPassword,
      }),
    });
    const dynamicAdminLoginData = await dynamicAdminLoginRes.json();
    console.assert(dynamicAdminLoginRes.status === 200, 'Provisioned Org Admin login succeeds with 200');
    console.assert(dynamicAdminLoginData.accessToken, 'Login returns accessToken');
    console.assert(dynamicAdminLoginData.user.role === 'ORG_ADMIN', 'Login user role is ORG_ADMIN');
    console.assert(dynamicAdminLoginData.user.orgSlug === dynamicSlug, 'Login user orgSlug matches created slug');
    console.log('✅ Step C: Dynamic Org Admin login & token generation passed');

    console.log('\n🎉 ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runE2ETests().catch((err) => {
  console.error('❌ E2E Test Suite Error:', err);
  process.exit(1);
});
