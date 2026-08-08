const express = require('express');
const negotiationsController = require('./negotiations.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const {
  createNegotiationSchema,
  counterOfferSchema,
} = require('./negotiations.validation');

// mergeParams: true allows accessing parent route parameter :id (rideId)
const router = express.Router({ mergeParams: true });

// 1. Start a new price negotiation for a ride (Passenger only)
router.post(
  '/',
  authenticateToken,
  validate(createNegotiationSchema),
  negotiationsController.createNegotiation
);

// 2. List open negotiations for a ride (Driver only)
router.get(
  '/',
  authenticateToken,
  negotiationsController.getRideNegotiations
);

// 3. Get offer history for a specific negotiation session
router.get(
  '/:negotiationId',
  authenticateToken,
  negotiationsController.getNegotiationById
);

// 4. Submit a counter-offer in an open negotiation session
router.post(
  '/:negotiationId/counter',
  authenticateToken,
  validate(counterOfferSchema),
  negotiationsController.counterOffer
);

// 5. Accept the other party's latest offer
router.patch(
  '/:negotiationId/accept',
  authenticateToken,
  negotiationsController.acceptNegotiation
);

// 6. Reject a price negotiation
router.patch(
  '/:negotiationId/reject',
  authenticateToken,
  negotiationsController.rejectNegotiation
);

module.exports = router;
