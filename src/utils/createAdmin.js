/**
 * Script to create or update an admin user with email + password
 * Run: node src/utils/createAdmin.js
 *
 * Set these env vars before running (or edit directly below):
 *   ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URL;
const ADMIN_NAME     = process.env.ADMIN_NAME     || 'Super Admin';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@joincab.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const ADMIN_PHONE    = process.env.ADMIN_PHONE    || '9999999999';

if (!MONGO_URI) {
  console.error('❌  MONGO_URI not set in .env');
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log('✅  Connected to MongoDB');

// Dynamically import model after connection
const { default: User } = await import('../models/User.js');

// Check if admin already exists
let admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });

if (admin) {
  // Update existing admin - set password directly (will be hashed by pre-save hook)
  admin.name = ADMIN_NAME;
  admin.phoneNumber = ADMIN_PHONE;
  admin.role = 'ADMIN';
  admin.isActive = true;
  admin.isVerified = true;
  admin.adminPassword = ADMIN_PASSWORD; // Set plain password, model will hash it
  await admin.save();
} else {
  // Create new admin
  admin = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL.toLowerCase(),
    phoneNumber: ADMIN_PHONE,
    role: 'ADMIN',
    isActive: true,
    isVerified: true,
    adminPassword: ADMIN_PASSWORD, // Set plain password, model will hash it
  });
}

console.log(`✅  Admin user ready:`);
console.log(`    Name    : ${admin.name}`);
console.log(`    Email   : ${admin.email}`);
console.log(`    Phone   : ${admin.phoneNumber}`);
console.log(`    Password: ${ADMIN_PASSWORD}  ← change this after first login!`);

await mongoose.disconnect();
process.exit(0);
