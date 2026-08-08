const authService = require('./auth.service');

// Controller class to handle incoming HTTP requests and responses for authentication
class AuthController {
  // Handles new user registration request
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result); // 201 Created
    } catch (error) {
      next(error); // Pass errors to global error middleware
    }
  }

  // Handles ID proof document upload after registration
  async uploadIdProof(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'ID proof file is required' });
      }
      const result = await authService.uploadIdProof(req.user.id, req.file.path);
      res.status(200).json(result); // 200 OK
    } catch (error) {
      next(error);
    }
  }

  // Handles user login request and checks account verification status
  async login(req, res, next) {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.status(200).json(result);
    } catch (error) {
      // If account registration was rejected by admin, return reason with 403 Forbidden
      if (error.rejectionReason) {
        return res.status(403).json({
          message: error.message,
          rejectionReason: error.rejectionReason,
        });
      }
      next(error);
    }
  }

  // Handles issuing a new access token using a valid refresh token
  async refreshToken(req, res, next) {
    try {
      const result = await authService.refreshToken(req.body.refreshToken);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Handles user logout by revoking the refresh token
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
