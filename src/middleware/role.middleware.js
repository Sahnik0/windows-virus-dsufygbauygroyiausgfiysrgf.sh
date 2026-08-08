// Middleware factory to restrict access to specific user roles (e.g. 'SUPER_ADMIN', 'ORG_ADMIN', 'USER')
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Step 1: Ensure req.user exists (set by auth middleware)
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Step 2: Check if user role is included in allowedRoles list
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
};
