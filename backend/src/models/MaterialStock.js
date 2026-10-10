/**
 * MaterialStock Mongoose Model.
 * Represents inventory items (raw fibers, yarns, dyes, chemicals, packaging).
 */
const mongoose = require('mongoose');

const STOCK_UNITS = ['kg', 'meters', 'liters', 'cones', 'bags', 'rolls'];

const materialStockSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Material name is required'],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'Material SKU / Code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    quantityOnHand: {
      type: Number,
      required: [true, 'Quantity on hand is required'],
      min: [0, 'Quantity on hand cannot be negative'],
      default: 0,
    },
    unit: {
      type: String,
      required: [true, 'Measurement unit is required'],
      enum: {
        values: STOCK_UNITS,
        message: '{VALUE} is not a supported stock unit',
      },
      default: 'kg',
    },
    reorderLevel: {
      type: Number,
      required: [true, 'Reorder level is required'],
      min: [0, 'Reorder level cannot be negative'],
      default: 100,
    },
    supplier: {
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

const MaterialStock = mongoose.model('MaterialStock', materialStockSchema);

module.exports = MaterialStock;
