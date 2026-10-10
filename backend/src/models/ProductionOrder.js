/**
 * ProductionOrder Mongoose Model.
 * Represents a manufacturing work order tracking customer requirements, machine assignments, stages, and deadlines.
 */
const mongoose = require('mongoose');

const PRODUCTION_STATUSES = [
  'queued',
  'in_progress',
  'completed',
  'on_hold',
  'draft',
  'planned',
  'cancelled',
];

const PRODUCTION_STAGES = [
  'spinning',
  'weaving',
  'dyeing',
  'finishing',
  'quality_inspection',
  'packaging',
  'dispatched',
];

const PRIORITY_LEVELS = ['low', 'medium', 'high', 'urgent'];
const ORDER_UNITS = ['meters', 'yards', 'kg', 'rolls'];

const productionOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    customer: {
      type: String,
      required: [true, 'Customer / Buyer name is required'],
      trim: true,
    },
    fabricType: {
      type: String,
      required: [true, 'Product / Fabric type is required'],
      trim: true,
    },
    // Required quantity for production (kept in sync with quantity)
    requiredQuantity: {
      type: Number,
      required: [true, 'Required quantity is required'],
      min: [1, 'Quantity must be greater than 0'],
    },
    quantity: {
      type: Number,
      min: [1, 'Quantity must be greater than 0'],
    },
    // Produced quantity so far
    producedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Produced quantity cannot be negative'],
    },
    unit: {
      type: String,
      required: [true, 'Measurement unit is required'],
      enum: {
        values: ORDER_UNITS,
        message: '{VALUE} is not a supported unit',
      },
      default: 'meters',
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: PRODUCTION_STATUSES,
        message: '{VALUE} is not a valid order status',
      },
      default: 'queued',
      index: true,
    },
    currentStage: {
      type: String,
      required: true,
      enum: {
        values: PRODUCTION_STAGES,
        message: '{VALUE} is not a valid production stage',
      },
      default: 'weaving',
      index: true,
    },
    priority: {
      type: String,
      required: true,
      enum: {
        values: PRIORITY_LEVELS,
        message: '{VALUE} is not a valid priority level',
      },
      default: 'medium',
    },
    assignedMachine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      default: null,
      index: true,
    },
    productionRatePerDay: {
      type: Number,
      min: [0.001, 'Production rate override must be positive'],
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
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

// Synchronize legacy `quantity` with `requiredQuantity` before validation/save
productionOrderSchema.pre('validate', function (next) {
  if (this.requiredQuantity === undefined && this.quantity !== undefined) {
    this.requiredQuantity = this.quantity;
  }
  if (this.quantity === undefined && this.requiredQuantity !== undefined) {
    this.quantity = this.requiredQuantity;
  }
  next();
});

// Buyer virtual alias for customer
productionOrderSchema.virtual('buyer').get(function () {
  return this.customer;
});

const ProductionOrder = mongoose.model('ProductionOrder', productionOrderSchema);

module.exports = ProductionOrder;
