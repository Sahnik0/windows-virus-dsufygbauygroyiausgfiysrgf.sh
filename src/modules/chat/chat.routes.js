const express = require('express');
const chatController = require('./chat.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();

// 1. Get paginated chat history for a trip
router.get(
  '/:id/messages',
  authenticateToken,
  chatController.getMessages
);

// 2. Send a new chat message via REST API
router.post(
  '/:id/messages',
  authenticateToken,
  chatController.sendMessage
);

// 3. Mark unread messages in a trip as read
router.patch(
  '/:id/messages/read',
  authenticateToken,
  chatController.markAsRead
);

module.exports = router;
