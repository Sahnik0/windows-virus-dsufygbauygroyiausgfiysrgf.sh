const usersService = require('./users.service');

class UsersController {
  async getAllUsers(req, res, next) {
    try {
      const filterOrgId = req.query.orgId;
      const result = await usersService.getAllUsers(req.user, filterOrgId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req, res, next) {
    try {
      const result = await usersService.getUserById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const result = await usersService.updateUser(req.user, req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getPendingUsers(req, res, next) {
    try {
      const filterOrgId = req.query.orgId;
      const result = await usersService.getPendingUsers(req.user, filterOrgId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getIdProof(req, res, next) {
    try {
      const { filePath } = await usersService.getIdProof(req.user, req.params.id);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }

  async approveUser(req, res, next) {
    try {
      const result = await usersService.approveUser(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async rejectUser(req, res, next) {
    try {
      const result = await usersService.rejectUser(req.user, req.params.id, req.body.rejectionReason);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UsersController();
