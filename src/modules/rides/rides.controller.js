const ridesService = require('./rides.service');

// Controller handling Ride publishing, search, discovery, and join request HTTP endpoints
class RidesController {
  // Publishes a new ride offer
  async createRide(req, res, next) {
    try {
      const result = await ridesService.createRide(req.user, req.body);
      const io = req.app.get('io');
      if (io) {
        const tracking = io.of('/tracking');
        if (req.user.orgId) tracking.to(`org:${req.user.orgId}`).emit('ride:created', result);
        tracking.to(`user:${req.user.id}`).emit('ride:created', result);
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Lists published ride offers created by caller with active negotiations and join requests
  async getMyOfferedRides(req, res, next) {
    try {
      const result = await ridesService.getMyOfferedRides(req.user);
      res.status(200).json(result);
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

  // Finds nearby published driver rides for a passenger location
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

  // Finds nearby passenger saved places for a driver ride
  async getNearbyPassengers(req, res, next) {
    try {
      const radiusKm = req.query.radiusKm ? parseFloat(req.query.radiusKm) : 2.0;
      const result = await ridesService.getNearbyPassengers(req.user, req.params.id, radiusKm);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Gets single ride details by ID
  async getRideById(req, res, next) {
    try {
      const result = await ridesService.getRideById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Submits a join request for a ride
  async createJoinRequest(req, res, next) {
    try {
      const result = await ridesService.createJoinRequest(req.user, req.params.id, req.body);
      const io = req.app.get('io');
      if (io) {
        const tracking = io.of('/tracking');
        const rideId = req.params.id;
        tracking.to(`ride:${rideId}`).emit('join_request:created', result.joinRequest);
        if (result.joinRequest?.ride?.driverId) {
          tracking.to(`user:${result.joinRequest.ride.driverId}`).emit('join_request:created', result.joinRequest);
        }
        tracking.to(`user:${req.user.id}`).emit('join_request:created', result.joinRequest);
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Lists pending join requests for a ride
  async getJoinRequests(req, res, next) {
    try {
      const result = await ridesService.getJoinRequests(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Accepts a join request and books seat
  async acceptJoinRequest(req, res, next) {
    try {
      const result = await ridesService.acceptJoinRequest(
        req.user,
        req.params.id,
        req.params.requestId
      );
      const io = req.app.get('io');
      if (io) {
        const tracking = io.of('/tracking');
        const rideId = req.params.id;
        const passengerId = result.joinRequest?.passengerId;
        const driverId = result.trip?.driverId;
        const tripId = result.trip?.id;

        tracking.to(`ride:${rideId}`).emit('ride:accepted', result);
        if (tripId) tracking.to(`trip:${tripId}`).emit('ride:accepted', result);
        if (passengerId) tracking.to(`user:${passengerId}`).emit('ride:accepted', result);
        if (driverId) tracking.to(`user:${driverId}`).emit('ride:accepted', result);
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Declines a join request
  async declineJoinRequest(req, res, next) {
    try {
      const result = await ridesService.declineJoinRequest(
        req.user,
        req.params.id,
        req.params.requestId
      );
      const io = req.app.get('io');
      if (io) {
        const tracking = io.of('/tracking');
        const rideId = req.params.id;
        tracking.to(`ride:${rideId}`).emit('join_request:declined', { rideId, requestId: req.params.requestId });
        if (result.passengerId) {
          tracking.to(`user:${result.passengerId}`).emit('join_request:declined', { rideId, requestId: req.params.requestId });
        }
        tracking.to(`user:${req.user.id}`).emit('join_request:declined', { rideId, requestId: req.params.requestId });
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RidesController();
