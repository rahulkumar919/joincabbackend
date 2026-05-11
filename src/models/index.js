// src/models/index.js
import mongoose from 'mongoose';
import logger from '../config/logger.js';

// Import all models
import User from './User.js';
import Vehicle from './Vehicle.js';
import Booking from './Booking.js';
import { Otp } from './Otp.js';
import Driver from './Driver.js';
import Payment from './Payment.js';
import AppConfig from './AppConfig.js';

// Log registered models
const registeredModels = mongoose.modelNames();
logger.info('Mongoose models registered:', { models: registeredModels });

// Export all models
export { User, Vehicle, Booking, Otp, Driver, Payment, AppConfig };

export default {
    User,
    Vehicle,
    Booking,
    Otp,
    Driver,
    Payment,
    AppConfig,
};