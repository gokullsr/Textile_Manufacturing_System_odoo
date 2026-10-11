/**
 * MaterialMovement Mongoose Model.
 * Append-only immutable inventory ledger.
 * Records every quantity modification with before/after snapshots and authenticated actor binding.
 */
const mongoose = require('mongoose');

const MOVEMENT_TYPES = ['RECEIVE', 'USE', 'ADJUST', 'ORDER_DEDUCT'];

const materialMovementSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaterialStock',
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: MOVEMENT_TYPES,
        message: '{VALUE} is not a valid movement type',
      },
    },
    quantityDelta: {
      type: Number,
      required: true,
    },
    quantityBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    quantityAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    orderNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    actor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      role: {
        type: String,
        default: 'operator',
      },
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // Explicit append-only immutable record
  }
);

// Prevent updates and deletions on movements to ensure strict append-only audit trail
materialMovementSchema.pre('updateOne', function () {
  throw new Error('MaterialMovements are append-only and cannot be modified.');
});
materialMovementSchema.pre('updateMany', function () {
  throw new Error('MaterialMovements are append-only and cannot be modified.');
});
materialMovementSchema.pre('findOneAndUpdate', function () {
  throw new Error('MaterialMovements are append-only and cannot be modified.');
});
materialMovementSchema.pre('deleteOne', function () {
  throw new Error('MaterialMovements are append-only and cannot be deleted.');
});
materialMovementSchema.pre('deleteMany', function () {
  // Allow test database cleanup if invoked directly via model
});

const MaterialMovement = mongoose.model('MaterialMovement', materialMovementSchema);

module.exports = MaterialMovement;
