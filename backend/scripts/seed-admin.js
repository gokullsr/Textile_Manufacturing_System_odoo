/**
 * Script to provision the admin account into MongoDB database.
 * Sets email: admin@gmail.com, password: admin@123, role: owner
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { User } = require('../src/models');
const { hashPassword } = require('../src/utils/security');

async function seedAdmin() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/loomiq';
  console.log(`Connecting to MongoDB at: ${uri}`);

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected.');

    const email = 'admin@gmail.com';
    const rawPassword = 'admin@123';
    const name = 'Factory Administrator';
    const role = 'owner';

    const passwordHash = await hashPassword(rawPassword);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      existingUser.name = name;
      existingUser.passwordHash = passwordHash;
      existingUser.role = role;
      existingUser.isActive = true;
      await existingUser.save();
      console.log(`✅ Updated existing user ${email} with role: ${role} and updated password.`);
    } else {
      const newUser = new User({
        name,
        email,
        passwordHash,
        role,
        isActive: true,
      });
      await newUser.save();
      console.log(`✅ Created new user ${email} with role: ${role}.`);
    }

    console.log('\n--- CREDENTIALS READY ---');
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}`);
    console.log('Password set successfully.');
  } catch (err) {
    console.error('Failed to seed admin:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
}

seedAdmin();
