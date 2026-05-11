// src/controllers/admin.controller.js - Full Admin Controller
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Driver from '../models/Driver.js';
import Vehicle from '../models/Vehicle.js';
import Payment from '../models/Payment.js';
import AppConfig from '../models/AppConfig.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess, sendPaginatedResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/customError.js';
import { parsePagination } from '../utils/helpers.js';
import { invalidateConfigCache, seedDefaultConfig } from '../utils/configLoader.js';
import { BOOKING_STATUS, VEHICLE_TYPES } from '../config/constants.js';
import logger from '../config/logger.js';

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

export const getDashboardStats = catchAsync(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalBookings,
    todayBookings,
    monthBookings,
    totalUsers,
    totalDrivers,
    totalRevenue,
    monthRevenue,
    pendingBookings,
    confirmedBookings,
    recentBookings,
    bookingsByStatus,
    bookingsByType,
    revenueByMonth
  ] = await Promise.all([
    Booking.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: today } }),
    Booking.countDocuments({ createdAt: { $gte: thisMonth } }),
    User.countDocuments({ role: 'CUSTOMER', isActive: true }),
    Driver.countDocuments(),
    Booking.aggregate([
      { $match: { status: BOOKING_STATUS.COMPLETED } },
      { $group: { _id: null, total: { $sum: '$fareDetails.finalAmount' } } }
    ]),
    Booking.aggregate([
      { $match: { status: BOOKING_STATUS.COMPLETED, createdAt: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$fareDetails.finalAmount' } } }
    ]),
    Booking.countDocuments({ status: BOOKING_STATUS.PENDING }),
    Booking.countDocuments({ status: BOOKING_STATUS.CONFIRMED }),
    Booking.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name phoneNumber')
      .select('bookingId status bookingType pickupLocation dropLocation fareDetails createdAt'),
    Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Booking.aggregate([
      { $group: { _id: '$bookingType', count: { $sum: 1 } } }
    ]),
    Booking.aggregate([
      {
        $match: {
          status: BOOKING_STATUS.COMPLETED,
          createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$fareDetails.finalAmount' },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ])
  ]);

  return sendSuccess(res, {
    overview: {
      totalBookings,
      todayBookings,
      monthBookings,
      totalUsers,
      totalDrivers,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthRevenue: monthRevenue[0]?.total || 0,
      pendingBookings,
      confirmedBookings
    },
    recentBookings,
    bookingsByStatus: bookingsByStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
    bookingsByType: bookingsByType.reduce((acc, t) => { acc[t._id] = t.count; return acc; }, {}),
    revenueByMonth: revenueByMonth.map(r => ({
      month: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
      revenue: Math.round(r.revenue),
      bookings: r.bookings
    }))
  }, 'Dashboard stats retrieved', 200);
});

// ═══════════════════════════════════════════════════════════════
// BOOKINGS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export const getAllBookings = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, bookingType, search, fromDate, toDate, sortBy = '-createdAt' } = req.query;

  const query = {};
  if (status) query.status = { $in: status.split(',').map(s => s.toUpperCase()) };
  if (bookingType) query.bookingType = bookingType.toUpperCase();
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) query.createdAt.$lte = new Date(toDate);
  }
  if (search) {
    query.$or = [
      { bookingId: { $regex: search, $options: 'i' } },
      { 'pickupLocation.city': { $regex: search, $options: 'i' } },
      { 'dropLocation.city': { $regex: search, $options: 'i' } },
      { 'passengerDetails.name': { $regex: search, $options: 'i' } },
      { 'passengerDetails.phone': { $regex: search, $options: 'i' } }
    ];
  }

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .sort(sortBy)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name phoneNumber email')
      .populate('driverId', 'name phoneNumber rating')
      .populate('vehicleId', 'type modelName licensePlate'),
    Booking.countDocuments(query)
  ]);

  return sendPaginatedResponse(res, bookings, page, limit, total, 'Bookings retrieved');
});

export const getBookingById = catchAsync(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('userId', 'name phoneNumber email')
    .populate('driverId', 'name phoneNumber rating licenseNumber')
    .populate('vehicleId')
    .populate('paymentId');

  if (!booking) throw new NotFoundError('Booking not found');
  return sendSuccess(res, booking, 'Booking retrieved', 200);
});

export const updateBookingStatus = catchAsync(async (req, res) => {
  const { status, notes } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new NotFoundError('Booking not found');

  booking.status = status;
  if (notes) booking.notes = notes;
  await booking.save();

  logger.info('Admin updated booking status', { bookingId: booking.bookingId, status, adminId: req.user._id });
  return sendSuccess(res, booking, 'Booking status updated', 200);
});

export const assignDriver = catchAsync(async (req, res) => {
  const { driverId, vehicleId } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new NotFoundError('Booking not found');

  if (driverId) {
    const driver = await Driver.findById(driverId);
    if (!driver) throw new NotFoundError('Driver not found');
    booking.driverId = driverId;
  }
  if (vehicleId) {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new NotFoundError('Vehicle not found');
    booking.vehicleId = vehicleId;
  }
  booking.status = BOOKING_STATUS.ASSIGNED;
  await booking.save();

  return sendSuccess(res, booking, 'Driver assigned successfully', 200);
});

// ═══════════════════════════════════════════════════════════════
// USERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export const getAllUsers = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { role, search, isActive, sortBy = '-createdAt' } = req.query;

  const query = {};
  if (role) query.role = role.toUpperCase();
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query).sort(sortBy).skip(skip).limit(limit).select('-token -deviceInfo'),
    User.countDocuments(query)
  ]);

  return sendPaginatedResponse(res, users, page, limit, total, 'Users retrieved');
});

export const getUserById = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id).select('-token');
  if (!user) throw new NotFoundError('User not found');

  const bookingStats = await Booking.aggregate([
    { $match: { userId: user._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
        totalSpent: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$fareDetails.finalAmount', 0] } }
      }
    }
  ]);

  return sendSuccess(res, { user, bookingStats: bookingStats[0] || {} }, 'User retrieved', 200);
});

export const updateUserStatus = catchAsync(async (req, res) => {
  const { isActive, role } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User not found');

  if (isActive !== undefined) user.isActive = isActive;
  if (role) user.role = role;
  await user.save();

  return sendSuccess(res, user, 'User updated', 200);
});

// ═══════════════════════════════════════════════════════════════
// DRIVERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export const getAllDrivers = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { search, isAvailable, isVerified, sortBy = '-createdAt' } = req.query;

  const query = {};
  if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
  if (isVerified !== undefined) query.isVerified = isVerified === 'true';
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } },
      { licenseNumber: { $regex: search, $options: 'i' } }
    ];
  }

  const [drivers, total] = await Promise.all([
    Driver.find(query).sort(sortBy).skip(skip).limit(limit).populate('vehicleId', 'type modelName licensePlate'),
    Driver.countDocuments(query)
  ]);

  return sendPaginatedResponse(res, drivers, page, limit, total, 'Drivers retrieved');
});

export const getDriverById = catchAsync(async (req, res) => {
  const driver = await Driver.findById(req.params.id).populate('vehicleId');
  if (!driver) throw new NotFoundError('Driver not found');

  const recentBookings = await Booking.find({ driverId: driver._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('bookingId status bookingType pickupLocation dropLocation fareDetails createdAt');

  return sendSuccess(res, { driver, recentBookings }, 'Driver retrieved', 200);
});

export const createDriver = catchAsync(async (req, res) => {
  const driver = await Driver.create(req.body);
  logger.info('Admin created driver', { driverId: driver._id, adminId: req.user._id });
  return sendSuccess(res, driver, 'Driver created', 201);
});

export const updateDriver = catchAsync(async (req, res) => {
  const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!driver) throw new NotFoundError('Driver not found');
  return sendSuccess(res, driver, 'Driver updated', 200);
});

export const deleteDriver = catchAsync(async (req, res) => {
  const driver = await Driver.findByIdAndDelete(req.params.id);
  if (!driver) throw new NotFoundError('Driver not found');
  return sendSuccess(res, null, 'Driver deleted', 200);
});

// ═══════════════════════════════════════════════════════════════
// VEHICLES MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export const getAllVehicles = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { type, isAvailable, search, sortBy = '-createdAt' } = req.query;

  const query = {};
  if (type) query.type = type.toUpperCase();
  if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
  if (search) {
    query.$or = [
      { modelName: { $regex: search, $options: 'i' } },
      { licensePlate: { $regex: search, $options: 'i' } }
    ];
  }

  const [vehicles, total] = await Promise.all([
    Vehicle.find(query).sort(sortBy).skip(skip).limit(limit),
    Vehicle.countDocuments(query)
  ]);

  return sendPaginatedResponse(res, vehicles, page, limit, total, 'Vehicles retrieved');
});

export const getVehicleById = catchAsync(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new NotFoundError('Vehicle not found');
  return sendSuccess(res, vehicle, 'Vehicle retrieved', 200);
});

export const createVehicle = catchAsync(async (req, res) => {
  const vehicle = await Vehicle.create(req.body);
  logger.info('Admin created vehicle', { vehicleId: vehicle._id, adminId: req.user._id });
  return sendSuccess(res, vehicle, 'Vehicle created', 201);
});

export const updateVehicle = catchAsync(async (req, res) => {
  const vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!vehicle) throw new NotFoundError('Vehicle not found');
  return sendSuccess(res, vehicle, 'Vehicle updated', 200);
});

export const deleteVehicle = catchAsync(async (req, res) => {
  const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
  if (!vehicle) throw new NotFoundError('Vehicle not found');
  return sendSuccess(res, null, 'Vehicle deleted', 200);
});

// ═══════════════════════════════════════════════════════════════
// APP CONFIG (Pricing, T&C, Settings)
// ═══════════════════════════════════════════════════════════════

export const getAppConfig = catchAsync(async (req, res) => {
  let config = await AppConfig.findOne({ configKey: 'MAIN' });
  if (!config) {
    config = await seedDefaultConfig();
  }
  return sendSuccess(res, config, 'App config retrieved', 200);
});

export const updatePricing = catchAsync(async (req, res) => {
  const {
    vehiclePricing,
    localPackages,
    airportPrices,
    gstRate,
    tollPerKm,
    statePermitHatchback,
    statePermitSedan,
    statePermitSuv,
    statePermitTraveller,
    driverAllowancePerDay,
    minOutstationKmPerDay,
    freeKmForAirport,
    advancePaymentPercentage
  } = req.body;

  let config = await AppConfig.findOne({ configKey: 'MAIN' });
  if (!config) config = await seedDefaultConfig();

  if (vehiclePricing) config.vehiclePricing = vehiclePricing;
  if (localPackages) config.localPackages = localPackages;
  if (airportPrices) config.airportPrices = airportPrices;
  if (gstRate !== undefined) config.gstRate = gstRate;
  if (tollPerKm !== undefined) config.tollPerKm = tollPerKm;
  if (statePermitHatchback !== undefined) config.statePermitHatchback = statePermitHatchback;
  if (statePermitSedan !== undefined) config.statePermitSedan = statePermitSedan;
  if (statePermitSuv !== undefined) config.statePermitSuv = statePermitSuv;
  if (statePermitTraveller !== undefined) config.statePermitTraveller = statePermitTraveller;
  if (driverAllowancePerDay !== undefined) config.driverAllowancePerDay = driverAllowancePerDay;
  if (minOutstationKmPerDay !== undefined) config.minOutstationKmPerDay = minOutstationKmPerDay;
  if (freeKmForAirport !== undefined) config.freeKmForAirport = freeKmForAirport;
  if (advancePaymentPercentage !== undefined) config.advancePaymentPercentage = advancePaymentPercentage;

  config.lastUpdatedBy = req.user._id;
  await config.save();
  invalidateConfigCache();

  logger.info('Admin updated pricing config', { adminId: req.user._id });
  return sendSuccess(res, config, 'Pricing updated successfully', 200);
});

export const updateContent = catchAsync(async (req, res) => {
  const { termsAndConditions, privacyPolicy, refundPolicy, faqJson, contactEmail, contactPhone, aboutUs } = req.body;

  let config = await AppConfig.findOne({ configKey: 'MAIN' });
  if (!config) config = await seedDefaultConfig();

  if (!config.content) config.content = {};
  if (termsAndConditions !== undefined) config.content.termsAndConditions = termsAndConditions;
  if (privacyPolicy !== undefined) config.content.privacyPolicy = privacyPolicy;
  if (refundPolicy !== undefined) config.content.refundPolicy = refundPolicy;
  if (faqJson !== undefined) config.content.faqJson = faqJson;
  if (contactEmail !== undefined) config.content.contactEmail = contactEmail;
  if (contactPhone !== undefined) config.content.contactPhone = contactPhone;
  if (aboutUs !== undefined) config.content.aboutUs = aboutUs;

  config.lastUpdatedBy = req.user._id;
  config.markModified('content');
  await config.save();
  invalidateConfigCache();

  logger.info('Admin updated content', { adminId: req.user._id });
  return sendSuccess(res, config.content, 'Content updated successfully', 200);
});

export const updateAppSettings = catchAsync(async (req, res) => {
  const { appVersion, maintenanceMode, maintenanceMessage, supportPhone, supportEmail,
    cancellationWindowHours, cancellationChargePercent, minBookingHoursAhead, advanceBookingDays } = req.body;

  let config = await AppConfig.findOne({ configKey: 'MAIN' });
  if (!config) config = await seedDefaultConfig();

  if (appVersion !== undefined) config.appVersion = appVersion;
  if (maintenanceMode !== undefined) config.maintenanceMode = maintenanceMode;
  if (maintenanceMessage !== undefined) config.maintenanceMessage = maintenanceMessage;
  if (supportPhone !== undefined) config.supportPhone = supportPhone;
  if (supportEmail !== undefined) config.supportEmail = supportEmail;
  if (cancellationWindowHours !== undefined) config.cancellationWindowHours = cancellationWindowHours;
  if (cancellationChargePercent !== undefined) config.cancellationChargePercent = cancellationChargePercent;
  if (minBookingHoursAhead !== undefined) config.minBookingHoursAhead = minBookingHoursAhead;
  if (advanceBookingDays !== undefined) config.advanceBookingDays = advanceBookingDays;

  config.lastUpdatedBy = req.user._id;
  await config.save();
  invalidateConfigCache();

  logger.info('Admin updated app settings', { adminId: req.user._id });
  return sendSuccess(res, config, 'App settings updated', 200);
});

// ═══════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════

export const getAllPayments = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, method, fromDate, toDate, sortBy = '-createdAt' } = req.query;

  const query = {};
  if (status) query.status = status.toUpperCase();
  if (method) query.method = method.toUpperCase();
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) query.createdAt.$lte = new Date(toDate);
  }

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .sort(sortBy)
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name phoneNumber')
      .populate('bookingId', 'bookingId status bookingType'),
    Payment.countDocuments(query)
  ]);

  return sendPaginatedResponse(res, payments, page, limit, total, 'Payments retrieved');
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC CONFIG ENDPOINT (for mobile app)
// ═══════════════════════════════════════════════════════════════

export const getPublicConfig = catchAsync(async (req, res) => {
  let config = await AppConfig.findOne({ configKey: 'MAIN' }).lean();
  if (!config) {
    config = await seedDefaultConfig();
  }

  // Return only what the app needs (no sensitive data)
  const publicConfig = {
    vehiclePricing: config.vehiclePricing?.filter(v => v.isActive),
    localPackages: config.localPackages?.filter(p => p.isActive),
    airportPrices: config.airportPrices,
    gstRate: config.gstRate,
    advancePaymentPercentage: config.advancePaymentPercentage,
    driverAllowancePerDay: config.driverAllowancePerDay,
    minOutstationKmPerDay: config.minOutstationKmPerDay,
    freeKmForAirport: config.freeKmForAirport,
    cancellationWindowHours: config.cancellationWindowHours,
    cancellationChargePercent: config.cancellationChargePercent,
    minBookingHoursAhead: config.minBookingHoursAhead,
    advanceBookingDays: config.advanceBookingDays,
    content: config.content,
    appVersion: config.appVersion,
    maintenanceMode: config.maintenanceMode,
    maintenanceMessage: config.maintenanceMessage,
    supportPhone: config.supportPhone,
    supportEmail: config.supportEmail
  };

  return sendSuccess(res, publicConfig, 'Config retrieved', 200);
});
