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

// 1. Offer/publish a new ride
router.post(
  '/',
  authenticateToken,
  validate(createRideSchema),
  ridesController.createRide
);

// 2. List caller's published ride offers with active negotiations & join requests
router.get(
  '/my-offers',
  authenticateToken,
  ridesController.getMyOfferedRides
);
router.post(
  '/search',
  authenticateToken,
  validate(searchRideSchema),
  ridesController.searchRides
);

// 3. Passenger discovery: Nearby drivers around pickup location
router.get(
  '/nearby-drivers',
  authenticateToken,
  ridesController.getNearbyDrivers
);

// 4. Mount price negotiations sub-router under /api/v1/rides/:id/negotiations
router.use('/:id/negotiations', negotiationsRouter);

// 5. Driver discovery: Nearby passenger saved places around ride pickup
router.get(
  '/:id/nearby-passengers',
  authenticateToken,
  ridesController.getNearbyPassengers
);

// 6. Get single ride details
router.get(
  '/:id',
  authenticateToken,
  ridesController.getRideById
);

// 7. Submit a join request for a ride
router.post(
  '/:id/join-requests',
  authenticateToken,
  validate(createJoinRequestSchema),
  ridesController.createJoinRequest
);

// 8. List pending join requests for a ride (driver-only)
router.get(
  '/:id/join-requests',
  authenticateToken,
  ridesController.getJoinRequests
);

// 9. Accept a join request and book seat
router.patch(
  '/:id/join-requests/:requestId/accept',
  authenticateToken,
  ridesController.acceptJoinRequest
);

// 10. Decline a join request
router.patch(
  '/:id/join-requests/:requestId/decline',
  authenticateToken,
  ridesController.declineJoinRequest
);

module.exports = router;
