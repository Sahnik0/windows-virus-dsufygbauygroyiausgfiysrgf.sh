const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { revokeToken, isTokenRevoked } = require('../../utils/tokenRevocation');

// Service class containing business logic for authentication
class AuthService {
  // Registers a new USER account linked to an existing organization
  async register({ email, password, firstName, lastName, phone, orgId, employeeId }) {
    const normalizedEmail = email.trim().toLowerCase();

    // Step 1: Make sure the target organization exists in database
    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 400;
      throw error;
    }

    // Step 2: Prevent duplicate email registration (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existingUser) {
      const error = new Error('Email is already registered');
      error.statusCode = 400;
      throw error;
    }

    // Step 3: Securely hash the user's plain-text password using bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Step 4: Create new user record with PENDING verification status
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        phone,
        employeeId: employeeId || null,
        role: 'USER',
        orgId,
        verificationStatus: 'PENDING',
      },
    });

    // Step 5: Issue a temporary 30-minute JWT token solely for ID proof upload
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

  // Saves the uploaded ID proof file path to the user's database record
  async uploadIdProof(userId, filePath) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    // Update file path and upload timestamp
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        idProofPath: filePath,
        idProofUploadedAt: new Date(),
      },
    });

    return {
      message: 'ID proof uploaded. Pending admin approval.',
      userId: updatedUser.id,
      verificationStatus: updatedUser.verificationStatus,
    };
  }

  // Verifies user credentials and checks admin approval status before issuing login tokens
  async login(email, password) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { org: true },
    });

    // Step 1: Validate email existence and password match
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Step 2: Block login if account is still PENDING admin review (unless SUPER_ADMIN or ORG_ADMIN)
    if (user.verificationStatus === 'PENDING' && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      const error = new Error('Your ID proof is under review. Please wait for admin approval.');
      error.statusCode = 403;
      throw error;
    }

    // Step 3: Block login if account was REJECTED by admin
    if (user.verificationStatus === 'REJECTED') {
      const reason = user.rejectionReason ? `: ${user.rejectionReason}` : '';
      const error = new Error(`Account registration rejected${reason}`);
      error.statusCode = 403;
      error.rejectionReason = user.rejectionReason;
      throw error;
    }

    // Step 4: Account is APPROVED (or Admin) -> Issue role-tailored access tokens
    // Super Admins get 30 days token, Org Admins get 7 days, regular Users get 15m (or JWT_ACCESS_EXPIRY)
    const accessTokenExpiry = user.role === 'SUPER_ADMIN'
      ? '30d'
      : user.role === 'ORG_ADMIN'
        ? '7d'
        : (process.env.JWT_ACCESS_EXPIRY || '15m');

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, orgId: user.orgId, type: 'access' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );

    const orgSlug = user.org?.slug || (user.org?.name ? user.org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null);

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
        orgSlug,
        verificationStatus: user.verificationStatus,
      },
    };
  }

  // Validates a refresh token and generates a fresh access token
  async refreshToken(refreshTokenStr) {
    // Check if token was previously revoked via logout
    if (isTokenRevoked(refreshTokenStr)) {
      const error = new Error('Refresh token has been revoked');
      error.statusCode = 401;
      throw error;
    }

    // Verify JWT signature and expiration
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

    // Ensure the user still exists and remains APPROVED (or Admin)
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || (user.verificationStatus !== 'APPROVED' && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      const error = new Error('User is no longer active or approved');
      error.statusCode = 401;
      throw error;
    }

    const accessTokenExpiry = user.role === 'SUPER_ADMIN'
      ? '30d'
      : user.role === 'ORG_ADMIN'
        ? '7d'
        : (process.env.JWT_ACCESS_EXPIRY || '15m');

    // Issue a new access token
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, orgId: user.orgId, type: 'access' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: accessTokenExpiry }
    );

    return { accessToken };
  }

  // Revokes the given refresh token on logout
  async logout(refreshTokenStr) {
    revokeToken(refreshTokenStr);
    return { message: 'Logged out successfully' };
  }
}

module.exports = new AuthService();
