const { z } = require('zod');

// Input validation schema for updating trip lifecycle status
// Accepts both canonical schema values and legacy frontend aliases
const updateTripStatusSchema = z.object({
  status: z.enum([
    // Canonical TripStatus enum values (Prisma schema)
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    // Legacy aliases supported via _normalizeStatus() in trips.service.js
    'RIDE_BOOKED',
    'TRIP_STARTED',
    'TRIP_IN_PROGRESS',
    'TRIP_COMPLETED',
    'PAYMENT_PENDING',
    'PAYMENT_COMPLETED',
  ]),
});

module.exports = {
  updateTripStatusSchema,
};
