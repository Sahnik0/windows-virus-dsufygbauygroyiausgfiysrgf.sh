require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');

// Import Socket.io namespace event handlers
const registerTrackingHandlers = require('./modules/tracking/tracking.socket');
const registerChatHandlers = require('./modules/chat/chat.socket');
const registerCallHandlers = require('./modules/calls/calls.socket');

const PORT = process.env.PORT || 3000;

// Create HTTP server instance wrapping Express application
const server = http.createServer(app);

// Initialize Socket.io server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

// Attach Socket.io server instance to express app context for access in controllers
app.set('io', io);

// Register real-time Socket.io namespace handlers (/tracking, /chat, /calls)
registerTrackingHandlers(io);
registerChatHandlers(io);
registerCallHandlers(io);

// Start HTTP server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = { server, io };
