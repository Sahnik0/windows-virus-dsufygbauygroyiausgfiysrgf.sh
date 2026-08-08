const { z } = require('zod');

const rejectUserSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
});

module.exports = {
  rejectUserSchema,
  updateUserSchema,
};
