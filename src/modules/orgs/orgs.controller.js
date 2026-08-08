const orgsService = require('./orgs.service');

class OrgsController {
  async createOrg(req, res, next) {
    try {
      const result = await orgsService.createOrg(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAllOrgs(req, res, next) {
    try {
      const result = await orgsService.getAllOrgs();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async provisionOrgAdmin(req, res, next) {
    try {
      const result = await orgsService.provisionOrgAdmin(req.params.orgId, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getOrgAdmins(req, res, next) {
    try {
      const result = await orgsService.getOrgAdmins(req.params.orgId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateOrgSettings(req, res, next) {
    try {
      const result = await orgsService.updateOrgSettings(req.user, req.params.orgId, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrgsController();
