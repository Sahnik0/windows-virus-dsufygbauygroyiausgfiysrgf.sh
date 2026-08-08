const paymentsService = require('./payments.service');

class PaymentsController {
  async processTripPayment(req, res, next) {
    try {
      const result = await paymentsService.processTripPayment(
        req.user,
        req.params.tripId,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      // Use rawBody buffer captured during express.json middleware
      const rawBody = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body)));
      const result = await paymentsService.handleRazorpayWebhook(
        rawBody,
        signature
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentsController();
