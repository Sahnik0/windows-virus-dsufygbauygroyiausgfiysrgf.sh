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

// SUPER_ADMIN operations
router.post(
  '/',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validate(createOrgSchema),
  orgsController.createOrg
);

router.get(
  '/',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  orgsController.getAllOrgs
);

router.post(
  '/:orgId/admins',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validate(provisionOrgAdminSchema),
  orgsController.provisionOrgAdmin
);

router.get(
  '/:orgId/admins',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  orgsController.getOrgAdmins
);

// ORG_ADMIN (own org) or SUPER_ADMIN
router.patch(
  '/:orgId/settings',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  validate(updateOrgSettingsSchema),
  orgsController.updateOrgSettings
);

module.exports = router;
