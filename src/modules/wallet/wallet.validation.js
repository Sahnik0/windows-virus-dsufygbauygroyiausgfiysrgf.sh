const { z } = require('zod');

// Input validation schema for initiating a wallet recharge order
const rechargeWalletSchema = z.object({
  amount: z.number().positive('Recharge amount must be greater than zero'),
});

// Input validation schema for verifying Razorpay HMAC signature on recharge
const verifyRechargeSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
  amount: z.number().positive('Amount is required'),
});

module.exports = {
  rechargeWalletSchema,
  verifyRechargeSchema,
};
