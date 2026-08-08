const { z } = require('zod');

// Input validation schema for processing trip payments (WALLET, CASH, CARD, UPI)
const processPaymentSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'UPI', 'WALLET']),
  amount: z.number().positive().optional(),
});

module.exports = {
  processPaymentSchema,
};
