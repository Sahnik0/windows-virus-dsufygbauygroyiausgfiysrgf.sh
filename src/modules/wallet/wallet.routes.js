const express = require('express');
const walletController = require('./wallet.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const { rechargeWalletSchema, verifyRechargeSchema } = require('./wallet.validation');

const router = express.Router();

// 1. Get user wallet balance and transaction history
router.get(
  '/',
  authenticateToken,
  walletController.getWallet
);

// 2. Create a Razorpay order for wallet recharge
router.post(
  '/recharge',
  authenticateToken,
  validate(rechargeWalletSchema),
  walletController.createRechargeOrder
);

// 3. Verify Razorpay HMAC signature and credit wallet balance
router.post(
  '/recharge/verify',
  authenticateToken,
  validate(verifyRechargeSchema),
  walletController.verifyRecharge
);

module.exports = router;
