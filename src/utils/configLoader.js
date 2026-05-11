// src/utils/configLoader.js
// Loads dynamic config from DB, falls back to constants.js if DB not available
import AppConfig from '../models/AppConfig.js';
import {
  PRICING,
  LOCAL_PACKAGES,
  AIRPORT_BASE_PRICE,
  TAX_CONFIG,
  OUTSTATION_SURCHARGES,
  BOOKING_CONFIG,
  DISTANCE_CONFIG,
  VEHICLE_CAPACITY,
  VEHICLE_FEATURES,
  VEHICLE_TYPES
} from '../config/constants.js';
import logger from '../config/logger.js';

let cachedConfig = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the active app config from DB (with in-memory cache)
 * Falls back to constants.js if DB config not found
 */
export async function getAppConfig() {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig;
  }

  try {
    const dbConfig = await AppConfig.findOne({ configKey: 'MAIN' }).lean();
    if (dbConfig) {
      cachedConfig = dbConfig;
      cacheExpiry = now + CACHE_TTL;
      logger.debug('AppConfig loaded from DB');
      return dbConfig;
    }
  } catch (err) {
    logger.warn('Failed to load AppConfig from DB, using defaults', { error: err.message });
  }

  // Return defaults from constants.js
  return buildDefaultConfig();
}

/**
 * Invalidate the in-memory cache (call after admin updates config)
 */
export function invalidateConfigCache() {
  cachedConfig = null;
  cacheExpiry = 0;
  logger.info('AppConfig cache invalidated');
}

/**
 * Build a default config object from constants.js
 */
function buildDefaultConfig() {
  const vehiclePricing = Object.values(VEHICLE_TYPES).map(vt => ({
    vehicleType: vt,
    displayName: vt,
    perKmRateOneWay: PRICING[vt]?.perKmRateOneWay || 15,
    perKmRateRoundTrip: PRICING[vt]?.perKmRateRoundTrip || 11,
    minFare: PRICING[vt]?.minFare || 300,
    nightChargeMultiplier: PRICING[vt]?.nightChargeMultiplier || 1.2,
    isActive: true,
    capacity: VEHICLE_CAPACITY[vt] || { passengers: 4, luggage: 2 },
    features: VEHICLE_FEATURES[vt] || ['AC', 'Music System'],
    modelExamples: [],
    description: '',
    bestFor: ''
  }));

  const localPackages = Object.entries(LOCAL_PACKAGES).map(([key, pkg]) => {
    const vehicles = Object.values(VEHICLE_TYPES)
      .filter(vt => pkg[vt.toLowerCase()] !== undefined)
      .map(vt => ({
        vehicleType: vt,
        basePrice: pkg[vt.toLowerCase()] || 0,
        extraKmCharge: pkg.extraKmCharge?.[vt.toLowerCase()] || 0,
        extraHourCharge: pkg.extraHourCharge?.[vt.toLowerCase()] || 0
      }));
    return {
      packageKey: key,
      hours: pkg.hours,
      km: pkg.km,
      vehicles,
      isActive: true
    };
  });

  const airportPrices = Object.entries(AIRPORT_BASE_PRICE).map(([vt, price]) => ({
    vehicleType: vt,
    basePrice: price
  }));

  return {
    vehiclePricing,
    localPackages,
    airportPrices,
    gstRate: TAX_CONFIG.GST_RATE,
    tollPerKm: OUTSTATION_SURCHARGES.TOLL_PER_KM || 3,
    statePermitHatchback: OUTSTATION_SURCHARGES.STATE_PERMIT_HATCHBACK || 300,
    statePermitSedan: OUTSTATION_SURCHARGES.STATE_PERMIT_SEDAN || 400,
    statePermitSuv: OUTSTATION_SURCHARGES.STATE_PERMIT_SUV || 500,
    statePermitTraveller: OUTSTATION_SURCHARGES.STATE_PERMIT_TRAVELLER || 800,
    driverAllowancePerDay: 300,
    minOutstationKmPerDay: DISTANCE_CONFIG.MIN_OUTSTATION_KM_PER_DAY || 250,
    freeKmForAirport: DISTANCE_CONFIG.FREE_KM_FOR_AIRPORT || 10,
    advancePaymentPercentage: BOOKING_CONFIG.ADVANCE_PAYMENT_PERCENTAGE || 0.20,
    cancellationWindowHours: BOOKING_CONFIG.CANCELLATION_WINDOW_HOURS || 24,
    cancellationChargePercent: BOOKING_CONFIG.CANCELLATION_CHARGE_PERCENT || 0.20,
    minBookingHoursAhead: BOOKING_CONFIG.MIN_BOOKING_HOURS_AHEAD || 2,
    advanceBookingDays: BOOKING_CONFIG.ADVANCE_BOOKING_DAYS || 30,
    content: {
      termsAndConditions: '',
      privacyPolicy: '',
      refundPolicy: '',
      faqJson: '[]',
      contactEmail: 'support@joincab.com',
      contactPhone: '',
      aboutUs: ''
    },
    appVersion: '1.0.0',
    maintenanceMode: false,
    maintenanceMessage: '',
    supportPhone: '',
    supportEmail: 'support@joincab.com'
  };
}

/**
 * Seed the DB with default config if none exists
 */
export async function seedDefaultConfig() {
  try {
    const existing = await AppConfig.findOne({ configKey: 'MAIN' });
    if (existing) {
      logger.info('AppConfig already exists in DB, skipping seed');
      return existing;
    }

    const defaults = buildDefaultConfig();
    const config = await AppConfig.create({ configKey: 'MAIN', ...defaults });
    logger.info('Default AppConfig seeded to DB');
    return config;
  } catch (err) {
    logger.error('Failed to seed AppConfig', { error: err.message });
  }
}
