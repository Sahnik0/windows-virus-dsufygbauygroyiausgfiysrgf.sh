const { z } = require('zod');

// Preprocessor for Status enum to accept 'Active', 'Pending Setup', 'PENDING SETUP', 'Suspended', etc.
const statusEnum = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.toUpperCase().trim().replace(/[\s-]+/g, '_');
    if (s === 'PENDING') return 'PENDING_SETUP';
    return s;
  }
  return val;
}, z.enum(['ACTIVE', 'PENDING_SETUP', 'SUSPENDED']));

// Input validation schema for creating a new organization
const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  slug: z.string().optional(),
  status: statusEnum.optional().default('ACTIVE'),
  fuelCostPerLitre: z.number().positive().optional(),
  costPerKmDefault: z.number().positive().optional(),
});

// Input validation schema for updating an organization
const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  status: statusEnum.optional(),
  fuelCostPerLitre: z.number().positive().optional(),
  costPerKmDefault: z.number().positive().optional(),
  subsidyPercent: z.number().min(0).max(100).optional(),
  baseRideCharge: z.number().min(0).optional(),
  maxRidersPerCarpool: z.number().int().min(1).optional(),
  autoMatchEnabled: z.boolean().optional(),
  departmentRestriction: z.boolean().optional(),
});

// Input validation schema for provisioning an Org Admin account
const provisionOrgAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  firstName: z.string().optional().default('Org'),
  lastName: z.string().optional().default('Admin'),
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
  status: statusEnum.optional(),
});

module.exports = {
  createOrgSchema,
  updateOrgSchema,
  provisionOrgAdminSchema,
  updateOrgSettingsSchema,
};
