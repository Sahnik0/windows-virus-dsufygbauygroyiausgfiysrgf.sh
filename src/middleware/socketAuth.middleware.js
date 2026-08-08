const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

// Socket.io middleware to verify JWT access tokens on WebSocket connection handshakes
async function socketAuthMiddleware(socket, next) {
  try {
    // Read token from socket auth handshake object or Authorization header
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    // Verify JWT access token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (decoded.type !== 'access') {
      return next(new Error('Invalid token type'));
    }

    // Verify user exists and is APPROVED
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, orgId: true, verificationStatus: true },
    });

    if (!user || user.verificationStatus !== 'APPROVED') {
      return next(new Error('Account not active or approved'));
    }

    // Attach authenticated user payload to socket instance
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed: ' + err.message));
  }
}

module.exports = socketAuthMiddleware;
