const paymentsService = require('./payments.service');

// Controller handling Payment HTTP endpoints
class PaymentsController {
  // Processes payment for a trip
  async processTripPayment(req, res, next) {
    try {
      const result = await paymentsService.processTripPayment(
        req.user,
        req.params.tripId,
        req.body
      );
      const io = req.app.get('io');
      if (io) {
        const tracking = io.of('/tracking');
        const tripId = req.params.tripId;
        const payload = { tripId, payment: result.payment };
        tracking.to(`trip:${tripId}`).emit('payment:updated', payload);
        tracking.to(`user:${req.user.id}`).emit('payment:updated', payload);
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Receives and verifies Razorpay webhook notifications
  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      // Use rawBody buffer captured during express.json parsing middleware
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
