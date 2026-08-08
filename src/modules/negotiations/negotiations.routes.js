const express = require('express');
const negotiationsController = require('./negotiations.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const {
  createNegotiationSchema,
  counterOfferSchema,
} = require('./negotiations.validation');

// mergeParams: true allows accessing :id (rideId) from parent router
const router = express.Router({ mergeParams: true });

router.post(
  '/',
  authenticateToken,
  validate(createNegotiationSchema),
  negotiationsController.createNegotiation
);

router.get(
  '/',
  authenticateToken,
  negotiationsController.getRideNegotiations
);

router.get(
  '/:negotiationId',
  authenticateToken,
  negotiationsController.getNegotiationById
);

router.post(
  '/:negotiationId/counter',
  authenticateToken,
  validate(counterOfferSchema),
  negotiationsController.counterOffer
);

router.patch(
  '/:negotiationId/accept',
  authenticateToken,
  negotiationsController.acceptNegotiation
);

router.patch(
  '/:negotiationId/reject',
  authenticateToken,
  negotiationsController.rejectNegotiation
);

module.exports = router;
