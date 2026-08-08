const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

/**
 * Socket.io middleware to verify JWT access token on connection handshakes.
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (decoded.type !== 'access') {
      return next(new Error('Invalid token type'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, orgId: true, verificationStatus: true },
    });

    if (!user || user.verificationStatus !== 'APPROVED') {
      return next(new Error('Account not active or approved'));
    }

    // Attach authenticated user to socket
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed: ' + err.message));
  }
}

module.exports = socketAuthMiddleware;
