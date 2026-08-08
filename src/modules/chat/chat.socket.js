const socketAuthMiddleware = require('../../middleware/socketAuth.middleware');
const chatService = require('./chat.service');
const { assertTripParticipant } = require('../../utils/tripAuth');

function registerChatHandlers(io) {
  const chatNamespace = io.of('/chat');

  chatNamespace.use(socketAuthMiddleware);

  chatNamespace.on('connection', (socket) => {
    console.log(`[Chat Socket] User connected: ${socket.user.id}`);

    socket.on('join:trip', async ({ tripId }) => {
      try {
        await assertTripParticipant(socket.user.id, tripId);
        socket.join(`trip:${tripId}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('message:send', async ({ tripId, content }) => {
      try {
        if (!content || typeof content !== 'string') {
          return socket.emit('error', { message: 'Message content is required' });
        }

        const message = await chatService.sendMessage(socket.user, tripId, content);

        chatNamespace.to(`trip:${tripId}`).emit('message:new', message);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Chat Socket] User disconnected: ${socket.user.id}`);
    });
  });
}

module.exports = registerChatHandlers;
