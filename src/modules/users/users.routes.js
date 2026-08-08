const express = require('express');
const usersController = require('./users.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { rejectUserSchema, updateUserSchema } = require('./users.validation');

const router = express.Router();

// Admin pending approval routes
router.get(
  '/pending',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  usersController.getPendingUsers
);

router.get(
  '/:id/id-proof',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  usersController.getIdProof
);

router.patch(
  '/:id/approve',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  usersController.approveUser
);

router.patch(
  '/:id/reject',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  validate(rejectUserSchema),
  usersController.rejectUser
);

// General User management routes
router.get(
  '/',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  usersController.getAllUsers
);

router.get(
  '/:id',
  authenticateToken,
  usersController.getUserById
);

router.patch(
  '/:id',
  authenticateToken,
  validate(updateUserSchema),
  usersController.updateUser
);

module.exports = router;
