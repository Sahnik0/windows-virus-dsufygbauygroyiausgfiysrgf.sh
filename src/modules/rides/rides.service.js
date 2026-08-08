const prisma = require('../../config/prisma');
const { getRoute, haversineDistance } = require('../../utils/routing');

// Service class containing business logic for ride creation, search, discovery, and join requests
class RidesService {
  // Publishes a new ride offer (verifies vehicle ownership and calculates OSRM route details)
  async createRide(currentUser, {
    vehicleId,
    pickupLabel,
    pickupLat,
    pickupLng,
    destinationLabel,
    destinationLat,
    destinationLng,
    departureAt,
    availableSeats,
    farePerSeat,
    isRecurring = false,
  }) {
    // Step 1: Ensure caller owns at least one registered vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle || vehicle.ownerId !== currentUser.id) {
      const error = new Error('You must register a vehicle before publishing a ride offer');
      error.statusCode = 400;
      throw error;
    }

    if (vehicle.status !== 'VERIFIED') {
      const error = new Error('Vehicle is not verified by organization admin. Please wait for vehicle approval before publishing rides.');
      error.statusCode = 400;
      throw error;
    }

    // Step 2: Calculate road distance, duration, and GeoJSON route line via OSRM engine
    const routeInfo = await getRoute(
      { lat: pickupLat, lng: pickupLng },
      { lat: destinationLat, lng: destinationLng }
    );

    // Step 3: Create published ride record tied strictly to caller's orgId
    return await prisma.ride.create({
      data: {
        driverId: currentUser.id,
        vehicleId,
        pickupLabel,
        pickupLat,
        pickupLng,
        destinationLabel,
        destinationLat,
        destinationLng,
        departureAt: new Date(departureAt),
        availableSeats,
        farePerSeat,
        isRecurring,
        status: 'SCHEDULED',
        routeGeometry: routeInfo.routeGeometry,
        routeDistanceKm: routeInfo.distanceKm,
        routeDurationMinutes: routeInfo.durationMinutes,
        orgId: currentUser.orgId,
      },
      include: {
        vehicle: true,
        driver: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, rating: true },
        },
      },
    });
  }

  // Searches for available published rides within caller's organization
  async searchRides(currentUser, {
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    departureDate,
    departureTime,
    seatsNeeded = 1,
    isRecurring,
  }) {
    const where = {
      orgId: currentUser.orgId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      availableSeats: { gte: seatsNeeded },
    };

    if (isRecurring !== undefined) {
      where.isRecurring = isRecurring;
    }

    if (departureDate) {
      const dateStr = departureTime ? `${departureDate}T${departureTime}` : departureDate;
      const start = new Date(dateStr);
      if (!isNaN(start.getTime())) {
        if (!departureTime) {
          start.setHours(0, 0, 0, 0);
          const end = new Date(departureDate);
          end.setHours(23, 59, 59, 999);
          where.departureAt = { gte: start, lte: end };
        } else {
          where.departureAt = { gte: start };
        }
      }
    }

    const rides = await prisma.ride.findMany({
      where,
      include: {
        vehicle: true,
        driver: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, rating: true },
        },
      },
      orderBy: { departureAt: 'asc' },
    });

    const routeInfo = await getRoute(
      { lat: pickupLat, lng: pickupLng },
      { lat: destinationLat, lng: destinationLng }
    );

    return {
      searchRoute: routeInfo,
      rides: rides.map(r => ({
        ...r,
        driver: {
          ...r.driver,
          rating: r.driver.rating || 4.9, // Default rating if null
        }
      })),
    };
  }

  // Driver discovery: Finds passenger saved places within radiusKm of ride pickup using bounding box + Haversine math
  async getNearbyPassengers(currentUser, rideId, radiusKm = 2.0) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });

    if (!ride) {
      const error = new Error('Ride not found');
      error.statusCode = 404;
      throw error;
    }

    if (ride.driverId !== currentUser.id && currentUser.role !== 'SUPER_ADMIN') {
      const error = new Error('Forbidden: Only the driver can discover nearby passengers for this ride');
      error.statusCode = 403;
      throw error;
    }

    // Quick bounding box pre-filter
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((ride.pickupLat * Math.PI) / 180));

    const candidatePlaces = await prisma.savedPlace.findMany({
      where: {
        user: { orgId: currentUser.orgId },
        latitude: { gte: ride.pickupLat - latDelta, lte: ride.pickupLat + latDelta },
        longitude: { gte: ride.pickupLng - lngDelta, lte: ride.pickupLng + lngDelta },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    // Exact Haversine radial distance filter
    return candidatePlaces.filter((place) => {
      const distance = haversineDistance(
        ride.pickupLat,
        ride.pickupLng,
        place.latitude,
        place.longitude
      );
      return distance <= radiusKm;
    });
  }

  // Passenger discovery: Finds nearby published driver rides within radiusKm of passenger pickup
  async getNearbyDrivers(currentUser, pickupLat, pickupLng, radiusKm = 2.0) {
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((pickupLat * Math.PI) / 180));

    const candidateRides = await prisma.ride.findMany({
      where: {
        orgId: currentUser.orgId,
        status: { in: ['SCHEDULED', 'ACTIVE'] },
        pickupLat: { gte: pickupLat - latDelta, lte: pickupLat + latDelta },
        pickupLng: { gte: pickupLng - lngDelta, lte: pickupLng + lngDelta },
      },
      include: {
        vehicle: true,
        driver: {
          select: { id: true, firstName: true, lastName: true, phone: true, rating: true },
        },
      },
    });

    return candidateRides.filter((ride) => {
      const distance = haversineDistance(pickupLat, pickupLng, ride.pickupLat, ride.pickupLng);
      return distance <= radiusKm;
    });
  }

  // Fetches single ride record by ID
  async getRideById(currentUser, rideId) {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        vehicle: true,
        driver: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, rating: true },
        },
      },
    });

    if (!ride) {
      const error = new Error('Ride not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentUser.role !== 'SUPER_ADMIN' && ride.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Ride belongs to another organization');
      error.statusCode = 403;
      throw error;
    }

    return ride;
  }

  // Submits a join request (verifies agreed fare equals listed price OR matches an accepted negotiation)
  async createJoinRequest(currentUser, rideId, { agreedFare, seatsRequested = 1, initiatedBy = 'PASSENGER' }) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });

    if (!ride) {
      const error = new Error('Ride not found');
      error.statusCode = 404;
      throw error;
    }

    if (ride.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Ride belongs to another organization');
      error.statusCode = 403;
      throw error;
    }

    if (ride.status !== 'SCHEDULED' && ride.status !== 'ACTIVE') {
      const error = new Error('Ride is no longer accepting join requests');
      error.statusCode = 400;
      throw error;
    }

    if (ride.availableSeats < seatsRequested) {
      const error = new Error(`Only ${ride.availableSeats} seat(s) available on this ride`);
      error.statusCode = 400;
      throw error;
    }

    const passengerId = currentUser.id;

    // Price Agreement Check: Verify fare matches listed price or an ACCEPTED negotiation
    let negotiationId = null;
    const isListedPrice = Number(agreedFare) === Number(ride.farePerSeat);

    if (!isListedPrice) {
      const acceptedNegotiation = await prisma.negotiation.findFirst({
        where: {
          rideId,
          passengerId,
          status: 'ACCEPTED',
        },
        include: {
          offers: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (
        !acceptedNegotiation ||
        !acceptedNegotiation.offers[0] ||
        Number(acceptedNegotiation.offers[0].amount) !== Number(agreedFare)
      ) {
        const error = new Error(
          'Join request agreed fare does not match listed price and no accepted price negotiation exists at this fare'
        );
        error.statusCode = 400;
        throw error;
      }
      negotiationId = acceptedNegotiation.id;
    }

    const joinRequest = await prisma.joinRequest.create({
      data: {
        rideId,
        passengerId,
        initiatedBy,
        agreedFare,
        negotiationId,
        seatsRequested,
        status: 'PENDING',
      },
      include: {
        passenger: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        ride: true,
      },
    });

    return {
      message: 'Join request submitted',
      joinRequest: {
        id: joinRequest.id,
        status: joinRequest.status,
        rideId: joinRequest.rideId,
        passengerId: joinRequest.passengerId,
        agreedFare: joinRequest.agreedFare,
        seatsRequested: joinRequest.seatsRequested,
      },
    };
  }

  // Lists pending join requests for a ride (driver-only)
  async getJoinRequests(currentUser, rideId) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });

    if (!ride) {
      const error = new Error('Ride not found');
      error.statusCode = 404;
      throw error;
    }

    if (ride.driverId !== currentUser.id && currentUser.role !== 'SUPER_ADMIN') {
      const error = new Error('Forbidden: Only the driver can review join requests for this ride');
      error.statusCode = 403;
      throw error;
    }

    return await prisma.joinRequest.findMany({
      where: { rideId, status: 'PENDING' },
      include: {
        passenger: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Accepts a join request (decrements availableSeats, creates Booking & Trip wrapper atomically)
  async acceptJoinRequest(currentUser, rideId, requestId) {
    const request = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { ride: true },
    });

    if (!request || request.rideId !== rideId) {
      const error = new Error('Join request not found');
      error.statusCode = 404;
      throw error;
    }

    if (request.status !== 'PENDING') {
      const error = new Error(`Join request is already ${request.status.toLowerCase()}`);
      error.statusCode = 400;
      throw error;
    }

    // Reversed party authorization: Driver accepts passenger request; Passenger accepts driver invitation
    const isDriver = request.ride.driverId === currentUser.id;
    const isPassenger = request.passengerId === currentUser.id;

    if (request.initiatedBy === 'PASSENGER' && !isDriver) {
      const error = new Error('Forbidden: Only the driver can accept passenger-initiated join requests');
      error.statusCode = 403;
      throw error;
    }

    if (request.initiatedBy === 'DRIVER' && !isPassenger) {
      const error = new Error('Forbidden: Only the passenger can accept driver-initiated join invitations');
      error.statusCode = 403;
      throw error;
    }

    // Atomic transaction for accepting request and creating Booking & Trip
    return await prisma.$transaction(async (tx) => {
      const currentRide = await tx.ride.findUnique({ where: { id: rideId } });

      if (currentRide.availableSeats < request.seatsRequested) {
        const error = new Error('Insufficient seats available to accept this request');
        error.statusCode = 400;
        throw error;
      }

      const newSeats = currentRide.availableSeats - request.seatsRequested;
      const newRideStatus = newSeats === 0 ? 'ACTIVE' : currentRide.status;

      // 1. Update ride available seats and status
      await tx.ride.update({
        where: { id: rideId },
        data: {
          availableSeats: newSeats,
          status: newRideStatus,
        },
      });

      // 2. Mark join request ACCEPTED
      const updatedRequest = await tx.joinRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      });

      // 3. Create Booking record
      const booking = await tx.booking.create({
        data: {
          rideId,
          passengerId: request.passengerId,
          requestId: requestId,
          seatsBooked: request.seatsRequested,
          totalFare: request.agreedFare,
        },
      });

      // 4. Create or reuse active Trip record (RIDE_BOOKED state)
      let trip = await tx.trip.findUnique({
        where: { rideId },
        include: {
          ride: {
            include: {
              bookings: {
                include: {
                  passenger: { select: { id: true, firstName: true, lastName: true, phone: true } },
                  joinRequest: { select: { agreedFare: true } },
                },
              },
            },
          },
        },
      });
      if (!trip) {
        trip = await tx.trip.create({
          data: {
            rideId,
            driverId: currentRide.driverId,
            status: 'SCHEDULED',
          },
          include: {
            ride: {
              include: {
                bookings: {
                  include: {
                    passenger: { select: { id: true, firstName: true, lastName: true, phone: true } },
                    request: { select: { agreedFare: true } },
                  },
                },
              },
            },
          },
        });
      }

      // 5. Auto-decline any remaining PENDING requests requesting more seats than now available
      if (newSeats >= 0) {
        await tx.joinRequest.updateMany({
          where: {
            rideId,
            status: 'PENDING',
            seatsRequested: { gt: newSeats },
          },
          data: { status: 'DECLINED' },
        });
      }

      const formattedPassengers = trip.ride.bookings.map((b) => ({
        id: b.passenger.id,
        firstName: b.passenger.firstName,
        lastName: b.passenger.lastName,
        phone: b.passenger.phone,
        seatsBooked: b.seatsBooked,
        fareAmount: Number(b.request?.agreedFare || currentRide.farePerSeat),
      }));

      return {
        message: 'Join request accepted',
        booking: { id: booking.id, seatsBooked: booking.seatsBooked, status: booking.status },
        trip: {
          id: trip.id,
          status: trip.status,
          rideId: trip.rideId,
          driverId: currentRide.driverId,
          passengers: formattedPassengers,
        },
        joinRequest: updatedRequest,
      };
    });
  }

  // Declines a join request
  async declineJoinRequest(currentUser, rideId, requestId) {
    const request = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { ride: true },
    });

    if (!request || request.rideId !== rideId) {
      const error = new Error('Join request not found');
      error.statusCode = 404;
      throw error;
    }

    const isDriver = request.ride.driverId === currentUser.id;
    const isPassenger = request.passengerId === currentUser.id;

    if (!isDriver && !isPassenger) {
      const error = new Error('Forbidden: You are not authorized to decline this request');
      error.statusCode = 403;
      throw error;
    }

    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'DECLINED' },
    });

    return {
      message: 'Join request declined',
    };
  }
}

module.exports = new RidesService();
