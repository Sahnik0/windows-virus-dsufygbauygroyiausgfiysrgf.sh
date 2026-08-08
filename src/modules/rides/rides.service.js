// CRITICAL SECURITY RULE: Every service function touching org-scoped data MUST filter by orgId
// derived from req.user.orgId for ORG_ADMIN / USER callers. Never trust a client-supplied orgId for these roles.

const prisma = require('../../config/prisma');
const { getRoute, haversineDistance } = require('../../utils/routing');

class RidesService {
  /**
   * Publishes a new ride offer. Requires owning at least one registered vehicle.
   */
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
    // 1. Verify caller owns at least one registered vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle || vehicle.ownerId !== currentUser.id) {
      const error = new Error('You must register a vehicle before publishing a ride offer');
      error.statusCode = 400;
      throw error;
    }

    // 2. Fetch OSRM route details (fallback to Haversine on error/timeout)
    const routeInfo = await getRoute(
      { lat: pickupLat, lng: pickupLng },
      { lat: destinationLat, lng: destinationLng }
    );

    // 3. Create published ride tied to req.user.orgId
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
        status: 'PUBLISHED',
        routeGeometry: routeInfo.routeGeometry,
        routeDistanceKm: routeInfo.distanceKm,
        routeDurationMinutes: routeInfo.durationMinutes,
        orgId: currentUser.orgId,
      },
      include: {
        vehicle: true,
        driver: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
      },
    });
  }

  /**
   * Searches for published rides within the caller's organization.
   */
  async searchRides(currentUser, {
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    departureDate,
    seatsNeeded = 1,
    isRecurring,
  }) {
    const where = {
      orgId: currentUser.orgId,
      status: 'PUBLISHED',
      availableSeats: { gte: seatsNeeded },
    };

    if (isRecurring !== undefined) {
      where.isRecurring = isRecurring;
    }

    if (departureDate) {
      const start = new Date(departureDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(departureDate);
      end.setHours(23, 59, 59, 999);
      where.departureAt = { gte: start, lte: end };
    }

    const rides = await prisma.ride.findMany({
      where,
      include: {
        vehicle: true,
        driver: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { departureAt: 'asc' },
    });

    // Compute route info for requested search coordinates
    const routeInfo = await getRoute(
      { lat: pickupLat, lng: pickupLng },
      { lat: destinationLat, lng: destinationLng }
    );

    return {
      searchRoute: routeInfo,
      rides,
    };
  }

  /**
   * Finds nearby passengers' saved places along/near a published ride's route.
   * Implementation: Bounding-box pre-filter + exact Haversine distance check.
   */
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

    // Bounding box pre-filter for performance
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
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Exact Haversine filter
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

  /**
   * Finds nearby published driver rides for a given passenger pickup location.
   */
  async getNearbyDrivers(currentUser, pickupLat, pickupLng, radiusKm = 2.0) {
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((pickupLat * Math.PI) / 180));

    const candidateRides = await prisma.ride.findMany({
      where: {
        orgId: currentUser.orgId,
        status: 'PUBLISHED',
        pickupLat: { gte: pickupLat - latDelta, lte: pickupLat + latDelta },
        pickupLng: { gte: pickupLng - lngDelta, lte: pickupLng + lngDelta },
      },
      include: {
        vehicle: true,
        driver: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return candidateRides.filter((ride) => {
      const distance = haversineDistance(pickupLat, pickupLng, ride.pickupLat, ride.pickupLng);
      return distance <= radiusKm;
    });
  }

  /**
   * Retrieves single ride by ID.
   */
  async getRideById(currentUser, rideId) {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        vehicle: true,
        driver: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
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

  /**
   * Submits a join request for a ride. Requires agreed fare matching listed fare OR accepted negotiation.
   */
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

    if (ride.status !== 'PUBLISHED') {
      const error = new Error('Ride is no longer accepting join requests');
      error.statusCode = 400;
      throw error;
    }

    if (ride.availableSeats < seatsRequested) {
      const error = new Error(`Only ${ride.availableSeats} seat(s) available on this ride`);
      error.statusCode = 400;
      throw error;
    }

    // Determine target passengerId
    const passengerId = initiatedBy === 'PASSENGER' ? currentUser.id : currentUser.id; // caller is passenger when initiatedBy PASSENGER

    // Enforcement Check: Price agreement verification
    let negotiationId = null;
    const isListedPrice = Number(agreedFare) === Number(ride.farePerSeat);

    if (!isListedPrice) {
      // Find matching ACCEPTED negotiation for this ride and passenger
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

    return await prisma.joinRequest.create({
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
        passenger: { select: { id: true, firstName: true, lastName: true, email: true } },
        ride: true,
      },
    });
  }

  /**
   * Lists pending join requests for a ride (Driver only).
   */
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

  /**
   * Accepts a join request (Reversed party rule: driver accepts if passenger-initiated; passenger accepts if driver-initiated).
   * Atomically decrements availableSeats, creates Booking, creates Trip (RIDE_BOOKED) if first booking, and auto-declines overflowing requests.
   */
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

    // Reversed party authorization rule
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

    // Perform atomic acceptance transaction using Prisma transaction
    return await prisma.$transaction(async (tx) => {
      // Re-query ride with lock / status check
      const currentRide = await tx.ride.findUnique({ where: { id: rideId } });

      if (currentRide.availableSeats < request.seatsRequested) {
        const error = new Error('Insufficient seats available to accept this request');
        error.statusCode = 400;
        throw error;
      }

      const newSeats = currentRide.availableSeats - request.seatsRequested;
      const newRideStatus = newSeats === 0 ? 'FULL' : currentRide.status;

      // 1. Update ride available seats and status
      await tx.ride.update({
        where: { id: rideId },
        data: {
          availableSeats: newSeats,
          status: newRideStatus,
        },
      });

      // 2. Mark join request as ACCEPTED
      const updatedRequest = await tx.joinRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      });

      // 3. Create Booking record
      const booking = await tx.booking.create({
        data: {
          rideId,
          passengerId: request.passengerId,
          joinRequestId: requestId,
          seatsBooked: request.seatsRequested,
          status: 'BOOKED',
        },
      });

      // 4. Create or ensure Trip wrapper exists (in RIDE_BOOKED state)
      let trip = await tx.trip.findUnique({ where: { rideId } });
      if (!trip) {
        trip = await tx.trip.create({
          data: {
            rideId,
            status: 'RIDE_BOOKED',
          },
        });
      }

      // 5. Auto-decline any remaining PENDING join requests that require more seats than now available
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

      return {
        message: 'Join request accepted and seat booked successfully',
        booking,
        trip,
        joinRequest: updatedRequest,
      };
    });
  }

  /**
   * Declines a join request.
   */
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

    const updated = await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'DECLINED' },
    });

    return {
      message: 'Join request declined',
      joinRequest: updated,
    };
  }
}

module.exports = new RidesService();
