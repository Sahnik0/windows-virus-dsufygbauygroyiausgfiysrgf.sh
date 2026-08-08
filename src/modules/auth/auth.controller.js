const authService = require('./auth.service');

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async uploadIdProof(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'ID proof file is required' });
      }
      const result = await authService.uploadIdProof(req.user.id, req.file.path);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.status(200).json(result);
    } catch (error) {
      if (error.rejectionReason) {
        return res.status(403).json({
          message: error.message,
          rejectionReason: error.rejectionReason,
        });
      }
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const result = await authService.refreshToken(req.body.refreshToken);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const refreshTokenStr = req.body.refreshToken;
      const result = await authService.logout(refreshTokenStr);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
