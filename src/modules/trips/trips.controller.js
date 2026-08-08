const tripsService = require('./trips.service');

// Controller handling Trip lifecycle and history HTTP endpoints
class TripsController {
  // Returns paginated trip history
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

  // Returns active ongoing trips for user
  async getMyTrips(req, res, next) {
    try {
      const result = await tripsService.getMyTrips(req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Gets trip details by ID
  async getTripById(req, res, next) {
    try {
      const result = await tripsService.getTripById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Updates trip status (driver-only)
  async updateTripStatus(req, res, next) {
    try {
      const result = await tripsService.updateTripStatus(
        req.user,
        req.params.id,
        req.body.status
      );
      // If OTP was generated (trip starting), broadcast via Socket.IO to trip room
      if (result.otp) {
        const io = req.app.get('io');
        if (io) {
          io.of('/tracking').to(`trip:${req.params.id}`).emit('otp:generated', {
            tripId: req.params.id,
            otp: result.otp,
          });
        }
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Passenger verifies OTP to confirm ride start
  async verifyOtp(req, res, next) {
    try {
      const result = await tripsService.verifyOtpAndStart(
        req.user,
        req.params.id,
        req.body.otp
      );
      // Broadcast ride started to all participants
      const io = req.app.get('io');
      if (io) {
        io.of('/tracking').to(`trip:${req.params.id}`).emit('ride:started', {
          tripId: req.params.id,
        });
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Driver retrieves current OTP for display
  async getOtp(req, res, next) {
    try {
      const result = await tripsService.getTripOtp(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TripsController();

