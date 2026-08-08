const socketAuthMiddleware = require('../../middleware/socketAuth.middleware');
const prisma = require('../../config/prisma');
const { assertTripParticipant } = require('../../utils/tripAuth');
const { getRoute } = require('../../utils/routing');

// In-memory ETA throttling cache per trip
// Key: tripId -> Value: { lastCalculatedAt: number, etaMinutes: number }
const etaCache = new Map();

// Sweep stale ETA cache entries older than 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [tripId, cached] of etaCache.entries()) {
    if (now - cached.lastCalculatedAt > 10 * 60 * 1000) {
      etaCache.delete(tripId);
    }
  }
}, 60 * 1000).unref();

function registerTrackingHandlers(io) {
  const trackingNamespace = io.of('/tracking');

  trackingNamespace.use(socketAuthMiddleware);

  trackingNamespace.on('connection', (socket) => {
    console.log(`[Tracking Socket] User connected: ${socket.user.id}`);

    // Join trip room and send initial route info
    socket.on('join:trip', async ({ tripId }) => {
      try {
        await assertTripParticipant(socket.user.id, tripId);

        const roomName = `trip:${tripId}`;
        socket.join(roomName);

        const trip = await prisma.trip.findUnique({
          where: { id: tripId },
          include: { ride: { select: { routeGeometry: true } } },
        });

        // Send planned route geometry immediately on join
        socket.emit('route:info', {
          tripId,
          routeGeometry: trip.ride.routeGeometry,
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Driver location update
    socket.on('location:update', async ({ tripId, lat, lng }) => {
      try {
        const { isDriver, trip } = await assertTripParticipant(socket.user.id, tripId);

        if (!isDriver) {
          return socket.emit('error', { message: 'Only the driver can send location updates' });
        }

        // Reject emits for trips not in active states
        if (trip.status !== 'TRIP_STARTED' && trip.status !== 'TRIP_IN_PROGRESS') {
          return socket.emit('error', {
            message: `Location tracking inactive for trip in status ${trip.status}`,
          });
        }

        // 1. Persist location point
        const location = await prisma.tripLocation.create({
          data: {
            tripId,
            lat,
            lng,
          },
        });

        // 2. ETA Throttling: Recalculating ETA on every location update can hammer the shared public OSRM server.
        // Server throttles OSRM route calculations to at most once per 30 seconds per active trip, reusing the last computed value in between.
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

        // 3. Broadcast to trip room
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
