const express = require('express');
const vehiclesController = require('./vehicles.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const uploadLicense = require('../../utils/multerLicense');
const { createVehicleSchema, updateVehicleSchema, rejectVehicleSchema } = require('./vehicles.validation');

const router = express.Router();

// 1. Register a new vehicle (requires driving license file upload under 'license')
router.post(
  '/',
  authenticateToken,
  uploadLicense.single('license'),
  validate(createVehicleSchema),
  vehiclesController.createVehicle
);

// 2. List vehicles waiting for admin approval (ORG_ADMIN / SUPER_ADMIN)
router.get(
  '/pending',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  vehiclesController.getPendingVehicles
);

// 3. View/stream uploaded driving license document
router.get(
  '/:id/license',
  authenticateToken,
  vehiclesController.getVehicleLicense
);

// 4. Approve a pending vehicle application (ORG_ADMIN / SUPER_ADMIN)
router.patch(
  '/:id/approve',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  vehiclesController.approveVehicle
);

// 5. Reject a pending vehicle application with reason (ORG_ADMIN / SUPER_ADMIN)
router.patch(
  '/:id/reject',
  authenticateToken,
  requireRole('ORG_ADMIN', 'SUPER_ADMIN'),
  validate(rejectVehicleSchema),
  vehiclesController.rejectVehicle
);

// 6. List vehicles (returns user's vehicles, or all org vehicles if ?all=true for admin)
router.get(
  '/',
  authenticateToken,
  vehiclesController.getVehicles
);

// 7. Get single vehicle details by ID
router.get(
  '/:id',
  authenticateToken,
  vehiclesController.getVehicleById
);

// 8. Update vehicle details (owner-only)
router.patch(
  '/:id',
  authenticateToken,
  validate(updateVehicleSchema),
  vehiclesController.updateVehicle
);

// 9. Delete a vehicle (owner-only, blocked with 409 Conflict if active ride attached)
router.delete(
  '/:id',
  authenticateToken,
  vehiclesController.deleteVehicle
);

module.exports = router;
