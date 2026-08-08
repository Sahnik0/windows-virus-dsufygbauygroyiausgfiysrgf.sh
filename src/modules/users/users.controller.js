const usersService = require('./users.service');

// Controller handling user management HTTP endpoints
class UsersController {
  // Returns all users in caller's organization
  async getAllUsers(req, res, next) {
    try {
      const filterOrgId = req.query.orgId;
      const result = await usersService.getAllUsers(req.user, filterOrgId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Returns single user profile by ID
  async getUserById(req, res, next) {
    try {
      const result = await usersService.getUserById(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Updates user profile info
  async updateUser(req, res, next) {
    try {
      const result = await usersService.updateUser(req.user, req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Returns list of users waiting for admin verification approval
  async getPendingUsers(req, res, next) {
    try {
      const filterOrgId = req.query.orgId;
      const result = await usersService.getPendingUsers(req.user, filterOrgId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Streams uploaded ID proof file to admin client
  async getIdProof(req, res, next) {
    try {
      const { filePath } = await usersService.getIdProof(req.user, req.params.id);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }

  // Approves user registration
  async approveUser(req, res, next) {
    try {
      const result = await usersService.approveUser(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Rejects user registration with reason
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
