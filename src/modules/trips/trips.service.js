const prisma = require('../../config/prisma');
const crypto = require('crypto');

// In-memory OTP store: tripId → { otp, expiresAt }
const otpStore = new Map();

// Generate and store a 4-digit OTP for a trip (expires in 10 minutes)
function generateOtp(tripId) {
  const otp = String(Math.floor(1000 + Math.random() * 9000));
  otpStore.set(tripId, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  return otp;
}

// Verify OTP for a trip — returns true/false
function verifyOtp(tripId, otp) {
  const entry = otpStore.get(tripId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) { otpStore.delete(tripId); return false; }
  if (entry.otp !== String(otp)) return false;
  otpStore.delete(tripId);
  return true;
}

// Get current OTP for display (driver side)
function getOtp(tripId) {
  const entry = otpStore.get(tripId);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.otp;
}


// Service class containing business logic for Trip lifecycle state transitions
class TripsService {
  // Finite State Machine (FSM) map defining allowed next statuses
  // Maps to Prisma TripStatus enum: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
  // We use friendly aliases in the app layer for clarity
  allowedTransitions = {
    SCHEDULED:   ['IN_PROGRESS'],
    IN_PROGRESS: ['COMPLETED'],
    COMPLETED:   [],
    CANCELLED:   [],
  };

  // Legacy alias map for backward-compat with older frontend strings
  _normalizeStatus(s) {
    const map = {
      RIDE_BOOKED:        'SCHEDULED',
      TRIP_STARTED:       'IN_PROGRESS',
      TRIP_IN_PROGRESS:   'IN_PROGRESS',
      TRIP_COMPLETED:     'COMPLETED',
      PAYMENT_PENDING:    'COMPLETED',
      PAYMENT_COMPLETED:  'COMPLETED',
    };
    return map[s] || s;
  }

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
        fareAmount: Number(b.request?.agreedFare || trip.ride.farePerSeat),
        paymentStatus: payment ? payment.status : (trip.status === 'COMPLETED' ? 'PAID' : 'PENDING'),
      };
    });

    // Determine user's specific fareAmount for history cards
    let fareAmount = Number(trip.ride.farePerSeat);
    if (!isDriver) {
      const myBooking = trip.ride.bookings?.find((b) => b.passengerId === currentUser.id);
      if (myBooking?.request?.agreedFare) {
        fareAmount = Number(myBooking.request.agreedFare);
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
      status: { in: ['COMPLETED', 'CANCELLED'] },
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
                  request: { select: { agreedFare: true } },
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
                  request: { select: { agreedFare: true } },
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
                  request: { select: { agreedFare: true } },
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


  // Advances trip status forward: SCHEDULED → IN_PROGRESS → COMPLETED (driver-only)
  // When transitioning to IN_PROGRESS, generates OTP and returns it for Socket.IO broadcast
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

    // Normalize incoming status (accept both legacy frontend strings and schema strings)
    const normalizedNew = this._normalizeStatus(newStatus);
    const normalizedCurrent = this._normalizeStatus(trip.status);
    const allowed = this.allowedTransitions[normalizedCurrent] || [];

    if (!allowed.includes(normalizedNew)) {
      const error = new Error(
        `Invalid status transition from '${trip.status}' to '${newStatus}'. Allowed next: [${allowed.join(', ')}]`
      );
      error.statusCode = 400;
      throw error;
    }

    const updateData = { status: normalizedNew };
    let otp = null;

    if (normalizedNew === 'IN_PROGRESS' && !trip.startedAt) {
      updateData.startedAt = new Date();
      // Generate OTP — caller should broadcast this via socket to passenger
      otp = generateOtp(tripId);
    }
    if (normalizedNew === 'COMPLETED' && !trip.completedAt) {
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
      otp, // null unless transitioning to IN_PROGRESS
      trip: {
        id: updatedTrip.id,
        status: updatedTrip.status,
      },
    };
  }

  // Passenger verifies OTP to confirm driver is at pickup → transitions SCHEDULED → IN_PROGRESS
  async verifyOtpAndStart(currentUser, tripId, otp) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { ride: { include: { bookings: true } } },
    });

    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    const isPassenger = trip.ride.bookings.some(b => b.passengerId === currentUser.id);
    const isDriver = trip.ride.driverId === currentUser.id;
    if (!isPassenger && !isDriver && currentUser.role !== 'SUPER_ADMIN') {
      const error = new Error('Forbidden: You are not a participant in this trip');
      error.statusCode = 403;
      throw error;
    }

    if (!verifyOtp(tripId, otp)) {
      const error = new Error('Invalid or expired OTP');
      error.statusCode = 400;
      throw error;
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });

    return {
      message: 'OTP verified. Ride has started!',
      trip: { id: updatedTrip.id, status: updatedTrip.status },
    };
  }

  // Driver fetches current OTP for display (before passenger verifies)
  async getTripOtp(currentUser, tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { ride: true },
    });

    if (!trip) {
      const error = new Error('Trip not found');
      error.statusCode = 404;
      throw error;
    }

    if (trip.ride.driverId !== currentUser.id) {
      const error = new Error('Forbidden: Only the driver can view the OTP');
      error.statusCode = 403;
      throw error;
    }

    const otp = getOtp(tripId);
    if (!otp) {
      const error = new Error('No active OTP found. Please request ride start again.');
      error.statusCode = 404;
      throw error;
    }

    return { otp };
  }
}

module.exports = new TripsService();
