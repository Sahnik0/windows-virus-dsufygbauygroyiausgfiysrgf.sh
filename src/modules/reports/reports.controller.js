const reportsService = require('./reports.service');

class ReportsController {
  async getSummaryReport(req, res, next) {
    try {
      const { orgId, startDate, endDate } = req.query;
      const result = await reportsService.getSummaryReport(req.user, orgId, startDate, endDate);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getFuelReport(req, res, next) {
    try {
      const { orgId, startDate, endDate } = req.query;
      const result = await reportsService.getFuelReport(req.user, orgId, startDate, endDate);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getCostPerKmReport(req, res, next) {
    try {
      const { orgId } = req.query;
      const result = await reportsService.getCostPerKmReport(req.user, orgId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

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
