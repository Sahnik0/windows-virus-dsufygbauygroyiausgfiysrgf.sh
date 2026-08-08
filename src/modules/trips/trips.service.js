// CRITICAL SECURITY RULE: Every service function touching org-scoped data MUST filter by orgId
// derived from req.user.orgId for ORG_ADMIN / USER callers. Never trust a client-supplied orgId for these roles.

const prisma = require('../../config/prisma');

class TripsService {
  /**
   * State transitions map defining allowed next states.
   */
  allowedTransitions = {
    RIDE_BOOKED: ['TRIP_STARTED'],
    TRIP_STARTED: ['TRIP_IN_PROGRESS', 'TRIP_COMPLETED'],
    TRIP_IN_PROGRESS: ['TRIP_COMPLETED'],
    TRIP_COMPLETED: ['PAYMENT_PENDING', 'PAYMENT_COMPLETED'],
    PAYMENT_PENDING: ['PAYMENT_COMPLETED'],
    PAYMENT_COMPLETED: [],
  };

  /**
   * Returns paginated trip history (completed or payment-phase trips) for caller.
   */
  async getTripHistory(currentUser, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where = {
      status: { in: ['TRIP_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED'] },
      ride: {
        orgId: currentUser.role === 'SUPER_ADMIN' ? undefined : currentUser.orgId,
        OR: [
          { driverId: currentUser.id },
          { bookings: { some: { passengerId: currentUser.id } } },
        ],
      },
    };

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        include: {
          ride: {
            include: {
              vehicle: true,
              driver: { select: { id: true, firstName: true, lastName: true, email: true } },
              bookings: {
                select: { id: true, passengerId: true, seatsBooked: true, status: true },
              },
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.trip.count({ where }),
    ]);

    return {
      trips,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lists active/ongoing trips where current user is either driver or a booked passenger.
   */
  async getMyTrips(currentUser) {
    return await prisma.trip.findMany({
      where: {
        ride: {
          orgId: currentUser.role === 'SUPER_ADMIN' ? undefined : currentUser.orgId,
          OR: [
            { driverId: currentUser.id },
            { bookings: { some: { passengerId: currentUser.id } } },
          ],
        },
      },
      include: {
        ride: {
          include: {
            vehicle: true,
            driver: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            bookings: {
              where: { passengerId: currentUser.id },
              select: { id: true, seatsBooked: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves full details for a trip. Driver sees full passenger list; passengers see their own booking.
   */
  async getTripById(currentUser, tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        ride: {
          include: {
            vehicle: true,
            driver: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            bookings: {
              include: {
                passenger: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
                joinRequest: { select: { agreedFare: true } },
              },
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

    const isDriver = trip.ride.driverId === currentUser.id;
    const isBookedPassenger = trip.ride.bookings.some((b) => b.passengerId === currentUser.id);

    if (!isDriver && !isBookedPassenger && currentUser.role !== 'SUPER_ADMIN') {
      const error = new Error('Forbidden: You are not a participant in this trip');
      error.statusCode = 403;
      throw error;
    }

    if (!isDriver && currentUser.role !== 'SUPER_ADMIN') {
      trip.ride.bookings = trip.ride.bookings.filter((b) => b.passengerId === currentUser.id);
    }

    return trip;
  }

  /**
   * Moves trip status forward through the fixed lifecycle. Driver only.
   */
  async updateTripStatus(currentUser, tripId, newStatus) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { ride: true },
    });

    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    if (trip.ride.driverId !== currentUser.id && currentUser.role !== 'SUPER_ADMIN') {
      const error = new Error('Forbidden: Only the driver can update trip status');
      error.statusCode = 403;
      throw error;
    }

    const allowed = this.allowedTransitions[trip.status] || [];
    if (!allowed.includes(newStatus)) {
      const error = new Error(
        `Invalid status transition from '${trip.status}' to '${newStatus}'. Allowed transitions: [${allowed.join(', ')}]`
      );
      error.statusCode = 400;
      throw error;
    }

    const updateData = { status: newStatus };
    if (newStatus === 'TRIP_STARTED' && !trip.startedAt) {
      updateData.startedAt = new Date();
    }
    if (newStatus === 'TRIP_COMPLETED' && !trip.completedAt) {
      updateData.completedAt = new Date();
      await prisma.ride.update({
        where: { id: trip.rideId },
        data: { status: 'COMPLETED' },
      });
    }

    return await prisma.trip.update({
      where: { id: tripId },
      data: updateData,
      include: { ride: true },
    });
  }
}

module.exports = new TripsService();
