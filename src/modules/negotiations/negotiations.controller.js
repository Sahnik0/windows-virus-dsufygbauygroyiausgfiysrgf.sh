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
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NegotiationsController();
