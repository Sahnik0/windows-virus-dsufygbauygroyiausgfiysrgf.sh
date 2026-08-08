const reportsService = require('./reports.service');

// Controller handling Administrative Reporting HTTP endpoints
class ReportsController {
  // Handles summary report requests (total trips and total distance)
  async getSummaryReport(req, res, next) {
    try {
      const { orgId, startDate, endDate } = req.query;
      const result = await reportsService.getSummaryReport(req.user, orgId, startDate, endDate);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Handles fuel report requests (estimated fuel litres and total fuel cost)
  async getFuelReport(req, res, next) {
    try {
      const { orgId, startDate, endDate } = req.query;
      const result = await reportsService.getFuelReport(req.user, orgId, startDate, endDate);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Handles cost per km report requests
  async getCostPerKmReport(req, res, next) {
    try {
      const { orgId } = req.query;
      const result = await reportsService.getCostPerKmReport(req.user, orgId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Handles per-vehicle cost report requests
  async getVehicleCostReport(req, res, next) {
    try {
      const { orgId } = req.query;
      const result = await reportsService.getVehicleCostReport(req.user, orgId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReportsController();
