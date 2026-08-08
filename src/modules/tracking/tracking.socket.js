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

// Registers real-time live vehicle tracking + negotiation handlers for /tracking namespace
function registerTrackingHandlers(io) {
  const trackingNamespace = io.of('/tracking');

  // Authenticate socket connections with JWT access token
  trackingNamespace.use(socketAuthMiddleware);

  trackingNamespace.on('connection', (socket) => {
    console.log(`[Tracking Socket] User connected: ${socket.user.id}`);

    // Automatically join user-specific and organization-wide room
    socket.join(`user:${socket.user.id}`);
    if (socket.user.orgId) {
      socket.join(`org:${socket.user.orgId}`);
    }

    // ── TRIP TRACKING ──────────────────────────────────────────

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
        if (trip.status !== 'IN_PROGRESS' && trip.status !== 'SCHEDULED') {
          return socket.emit('error', {
            message: `Location tracking inactive for trip in status ${trip.status}`,
          });
        }

        // 1. Save GPS coordinate to database
        const location = await prisma.tripLocation.create({
          data: { tripId, lat, lng },
        });

        // 2. ETA Throttling: Recalculate OSRM ETA at most once per 30 seconds per trip
        const now = Date.now();
        const cachedEta = etaCache.get(tripId);
        let etaMinutes = cachedEta ? cachedEta.etaMinutes : null;

        if (!cachedEta || now - cachedEta.lastCalculatedAt > 30000) {
          try {
            const routeInfo = await getRoute(
              { lat, lng },
              { lat: trip.ride.destinationLat, lng: trip.ride.destinationLng }
            );
            etaMinutes = routeInfo.durationMinutes;
            etaCache.set(tripId, { lastCalculatedAt: now, etaMinutes });
          } catch { /* keep cached ETA on OSRM error */ }
        }

        // 3. Broadcast updated location and ETA to all clients in the trip room
        trackingNamespace.to(`trip:${tripId}`).emit('location:update', {
          tripId, lat, lng, etaMinutes,
          recordedAt: location.recordedAt,
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── REAL-TIME NEGOTIATION ───────────────────────────────────

    // Join a ride negotiation room (passenger or driver watches for offers)
    socket.on('join:ride', ({ rideId }) => {
      socket.join(`ride:${rideId}`);
    });

    // Passenger or driver sends a fare offer for a ride
    socket.on('negotiation:offer', async ({ rideId, negotiationId, amount, offeredBy }) => {
      try {
        const payload = {
          rideId,
          negotiationId,
          amount,
          offeredBy,
          timestamp: new Date().toISOString(),
        };
        // Broadcast the new offer to everyone in the ride room and org room
        trackingNamespace.to(`ride:${rideId}`).emit('negotiation:offer', payload);
        if (socket.user.orgId) {
          trackingNamespace.to(`org:${socket.user.orgId}`).emit('negotiation:offer', payload);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Either side accepts the negotiation
    socket.on('negotiation:accept', async ({ rideId, negotiationId, agreedFare }) => {
      try {
        const payload = {
          rideId,
          negotiationId,
          agreedFare,
          timestamp: new Date().toISOString(),
        };
        trackingNamespace.to(`ride:${rideId}`).emit('negotiation:accepted', payload);
        if (socket.user.orgId) {
          trackingNamespace.to(`org:${socket.user.orgId}`).emit('negotiation:accepted', payload);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Either side rejects the negotiation
    socket.on('negotiation:reject', async ({ rideId, negotiationId }) => {
      try {
        const payload = {
          rideId,
          negotiationId,
          timestamp: new Date().toISOString(),
        };
        trackingNamespace.to(`ride:${rideId}`).emit('negotiation:rejected', payload);
        if (socket.user.orgId) {
          trackingNamespace.to(`org:${socket.user.orgId}`).emit('negotiation:rejected', payload);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Driver accepts a join request — notify passenger in ride room
    socket.on('ride:accepted', ({ rideId, passengerId, tripId }) => {
      const payload = {
        rideId,
        passengerId,
        tripId,
        message: 'Your ride has been confirmed! 🎉',
      };
      trackingNamespace.to(`ride:${rideId}`).emit('ride:matched', payload);
      if (socket.user.orgId) {
        trackingNamespace.to(`org:${socket.user.orgId}`).emit('ride:matched', payload);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Tracking Socket] User disconnected: ${socket.user.id}`);
    });
  });
}

module.exports = registerTrackingHandlers;

