const express = require('express');
const chatController = require('./chat.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();

// REST Chat endpoints under /api/v1/trips/:id/messages
router.get(
  '/:id/messages',
  authenticateToken,
  chatController.getMessages
);

router.post(
  '/:id/messages',
  authenticateToken,
  chatController.sendMessage
);

router.patch(
  '/:id/messages/read',
  authenticateToken,
  chatController.markAsRead
);

module.exports = router;
