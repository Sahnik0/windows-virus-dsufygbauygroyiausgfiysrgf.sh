const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Database Seeding...');

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Create Super Admin User (role SUPER_ADMIN, verificationStatus APPROVED)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@platform.com' },
    update: {},
    create: {
      email: 'superadmin@platform.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+10000000000',
      role: 'SUPER_ADMIN',
      verificationStatus: 'APPROVED',
      org: {
        create: {
          id: 'platform-org-id',
          name: 'Platform Core Admin Org',
          slug: 'platform-core-admin',
          status: 'ACTIVE',
        },
      },
    },
  });
  console.log(`Created/Verified Super Admin: ${superAdmin.email}`);

  // 2. Create sample organization (Acme Corporation)
  const acmeOrg = await prisma.org.upsert({
    where: { id: 'acme-corp-org-id' },
    update: {
      slug: 'acme-corporation',
    },
    create: {
      id: 'acme-corp-org-id',
      name: 'Acme Corporation',
      slug: 'acme-corporation',
      status: 'ACTIVE',
    },
  });
  console.log(`Created/Verified Org: ${acmeOrg.name}`);

  // 3. Create Org Admin in Acme Org (verificationStatus APPROVED)
  const orgAdmin = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      email: 'admin@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Acme',
      lastName: 'Admin',
      phone: '+10000000001',
      employeeId: 'EMP-0001',
      role: 'ORG_ADMIN',
      orgId: acmeOrg.id,
      verificationStatus: 'APPROVED',
    },
  });
  console.log(`Created/Verified Org Admin: ${orgAdmin.email}`);

  // 4. Create Approved Regular Employee User
  const regularUser = await prisma.user.upsert({
    where: { email: 'john.doe@acme.com' },
    update: {},
    create: {
      email: 'john.doe@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+10000000002',
      employeeId: 'EMP-9842',
      role: 'USER',
      orgId: acmeOrg.id,
      verificationStatus: 'APPROVED',
      wallet: {
        create: {
          balance: 1000.0,
        },
      },
    },
  });
  console.log(`Created/Verified Regular User: ${regularUser.email}`);

  // 5. Create Driver Vehicle for John Doe
  const vehicle = await prisma.vehicle.upsert({
    where: { id: 'acme-demo-vehicle-id' },
    update: {},
    create: {
      id: 'acme-demo-vehicle-id',
      model: 'Tesla Model Y',
      registrationNumber: 'CA-EX-9988',
      seatingCapacity: 4,
      fuelType: 'ELECTRIC',
      status: 'VERIFIED',
      ownerId: regularUser.id,
    },
  });
  console.log(`Created/Verified Driver Vehicle: ${vehicle.model} (${vehicle.registrationNumber})`);

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
