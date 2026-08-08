const express = require('express');
const usersController = require('./users.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { rejectUserSchema, updateUserSchema } = require('./users.validation');

const router = express.Router();

// 1. Get users waiting for admin approval (ORG_ADMIN / SUPER_ADMIN)
router.get(
  '/pending',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  usersController.getPendingUsers
);

// 2. View/stream uploaded ID proof document for a pending user
router.get(
  '/:id/id-proof',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  usersController.getIdProof
);

// 3. Approve a pending user account
router.patch(
  '/:id/approve',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  usersController.approveUser
);

// 4. Reject a pending user account with reason
router.patch(
  '/:id/reject',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  validate(rejectUserSchema),
  usersController.rejectUser
);

// 5. Get all users in organization (ORG_ADMIN / SUPER_ADMIN)
router.get(
  '/',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  usersController.getAllUsers
);

// 6. Get user details by ID
router.get(
  '/:id',
  authenticateToken,
  usersController.getUserById
);

// 7. Update user profile details
router.patch(
  '/:id',
  authenticateToken,
  validate(updateUserSchema),
  usersController.updateUser
);

module.exports = router;
