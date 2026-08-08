const express = require('express');
const reportsController = require('./reports.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

const router = express.Router();

router.get(
  '/summary',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  reportsController.getSummaryReport
);

router.get(
  '/fuel',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  reportsController.getFuelReport
);

router.get(
  '/cost-per-km',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  reportsController.getCostPerKmReport
);

router.get(
  '/vehicle-cost',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  reportsController.getVehicleCostReport
);

module.exports = router;
