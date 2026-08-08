const express = require('express');
const savedPlacesController = require('./saved-places.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const {
  createSavedPlaceSchema,
  updateSavedPlaceSchema,
} = require('./saved-places.validation');

const router = express.Router();

// Saved Places routes under /api/v1/settings/saved-places
router.post(
  '/saved-places',
  authenticateToken,
  validate(createSavedPlaceSchema),
  savedPlacesController.createSavedPlace
);

router.get(
  '/saved-places',
  authenticateToken,
  savedPlacesController.getSavedPlaces
);

router.get(
  '/saved-places/:id',
  authenticateToken,
  savedPlacesController.getSavedPlaceById
);

router.patch(
  '/saved-places/:id',
  authenticateToken,
  validate(updateSavedPlaceSchema),
  savedPlacesController.updateSavedPlace
);

router.delete(
  '/saved-places/:id',
  authenticateToken,
  savedPlacesController.deleteSavedPlace
);

module.exports = router;
