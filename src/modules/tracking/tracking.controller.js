const trackingService = require('./tracking.service');

// Controller handling REST tracking HTTP endpoints
class TrackingController {
  // Returns latest vehicle location and planned route geometry
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
