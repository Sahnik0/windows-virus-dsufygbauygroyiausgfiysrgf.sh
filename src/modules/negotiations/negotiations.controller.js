const negotiationsService = require('./negotiations.service');

class NegotiationsController {
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
