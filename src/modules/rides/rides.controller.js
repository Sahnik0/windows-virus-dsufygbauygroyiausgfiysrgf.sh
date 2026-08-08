const ridesService = require('./rides.service');

class RidesController {
  async createRide(req, res, next) {
    try {
      const result = await ridesService.createRide(req.user, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async searchRides(req, res, next) {
    try {
      const result = await ridesService.searchRides(req.user, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getNearbyDrivers(req, res, next) {
    try {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const radiusKm = req.query.radiusKm ? parseFloat(req.query.radiusKm) : 2.0;

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: 'Valid lat and lng query parameters are required' });
      }

      const result = await ridesService.getNearbyDrivers(req.user, lat, lng, radiusKm);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getNearbyPassengers(req, res, next) {
    try {
      const radiusKm = req.query.radiusKm ? parseFloat(req.query.radiusKm) : 2.0;
      const result = await ridesService.getNearbyPassengers(req.user, req.params.id, radiusKm);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getRideById(req, res, next) {
    try {
      const result = await ridesService.getRideById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async createJoinRequest(req, res, next) {
    try {
      const result = await ridesService.createJoinRequest(req.user, req.params.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getJoinRequests(req, res, next) {
    try {
      const result = await ridesService.getJoinRequests(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async acceptJoinRequest(req, res, next) {
    try {
      const result = await ridesService.acceptJoinRequest(
        req.user,
        req.params.id,
        req.params.requestId
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async declineJoinRequest(req, res, next) {
    try {
      const result = await ridesService.declineJoinRequest(
        req.user,
        req.params.id,
        req.params.requestId
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RidesController();
