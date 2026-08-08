const socketAuthMiddleware = require('../../middleware/socketAuth.middleware');
const prisma = require('../../config/prisma');
const { assertTripParticipant } = require('../../utils/tripAuth');
const { getRoute } = require('../../utils/routing');

// In-memory cache for ETA calculations per trip (prevents hammering OSRM demo server)
const etaCache = new Map();

// Periodic cleanup timer for stale ETA cache entries (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [tripId, cached] of etaCache.entries()) {
    if (now - cached.lastCalculatedAt > 10 * 60 * 1000) {
      etaCache.delete(tripId);
    }
  }
}, 60 * 1000).unref();

// Registers real-time live vehicle tracking handlers for the /tracking Socket.io namespace
function registerTrackingHandlers(io) {
  const trackingNamespace = io.of('/tracking');

  // Authenticate socket connections with JWT access token
  trackingNamespace.use(socketAuthMiddleware);

  trackingNamespace.on('connection', (socket) => {
    console.log(`[Tracking Socket] User connected: ${socket.user.id}`);

    // Join trip room and send planned route geometry immediately on join
    socket.on('join:trip', async ({ tripId }) => {
      try {
        await assertTripParticipant(socket.user.id, tripId);

        const roomName = `trip:${tripId}`;
        socket.join(roomName);

        const trip = await prisma.trip.findUnique({
          where: { id: tripId },
          include: { ride: { select: { routeGeometry: true } } },
        });

        socket.emit('route:info', {
          tripId,
          routeGeometry: trip.ride.routeGeometry,
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Driver emits live location updates
    socket.on('location:update', async ({ tripId, lat, lng }) => {
      try {
        const { isDriver, trip } = await assertTripParticipant(socket.user.id, tripId);

        if (!isDriver) {
          return socket.emit('error', { message: 'Only the driver can send location updates' });
        }

        // Only allow tracking for active trips
        if (trip.status !== 'TRIP_STARTED' && trip.status !== 'TRIP_IN_PROGRESS') {
          return socket.emit('error', {
            message: `Location tracking inactive for trip in status ${trip.status}`,
          });
        }

        // 1. Save GPS coordinate to database
        const location = await prisma.tripLocation.create({
          data: {
            tripId,
            lat,
            lng,
          },
        });

        // 2. ETA Throttling: Recalculate OSRM ETA at most once per 30 seconds per trip
        const now = Date.now();
        const cachedEta = etaCache.get(tripId);
        let etaMinutes = cachedEta ? cachedEta.etaMinutes : null;

        if (!cachedEta || now - cachedEta.lastCalculatedAt > 30000) {
          const routeInfo = await getRoute(
            { lat, lng },
            { lat: trip.ride.destinationLat, lng: trip.ride.destinationLng }
          );
          etaMinutes = routeInfo.durationMinutes;
          etaCache.set(tripId, { lastCalculatedAt: now, etaMinutes });
        }

        // 3. Broadcast updated location and ETA to all clients in the trip room
        trackingNamespace.to(`trip:${tripId}`).emit('location:update', {
          tripId,
          lat,
          lng,
          etaMinutes,
          recordedAt: location.recordedAt,
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Tracking Socket] User disconnected: ${socket.user.id}`);
    });
  });
}

module.exports = registerTrackingHandlers;
