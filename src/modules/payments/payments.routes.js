const express = require('express');
const paymentsController = require('./payments.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const { processPaymentSchema } = require('./payments.validation');

const router = express.Router();

// Trip payment route
router.post(
  '/trips/:tripId/pay',
  authenticateToken,
  validate(processPaymentSchema),
  paymentsController.processTripPayment
);

// Razorpay Webhook Receiver
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentsController.handleWebhook
);

module.exports = router;
