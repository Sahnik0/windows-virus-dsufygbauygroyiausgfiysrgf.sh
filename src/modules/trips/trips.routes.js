const express = require('express');
const tripsController = require('./trips.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const { updateTripStatusSchema } = require('./trips.validation');

const router = express.Router();

router.get(
  '/history',
  authenticateToken,
  tripsController.getTripHistory
);

router.get(
  '/',
  authenticateToken,
  tripsController.getMyTrips
);

router.get(
  '/:id',
  authenticateToken,
  tripsController.getTripById
);

router.patch(
  '/:id/status',
  authenticateToken,
  validate(updateTripStatusSchema),
  tripsController.updateTripStatus
);

module.exports = router;
