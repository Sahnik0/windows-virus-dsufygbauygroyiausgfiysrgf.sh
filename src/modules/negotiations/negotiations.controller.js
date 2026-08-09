const negotiationsService = require('./negotiations.service');

// Controller handling price negotiation HTTP endpoints
class NegotiationsController {
  // Starts a new price negotiation session (Passenger only)
  async createNegotiation(req, res, next) {
    try {
      const result = await negotiationsService.createNegotiation(
        req.user,
        req.params.id,
        req.body.amount
      );
      const io = req.app.get('io');
      if (io) {
        const tracking = io.of('/tracking');
        const rideId = req.params.id;
        const lastOffer = result.offers?.[result.offers.length - 1];
        const payload = {
          rideId,
          negotiationId: result.id,
          amount: lastOffer ? lastOffer.amount : req.body.amount,
          offeredBy: 'PASSENGER',
          passengerId: result.passengerId,
        };
        tracking.to(`ride:${rideId}`).emit('negotiation:offer', payload);
        tracking.to(`user:${result.passengerId}`).emit('negotiation:offer', payload);
        if (result.ride?.driverId) tracking.to(`user:${result.ride.driverId}`).emit('negotiation:offer', payload);
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Lists all open negotiations for a ride (Driver only)
  async getRideNegotiations(req, res, next) {
    try {
      const result = await negotiationsService.getRideNegotiations(
        req.user,
        req.params.id
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Gets complete offer history for a negotiation
  async getNegotiationById(req, res, next) {
    try {
      const result = await negotiationsService.getNegotiationById(
        req.user,
        req.params.id,
        req.params.negotiationId
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Submits a counter-offer in an open negotiation
  async counterOffer(req, res, next) {
    try {
      const result = await negotiationsService.counterOffer(
        req.user,
        req.params.id,
        req.params.negotiationId,
        req.body.amount
      );
      const io = req.app.get('io');
      if (io) {
        const tracking = io.of('/tracking');
        const rideId = req.params.id;
        const lastOffer = result.offers?.[result.offers.length - 1];
        const payload = {
          rideId,
          negotiationId: result.id,
          amount: lastOffer ? lastOffer.amount : req.body.amount,
          offeredBy: lastOffer ? lastOffer.offeredBy : (req.user.id === result.ride?.driverId ? 'DRIVER' : 'PASSENGER'),
          passengerId: result.passengerId,
        };
        tracking.to(`ride:${rideId}`).emit('negotiation:offer', payload);
        tracking.to(`user:${result.passengerId}`).emit('negotiation:offer', payload);
        if (result.ride?.driverId) tracking.to(`user:${result.ride.driverId}`).emit('negotiation:offer', payload);
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Accepts the other party's latest offer
  async acceptNegotiation(req, res, next) {
    try {
      const result = await negotiationsService.acceptNegotiation(
        req.user,
        req.params.id,
        req.params.negotiationId
      );
      const io = req.app.get('io');
      if (io) {
        const tracking = io.of('/tracking');
        const rideId = req.params.id;
        const passengerId = result.negotiation?.passengerId;
        const driverId = result.trip?.driverId || result.negotiation?.ride?.driverId;
        const tripId = result.trip?.id;

        const payload = {
          rideId,
          negotiationId: req.params.negotiationId,
          agreedFare: result.agreedFare,
          passengerId,
          trip: result.trip,
        };
        tracking.to(`ride:${rideId}`).emit('negotiation:accepted', payload);
        tracking.to(`ride:${rideId}`).emit('ride:accepted', payload);
        if (tripId) tracking.to(`trip:${tripId}`).emit('ride:accepted', payload);
        if (passengerId) {
          tracking.to(`user:${passengerId}`).emit('negotiation:accepted', payload);
          tracking.to(`user:${passengerId}`).emit('ride:accepted', payload);
        }
        if (driverId) {
          tracking.to(`user:${driverId}`).emit('negotiation:accepted', payload);
          tracking.to(`user:${driverId}`).emit('ride:accepted', payload);
        }
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Rejects a price negotiation
  async rejectNegotiation(req, res, next) {
    try {
      const result = await negotiationsService.rejectNegotiation(
        req.user,
        req.params.id,
        req.params.negotiationId
      );
      const io = req.app.get('io');
      if (io) {
        const tracking = io.of('/tracking');
        const rideId = req.params.id;
        const payload = {
          rideId,
          negotiationId: req.params.negotiationId,
          passengerId: result.negotiation?.passengerId,
        };
        tracking.to(`ride:${rideId}`).emit('negotiation:rejected', payload);
        if (result.negotiation?.passengerId) tracking.to(`user:${result.negotiation.passengerId}`).emit('negotiation:rejected', payload);
        tracking.to(`user:${req.user.id}`).emit('negotiation:rejected', payload);
      }
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NegotiationsController();
