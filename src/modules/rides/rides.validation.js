const { z } = require('zod');

// Input validation schema for publishing a ride offer
const createRideSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle ID is required'),
  pickupLabel: z.string().min(1, 'Pickup label is required'),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  destinationLabel: z.string().min(1, 'Destination label is required'),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  departureAt: z.string().datetime().or(z.string().min(1)),
  availableSeats: z.number().int().min(1, 'Available seats must be at least 1'),
  farePerSeat: z.number().positive('Fare per seat must be positive'),
  isRecurring: z.boolean().optional(),
});

// Input validation schema for searching available rides
const searchRideSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  pickupLabel: z.string().optional(),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  destinationLabel: z.string().optional(),
  departureDate: z.string().optional(),
  departureTime: z.string().optional(),
  seatsNeeded: z.number().int().min(1).optional().default(1),
  isRecurring: z.boolean().optional(),
});

// Input validation schema for submitting a ride join request
const createJoinRequestSchema = z.object({
  agreedFare: z.number().positive('Agreed fare must be positive'),
  seatsRequested: z.number().int().min(1).optional().default(1),
  initiatedBy: z.enum(['PASSENGER', 'DRIVER']).optional().default('PASSENGER'),
});

module.exports = {
  createRideSchema,
  searchRideSchema,
  createJoinRequestSchema,
};
