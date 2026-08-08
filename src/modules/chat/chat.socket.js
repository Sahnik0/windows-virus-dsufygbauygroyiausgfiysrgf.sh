const socketAuthMiddleware = require('../../middleware/socketAuth.middleware');
const chatService = require('./chat.service');
const { assertTripParticipant } = require('../../utils/tripAuth');

// Registers real-time in-trip chat handlers for the /chat Socket.io namespace
function registerChatHandlers(io) {
  const chatNamespace = io.of('/chat');

  // Authenticate socket connection using JWT access token
  chatNamespace.use(socketAuthMiddleware);

  chatNamespace.on('connection', (socket) => {
    console.log(`[Chat Socket] User connected: ${socket.user.id}`);

    // Join trip room for real-time chat
    socket.on('join:trip', async ({ tripId }) => {
      try {
        await assertTripParticipant(socket.user.id, tripId);
        socket.join(`trip:${tripId}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Receive message from client, persist to DB, and broadcast to room
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
