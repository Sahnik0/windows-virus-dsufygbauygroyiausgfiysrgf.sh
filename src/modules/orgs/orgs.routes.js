const express = require('express');
const orgsController = require('./orgs.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const {
  createOrgSchema,
  provisionOrgAdminSchema,
  updateOrgSettingsSchema,
} = require('./orgs.validation');

const router = express.Router();

// 1. Create new organization (SUPER_ADMIN only)
router.post(
  '/',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validate(createOrgSchema),
  orgsController.createOrg
);

// 2. List all organizations (SUPER_ADMIN only)
router.get(
  '/',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  orgsController.getAllOrgs
);

// 3. Provision an Org Admin account for an organization (SUPER_ADMIN only)
router.post(
  '/:orgId/admins',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validate(provisionOrgAdminSchema),
  orgsController.provisionOrgAdmin
);

// 4. List all admins assigned to an organization (SUPER_ADMIN only)
router.get(
  '/:orgId/admins',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  orgsController.getOrgAdmins
);

// 5. Update organization pricing settings (ORG_ADMIN for own org, or SUPER_ADMIN)
router.patch(
  '/:orgId/settings',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  validate(updateOrgSettingsSchema),
  orgsController.updateOrgSettings
);

module.exports = router;
