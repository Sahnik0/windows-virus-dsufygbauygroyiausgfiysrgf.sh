const savedPlacesService = require('./saved-places.service');

// Controller handling Saved Places HTTP endpoints
class SavedPlacesController {
  // Creates a new saved place
  async createSavedPlace(req, res, next) {
    try {
      const result = await savedPlacesService.createSavedPlace(req.user, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Lists all personal saved places
  async getSavedPlaces(req, res, next) {
    try {
      const result = await savedPlacesService.getSavedPlaces(req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Gets a single saved place by ID
  async getSavedPlaceById(req, res, next) {
    try {
      const result = await savedPlacesService.getSavedPlaceById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Updates saved place details
  async updateSavedPlace(req, res, next) {
    try {
      const result = await savedPlacesService.updateSavedPlace(req.user, req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Deletes a saved place
  async deleteSavedPlace(req, res, next) {
    try {
      const result = await savedPlacesService.deleteSavedPlace(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SavedPlacesController();
