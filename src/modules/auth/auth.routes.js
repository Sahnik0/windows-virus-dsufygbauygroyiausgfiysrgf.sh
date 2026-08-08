const express = require('express');
const authController = require('./auth.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticatePendingToken } = require('../../middleware/auth.middleware');
const uploadIdProof = require('../../utils/multer');
const { registerSchema, loginSchema, refreshTokenSchema } = require('./auth.validation');

const router = express.Router();

router.post('/register', validate(registerSchema), authController.register);

router.post(
  '/register/id-proof',
  authenticatePendingToken,
  uploadIdProof.single('idProof'),
  authController.uploadIdProof
);

router.post('/login', validate(loginSchema), authController.login);

router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

router.post('/logout', authController.logout);

module.exports = router;
