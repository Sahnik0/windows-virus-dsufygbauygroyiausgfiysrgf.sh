const prisma = require('../config/prisma');

/**
 * Asserts that a user is either the driver or a booked passenger on a trip.
 * @param {string} userId - User ID to check
 * @param {string} tripId - Trip ID
 * @returns {Promise<{ isDriver: boolean, isPassenger: boolean, trip: object }>}
 */
async function assertTripParticipant(userId, tripId) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      ride: {
        include: {
          bookings: {
            where: { passengerId: userId, status: 'BOOKED' },
          },
        },
      },
    },
  });

  if (!trip) {
    const error = new Error('Trip not found');
    error.statusCode = 404;
    throw error;
  }

  const isDriver = trip.ride.driverId === userId;
  const isPassenger = trip.ride.bookings.length > 0;

  if (!isDriver && !isPassenger) {
    const error = new Error('Forbidden: You are not a participant in this trip');
    error.statusCode = 403;
    throw error;
  }

  return { isDriver, isPassenger, trip };
}

module.exports = {
  assertTripParticipant,
};
