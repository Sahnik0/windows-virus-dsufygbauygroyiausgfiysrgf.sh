// CRITICAL SECURITY RULE: Every service function touching org-scoped data MUST filter by orgId
// derived from req.user.orgId for ORG_ADMIN / USER callers. Never trust a client-supplied orgId for these roles.

const prisma = require('../../config/prisma');

class VehiclesService {
  /**
   * Registers a vehicle owned by the current user.
   * ownerId is derived strictly from req.user.id.
   */
  async createVehicle(currentUser, { model, registrationNumber, seatingCapacity }) {
    const existing = await prisma.vehicle.findUnique({
      where: { registrationNumber },
    });

    if (existing) {
      const error = new Error('Vehicle with this registration number is already registered');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.vehicle.create({
      data: {
        model,
        registrationNumber,
        seatingCapacity,
        ownerId: currentUser.id,
      },
    });
  }

  /**
   * Lists vehicles. User sees own vehicles; Org Admin can view all vehicles in their org via includeOrg flag.
   */
  async getVehicles(currentUser, includeOrg = false) {
    if (includeOrg && (currentUser.role === 'ORG_ADMIN' || currentUser.role === 'SUPER_ADMIN')) {
      const where = currentUser.role === 'ORG_ADMIN' ? { owner: { orgId: currentUser.orgId } } : {};
      return await prisma.vehicle.findMany({
        where,
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true, orgId: true },
          },
        },
      });
    }

    // Default: Return vehicles owned by current user
    return await prisma.vehicle.findMany({
      where: { ownerId: currentUser.id },
    });
  }

  /**
   * Gets single vehicle by ID. Owner or Org Admin (same org) only.
   */
  async getVehicleById(currentUser, vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { owner: true },
    });

    if (!vehicle) {
      const error = new Error('Vehicle not found');
      error.statusCode = 404;
      throw error;
    }

    if (currentUser.role === 'USER' && vehicle.ownerId !== currentUser.id) {
      const error = new Error('Forbidden: Cannot view another user’s vehicle');
      error.statusCode = 403;
      throw error;
    }

    if (currentUser.role === 'ORG_ADMIN' && vehicle.owner.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Vehicle belongs to another organization');
      error.statusCode = 403;
      throw error;
    }

    return vehicle;
  }

  /**
   * Updates vehicle. Owner-only.
   */
  async updateVehicle(currentUser, vehicleId, { model, registrationNumber, seatingCapacity }) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

    if (!vehicle) {
      const error = new Error('Vehicle not found');
      error.statusCode = 404;
      throw error;
    }

    if (vehicle.ownerId !== currentUser.id) {
      const error = new Error('Forbidden: Only the vehicle owner can update vehicle details');
      error.statusCode = 403;
      throw error;
    }

    if (registrationNumber && registrationNumber !== vehicle.registrationNumber) {
      const existing = await prisma.vehicle.findUnique({ where: { registrationNumber } });
      if (existing) {
        const error = new Error('Registration number is already in use by another vehicle');
        error.statusCode = 400;
        throw error;
      }
    }

    return await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(model !== undefined && { model }),
        ...(registrationNumber !== undefined && { registrationNumber }),
        ...(seatingCapacity !== undefined && { seatingCapacity }),
      },
    });
  }

  /**
   * Deletes vehicle. Owner-only.
   * Blocks deletion if referenced by an active ride (returns 409 Conflict).
   */
  async deleteVehicle(currentUser, vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

    if (!vehicle) {
      const error = new Error('Vehicle not found');
      error.statusCode = 404;
      throw error;
    }

    if (vehicle.ownerId !== currentUser.id) {
      const error = new Error('Forbidden: Only the vehicle owner can delete this vehicle');
      error.statusCode = 403;
      throw error;
    }

    // Check if vehicle is attached to an active ride (if Ride model exists)
    if (prisma.ride) {
      const activeRide = await prisma.ride.findFirst({
        where: {
          vehicleId,
          status: { in: ['PUBLISHED', 'FULL'] },
        },
      });

      if (activeRide) {
        const error = new Error('Cannot delete vehicle attached to an active ride');
        error.statusCode = 409;
        throw error;
      }
    }

    try {
      await prisma.vehicle.delete({ where: { id: vehicleId } });
      return { message: 'Vehicle deleted successfully' };
    } catch (err) {
      if (err.code === 'P2003') {
        const error = new Error('Cannot delete vehicle referenced by existing rides');
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }
  }
}

module.exports = new VehiclesService();
