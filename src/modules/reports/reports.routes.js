const express = require('express');
const reportsController = require('./reports.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

const router = express.Router();

// 1. Get organization summary report (ORG_ADMIN / SUPER_ADMIN)
router.get(
  '/summary',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  reportsController.getSummaryReport
);

// 2. Get organization fuel consumption report (ORG_ADMIN / SUPER_ADMIN)
router.get(
  '/fuel',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  reportsController.getFuelReport
);

// 3. Get per-vehicle cost report (ORG_ADMIN / SUPER_ADMIN)
router.get(
  '/vehicle-cost',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  reportsController.getVehicleCostReport
);

module.exports = router;
