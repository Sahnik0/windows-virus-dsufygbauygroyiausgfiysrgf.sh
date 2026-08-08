const { z } = require('zod');

const createVehicleSchema = z.object({
  model: z.string().min(1, 'Vehicle model is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  seatingCapacity: z.number().int().min(1, 'Seating capacity must be at least 1'),
});

const updateVehicleSchema = z.object({
  model: z.string().min(1).optional(),
  registrationNumber: z.string().min(1).optional(),
  seatingCapacity: z.number().int().min(1).optional(),
});

module.exports = {
  createVehicleSchema,
  updateVehicleSchema,
};
