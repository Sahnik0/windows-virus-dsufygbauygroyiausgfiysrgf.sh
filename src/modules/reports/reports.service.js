const prisma = require('../../config/prisma');

const ASSUMED_KM_PER_LITRE = 15; // Benchmark 15 km per litre efficiency

// Service class containing business logic for analytical reports
class ReportsService {
  // Helper to resolve orgId based on user role and query params
  _getOrgId(currentUser, filterOrgId) {
    if (currentUser.role === 'ORG_ADMIN') {
      return currentUser.orgId;
    }
    return filterOrgId || null;
  }

  // Summary Report: Returns total trips and total distance for specified org
  async getSummaryReport(currentUser, filterOrgId, startDate, endDate) {
    const orgId = this._getOrgId(currentUser, filterOrgId);
    if (!orgId) {
      const error = new Error('Organization ID is required');
      error.statusCode = 400;
      throw error;
    }

    const where = { orgId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          const error = new Error('Invalid startDate provided');
          error.statusCode = 400;
          throw error;
        }
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          const error = new Error('Invalid endDate provided');
          error.statusCode = 400;
          throw error;
        }
        where.createdAt.lte = end;
      }
    }

    const completedRides = await prisma.ride.findMany({
      where: {
        ...where,
        trip: {
          status: 'COMPLETED',
        },
      },
      select: {
        routeDistanceKm: true,
      },
    });

    const totalTrips = completedRides.length;
    const totalDistanceKm = parseFloat(
      completedRides.reduce((sum, ride) => sum + (ride.routeDistanceKm || 0), 0).toFixed(2)
    );

    return {
      orgId,
      totalTrips,
      totalDistanceKm,
      dateRange: { startDate, endDate },
    };
  }

  // Fuel Report: Calculates estimated fuel consumption (litres)
  async getFuelReport(currentUser, filterOrgId, startDate, endDate) {
    const orgId = this._getOrgId(currentUser, filterOrgId);
    if (!orgId) {
      const error = new Error('Organization ID is required');
      error.statusCode = 400;
      throw error;
    }
    const org = await prisma.org.findUnique({ where: { id: orgId } });

    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 404;
      throw error;
    }

    const summary = await this.getSummaryReport(currentUser, filterOrgId, startDate, endDate);
    const rawLitres = summary.totalDistanceKm / ASSUMED_KM_PER_LITRE;
    const estimatedFuelLitres = parseFloat(rawLitres.toFixed(2));

    return {
      orgId,
      orgName: org.name,
      totalDistanceKm: summary.totalDistanceKm,
      assumedKmPerLitre: ASSUMED_KM_PER_LITRE,
      estimatedFuelLitres,
    };
  }

  // Vehicle Cost Report: Returns per-vehicle breakdown of completed trips and total distance
  async getVehicleCostReport(currentUser, filterOrgId) {
    const orgId = this._getOrgId(currentUser, filterOrgId);
    if (!orgId) {
      const error = new Error('Organization ID is required');
      error.statusCode = 400;
      throw error;
    }
    const org = await prisma.org.findUnique({ where: { id: orgId } });

    if (!org) {
      const error = new Error('Organization not found');
      error.statusCode = 404;
      throw error;
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { owner: { orgId } },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        rides: {
          where: {
            orgId,
            trip: {
              status: 'COMPLETED',
            },
          },
          select: { routeDistanceKm: true },
        },
      },
    });

    const report = vehicles.map((v) => {
      const totalTrips = v.rides.length;
      const totalDistanceKm = parseFloat(
        v.rides.reduce((sum, r) => sum + (r.routeDistanceKm || 0), 0).toFixed(2)
      );
      const rawLitres = totalDistanceKm / ASSUMED_KM_PER_LITRE;
      const estimatedFuelLitres = parseFloat(rawLitres.toFixed(2));

      return {
        vehicleId: v.id,
        model: v.model,
        registrationNumber: v.registrationNumber,
        driverName: `${v.owner.firstName} ${v.owner.lastName}`.trim(),
        totalTrips,
        totalDistanceKm,
        estimatedFuelLitres,
      };
    });

    return report;
  }
}

module.exports = new ReportsService();
