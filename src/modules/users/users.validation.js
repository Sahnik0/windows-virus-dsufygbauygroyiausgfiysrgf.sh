const { z } = require('zod');

// Input validation schema for rejecting a user account (reason mandatory)
const rejectUserSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

// Input validation schema for updating user profile fields
const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  employeeId: z.string().optional(),
  carpoolAccess: z.boolean().optional(),
});

module.exports = {
  rejectUserSchema,
  updateUserSchema,
};
