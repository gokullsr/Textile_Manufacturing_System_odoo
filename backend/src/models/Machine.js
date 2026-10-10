/**
 * Machine Mongoose Model.
 * Represents factory equipment/machinery across spinning, weaving, dyeing, and finishing units.
 */
const mongoose = require('mongoose');

const MACHINE_TYPES = [
  'spinning_frame',
  'loom',
  'dyeing_vat',
  'finishing_range',
  'inspection_table',
  'packaging_machine',
  'knitting_machine',
];

const MACHINE_STATUSES = [
  'available',
  'running',
  'maintenance',
  'idle',
  'breakdown',
  'offline',
];

const machineSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Machine code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Machine name is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Machine type is required'],
      enum: {
        values: MACHINE_TYPES,
        message: '{VALUE} is not a valid machine type',
      },
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: MACHINE_STATUSES,
        message: '{VALUE} is not a valid machine status',
      },
      default: 'available',
      index: true,
    },
    dailyCapacity: {
      type: Number,
      min: [0, 'Daily capacity cannot be negative'],
    },
    capacity: {
      type: Number,
      min: [0, 'Capacity cannot be negative'],
    },
    capacityUnit: {
      type: String,
      default: 'meters',
      trim: true,
    },
    currentAssignedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductionOrder',
      default: null,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Synchronize dailyCapacity and legacy capacity
machineSchema.pre('validate', function (next) {
  if (this.dailyCapacity === undefined && this.capacity !== undefined) {
    this.dailyCapacity = this.capacity;
  }
  if (this.capacity === undefined && this.dailyCapacity !== undefined) {
    this.capacity = this.dailyCapacity;
  }
  next();
});

// Virtual alias for currentAssignedOrder -> currentOrder
machineSchema.virtual('currentOrder', {
  ref: 'ProductionOrder',
  localField: 'currentAssignedOrder',
  foreignField: '_id',
  justOne: true,
});

const Machine = mongoose.model('Machine', machineSchema);

module.exports = Machine;
