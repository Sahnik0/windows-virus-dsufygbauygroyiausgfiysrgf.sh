const chatService = require('./chat.service');

// Controller handling REST chat HTTP endpoints
class ChatController {
  // Sends a chat message via REST API and broadcasts real-time to socket listeners
  async sendMessage(req, res, next) {
    try {
      const { content } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: 'Message content is required' });
      }

      const result = await chatService.sendMessage(req.user, req.params.id, content);

      // Broadcast real-time message event to Socket.io room if attached
      const io = req.app.get('io');
      if (io) {
        io.of('/chat').to(`trip:${req.params.id}`).emit('message:new', result);
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Returns paginated chat message history
  async getMessages(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const result = await chatService.getMessages(req.user, req.params.id, page, limit);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Marks unread messages as read
  async markAsRead(req, res, next) {
    try {
      const result = await chatService.markAsRead(req.user, req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();
