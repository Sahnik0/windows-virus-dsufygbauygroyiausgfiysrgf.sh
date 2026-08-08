const { z } = require('zod');

// Input validation schema for initiating a price negotiation
const createNegotiationSchema = z.object({
  amount: z.number().positive('Offer amount must be positive'),
});

// Input validation schema for submitting a counter-offer
const counterOfferSchema = z.object({
  amount: z.number().positive('Counter-offer amount must be positive'),
});

module.exports = {
  createNegotiationSchema,
  counterOfferSchema,
};
