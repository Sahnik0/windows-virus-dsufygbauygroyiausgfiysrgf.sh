const express = require('express');
const authController = require('./auth.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticatePendingToken } = require('../../middleware/auth.middleware');
const uploadIdProof = require('../../utils/multer');
const { registerSchema, loginSchema, refreshTokenSchema } = require('./auth.validation');

// Create an Express router instance for auth endpoints
const router = express.Router();

// 1. User registration endpoint (validates req.body against registerSchema)
router.post('/register', validate(registerSchema), authController.register);

// 2. ID proof file upload endpoint (requires pendingToken and single file input named 'idProof')
router.post(
  '/register/id-proof',
  authenticatePendingToken,
  uploadIdProof.single('idProof'),
  authController.uploadIdProof
);

// 3. User login endpoint (validates credentials and checks approval status)
router.post('/login', validate(loginSchema), authController.login);

// 4. Refresh token endpoint (issues a new short-lived access token)
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

// 5. Logout endpoint (invalidates the refresh token)
router.post('/logout', authController.logout);

module.exports = router;
