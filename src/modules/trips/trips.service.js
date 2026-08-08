const prisma = require('../../config/prisma');

// Service class containing business logic for Trip lifecycle state transitions
class TripsService {
  // Finite State Machine (FSM) map defining allowed next statuses
  allowedTransitions = {
    RIDE_BOOKED: ['TRIP_STARTED'],
    TRIP_STARTED: ['TRIP_IN_PROGRESS', 'TRIP_COMPLETED'],
    TRIP_IN_PROGRESS: ['TRIP_COMPLETED'],
    TRIP_COMPLETED: ['PAYMENT_PENDING', 'PAYMENT_COMPLETED'],
    PAYMENT_PENDING: ['PAYMENT_COMPLETED'],
    PAYMENT_COMPLETED: [],
  };

  // Helper to format a trip object with callerRole and passengers list
  _formatTrip(trip, currentUser) {
    const isDriver = trip.ride.driverId === currentUser.id;
    const callerRole = isDriver ? 'DRIVER' : 'PASSENGER';

    const passengers = (trip.ride.bookings || []).map((b) => {
      // Find matching payment for passenger if present
      const payment = (trip.payments || []).find((p) => p.payerId === b.passenger.id);
      return {
        id: b.passenger.id,
        firstName: b.passenger.firstName,
        lastName: b.passenger.lastName,
        phone: b.passenger.phone,
        seatsBooked: b.seatsBooked,
        fareAmount: Number(b.joinRequest?.agreedFare || trip.ride.farePerSeat),
        paymentStatus: payment ? payment.status : (trip.status === 'PAYMENT_COMPLETED' ? 'PAID' : 'PENDING'),
      };
    });

    // Determine user's specific fareAmount for history cards
    let fareAmount = Number(trip.ride.farePerSeat);
    if (!isDriver) {
      const myBooking = trip.ride.bookings?.find((b) => b.passengerId === currentUser.id);
      if (myBooking?.joinRequest?.agreedFare) {
        fareAmount = Number(myBooking.joinRequest.agreedFare);
      }
    }

    return {
      id: trip.id,
      status: trip.status,
      rideId: trip.rideId,
      startedAt: trip.startedAt,
      completedAt: trip.completedAt,
      createdAt: trip.createdAt,
      ride: {
        id: trip.ride.id,
        pickupLabel: trip.ride.pickupLabel,
        pickupLat: trip.ride.pickupLat,
        pickupLng: trip.ride.pickupLng,
        destinationLabel: trip.ride.destinationLabel,
        destinationLat: trip.ride.destinationLat,
        destinationLng: trip.ride.destinationLng,
        departureAt: trip.ride.departureAt,
        farePerSeat: Number(trip.ride.farePerSeat),
        routeDistanceKm: trip.ride.routeDistanceKm,
        routeDurationMinutes: trip.ride.routeDurationMinutes,
        routeGeometry: trip.ride.routeGeometry,
        vehicle: trip.ride.vehicle
          ? {
              id: trip.ride.vehicle.id,
              model: trip.ride.vehicle.model,
              registrationNumber: trip.ride.vehicle.registrationNumber,
              seatingCapacity: trip.ride.vehicle.seatingCapacity,
              fuelType: trip.ride.vehicle.fuelType,
            }
          : null,
      },
      driver: {
        id: trip.ride.driver.id,
        firstName: trip.ride.driver.firstName,
        lastName: trip.ride.driver.lastName,
        phone: trip.ride.driver.phone,
        email: trip.ride.driver.email,
      },
      passengers,
      callerRole,
      fareAmount,
    };
  }

  // Returns paginated list of completed / payment-phase trips for driver or passenger
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
          payments: true,
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
        orderBy: { completedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.trip.count({ where }),
    ]);

    const formattedTrips = trips.map((trip) => this._formatTrip(trip, currentUser));

    return {
      total,
      page,
      limit,
      trips: formattedTrips,
    };
  }

  // Returns active/ongoing trips where current user is driver or booked passenger
  async getMyTrips(currentUser) {
    const trips = await prisma.trip.findMany({
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
        payments: true,
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
      orderBy: { createdAt: 'desc' },
    });

    return trips.map((trip) => this._formatTrip(trip, currentUser));
  }

  // Returns full details for a trip
  async getTripById(currentUser, tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        payments: true,
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

    return this._formatTrip(trip, currentUser);
  }

  // Advances trip status forward through allowed transitions (driver-only)
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

    // Verify status transition is allowed by state machine
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

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: updateData,
      include: { ride: true },
    });

    return {
      message: 'Trip status updated',
      trip: {
        id: updatedTrip.id,
        status: updatedTrip.status,
      },
    };
  }
}

module.exports = new TripsService();
