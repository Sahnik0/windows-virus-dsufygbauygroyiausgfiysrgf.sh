const savedPlacesService = require('./saved-places.service');

class SavedPlacesController {
  async createSavedPlace(req, res, next) {
    try {
      const result = await savedPlacesService.createSavedPlace(req.user, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getSavedPlaces(req, res, next) {
    try {
      const result = await savedPlacesService.getSavedPlaces(req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getSavedPlaceById(req, res, next) {
    try {
      const result = await savedPlacesService.getSavedPlaceById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateSavedPlace(req, res, next) {
    try {
      const result = await savedPlacesService.updateSavedPlace(req.user, req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

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
