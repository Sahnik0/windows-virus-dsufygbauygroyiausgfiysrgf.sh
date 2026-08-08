const { z } = require('zod');

const updateTripStatusSchema = z.object({
  status: z.enum([
    'RIDE_BOOKED',
    'TRIP_STARTED',
    'TRIP_IN_PROGRESS',
    'TRIP_COMPLETED',
    'PAYMENT_PENDING',
    'PAYMENT_COMPLETED',
  ]),
});

module.exports = {
  updateTripStatusSchema,
};
