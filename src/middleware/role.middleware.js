/**
 * Role-based authorization middleware factory.
 * @param  {...string} allowedRoles - List of allowed role names (e.g. 'SUPER_ADMIN', 'ORG_ADMIN', 'USER')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

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
