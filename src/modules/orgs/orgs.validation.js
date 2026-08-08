const { z } = require('zod');

// Input validation schema for creating a new organization
const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  slug: z.string().optional(),
  status: z.enum(['ACTIVE', 'PENDING_SETUP', 'SUSPENDED']).optional(),
  fuelCostPerLitre: z.number().positive().optional(),
  costPerKmDefault: z.number().positive().optional(),
});

// Input validation schema for provisioning an Org Admin account
const provisionOrgAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

// Input validation schema for updating organization settings
const updateOrgSettingsSchema = z.object({
  fuelCostPerLitre: z.number().positive().optional(),
  costPerKmDefault: z.number().positive().optional(),
  subsidyPercent: z.number().min(0).max(100).optional(),
  baseRideCharge: z.number().min(0).optional(),
  maxRidersPerCarpool: z.number().int().min(1).optional(),
  autoMatchEnabled: z.boolean().optional(),
  departmentRestriction: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'PENDING_SETUP', 'SUSPENDED']).optional(),
});

module.exports = {
  createOrgSchema,
  provisionOrgAdminSchema,
  updateOrgSettingsSchema,
};
