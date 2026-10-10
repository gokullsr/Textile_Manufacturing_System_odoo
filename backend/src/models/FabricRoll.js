/**
 * FabricRoll Mongoose Model.
 * Represents an individual fabric roll with digital QR passport identity,
 * quality inspection audit trail, and dispatch status tracking.
 */
const mongoose = require('mongoose');
const { ROLL_LIMITS, ROLL_ID_REGEX } = require('../config/thresholds');

const QUALITY_STATUSES = ['PENDING', 'PASS', 'REWORK', 'REJECT'];
const DISPATCH_STATUSES = ['NOT_DISPATCHED', 'READY_FOR_DISPATCH', 'DISPATCHED'];

const inspectionHistorySchema = new mongoose.Schema(
  {
    result: {
      type: String,
      required: true,
      enum: ['PASS', 'REWORK', 'REJECT'],
    },
    defectNotes: {
      type: String,
      trim: true,
      maxlength: ROLL_LIMITS.MAX_DEFECT_NOTES_LENGTH,
      default: '',
    },
    inspectorName: {
      type: String,
      trim: true,
      maxlength: ROLL_LIMITS.MAX_INSPECTOR_NAME_LENGTH,
      default: null,
    },
    inspectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: true }
);

const fabricRollSchema = new mongoose.Schema(
  {
    rollId: {
      type: String,
      required: [true, 'Roll ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [ROLL_ID_REGEX, 'Roll ID format is invalid'],
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductionOrder',
      required: [true, 'Production order reference is required'],
      index: true,
    },
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      required: [true, 'Originating machine reference is required'],
      index: true,
    },
    quantityMetres: {
      type: Number,
      required: [true, 'Quantity in metres is required'],
      min: [ROLL_LIMITS.MIN_QUANTITY_METRES, `Quantity must be at least ${ROLL_LIMITS.MIN_QUANTITY_METRES} m`],
      max: [ROLL_LIMITS.MAX_QUANTITY_METRES, `Quantity cannot exceed ${ROLL_LIMITS.MAX_QUANTITY_METRES} m`],
    },
    qualityStatus: {
      type: String,
      required: true,
      enum: {
        values: QUALITY_STATUSES,
        message: '{VALUE} is not a valid quality status',
      },
      default: 'PENDING',
      index: true,
    },
    defectNotes: {
      type: String,
      trim: true,
      maxlength: ROLL_LIMITS.MAX_DEFECT_NOTES_LENGTH,
      default: '',
    },
    inspectedAt: {
      type: Date,
      default: null,
    },
    inspections: {
      type: [inspectionHistorySchema],
      default: [],
    },
    dispatchStatus: {
      type: String,
      required: true,
      enum: {
        values: DISPATCH_STATUSES,
        message: '{VALUE} is not a valid dispatch status',
      },
      default: 'NOT_DISPATCHED',
      index: true,
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative'],
      default: 0,
    },
    stage: {
      type: String,
      trim: true,
      default: 'finished',
    },
    producedAt: {
      type: Date,
      required: true,
      default: Date.now,
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

// Backward compatibility alias for legacy 'productionOrder' and 'length'
fabricRollSchema.virtual('productionOrder').get(function () {
  return this.order;
});

fabricRollSchema.virtual('length').get(function () {
  return this.quantityMetres;
});

// Pre-validate synchronization
fabricRollSchema.pre('validate', function (next) {
  if (!this.order && this.productionOrder) {
    this.order = this.productionOrder;
  }
  if (this.quantityMetres === undefined && this.length !== undefined) {
    this.quantityMetres = this.length;
  }
  next();
});

const FabricRoll = mongoose.model('FabricRoll', fabricRollSchema);

module.exports = FabricRoll;
