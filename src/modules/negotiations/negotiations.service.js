const prisma = require('../../config/prisma');

// Service class containing business logic for turn-based fare negotiations
class NegotiationsService {
  // Helper to determine if a negotiation session has expired based on ride departure & creation time
  isNegotiationExpired(negotiation, ride) {
    if (!negotiation || negotiation.status !== 'OPEN') return false;

    const now = Date.now();
    const departureTime = new Date(ride.departureAt).getTime();
    const createdAt = new Date(negotiation.createdAt).getTime();

    // A ride is scheduled if isRecurring is true OR departureAt is more than 5 minutes after ride creation
    const rideCreatedTime = new Date(ride.createdAt).getTime();
    const isScheduled = ride.isRecurring || (departureTime - rideCreatedTime > 5 * 60 * 1000);

    if (isScheduled) {
      // Scheduled ride: Expiration occurs when scheduled departure time starts
      return now >= departureTime;
    } else {
      // Immediate ride booking: Expiration occurs 10 minutes after negotiation creation
      const tenMinutesMs = 10 * 60 * 1000;
      return now - createdAt > tenMinutesMs;
    }
  }

  async checkAndEnforceExpiry(negotiation, ride) {
    if (this.isNegotiationExpired(negotiation, ride)) {
      await prisma.negotiation.update({
        where: { id: negotiation.id },
        data: { status: 'EXPIRED' },
      });

      const departureTime = new Date(ride.departureAt).getTime();
      const rideCreatedTime = new Date(ride.createdAt).getTime();
      const isScheduled = ride.isRecurring || (departureTime - rideCreatedTime > 5 * 60 * 1000);

      const msg = isScheduled
        ? 'Negotiation time window has expired as the scheduled ride departure time has passed.'
        : 'Negotiation time window has expired (10 minutes maximum limit for immediate ride bookings).';

      const error = new Error(msg);
      error.statusCode = 400;
      throw error;
    }
  }

  // Starts a new price negotiation session for a ride (Passenger only)
  async createNegotiation(currentUser, rideId, amount) {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      const error = new Error('Ride not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentUser.role !== 'SUPER_ADMIN' && currentUser.orgId && ride.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Ride belongs to another organization');
      error.statusCode = 403;
      throw error;
    }

    if (ride.status !== 'SCHEDULED') {
      const error = new Error('Cannot negotiate fare on a ride that is no longer accepting bookings');
      error.statusCode = 409;
      throw error;
    }

    // Check if ride departure time has already passed
    if (Date.now() >= new Date(ride.departureAt).getTime()) {
      const error = new Error('Cannot start negotiation. Ride departure time has already passed.');
      error.statusCode = 400;
      throw error;
    }

    if (ride.driverId === currentUser.id) {
      const error = new Error('Driver cannot initiate a negotiation on their own ride');
      error.statusCode = 400;
      throw error;
    }

    if (Number(ride.farePerSeat) === Number(amount)) {
      const error = new Error('Offer amount matches listed fare. You can send a direct join request without negotiating.');
      error.statusCode = 400;
      throw error;
    }

    // Check if an OPEN negotiation session already exists for this passenger
    const existing = await prisma.negotiation.findFirst({
      where: {
        rideId,
        passengerId: currentUser.id,
        status: 'OPEN',
      },
    });

    if (existing) {
      if (this.isNegotiationExpired(existing, ride)) {
        await prisma.negotiation.update({
          where: { id: existing.id },
          data: { status: 'EXPIRED' },
        });
      } else {
        const error = new Error('An active negotiation already exists for this ride');
        error.statusCode = 400;
        throw error;
      }
    }

    return await prisma.negotiation.create({
      data: {
        rideId,
        passengerId: currentUser.id,
        status: 'OPEN',
        offers: {
          create: {
            offeredBy: 'PASSENGER',
            amount,
          },
        },
      },
      include: {
        offers: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  // Lists negotiations for a ride (Driver sees all, Passenger sees their own)
  async getRideNegotiations(currentUser, rideId) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });

    if (!ride) {
      const error = new Error('Ride not found');
      error.statusCode = 404;
      throw error;
    }

    const isDriver = ride.driverId === currentUser.id || currentUser.role === 'SUPER_ADMIN';

    const where = { rideId, status: 'OPEN' };

    // If caller is NOT the driver, filter strictly by passenger's own ID
    if (!isDriver) {
      where.passengerId = currentUser.id;
    }

    const negotiations = await prisma.negotiation.findMany({
      where,
      include: {
        passenger: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        offers: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const active = [];
    for (const neg of negotiations) {
      if (this.isNegotiationExpired(neg, ride)) {
        await prisma.negotiation.update({ where: { id: neg.id }, data: { status: 'EXPIRED' } });
      } else {
        active.push(neg);
      }
    }

    return active;
  }

  // Gets full offer history for a specific negotiation session
  async getNegotiationById(currentUser, rideId, negotiationId) {
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      include: {
        ride: true,
        passenger: { select: { id: true, firstName: true, lastName: true, email: true } },
        offers: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!negotiation || negotiation.rideId !== rideId) {
      const error = new Error('Negotiation not found');
      error.statusCode = 404;
      throw error;
    }

    const isDriver = negotiation.ride.driverId === currentUser.id;
    const isPassenger = negotiation.passengerId === currentUser.id;

    if (!isDriver && !isPassenger && currentUser.role !== 'SUPER_ADMIN') {
      const error = new Error('Forbidden: You are not a participant in this negotiation');
      error.statusCode = 403;
      throw error;
    }

    return negotiation;
  }

  // Adds a counter-offer (enforces strict alternating turns so same party cannot offer twice in a row)
  async counterOffer(currentUser, rideId, negotiationId, amount) {
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      include: {
        ride: true,
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!negotiation || negotiation.rideId !== rideId) {
      const error = new Error('Negotiation not found');
      error.statusCode = 404;
      throw error;
    }

    await this.checkAndEnforceExpiry(negotiation, negotiation.ride);

    if (negotiation.ride.status !== 'SCHEDULED') {
      const error = new Error('Cannot counter-offer on a ride that is no longer accepting bookings');
      error.statusCode = 409;
      throw error;
    }

    if (negotiation.status !== 'OPEN') {
      const error = new Error('Negotiation is no longer open');
      error.statusCode = 409;
      throw error;
    }

    const isDriver = negotiation.ride.driverId === currentUser.id;
    const isPassenger = negotiation.passengerId === currentUser.id;

    if (!isDriver && !isPassenger) {
      const error = new Error('Forbidden: You are not a participant in this negotiation');
      error.statusCode = 403;
      throw error;
    }

    const expectedOfferedBy = isDriver ? 'DRIVER' : 'PASSENGER';
    const lastOffer = negotiation.offers[0];

    // Reject if caller is trying to counter their own offer without waiting for response
    if (lastOffer && lastOffer.offeredBy === expectedOfferedBy) {
      const error = new Error('Cannot counter your own offer twice in a row. Waiting for the other party to respond.');
      error.statusCode = 400;
      throw error;
    }

    await prisma.negotiationOffer.create({
      data: {
        negotiationId,
        offeredBy: expectedOfferedBy,
        amount,
      },
    });

    return await this.getNegotiationById(currentUser, rideId, negotiationId);
  }

  // Accepts the other party's latest offer and marks Negotiation.status as ACCEPTED
  async acceptNegotiation(currentUser, rideId, negotiationId) {
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      include: {
        ride: true,
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!negotiation || negotiation.rideId !== rideId) {
      const error = new Error('Negotiation not found');
      error.statusCode = 404;
      throw error;
    }

    await this.checkAndEnforceExpiry(negotiation, negotiation.ride);

    if (negotiation.ride.status !== 'SCHEDULED') {
      const error = new Error('Cannot accept negotiation for a ride that is no longer accepting bookings');
      error.statusCode = 409;
      throw error;
    }

    if (negotiation.status !== 'OPEN') {
      const error = new Error('Negotiation is no longer open');
      error.statusCode = 409;
      throw error;
    }

    const isDriver = negotiation.ride.driverId === currentUser.id;
    const isPassenger = negotiation.passengerId === currentUser.id;

    if (!isDriver && !isPassenger) {
      const error = new Error('Forbidden: You are not a participant in this negotiation');
      error.statusCode = 403;
      throw error;
    }

    const lastOffer = negotiation.offers[0];
    const callerRole = isDriver ? 'DRIVER' : 'PASSENGER';

    // Must accept the OTHER party's offer, not your own
    if (lastOffer && lastOffer.offeredBy === callerRole) {
      const error = new Error('Cannot accept your own offer. The other party must accept it.');
      error.statusCode = 400;
      throw error;
    }

    const updated = await prisma.negotiation.update({
      where: { id: negotiationId },
      data: { status: 'ACCEPTED' },
      include: {
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    return {
      message: 'Negotiation accepted',
      agreedFare: updated.offers[0].amount,
      negotiation: updated,
    };
  }

  // Rejects a negotiation session
  async rejectNegotiation(currentUser, rideId, negotiationId) {
    const negotiation = await prisma.negotiation.findUnique({
      where: { id: negotiationId },
      include: { ride: true },
    });

    if (!negotiation || negotiation.rideId !== rideId) {
      const error = new Error('Negotiation not found');
      error.statusCode = 404;
      throw error;
    }

    const isDriver = negotiation.ride.driverId === currentUser.id;
    const isPassenger = negotiation.passengerId === currentUser.id;

    if (!isDriver && !isPassenger) {
      const error = new Error('Forbidden: You are not a participant in this negotiation');
      error.statusCode = 403;
      throw error;
    }

    const updated = await prisma.negotiation.update({
      where: { id: negotiationId },
      data: { status: 'REJECTED' },
    });

    return {
      message: 'Negotiation rejected',
      negotiation: updated,
    };
  }
}

module.exports = new NegotiationsService();
