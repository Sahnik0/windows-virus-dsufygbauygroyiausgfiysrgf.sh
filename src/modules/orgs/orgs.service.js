const prisma = require('../../config/prisma');
const bcrypt = require('bcrypt');

// Service class containing business logic for Organization operations
class OrgsService {
  // Creates a new organization record (SUPER_ADMIN only)
  async createOrg({ name, slug, status = 'ACTIVE', fuelCostPerLitre, costPerKmDefault }) {
    const rawSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let finalSlug = rawSlug;

    // Check if slug is unique, append timestamp if duplicate exists
    const existingSlug = await prisma.org.findFirst({ where: { slug: finalSlug } });
    if (existingSlug) {
      finalSlug = `${rawSlug}-${Date.now()}`;
    }

    return await prisma.org.create({
      data: {
        name,
        slug: finalSlug,
        status,
        ...(fuelCostPerLitre !== undefined && { fuelCostPerLitre }),
        ...(costPerKmDefault !== undefined && { costPerKmDefault }),
      },
    });
  }

  // Lists all registered organizations with employee count (SUPER_ADMIN only)
  async getAllOrgs() {
    const orgs = await prisma.org.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    // Ensure slug is present in output (fallback to slugified name)
    return orgs.map((org) => ({
      ...org,
      slug: org.slug || org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    }));
  }

  // Provisions an Org Admin account (automatically APPROVED without ID proof upload)
  async provisionOrgAdmin(orgId, { email, password, firstName, lastName, phone }) {
    const normalizedEmail = email.trim().toLowerCase();

    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 404;
      throw error;
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existingUser) {
      const error = new Error('Email is already registered');
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        phone,
        role: 'ORG_ADMIN',
        orgId,
        verificationStatus: 'APPROVED', // Provisioned admins bypass pending review
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        orgId: true,
        verificationStatus: true,
        createdAt: true,
      },
    });

    return admin;
  }

  // Lists all Org Admins assigned to a specific organization (SUPER_ADMIN only)
  async getOrgAdmins(orgId) {
    return await prisma.user.findMany({
      where: {
        orgId,
        role: 'ORG_ADMIN',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        orgId: true,
        verificationStatus: true,
        createdAt: true,
      },
    });
  }

  // Updates fuel cost per litre, cost per km, or settings for an organization
  async updateOrgSettings(currentUser, targetOrgId, data) {
    const {
      fuelCostPerLitre,
      costPerKmDefault,
      subsidyPercent,
      baseRideCharge,
      maxRidersPerCarpool,
      autoMatchEnabled,
      departmentRestriction,
      status,
    } = data;

    // Ensure ORG_ADMIN can only update their own organization's settings
    if (currentUser.role === 'ORG_ADMIN' && currentUser.orgId !== targetOrgId) {
      const error = new Error('Forbidden: Cannot update settings for another organization');
      error.statusCode = 403;
      throw error;
    }

    const org = await prisma.org.findUnique({ where: { id: targetOrgId } });
    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.org.update({
      where: { id: targetOrgId },
      data: {
        ...(fuelCostPerLitre !== undefined && { fuelCostPerLitre }),
        ...(costPerKmDefault !== undefined && { costPerKmDefault }),
        ...(subsidyPercent !== undefined && { subsidyPercent }),
        ...(baseRideCharge !== undefined && { baseRideCharge }),
        ...(maxRidersPerCarpool !== undefined && { maxRidersPerCarpool }),
        ...(autoMatchEnabled !== undefined && { autoMatchEnabled }),
        ...(departmentRestriction !== undefined && { departmentRestriction }),
        ...(status !== undefined && { status }),
      },
    });
  }
}

module.exports = new OrgsService();
