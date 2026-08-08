const prisma = require('../../config/prisma');

// Service class containing business logic for vehicle management
class VehiclesService {
  // Registers a new vehicle with ownerId derived strictly from current user token
  async createVehicle(currentUser, { model, registrationNumber, seatingCapacity, fuelType = 'PETROL' }) {
    // Check if registration number is already registered by any user
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
        fuelType,
        status: 'VERIFIED',
        ownerId: currentUser.id,
      },
    });
  }

  // Lists vehicles (users see their own vehicles; admins can pass includeOrg=true to see org vehicles)
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

  // Fetches a single vehicle record by ID with ownership checks
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

    // Regular users can only view their own vehicles
    if (currentUser.role === 'USER' && vehicle.ownerId !== currentUser.id) {
      const error = new Error('Forbidden: Cannot view another user’s vehicle');
      error.statusCode = 403;
      throw error;
    }

    // Org admins can only view vehicles belonging to users in their org
    if (currentUser.role === 'ORG_ADMIN' && vehicle.owner.orgId !== currentUser.orgId) {
      const error = new Error('Forbidden: Vehicle belongs to another organization');
      error.statusCode = 403;
      throw error;
    }

    return vehicle;
  }

  // Updates vehicle model, registration number, seating capacity, fuelType, status (owner-only)
  async updateVehicle(currentUser, vehicleId, { model, registrationNumber, seatingCapacity, fuelType, status }) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

    if (!vehicle) {
      const error = new Error('Vehicle not found');
      error.statusCode = 404;
      throw error;
    }

    if (vehicle.ownerId !== currentUser.id && currentUser.role !== 'ORG_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
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
        ...(fuelType !== undefined && { fuelType }),
        ...(status !== undefined && { status }),
      },
    });
  }

  // Deletes a vehicle record (owner-only; blocks deletion if attached to an active ride with 409 Conflict)
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

    // Check if vehicle is attached to an active published/full ride
    if (prisma.ride) {
      const activeRide = await prisma.ride.findFirst({
        where: {
          vehicleId,
          status: { in: ['SCHEDULED', 'ACTIVE'] },
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
