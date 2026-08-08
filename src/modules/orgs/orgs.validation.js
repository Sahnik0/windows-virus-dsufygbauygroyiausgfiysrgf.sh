const { z } = require('zod');

const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  fuelCostPerLitre: z.number().positive().optional(),
  costPerKmDefault: z.number().positive().optional(),
});

const provisionOrgAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

const updateOrgSettingsSchema = z.object({
  fuelCostPerLitre: z.number().positive().optional(),
  costPerKmDefault: z.number().positive().optional(),
});

module.exports = {
  createOrgSchema,
  provisionOrgAdminSchema,
  updateOrgSettingsSchema,
};
