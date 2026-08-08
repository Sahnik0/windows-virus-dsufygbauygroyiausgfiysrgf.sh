const prisma = require('../../config/prisma');
const { assertTripParticipant } = require('../../utils/tripAuth');

// Service class handling REST fallback for vehicle live tracking
class TrackingService {
  // Returns latest recorded GPS location and planned route geometry for a trip
  async getLatestLocation(currentUser, tripId) {
    // Verify caller is driver or booked passenger
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
