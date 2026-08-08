const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { revokeToken, isTokenRevoked } = require('../../utils/tokenRevocation');

class AuthService {
  /**
   * Registers a new USER under an existing organization with PENDING verification status.
   */
  async register({ email, password, firstName, lastName, phone, orgId }) {
    // 1. Verify organization exists
    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 400;
      throw error;
    }

    // 2. Check if email already registered
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const error = new Error('Email is already registered');
      error.statusCode = 400;
      throw error;
    }

    // 3. Hash password with bcrypt cost factor 10
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Create user record
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        role: 'USER',
        orgId,
        verificationStatus: 'PENDING',
      },
    });

    // 5. Generate short-lived pending token specifically for ID-proof upload
    const pendingSecret = process.env.JWT_PENDING_SECRET || process.env.JWT_ACCESS_SECRET;
    const pendingToken = jwt.sign(
      { id: user.id, role: user.role, type: 'pending_upload' },
      pendingSecret,
      { expiresIn: '30m' }
    );

    return {
      message: 'Registration successful. Please upload an ID proof document to complete registration.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        verificationStatus: user.verificationStatus,
      },
      pendingToken,
    };
  }

  /**
   * Updates user record with uploaded ID proof path.
   */
  async uploadIdProof(userId, filePath) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        idProofPath: filePath,
        idProofUploadedAt: new Date(),
      },
    });

    return {
      message: 'ID proof uploaded successfully. Your account is now pending admin approval.',
      userId: updatedUser.id,
      verificationStatus: updatedUser.verificationStatus,
    };
  }

  /**
   * Authenticates user credentials and checks verification status before issuing tokens.
   */
  async login(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Generic error to avoid leaking user existence vs password mismatch
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Distinguish PENDING vs REJECTED verification status
    if (user.verificationStatus === 'PENDING') {
      const error = new Error('Your ID proof is under review. Please wait for admin approval.');
      error.statusCode = 403;
      throw error;
    }

    if (user.verificationStatus === 'REJECTED') {
      const reason = user.rejectionReason ? `: ${user.rejectionReason}` : '';
      const error = new Error(`Account registration rejected${reason}`);
      error.statusCode = 403;
      error.rejectionReason = user.rejectionReason;
      throw error;
    }

    // User is APPROVED: Issue access and refresh tokens
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, orgId: user.orgId, type: 'access' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: user.orgId,
        verificationStatus: user.verificationStatus,
      },
    };
  }

  /**
   * Exchanges a valid refresh token for a new access token.
   */
  async refreshToken(refreshTokenStr) {
    if (isTokenRevoked(refreshTokenStr)) {
      const error = new Error('Refresh token has been revoked');
      error.statusCode = 401;
      throw error;
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshTokenStr, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    if (decoded.type !== 'refresh') {
      const error = new Error('Invalid token type');
      error.statusCode = 401;
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.verificationStatus !== 'APPROVED') {
      const error = new Error('User is no longer active or approved');
      error.statusCode = 401;
      throw error;
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, orgId: user.orgId, type: 'access' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    return { accessToken };
  }

  /**
   * Invalidates a refresh token.
   */
  async logout(refreshTokenStr) {
    revokeToken(refreshTokenStr);
    return { message: 'Logged out successfully' };
  }
}

module.exports = new AuthService();
