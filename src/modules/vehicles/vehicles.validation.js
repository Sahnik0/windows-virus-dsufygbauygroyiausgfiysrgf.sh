const { z } = require('zod');

// Input validation schema for registering a vehicle
const createVehicleSchema = z.object({
  model: z.string().min(1, 'Vehicle model is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  seatingCapacity: z.coerce.number().int().min(1, 'Seating capacity must be at least 1'),
  fuelType: z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID']).optional().default('PETROL'),
});

// Input validation schema for updating vehicle details
const updateVehicleSchema = z.object({
  model: z.string().min(1).optional(),
  registrationNumber: z.string().min(1).optional(),
  seatingCapacity: z.coerce.number().int().min(1).optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID']).optional(),
  status: z.enum(['VERIFIED', 'PENDING', 'REJECTED']).optional(),
});

// Input validation schema for rejecting a vehicle verification application
const rejectVehicleSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

module.exports = {
  createVehicleSchema,
  updateVehicleSchema,
  rejectVehicleSchema,
};
