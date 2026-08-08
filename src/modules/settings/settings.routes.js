const express = require('express');
const savedPlacesController = require('./saved-places.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const {
  createSavedPlaceSchema,
  updateSavedPlaceSchema,
} = require('./saved-places.validation');

const router = express.Router();

// 1. Create a personal saved place (e.g. Home, Office)
router.post(
  '/saved-places',
  authenticateToken,
  validate(createSavedPlaceSchema),
  savedPlacesController.createSavedPlace
);

// 2. List personal saved places owned by user
router.get(
  '/saved-places',
  authenticateToken,
  savedPlacesController.getSavedPlaces
);

// 3. Get single saved place details by ID
router.get(
  '/saved-places/:id',
  authenticateToken,
  savedPlacesController.getSavedPlaceById
);

// 4. Update saved place details (owner-only)
router.patch(
  '/saved-places/:id',
  authenticateToken,
  validate(updateSavedPlaceSchema),
  savedPlacesController.updateSavedPlace
);

// 5. Delete a saved place (owner-only)
router.delete(
  '/saved-places/:id',
  authenticateToken,
  savedPlacesController.deleteSavedPlace
);

module.exports = router;
