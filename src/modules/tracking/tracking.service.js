const prisma = require('../../config/prisma');
const { assertTripParticipant } = require('../../utils/tripAuth');

class TrackingService {
  /**
   * REST fallback to fetch latest vehicle location and planned route geometry.
   */
  async getLatestLocation(currentUser, tripId) {
    await assertTripParticipant(currentUser.id, tripId);

    const latestLocation = await prisma.tripLocation.findFirst({
      where: { tripId },
      orderBy: { recordedAt: 'desc' },
    });

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        ride: {
          select: {
            routeGeometry: true,
            routeDistanceKm: true,
            routeDurationMinutes: true,
          },
        },
      },
    });

    return {
      tripId,
      status: trip.status,
      latestLocation,
      routeGeometry: trip.ride.routeGeometry,
      routeDistanceKm: trip.ride.routeDistanceKm,
      routeDurationMinutes: trip.ride.routeDurationMinutes,
    };
  }
}

module.exports = new TrackingService();
