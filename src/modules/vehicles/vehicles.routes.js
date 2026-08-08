const express = require('express');
const vehiclesController = require('./vehicles.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const { createVehicleSchema, updateVehicleSchema } = require('./vehicles.validation');

const router = express.Router();

// 1. Register a new vehicle (binds ownerId to req.user.id)
router.post(
  '/',
  authenticateToken,
  validate(createVehicleSchema),
  vehiclesController.createVehicle
);

// 2. List vehicles (returns user's vehicles, or all org vehicles if ?all=true for admin)
router.get(
  '/',
  authenticateToken,
  vehiclesController.getVehicles
);

// 3. Get single vehicle details by ID
router.get(
  '/:id',
  authenticateToken,
  vehiclesController.getVehicleById
);

// 4. Update vehicle details (owner-only)
router.patch(
  '/:id',
  authenticateToken,
  validate(updateVehicleSchema),
  vehiclesController.updateVehicle
);

// 5. Delete a vehicle (owner-only, blocked with 409 Conflict if active ride attached)
router.delete(
  '/:id',
  authenticateToken,
  vehiclesController.deleteVehicle
);

module.exports = router;
