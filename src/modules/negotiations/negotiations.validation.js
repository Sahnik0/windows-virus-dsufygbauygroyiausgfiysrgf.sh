const { z } = require('zod');

const createNegotiationSchema = z.object({
  amount: z.number().positive('Offer amount must be positive'),
});

const counterOfferSchema = z.object({
  amount: z.number().positive('Counter-offer amount must be positive'),
});

module.exports = {
  createNegotiationSchema,
  counterOfferSchema,
};
