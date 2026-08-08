const prisma = require('../../config/prisma');

// Constant for assumed vehicle fuel efficiency: 15 kilometers per litre
const ASSUMED_KM_PER_LITRE = 15.0;

// Service class containing business logic for administrative reporting & analytics
class ReportsService {
  // Helper method to derive target organization ID with strict ORG_ADMIN isolation
  _getOrgId(currentUser, filterOrgId) {
    if (currentUser.role === 'ORG_ADMIN') {
      return currentUser.orgId;
    }
    return filterOrgId || currentUser.orgId;
  }

  // Summary Report: Returns total completed trips and total distance within an optional date range
  async getSummaryReport(currentUser, filterOrgId, startDate, endDate) {
    const orgId = this._getOrgId(currentUser, filterOrgId);
    if (!orgId) {
      const error = new Error('Organization ID is required');
      error.statusCode = 400;
      throw error;
    }

    const where = {
      status: { in: ['TRIP_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED'] },
      ride: { orgId },
    };

    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          const error = new Error('Invalid startDate provided');
          error.statusCode = 400;
          throw error;
        }
        where.completedAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          const error = new Error('Invalid endDate provided');
          error.statusCode = 400;
          throw error;
        }
        where.completedAt.lte = end;
      }
    }

    const trips = await prisma.trip.findMany({
      where,
      include: {
        ride: { select: { routeDistanceKm: true } },
      },
    });

    const totalTrips = trips.length;
    const totalDistanceKm = parseFloat(
      trips.reduce((sum, t) => sum + (t.ride.routeDistanceKm || 0), 0).toFixed(2)
    );

    return {
      orgId,
      totalTrips,
      totalDistanceKm,
      dateRange: { startDate, endDate },
    };
  }

  // Fuel Report: Calculates estimated fuel consumption (litres) and total cost using org.fuelCostPerLitre
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
    const fuelCostPerLitre = Number(org.fuelCostPerLitre);

    const rawLitres = summary.totalDistanceKm / ASSUMED_KM_PER_LITRE;
    const estimatedFuelLitres = parseFloat(rawLitres.toFixed(2));
    const estimatedTotalFuelCost = parseFloat((rawLitres * fuelCostPerLitre).toFixed(2));

    return {
      orgId,
      orgName: org.name,
      totalDistanceKm: summary.totalDistanceKm,
      assumedKmPerLitre: ASSUMED_KM_PER_LITRE,
      fuelCostPerLitre,
      estimatedFuelLitres,
      estimatedTotalFuelCost,
    };
  }

  // Cost Per Km Report: Returns org default costPerKm and calculated derived fuel cost per km
  async getCostPerKmReport(currentUser, filterOrgId) {
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

    const fuelCostPerLitre = Number(org.fuelCostPerLitre);
    const costPerKmDefault = Number(org.costPerKmDefault);
    const derivedFuelCostPerKm = parseFloat((fuelCostPerLitre / ASSUMED_KM_PER_LITRE).toFixed(2));

    return {
      orgId,
      orgName: org.name,
      costPerKmDefault,
      derivedFuelCostPerKm,
      fuelCostPerLitre,
      assumedKmPerLitre: ASSUMED_KM_PER_LITRE,
    };
  }

  // Vehicle Cost Report: Returns per-vehicle breakdown of completed trips, total distance, and fuel cost
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

    const fuelCostPerLitre = Number(org.fuelCostPerLitre);

    const vehicles = await prisma.vehicle.findMany({
      where: { owner: { orgId } },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        rides: {
          where: {
            orgId,
            trip: {
              status: { in: ['TRIP_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED'] },
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
      const estimatedFuelCost = parseFloat((rawLitres * fuelCostPerLitre).toFixed(2));

      return {
        vehicleId: v.id,
        model: v.model,
        registrationNumber: v.registrationNumber,
        owner: v.owner,
        totalTrips,
        totalDistanceKm,
        estimatedFuelLitres,
        estimatedFuelCost,
      };
    });

    return {
      orgId,
      orgName: org.name,
      vehicles: report,
    };
  }
}

module.exports = new ReportsService();
