const express = require('express');
const ridesController = require('./rides.controller');
const negotiationsRouter = require('../negotiations/negotiations.routes');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const {
  createRideSchema,
  searchRideSchema,
  createJoinRequestSchema,
} = require('./rides.validation');

const router = express.Router();

// Offer a ride
router.post(
  '/',
  authenticateToken,
  validate(createRideSchema),
  ridesController.createRide
);

// Find a ride (search)
router.post(
  '/search',
  authenticateToken,
  validate(searchRideSchema),
  ridesController.searchRides
);

// Nearby drivers discovery
router.get(
  '/nearby-drivers',
  authenticateToken,
  ridesController.getNearbyDrivers
);

// Mount price negotiations sub-router (/api/v1/rides/:id/negotiations)
router.use('/:id/negotiations', negotiationsRouter);

// Nearby passengers discovery for driver
router.get(
  '/:id/nearby-passengers',
  authenticateToken,
  ridesController.getNearbyPassengers
);

// Get single ride details
router.get(
  '/:id',
  authenticateToken,
  ridesController.getRideById
);

// Join request routes
router.post(
  '/:id/join-requests',
  authenticateToken,
  validate(createJoinRequestSchema),
  ridesController.createJoinRequest
);

router.get(
  '/:id/join-requests',
  authenticateToken,
  ridesController.getJoinRequests
);

router.patch(
  '/:id/join-requests/:requestId/accept',
  authenticateToken,
  ridesController.acceptJoinRequest
);

router.patch(
  '/:id/join-requests/:requestId/decline',
  authenticateToken,
  ridesController.declineJoinRequest
);

module.exports = router;
