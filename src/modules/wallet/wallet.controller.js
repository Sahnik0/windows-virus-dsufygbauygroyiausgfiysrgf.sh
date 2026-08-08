const walletService = require('./wallet.service');

class WalletController {
  async getWallet(req, res, next) {
    try {
      const result = await walletService.getWallet(req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async createRechargeOrder(req, res, next) {
    try {
      const result = await walletService.createRechargeOrder(req.user, req.body.amount);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

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
