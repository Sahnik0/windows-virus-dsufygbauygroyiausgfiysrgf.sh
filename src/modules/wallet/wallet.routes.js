const express = require('express');
const walletController = require('./wallet.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const { rechargeWalletSchema, verifyRechargeSchema } = require('./wallet.validation');

const router = express.Router();

router.get(
  '/',
  authenticateToken,
  walletController.getWallet
);

router.post(
  '/recharge',
  authenticateToken,
  validate(rechargeWalletSchema),
  walletController.createRechargeOrder
);

router.post(
  '/recharge/verify',
  authenticateToken,
  validate(verifyRechargeSchema),
  walletController.verifyRecharge
);

module.exports = router;
