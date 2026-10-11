/**
 * Owner Provisioning CLI Script.
 * Securely provisions the root factory owner account directly against MongoDB.
 * Never logs or echoes passwords to the console.
 * Refuses execution if an owner already exists unless --additional flag is passed.
 *
 * Usage:
 *   node backend/scripts/create-owner.js [--additional]
 *   or:
 *   npm --prefix backend run create-owner
 */
const readline = require('readline');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const { validatePasswordPolicy, hashPassword, logSecurityEvent } = require('../src/utils/security');

const askHidden = (query) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const stdin = process.openStdin();
    const onData = (char) => {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.removeListener('data', onData);
          break;
        default:
          process.stdout.write('\x1B[2K\x1B[200D' + query + '*'.repeat(rl.line.length));
          break;
      }
    };

    process.stdin.on('data', onData);

    rl.question(query, (value) => {
      rl.close();
      console.log(); // Newline
      resolve(value.trim());
    });
  });
};

const askPlain = (query) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (value) => {
      rl.close();
      resolve(value.trim());
    });
  });
};

const createOwner = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGODB_URI is not set in environment or backend/.env.');
    process.exit(1);
  }

  const allowAdditional = process.argv.includes('--additional');

  console.log('====================================================');
  console.log('🏭 LoomIQ Factory Owner Provisioning CLI');
  console.log('====================================================');

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.\n');

    // Existence check
    const existingOwnerCount = await User.countDocuments({ role: 'owner' });
    if (existingOwnerCount > 0 && !allowAdditional) {
      console.error(`❌ Provisioning Aborted: An owner account already exists in this database (${existingOwnerCount} found).`);
      console.error('To provision an additional owner account intentionally, run:');
      console.error('   npm --prefix backend run create-owner -- --additional\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Prompt for details
    const name = await askPlain('Enter Owner Full Name: ');
    if (!name || name.length < 2) {
      console.error('❌ Error: Name must be at least 2 characters long.');
      await mongoose.disconnect();
      process.exit(1);
    }

    const email = await askPlain('Enter Owner Email Address: ');
    const normalizedEmail = email ? email.toLowerCase().trim() : '';
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      console.error('❌ Error: Invalid email format.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Check if user with this email exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.error(`❌ Error: An account with email "${normalizedEmail}" already exists.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const password = await askHidden('Enter Secure Password (min 12 characters): ');
    const policy = validatePasswordPolicy(password, normalizedEmail);
    if (!policy.valid) {
      console.error(`❌ Error: ${policy.error}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const confirmPassword = await askHidden('Confirm Secure Password: ');
    if (password !== confirmPassword) {
      console.error('❌ Error: Passwords do not match.');
      await mongoose.disconnect();
      process.exit(1);
    }

    const passwordHash = await hashPassword(password);

    const owner = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'owner',
      isActive: true,
    });

    await owner.save();

    logSecurityEvent('OWNER_PROVISIONED_VIA_CLI', {
      userId: owner._id,
      email: normalizedEmail,
    });

    console.log('\n✅ Owner Account Provisioned Successfully!');
    console.log(`   - Name:  ${owner.name}`);
    console.log(`   - Email: ${owner.email}`);
    console.log(`   - Role:  ${owner.role}`);
    console.log('You can now log in at http://localhost:5173/login\n');

  } catch (error) {
    if (error.code === 11000) {
      console.error('\n❌ Error: An account with this email was just registered concurrently.');
    } else {
      console.error('\n❌ Fatal Error during owner creation:', error.message);
    }
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  createOwner();
}

module.exports = { createOwner };
