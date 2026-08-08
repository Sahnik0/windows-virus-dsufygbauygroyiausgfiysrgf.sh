const vehiclesService = require('./vehicles.service');

// Controller handling Vehicle management HTTP endpoints
class VehiclesController {
  // Registers a new vehicle
  async createVehicle(req, res, next) {
    try {
      const licensePath = req.file ? req.file.path : null;
      const result = await vehiclesService.createVehicle(req.user, req.body, licensePath);
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

  // Lists pending vehicle verification applications (org admin / super admin)
  async getPendingVehicles(req, res, next) {
    try {
      const result = await vehiclesService.getPendingVehicles(req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Serves driving license document for a vehicle
  async getVehicleLicense(req, res, next) {
    try {
      const { filePath } = await vehiclesService.getVehicleLicense(req.user, req.params.id);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }

  // Approves a pending vehicle application
  async approveVehicle(req, res, next) {
    try {
      const result = await vehiclesService.approveVehicle(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Rejects a pending vehicle application with reason
  async rejectVehicle(req, res, next) {
    try {
      const result = await vehiclesService.rejectVehicle(req.user, req.params.id, req.body.rejectionReason);
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
