const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

/**
 * Authentication middleware for standard API endpoints.
 * Requires a valid Bearer access token and APPROVED verification status.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Reject non-access tokens (e.g. pending upload tokens)
    if (decoded.type !== 'access') {
      return res.status(401).json({ message: 'Invalid token type for this route' });
    }

    // Fetch user from DB to verify current verification status
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, orgId: true, verificationStatus: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'User account no longer exists' });
    }

    // Fold verificationStatus check into auth middleware to prevent pending/rejected users from accessing protected routes
    if (user.verificationStatus !== 'APPROVED') {
      return res.status(403).json({
        message: 'Account is not approved. Verification status: ' + user.verificationStatus,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Access token has expired' });
    }
    return res.status(401).json({ message: 'Invalid access token' });
  }
}

/**
 * Authentication middleware specifically for ID-proof upload during registration.
 * Accepts only a short-lived pending token issued by /register.
 */
async function authenticatePendingToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Pending upload token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_PENDING_SECRET || process.env.JWT_ACCESS_SECRET;
    const decoded = jwt.verify(token, secret);

    if (decoded.type !== 'pending_upload') {
      return res.status(401).json({ message: 'Only pending upload tokens can be used on this route' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, orgId: true, verificationStatus: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'User account no longer exists' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Pending token has expired. Please re-register.' });
    }
    return res.status(401).json({ message: 'Invalid pending upload token' });
  }
}

module.exports = {
  authenticateToken,
  authenticatePendingToken,
};
