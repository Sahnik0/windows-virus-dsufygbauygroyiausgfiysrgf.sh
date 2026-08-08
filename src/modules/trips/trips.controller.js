const tripsService = require('./trips.service');

class TripsController {
  async getTripHistory(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const result = await tripsService.getTripHistory(req.user, page, limit);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMyTrips(req, res, next) {
    try {
      const result = await tripsService.getMyTrips(req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTripById(req, res, next) {
    try {
      const result = await tripsService.getTripById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateTripStatus(req, res, next) {
    try {
      const result = await tripsService.updateTripStatus(
        req.user,
        req.params.id,
        req.body.status
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TripsController();
