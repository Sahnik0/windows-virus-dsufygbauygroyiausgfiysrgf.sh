const { z } = require('zod');

const processPaymentSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'UPI', 'WALLET']),
  amount: z.number().positive().optional(),
});

module.exports = {
  processPaymentSchema,
};
