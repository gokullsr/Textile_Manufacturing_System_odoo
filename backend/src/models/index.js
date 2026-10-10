/**
 * Mongoose Models index.
 * Consolidates all LoomIQ domain entities and sequence counters.
 */
const ProductionOrder = require('./ProductionOrder');
const Machine = require('./Machine');
const FabricRoll = require('./FabricRoll');
const MaterialStock = require('./MaterialStock');
const Counter = require('./Counter');

module.exports = {
  ProductionOrder,
  Machine,
  FabricRoll,
  MaterialStock,
  Counter,
};
