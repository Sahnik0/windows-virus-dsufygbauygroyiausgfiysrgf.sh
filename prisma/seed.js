const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hash standard test password with cost factor 10
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Create Super Admin (no org, verificationStatus APPROVED)
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
      orgId: null,
      verificationStatus: 'APPROVED',
    },
  });
  console.log(`Created/Verified Super Admin: ${superAdmin.email}`);

  // 2. Create Org
  const acmeOrg = await prisma.org.upsert({
    where: { id: 'acme-corp-org-id' },
    update: {},
    create: {
      id: 'acme-corp-org-id',
      name: 'Acme Corporation',
      fuelCostPerLitre: 100.0,
      costPerKmDefault: 15.0,
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
      role: 'ORG_ADMIN',
      orgId: acmeOrg.id,
      verificationStatus: 'APPROVED',
    },
  });
  console.log(`Created/Verified Org Admin: ${orgAdmin.email}`);

  // 4. Create two USERs in Acme Org (verificationStatus APPROVED)
  const user1 = await prisma.user.upsert({
    where: { email: 'driver@acme.com' },
    update: {},
    create: {
      email: 'driver@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Driver',
      lastName: 'User',
      phone: '+10000000002',
      role: 'USER',
      orgId: acmeOrg.id,
      verificationStatus: 'APPROVED',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'passenger@acme.com' },
    update: {},
    create: {
      email: 'passenger@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Passenger',
      lastName: 'User',
      phone: '+10000000003',
      role: 'USER',
      orgId: acmeOrg.id,
      verificationStatus: 'APPROVED',
    },
  });
  console.log(`Created/Verified Users: ${user1.email}, ${user2.email}`);

  // 5. Create Vehicle owned by user1 (driver)
  const vehicle1 = await prisma.vehicle.upsert({
    where: { registrationNumber: 'KA-01-AB-1234' },
    update: {},
    create: {
      model: 'Toyota Prius',
      registrationNumber: 'KA-01-AB-1234',
      seatingCapacity: 4,
      ownerId: user1.id,
    },
  });
  console.log(`Created/Verified Vehicle: ${vehicle1.registrationNumber} owned by ${user1.email}`);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
