const prisma = require('../../config/prisma');
const fs = require('fs');

// Service class containing business logic for user management and admin approvals
class UsersService {
  // Lists users with strict org isolation (ORG_ADMIN sees own org users; SUPER_ADMIN sees all or filtered)
  async getAllUsers(currentUser, filterOrgId) {
    const where = {};

    if (currentUser.role === 'ORG_ADMIN') {
      where.orgId = currentUser.orgId; // Restrict to caller's org
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
        employeeId: true,
        carpoolAccess: true,
        rating: true,
        role: true,
        orgId: true,
        verificationStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Fetches single user profile with authorization boundary checks
  async getUserById(currentUser, targetUserId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        employeeId: true,
        carpoolAccess: true,
        rating: true,
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

    // USER role can only view their own profile
    if (currentUser.role === 'USER' && currentUser.id !== targetUserId) {
      const error = new Error('Forbidden: Users can only view their own record');
      error.statusCode = 403;
      throw error;
    }

    // ORG_ADMIN can only view users inside their own organization
    if (currentUser.role === 'ORG_ADMIN' && targetUser.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Cannot view users outside your organization');
      error.statusCode = 403;
      throw error;
    }

    return targetUser;
  }

  // Updates profile info (firstName, lastName, phone, employeeId, carpoolAccess) with permissions check
  async updateUser(currentUser, targetUserId, { firstName, lastName, phone, employeeId, carpoolAccess }) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!targetUser) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

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
        ...(employeeId !== undefined && { employeeId }),
        ...(carpoolAccess !== undefined && { carpoolAccess }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        employeeId: true,
        carpoolAccess: true,
        role: true,
        orgId: true,
        verificationStatus: true,
        updatedAt: true,
      },
    });
  }

  // Lists users waiting for admin approval (verificationStatus === PENDING)
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
        employeeId: true,
        role: true,
        orgId: true,
        verificationStatus: true,
        idProofPath: true,
        idProofUploadedAt: true,
        createdAt: true,
      },
    });
  }

  // Retrieves the uploaded ID proof file path for admin viewing
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

  // Marks a user's verificationStatus as APPROVED
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

  // Marks a user's verificationStatus as REJECTED with a reason
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
