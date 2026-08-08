const vehiclesService = require('./vehicles.service');

class VehiclesController {
  async createVehicle(req, res, next) {
    try {
      const result = await vehiclesService.createVehicle(req.user, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getVehicles(req, res, next) {
    try {
      const includeOrg = req.query.all === 'true';
      const result = await vehiclesService.getVehicles(req.user, includeOrg);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getVehicleById(req, res, next) {
    try {
      const result = await vehiclesService.getVehicleById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateVehicle(req, res, next) {
    try {
      const result = await vehiclesService.updateVehicle(req.user, req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

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
