/**
 * Counter Model.
 * Provides atomic sequential counters for business identifier generation (e.g. Fabric Roll IDs).
 */
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Atomically increments and returns the next sequential number for a given counter name.
 */
counterSchema.statics.getNextSequence = async function (counterName) {
  const result = await this.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result.seq;
};

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
