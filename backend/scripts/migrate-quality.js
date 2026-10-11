/**
 * Idempotent Quality Stages & Gates Migration Script.
 * Backfills `stage`, `stageEnteredAt`, `stageHistory`, and updates legacy inspection records.
 * Running this script multiple times produces identical results with 0 unwanted mutations.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { FabricRoll } = require('../src/models');
const { STAGE_ORDER } = require('../src/config/qualityStages.config');

const migrateQuality = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/loomiq';
  console.log('🔄 Starting idempotent Module 4 Quality Stage Gates Migration...');
  console.log(`[DB] Connecting to ${mongoUri}...`);

  await mongoose.connect(mongoUri);
  console.log('[DB] Connected successfully.');

  const rolls = await FabricRoll.find().populate('machine');
  console.log(`📊 Found ${rolls.length} total fabric rolls in database.`);

  let migratedRollsCount = 0;
  let alreadyUpToDateCount = 0;
  let updatedInspectionsCount = 0;

  for (const roll of rolls) {
    let needsUpdate = false;
    const updates = {};

    // 1. Stage normalization
    let validStage = roll.stage;
    if (!validStage || !STAGE_ORDER.includes(validStage)) {
      if (roll.dispatchStatus === 'DISPATCHED' || roll.dispatchStatus === 'READY_FOR_DISPATCH') {
        validStage = 'FINAL';
      } else {
        validStage = 'GREY';
      }
      updates.stage = validStage;
      needsUpdate = true;
    }

    // 2. stageEnteredAt
    if (!roll.stageEnteredAt) {
      updates.stageEnteredAt = roll.createdAt || new Date();
      needsUpdate = true;
    }

    const currentEnteredAt = updates.stageEnteredAt || roll.stageEnteredAt || roll.createdAt || new Date();
    const machineCode = roll.machine ? roll.machine.code : null;

    // 3. stageHistory
    if (!roll.stageHistory || roll.stageHistory.length === 0) {
      updates.stageHistory = [
        {
          stage: validStage,
          machineCode,
          enteredAt: currentEnteredAt,
          exitedAt: null,
        },
      ];
      needsUpdate = true;
    }

    // 4. Inspections legacy schema normalization
    const currentInspections = roll.inspections || [];
    let inspectionsModified = false;
    const normalizedInspections = currentInspections.map((insp) => {
      let mod = false;
      const inspObj = insp.toObject ? insp.toObject() : { ...insp };

      if (!inspObj.stage || !STAGE_ORDER.includes(inspObj.stage)) {
        inspObj.stage = validStage;
        mod = true;
      }
      if (!Array.isArray(inspObj.defects)) {
        inspObj.defects = [];
        mod = true;
      }
      if (typeof inspObj.defectPoints !== 'number') {
        inspObj.defectPoints = 0;
        mod = true;
      }
      if (typeof inspObj.pointsPer100m !== 'number') {
        inspObj.pointsPer100m = 0;
        mod = true;
      }
      if (inspObj.isOverride === undefined) {
        inspObj.isOverride = false;
        mod = true;
      }
      if (!inspObj.machineCode && machineCode) {
        inspObj.machineCode = machineCode;
        mod = true;
      }

      if (mod) {
        inspectionsModified = true;
        updatedInspectionsCount++;
      }
      return inspObj;
    });

    if (inspectionsModified) {
      updates.inspections = normalizedInspections;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await FabricRoll.updateOne({ _id: roll._id }, { $set: updates });
      migratedRollsCount++;
    } else {
      alreadyUpToDateCount++;
    }
  }

  console.log('\n================ MIGRATION REPORT ================');
  console.log(`✅ Total Fabric Rolls Checked : ${rolls.length}`);
  console.log(`📦 Rolls Migrated / Updated   : ${migratedRollsCount}`);
  console.log(`✨ Rolls Already Up to Date   : ${alreadyUpToDateCount}`);
  console.log(`🔍 Legacy Inspections Updated  : ${updatedInspectionsCount}`);
  console.log('==================================================\n');

  await mongoose.disconnect();
  console.log('[DB] Migration completed. Database connection closed.');
};

if (require.main === module) {
  migrateQuality()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateQuality;
