// src/models/AppConfig.js - Dynamic App Configuration Model
import mongoose from 'mongoose';

// ─── Pricing per vehicle type ───────────────────────────────────────────────
const vehiclePricingSchema = new mongoose.Schema({
  vehicleType: { type: String, required: true },
  displayName: { type: String, required: true },
  perKmRateOneWay: { type: Number, required: true, min: 0 },
  perKmRateRoundTrip: { type: Number, required: true, min: 0 },
  minFare: { type: Number, required: true, min: 0 },
  nightChargeMultiplier: { type: Number, default: 1.2, min: 1 },
  isActive: { type: Boolean, default: true },
  capacity: {
    passengers: { type: Number, default: 4 },
    luggage: { type: Number, default: 2 }
  },
  features: [String],
  modelExamples: [String],
  description: { type: String, default: '' },
  bestFor: { type: String, default: '' }
}, { _id: false });

// ─── Local package per vehicle ───────────────────────────────────────────────
const localPackageVehicleSchema = new mongoose.Schema({
  vehicleType: { type: String, required: true },
  basePrice: { type: Number, required: true, min: 0 },
  extraKmCharge: { type: Number, required: true, min: 0 },
  extraHourCharge: { type: Number, required: true, min: 0 }
}, { _id: false });

const localPackageSchema = new mongoose.Schema({
  packageKey: { type: String, required: true }, // e.g. "2_20"
  hours: { type: Number, required: true },
  km: { type: Number, required: true },
  vehicles: [localPackageVehicleSchema],
  isActive: { type: Boolean, default: true }
}, { _id: false });

// ─── Airport base price per vehicle ─────────────────────────────────────────
const airportPriceSchema = new mongoose.Schema({
  vehicleType: { type: String, required: true },
  basePrice: { type: Number, required: true, min: 0 }
}, { _id: false });

// ─── Content (T&C, Privacy, Refund, FAQ) ────────────────────────────────────
const contentSchema = new mongoose.Schema({
  termsAndConditions: { type: String, default: '' },
  privacyPolicy: { type: String, default: '' },
  refundPolicy: { type: String, default: '' },
  faqJson: { type: String, default: '[]' }, // JSON string of FAQ array
  contactEmail: { type: String, default: 'support@joincab.com' },
  contactPhone: { type: String, default: '' },
  aboutUs: { type: String, default: '' }
}, { _id: false });

// ─── Main AppConfig Schema ───────────────────────────────────────────────────
const appConfigSchema = new mongoose.Schema({
  // Singleton key — only one document
  configKey: {
    type: String,
    default: 'MAIN',
    unique: true,
    immutable: true
  },

  // ── Pricing ──
  vehiclePricing: [vehiclePricingSchema],
  localPackages: [localPackageSchema],
  airportPrices: [airportPriceSchema],

  // ── Tax & Surcharges ──
  gstRate: { type: Number, default: 0.05, min: 0, max: 1 },
  tollPerKm: { type: Number, default: 3, min: 0 },
  statePermitHatchback: { type: Number, default: 300, min: 0 },
  statePermitSedan: { type: Number, default: 400, min: 0 },
  statePermitSuv: { type: Number, default: 500, min: 0 },
  statePermitTraveller: { type: Number, default: 800, min: 0 },
  driverAllowancePerDay: { type: Number, default: 300, min: 0 },
  minOutstationKmPerDay: { type: Number, default: 250, min: 0 },
  freeKmForAirport: { type: Number, default: 10, min: 0 },
  advancePaymentPercentage: { type: Number, default: 0.20, min: 0, max: 1 },

  // ── Booking Config ──
  cancellationWindowHours: { type: Number, default: 24, min: 0 },
  cancellationChargePercent: { type: Number, default: 0.20, min: 0, max: 1 },
  minBookingHoursAhead: { type: Number, default: 2, min: 0 },
  advanceBookingDays: { type: Number, default: 30, min: 1 },

  // ── Content ──
  content: { type: contentSchema, default: () => ({}) },

  // ── App Settings ──
  appVersion: { type: String, default: '1.0.0' },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'App is under maintenance. Please try again later.' },
  supportPhone: { type: String, default: '' },
  supportEmail: { type: String, default: 'support@joincab.com' },

  // ── Meta ──
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Auto-update updatedAt
appConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const AppConfig = mongoose.model('AppConfig', appConfigSchema);
export default AppConfig;
