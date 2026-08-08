const walletService = require('./wallet.service');

// Controller handling Wallet HTTP endpoints
class WalletController {
  // Returns current user wallet balance and transaction history
  async getWallet(req, res, next) {
    try {
      const result = await walletService.getWallet(req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Creates a Razorpay order for wallet recharge
  async createRechargeOrder(req, res, next) {
    try {
      const result = await walletService.createRechargeOrder(req.user, req.body.amount);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Verifies Razorpay payment signature and credits wallet balance
  async verifyRecharge(req, res, next) {
    try {
      const result = await walletService.verifyRecharge(req.user, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WalletController();
