const prisma = require('../../config/prisma');
const bcrypt = require('bcrypt');

// Service class containing business logic for Organization operations
class OrgsService {
  // Creates a new organization record (SUPER_ADMIN only)
  async createOrg({ name, slug, status = 'ACTIVE' }) {
    const rawSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let finalSlug = rawSlug;

    // Check if slug is unique, append timestamp if duplicate exists
    const existingSlug = await prisma.org.findFirst({ where: { slug: finalSlug } });
    if (existingSlug) {
      finalSlug = `${rawSlug}-${Date.now()}`;
    }

    return await prisma.org.create({
      data: {
        name,
        slug: finalSlug,
        status,
      },
    });
  }

  // Lists all registered organizations with employee count (SUPER_ADMIN only)
  async getAllOrgs() {
    const orgs = await prisma.org.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    // Ensure slug is present in output (fallback to slugified name)
    return orgs.map((org) => ({
      ...org,
      slug: org.slug || org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    }));
  }

  // Lists all ACTIVE organizations for public registration dropdown (unauthenticated)
  async getActiveOrgsPublic() {
    const orgs = await prisma.org.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { name: 'asc' },
    });

    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug || org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    }));
  }

  // Gets single organization details by ID or slug
  async getOrgById(orgId) {
    const org = await prisma.org.findFirst({
      where: {
        OR: [{ id: orgId }, { slug: orgId }],
      },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 404;
      throw error;
    }

    return {
      ...org,
      slug: org.slug || org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    };
  }

  // Updates organization details (name, slug, status, settings)
  async updateOrg(currentUser, targetOrgId, data) {
    if (currentUser.role === 'ORG_ADMIN' && currentUser.orgId !== targetOrgId) {
      const error = new Error('Forbidden: Cannot update settings for another organization');
      error.statusCode = 403;
      throw error;
    }

    const org = await prisma.org.findUnique({ where: { id: targetOrgId } });
    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 404;
      throw error;
    }

    const {
      name,
      slug,
      status,
      subsidyPercent,
      baseRideCharge,
      maxRidersPerCarpool,
      autoMatchEnabled,
      departmentRestriction,
    } = data;

    let finalSlug = slug;
    if (slug && slug !== org.slug) {
      const existingSlug = await prisma.org.findFirst({ where: { slug, NOT: { id: targetOrgId } } });
      if (existingSlug) {
        finalSlug = `${slug}-${Date.now()}`;
      }
    }

    return await prisma.org.update({
      where: { id: targetOrgId },
      data: {
        ...(name !== undefined && { name }),
        ...(finalSlug !== undefined && { slug: finalSlug }),
        ...(status !== undefined && { status }),
        ...(subsidyPercent !== undefined && { subsidyPercent: Number(subsidyPercent) }),
        ...(baseRideCharge !== undefined && { baseRideCharge: Number(baseRideCharge) }),
        ...(maxRidersPerCarpool !== undefined && { maxRidersPerCarpool: Number(maxRidersPerCarpool) }),
        ...(autoMatchEnabled !== undefined && { autoMatchEnabled }),
        ...(departmentRestriction !== undefined && { departmentRestriction }),
      },
    });
  }

  // Deletes an organization and associated records cleanly
  async deleteOrg(currentUser, targetOrgId) {
    if (currentUser.role !== 'SUPER_ADMIN') {
      const error = new Error('Forbidden: Only Super Admin can delete organizations');
      error.statusCode = 403;
      throw error;
    }

    const org = await prisma.org.findUnique({ where: { id: targetOrgId } });
    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 404;
      throw error;
    }

    await prisma.$transaction(
      async (tx) => {
        // 1. Fetch user IDs belonging to this org
        const users = await tx.user.findMany({ where: { orgId: targetOrgId }, select: { id: true } });
        const userIds = users.map((u) => u.id);

        // 2. Fetch ride IDs belonging to this org or its drivers
        const rides = await tx.ride.findMany({
          where: {
            OR: [
              { orgId: targetOrgId },
              ...(userIds.length > 0 ? [{ driverId: { in: userIds } }] : []),
            ],
          },
          select: { id: true },
        });
        const rideIds = rides.map((r) => r.id);

        // 3. Fetch trip IDs belonging to these rides
        const trips = await tx.trip.findMany({
          where: {
            OR: [
              ...(rideIds.length > 0 ? [{ rideId: { in: rideIds } }] : []),
              ...(userIds.length > 0 ? [{ driverId: { in: userIds } }] : []),
            ],
          },
          select: { id: true },
        });
        const tripIds = trips.map((t) => t.id);

        // 4. Fetch join request IDs belonging to these rides or passengers
        const joinReqs = await tx.joinRequest.findMany({
          where: {
            OR: [
              ...(rideIds.length > 0 ? [{ rideId: { in: rideIds } }] : []),
              ...(userIds.length > 0 ? [{ passengerId: { in: userIds } }] : []),
            ],
          },
          select: { id: true },
        });
        const joinReqIds = joinReqs.map((j) => j.id);

        // 5. Fetch booking IDs
        const bookings = await tx.booking.findMany({
          where: {
            OR: [
              ...(rideIds.length > 0 ? [{ rideId: { in: rideIds } }] : []),
              ...(userIds.length > 0 ? [{ passengerId: { in: userIds } }] : []),
              ...(joinReqIds.length > 0 ? [{ requestId: { in: joinReqIds } }] : []),
            ],
          },
          select: { id: true },
        });
        const bookingIds = bookings.map((b) => b.id);

        // Delete child trip components
        if (tripIds.length > 0) {
          await tx.tripPassenger.deleteMany({ where: { tripId: { in: tripIds } } });
          await tx.tripLocation.deleteMany({ where: { tripId: { in: tripIds } } });
          await tx.message.deleteMany({ where: { tripId: { in: tripIds } } });
          await tx.callLog.deleteMany({ where: { tripId: { in: tripIds } } });
          await tx.fareBreakdown.deleteMany({ where: { tripId: { in: tripIds } } });
        }

        // Delete payments and wallet transactions
        if (bookingIds.length > 0 || tripIds.length > 0) {
          const payments = await tx.payment.findMany({
            where: {
              OR: [
                ...(bookingIds.length > 0 ? [{ bookingId: { in: bookingIds } }] : []),
                ...(tripIds.length > 0 ? [{ tripId: { in: tripIds } }] : []),
              ],
            },
            select: { id: true },
          });
          const paymentIds = payments.map((p) => p.id);

          if (paymentIds.length > 0) {
            await tx.walletTransaction.deleteMany({ where: { paymentId: { in: paymentIds } } });
            await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
          }
        }

        // Delete trips
        if (tripIds.length > 0) {
          await tx.trip.deleteMany({ where: { id: { in: tripIds } } });
        }

        // Delete bookings, negotiations, join requests
        if (bookingIds.length > 0) {
          await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
        }
        if (joinReqIds.length > 0) {
          await tx.negotiation.deleteMany({ where: { requestId: { in: joinReqIds } } });
          await tx.joinRequest.deleteMany({ where: { id: { in: joinReqIds } } });
        }

        // Delete rides & vehicles
        if (rideIds.length > 0) {
          await tx.negotiation.deleteMany({ where: { rideId: { in: rideIds } } });
          await tx.ride.deleteMany({ where: { id: { in: rideIds } } });
        }

        if (userIds.length > 0) {
          await tx.savedPlace.deleteMany({ where: { userId: { in: userIds } } });
          await tx.vehicle.deleteMany({ where: { ownerId: { in: userIds } } });

          const wallets = await tx.wallet.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
          const walletIds = wallets.map((w) => w.id);
          if (walletIds.length > 0) {
            await tx.walletTransaction.deleteMany({ where: { walletId: { in: walletIds } } });
            await tx.wallet.deleteMany({ where: { id: { in: walletIds } } });
          }

          await tx.user.deleteMany({ where: { orgId: targetOrgId } });
        }

        // Finally delete the organization record
        await tx.org.delete({ where: { id: targetOrgId } });
      },
      {
        timeout: 30000, // 30 seconds timeout for remote cloud PostgreSQL
        maxWait: 10000,
      }
    );

    return { message: 'Organization deleted successfully' };
  }

  // Provisions or updates an Org Admin account
  async provisionOrgAdmin(orgId, { email, password, firstName = 'Org', lastName = 'Admin', phone }) {
    const normalizedEmail = email.trim().toLowerCase();

    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 404;
      throw error;
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    const passwordHash = await bcrypt.hash(password, 10);

    if (existingUser) {
      if (existingUser.orgId === orgId || existingUser.role === 'ORG_ADMIN') {
        const updatedAdmin = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            firstName,
            lastName,
            ...(phone && { phone }),
            role: 'ORG_ADMIN',
            orgId,
            verificationStatus: 'APPROVED',
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            orgId: true,
            verificationStatus: true,
            createdAt: true,
          },
        });
        return updatedAdmin;
      } else {
        const error = new Error('Email is already registered under another organization');
        error.statusCode = 400;
        throw error;
      }
    }

    const admin = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName,
        lastName,
        phone,
        role: 'ORG_ADMIN',
        orgId,
        verificationStatus: 'APPROVED',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        orgId: true,
        verificationStatus: true,
        createdAt: true,
      },
    });

    return admin;
  }

  // Lists all Org Admins assigned to a specific organization (SUPER_ADMIN only)
  async getOrgAdmins(orgId) {
    return await prisma.user.findMany({
      where: {
        orgId,
        role: 'ORG_ADMIN',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        orgId: true,
        verificationStatus: true,
        createdAt: true,
      },
    });
  }

  // Updates settings for an organization
  async updateOrgSettings(currentUser, targetOrgId, data) {
    return await this.updateOrg(currentUser, targetOrgId, data);
  }
}

module.exports = new OrgsService();
