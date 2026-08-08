const express = require('express');
const tripsController = require('./trips.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const { updateTripStatusSchema } = require('./trips.validation');

const router = express.Router();

// 1. Get paginated trip history for driver or passenger
router.get(
  '/history',
  authenticateToken,
  tripsController.getTripHistory
);

// 2. Get active ongoing trips where user is driver or booked passenger
router.get(
  '/',
  authenticateToken,
  tripsController.getMyTrips
);

// 3. Get single trip details by ID
router.get(
  '/:id',
  authenticateToken,
  tripsController.getTripById
);

// 4. Advance trip lifecycle status (driver-only state machine transition)
router.patch(
  '/:id/status',
  authenticateToken,
  validate(updateTripStatusSchema),
  tripsController.updateTripStatus
);

module.exports = router;
