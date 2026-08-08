const express = require('express');
const vehiclesController = require('./vehicles.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');
const { createVehicleSchema, updateVehicleSchema } = require('./vehicles.validation');

const router = express.Router();

router.post(
  '/',
  authenticateToken,
  validate(createVehicleSchema),
  vehiclesController.createVehicle
);

router.get(
  '/',
  authenticateToken,
  vehiclesController.getVehicles
);

router.get(
  '/:id',
  authenticateToken,
  vehiclesController.getVehicleById
);

router.patch(
  '/:id',
  authenticateToken,
  validate(updateVehicleSchema),
  vehiclesController.updateVehicle
);

router.delete(
  '/:id',
  authenticateToken,
  vehiclesController.deleteVehicle
);

module.exports = router;
