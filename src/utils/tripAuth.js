const prisma = require('../config/prisma');

// Helper function to verify if a user is authorized as the driver or booked passenger of a trip
async function assertTripParticipant(userId, tripId) {
  // Fetch trip with ride driver and matching booked passenger records
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      ride: {
        include: {
          bookings: {
            where: { passengerId: userId },
          },
        },
      },
    },
  });

  // Throw 404 if trip does not exist
  if (!trip) {
    const error = new Error('Trip not found');
    error.statusCode = 404;
    throw error;
  }

  // Check if caller is the driver or a booked passenger
  const isDriver = trip.ride.driverId === userId;
  const isPassenger = trip.ride.bookings.length > 0;

  // Reject access with 403 Forbidden if user is neither driver nor passenger
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
