const express = require('express');
const trackingController = require('./tracking.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();

// GET /api/v1/trips/:id/location (REST fallback for vehicle location)
router.get(
  '/:id/location',
  authenticateToken,
  trackingController.getLatestLocation
);

module.exports = router;
