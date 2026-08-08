const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// Middleware to protect standard API routes using a JWT access token
async function authenticateToken(req, res, next) {
  // Step 1: Read Authorization header (expected format: 'Bearer <token>')
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Step 2: Verify token signature and expiration against JWT_ACCESS_SECRET
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Step 3: Reject non-access tokens (e.g. pending registration tokens)
    if (decoded.type !== 'access') {
      return res.status(401).json({ message: 'Invalid token type for this route' });
    }

    // Step 4: Verify that user still exists in database and remains APPROVED by admin
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, orgId: true, verificationStatus: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'User account no longer exists' });
    }

    // Step 5: Reject access with 403 Forbidden if user is still PENDING or REJECTED
    if (user.verificationStatus !== 'APPROVED') {
      return res.status(403).json({
        message: 'Account is not approved. Verification status: ' + user.verificationStatus,
      });
    }

    // Attach user payload to Express request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Access token has expired' });
    }
    return res.status(401).json({ message: 'Invalid access token' });
  }
}

// Middleware specifically for uploading ID proof documents after registration
async function authenticatePendingToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Pending upload token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_PENDING_SECRET || process.env.JWT_ACCESS_SECRET;
    const decoded = jwt.verify(token, secret);

    // Only allow tokens issued specifically for pending ID proof upload
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
