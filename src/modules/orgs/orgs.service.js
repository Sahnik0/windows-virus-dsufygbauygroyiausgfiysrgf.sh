// CRITICAL SECURITY RULE: Every service function touching org-scoped data MUST filter by orgId
// derived from req.user.orgId for ORG_ADMIN / USER callers. Never trust a client-supplied orgId for these roles.

const prisma = require('../../config/prisma');
const bcrypt = require('bcrypt');

class OrgsService {
  /**
   * Creates a new organization (SUPER_ADMIN only).
   */
  async createOrg({ name, fuelCostPerLitre, costPerKmDefault }) {
    return await prisma.org.create({
      data: {
        name,
        ...(fuelCostPerLitre !== undefined && { fuelCostPerLitre }),
        ...(costPerKmDefault !== undefined && { costPerKmDefault }),
      },
    });
  }

  /**
   * Lists all organizations (SUPER_ADMIN only).
   */
  async getAllOrgs() {
    return await prisma.org.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  /**
   * Provisions an ORG_ADMIN account for a given org (SUPER_ADMIN only).
   * Provisioned admins are automatically APPROVED without going through approval flow.
   */
  async provisionOrgAdmin(orgId, { email, password, firstName, lastName, phone }) {
    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 404;
      throw error;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const error = new Error('Email is already registered');
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        role: 'ORG_ADMIN',
        orgId,
        verificationStatus: 'APPROVED', // Provisioned admins bypass approval gate
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

  /**
   * Lists all Org Admins for a specific org (SUPER_ADMIN only).
   */
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

  /**
   * Updates fuelCostPerLitre or costPerKmDefault for an org.
   * ORG_ADMIN can only update their own org. SUPER_ADMIN can update any org.
   */
  async updateOrgSettings(currentUser, targetOrgId, { fuelCostPerLitre, costPerKmDefault }) {
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
      },
    });
  }
}

module.exports = new OrgsService();
