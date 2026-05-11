// src/routes/admin.routes.js
import express from 'express';
import { protect, restrictTo } from '../middleware/auth.middleware.js';
import * as adminController from '../controllers/admin.controller.js';

const router = express.Router();

// ── Public config endpoint (mobile app uses this) ──────────────────────────
router.get('/public-config', adminController.getPublicConfig);

// ── All routes below require ADMIN role ────────────────────────────────────
router.use(protect, restrictTo('ADMIN'));

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Bookings
router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/:id', adminController.getBookingById);
router.patch('/bookings/:id/status', adminController.updateBookingStatus);
router.patch('/bookings/:id/assign-driver', adminController.assignDriver);

// Users
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id', adminController.updateUserStatus);

// Drivers
router.get('/drivers', adminController.getAllDrivers);
router.get('/drivers/:id', adminController.getDriverById);
router.post('/drivers', adminController.createDriver);
router.put('/drivers/:id', adminController.updateDriver);
router.delete('/drivers/:id', adminController.deleteDriver);

// Vehicles
router.get('/vehicles', adminController.getAllVehicles);
router.get('/vehicles/:id', adminController.getVehicleById);
router.post('/vehicles', adminController.createVehicle);
router.put('/vehicles/:id', adminController.updateVehicle);
router.delete('/vehicles/:id', adminController.deleteVehicle);

// App Config
router.get('/config', adminController.getAppConfig);
router.put('/config/pricing', adminController.updatePricing);
router.put('/config/content', adminController.updateContent);
router.put('/config/settings', adminController.updateAppSettings);

// Payments
router.get('/payments', adminController.getAllPayments);

export default router;
