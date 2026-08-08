const trackingService = require('./tracking.service');

class TrackingController {
  async getLatestLocation(req, res, next) {
    try {
      const result = await trackingService.getLatestLocation(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TrackingController();
