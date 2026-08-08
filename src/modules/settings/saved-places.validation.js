const { z } = require('zod');

// Input validation schema for creating a saved place (label, address, lat, lng)
const createSavedPlaceSchema = z.object({
  label: z.string().min(1, 'Label is required (e.g. Home, Office)'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
});

// Input validation schema for updating a saved place
const updateSavedPlaceSchema = z.object({
  label: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

module.exports = {
  createSavedPlaceSchema,
  updateSavedPlaceSchema,
};
