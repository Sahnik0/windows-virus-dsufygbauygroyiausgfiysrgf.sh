require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');

const registerTrackingHandlers = require('./modules/tracking/tracking.socket');
const registerChatHandlers = require('./modules/chat/chat.socket');
const registerCallHandlers = require('./modules/calls/calls.socket');

const PORT = process.env.PORT || 3000;

// Create HTTP server wrapping express app
const server = http.createServer(app);

// Attach Socket.io server instance
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

// Store io instance on app for access in REST controllers
app.set('io', io);

// Register Socket.io namespace handlers
registerTrackingHandlers(io);
registerChatHandlers(io);
registerCallHandlers(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = { server, io };
