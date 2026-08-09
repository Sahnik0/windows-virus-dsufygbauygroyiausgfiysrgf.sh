const { z } = require('zod');

// Input validation schema for processing trip payments (WALLET, CASH, CARD, UPI)
const processPaymentSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'UPI', 'WALLET']),
  amount: z.number().positive().optional(),
});

// Input validation schema for verifying Razorpay trip payment signature
const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  amount: z.number().positive().optional(),
});

module.exports = {
  processPaymentSchema,
  verifyPaymentSchema,
};
