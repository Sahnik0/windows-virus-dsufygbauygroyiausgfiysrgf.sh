// CRITICAL SECURITY RULE: Every service function touching org-scoped data MUST filter by orgId
// derived from req.user.orgId for ORG_ADMIN / USER callers. Never trust a client-supplied orgId for these roles.

const prisma = require('../../config/prisma');
const fs = require('fs');

class UsersService {
  /**
   * Lists users with org isolation.
   * ORG_ADMIN sees only users in their own org. SUPER_ADMIN sees all (with optional orgId query filter).
   */
  async getAllUsers(currentUser, filterOrgId) {
    const where = {};

    if (currentUser.role === 'ORG_ADMIN') {
      // Enforce org isolation derived from authenticated token
      where.orgId = currentUser.orgId;
    } else if (currentUser.role === 'SUPER_ADMIN' && filterOrgId) {
      where.orgId = filterOrgId;
    }

    return await prisma.user.findMany({
      where,
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
        updatedAt: true,
      },
    });
  }

  /**
   * Gets single user details with strict org/self isolation.
   */
  async getUserById(currentUser, targetUserId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        orgId: true,
        verificationStatus: true,
        idProofPath: true,
        idProofUploadedAt: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!targetUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Role-based access rule checks
    if (currentUser.role === 'USER' && currentUser.id !== targetUserId) {
      const error = new Error('Forbidden: Users can only view their own record');
      error.statusCode = 403;
      throw error;
    }

    if (currentUser.role === 'ORG_ADMIN' && targetUser.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Cannot view users outside your organization');
      error.statusCode = 403;
      throw error;
    }

    return targetUser;
  }

  /**
   * Updates user profile (firstName, lastName, phone).
   * USER/ORG_ADMIN can edit own record; ORG_ADMIN can edit any user in own org; SUPER_ADMIN any user.
   */
  async updateUser(currentUser, targetUserId, { firstName, lastName, phone }) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!targetUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Authorization checks
    if (currentUser.role === 'USER' && currentUser.id !== targetUserId) {
      const error = new Error('Forbidden: Users can only update their own record');
      error.statusCode = 403;
      throw error;
    }

    if (currentUser.role === 'ORG_ADMIN' && targetUser.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Cannot update users outside your organization');
      error.statusCode = 403;
      throw error;
    }

    return await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
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
        updatedAt: true,
      },
    });
  }

  /**
   * Lists pending verification users for ORG_ADMIN (own org) or SUPER_ADMIN (all or specific org).
   */
  async getPendingUsers(currentUser, filterOrgId) {
    const where = { verificationStatus: 'PENDING' };

    if (currentUser.role === 'ORG_ADMIN') {
      where.orgId = currentUser.orgId;
    } else if (currentUser.role === 'SUPER_ADMIN' && filterOrgId) {
      where.orgId = filterOrgId;
    }

    return await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        orgId: true,
        verificationStatus: true,
        idProofPath: true,
        idProofUploadedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Returns metadata and streams uploaded ID proof document for a user.
   */
  async getIdProof(currentUser, targetUserId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, orgId: true, idProofPath: true, verificationStatus: true },
    });

    if (!targetUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentUser.role === 'ORG_ADMIN' && targetUser.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Cannot access users outside your organization');
      error.statusCode = 403;
      throw error;
    }

    if (!targetUser.idProofPath || !fs.existsSync(targetUser.idProofPath)) {
      const error = new Error('ID proof document not found for this user');
      error.statusCode = 404;
      throw error;
    }

    return {
      filePath: targetUser.idProofPath,
    };
  }

  /**
   * Approves a pending user account.
   */
  async approveUser(currentUser, targetUserId) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!targetUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentUser.role === 'ORG_ADMIN' && targetUser.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Cannot approve users outside your organization');
      error.statusCode = 403;
      throw error;
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        verificationStatus: 'APPROVED',
        rejectionReason: null,
      },
      select: {
        id: true,
        email: true,
        verificationStatus: true,
        updatedAt: true,
      },
    });

    return {
      message: 'User successfully approved',
      user: updated,
    };
  }

  /**
   * Rejects a pending user account with a mandatory rejection reason.
   */
  async rejectUser(currentUser, targetUserId, rejectionReason) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!targetUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentUser.role === 'ORG_ADMIN' && targetUser.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Cannot reject users outside your organization');
      error.statusCode = 403;
      throw error;
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        verificationStatus: 'REJECTED',
        rejectionReason,
      },
      select: {
        id: true,
        email: true,
        verificationStatus: true,
        rejectionReason: true,
        updatedAt: true,
      },
    });

    return {
      message: 'User verification rejected',
      user: updated,
    };
  }
}

module.exports = new UsersService();
