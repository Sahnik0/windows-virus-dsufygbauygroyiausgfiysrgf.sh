const vehiclesService = require('./vehicles.service');

// Controller handling Vehicle management HTTP endpoints
class VehiclesController {
  // Registers a new vehicle
  async createVehicle(req, res, next) {
    try {
      const result = await vehiclesService.createVehicle(req.user, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Lists vehicles owned by user (or org-wide for admins)
  async getVehicles(req, res, next) {
    try {
      const includeOrg = req.query.all === 'true';
      const result = await vehiclesService.getVehicles(req.user, includeOrg);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Gets single vehicle by ID
  async getVehicleById(req, res, next) {
    try {
      const result = await vehiclesService.getVehicleById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Updates vehicle info
  async updateVehicle(req, res, next) {
    try {
      const result = await vehiclesService.updateVehicle(req.user, req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Deletes a vehicle record
  async deleteVehicle(req, res, next) {
    try {
      const result = await vehiclesService.deleteVehicle(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new VehiclesController();
