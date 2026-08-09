const express = require('express');
const paymentsController = require('./payments.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const { processPaymentSchema, verifyPaymentSchema } = require('./payments.validation');

const router = express.Router();

// 1. Process trip payment (WALLET, CASH, CARD, UPI)
router.post(
  '/trips/:tripId/pay',
  authenticateToken,
  validate(processPaymentSchema),
  paymentsController.processTripPayment
);

// 2. Verify Razorpay signature for trip payment (CARD, UPI)
router.post(
  '/trips/:tripId/verify',
  authenticateToken,
  validate(verifyPaymentSchema),
  paymentsController.verifyTripPayment
);

// 3. Razorpay Webhook listener endpoint
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentsController.handleWebhook
);

module.exports = router;
