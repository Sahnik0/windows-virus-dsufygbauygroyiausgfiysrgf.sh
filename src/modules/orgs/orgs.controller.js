const orgsService = require('./orgs.service');

// Controller handling Organization management HTTP requests
class OrgsController {
  // Handles creating a new organization
  async createOrg(req, res, next) {
    try {
      const result = await orgsService.createOrg(req.body);
      res.status(201).json({
        message: 'Organization created successfully',
        org: result,
        id: result.id,
        name: result.name,
        slug: result.slug,
        status: result.status,
      });
    } catch (error) {
      next(error);
    }
  }

  // Handles listing all organizations
  async getAllOrgs(req, res, next) {
    try {
      const result = await orgsService.getAllOrgs();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Handles provisioning an Org Admin for an organization
  async provisionOrgAdmin(req, res, next) {
    try {
      const result = await orgsService.provisionOrgAdmin(req.params.orgId, req.body);
      res.status(201).json({
        message: 'Org Admin provisioned successfully',
        user: result,
        id: result.id,
        email: result.email,
        role: result.role,
        orgId: result.orgId,
        verificationStatus: result.verificationStatus,
      });
    } catch (error) {
      next(error);
    }
  }

  // Handles listing all admins of an organization
  async getOrgAdmins(req, res, next) {
    try {
      const result = await orgsService.getOrgAdmins(req.params.orgId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Handles updating organization settings (fuel cost, cost per km)
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
