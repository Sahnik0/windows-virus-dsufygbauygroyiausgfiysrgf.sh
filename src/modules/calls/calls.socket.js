const socketAuthMiddleware = require('../../middleware/socketAuth.middleware');
const { assertTripParticipant } = require('../../utils/tripAuth');
const crypto = require('crypto');

// In-memory call state sessions
// Key: callId -> Value: { callId, tripId, callerId, calleeId, status, createdAt }
const activeCalls = new Map();

// Map tracking active socket connections per userId
// Key: userId -> Value: Set<socket.id>
const userSockets = new Map();

// Periodic cleanup timer for stale calls (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [callId, call] of activeCalls.entries()) {
    if (now - call.createdAt > 10 * 60 * 1000) {
      activeCalls.delete(callId);
    }
  }
}, 60 * 1000).unref();

function registerCallHandlers(io) {
  const callsNamespace = io.of('/calls');

  callsNamespace.use(socketAuthMiddleware);

  function emitToUser(userId, event, data) {
    const socketSet = userSockets.get(userId);
    if (!socketSet || socketSet.size === 0) return false;
    for (const socketId of socketSet) {
      callsNamespace.to(socketId).emit(event, data);
    }
    return true;
  }

  callsNamespace.on('connection', (socket) => {
    const userId = socket.user.id;

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    console.log(`[Calls Socket] User connected: ${userId} (socket ${socket.id})`);

    // Initiate voice call signaling
    socket.on('call:initiate', async ({ tripId, calleeId }) => {
      try {
        // Assert both caller and callee are trip participants
        const { isDriver: callerIsDriver } = await assertTripParticipant(userId, tripId);
        const { isDriver: calleeIsDriver } = await assertTripParticipant(calleeId, tripId);

        // Ensure call is between driver and a passenger (or vice-versa)
        if (callerIsDriver === calleeIsDriver) {
          return socket.emit('call:error', {
            message: 'Calls can only be initiated between driver and passenger',
          });
        }

        const calleeHasSockets = userSockets.has(calleeId) && userSockets.get(calleeId).size > 0;

        // If callee is not connected to /calls namespace, inform caller
        if (!calleeHasSockets) {
          return socket.emit('call:response', {
            status: 'callee_offline',
            message: 'Callee is currently offline or not connected to call signaling',
          });
        }

        const callId = crypto.randomUUID();
        const callSession = {
          callId,
          tripId,
          callerId: userId,
          calleeId,
          status: 'RINGING',
          createdAt: Date.now(),
        };

        activeCalls.set(callId, callSession);

        // Relay incoming call signal to callee
        emitToUser(calleeId, 'call:incoming', {
          callId,
          tripId,
          caller: {
            id: socket.user.id,
            firstName: socket.user.firstName || 'Driver/Passenger',
          },
        });

        socket.emit('call:response', { status: 'ringing', callId });
      } catch (err) {
        socket.emit('call:error', { message: err.message });
      }
    });

    // Accept incoming call
    socket.on('call:accept', ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call || call.calleeId !== userId) {
        return socket.emit('call:error', { message: 'Call session not found or unauthorized' });
      }

      call.status = 'ACTIVE';
      emitToUser(call.callerId, 'call:accepted', { callId });
    });

    // Reject incoming call
    socket.on('call:reject', ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call || call.calleeId !== userId) {
        return socket.emit('call:error', { message: 'Call session not found or unauthorized' });
      }

      call.status = 'ENDED';
      emitToUser(call.callerId, 'call:rejected', { callId });
      activeCalls.delete(callId);
    });

    // End active call
    socket.on('call:end', ({ callId }) => {
      const call = activeCalls.get(callId);
      if (!call) return;

      // Security check: verify calling socket belongs to caller or callee
      if (call.callerId !== userId && call.calleeId !== userId) {
        return socket.emit('call:error', { message: 'Unauthorized call operation' });
      }

      const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
      emitToUser(otherUserId, 'call:ended', { callId });

      call.status = 'ENDED';
      activeCalls.delete(callId);
    });

    socket.on('disconnect', () => {
      const userSet = userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          userSockets.delete(userId);

          // Clean up ringing calls if user completely disconnected
          for (const [callId, call] of activeCalls.entries()) {
            if ((call.callerId === userId || call.calleeId === userId) && call.status === 'RINGING') {
              const otherId = call.callerId === userId ? call.calleeId : call.callerId;
              emitToUser(otherId, 'call:ended', { callId, reason: 'peer_disconnected' });
              activeCalls.delete(callId);
            }
          }
        }
      }
      console.log(`[Calls Socket] User disconnected: ${userId} (socket ${socket.id})`);
    });
  });
}

module.exports = registerCallHandlers;
