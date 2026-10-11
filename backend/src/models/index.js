/**
 * Mongoose Models index.
 * Consolidates all LoomIQ domain entities and sequence counters.
 */
const ProductionOrder = require('./ProductionOrder');
const Machine = require('./Machine');
const FabricRoll = require('./FabricRoll');
const MaterialStock = require('./MaterialStock');
const Counter = require('./Counter');
const { CorrectiveAction } = require('./CorrectiveAction');

const User = require('./User');
const Session = require('./Session');
const Invitation = require('./Invitation');
const MaterialMovement = require('./MaterialMovement');

module.exports = {
  ProductionOrder,
  Machine,
  FabricRoll,
  MaterialStock,
  MaterialMovement,
  Counter,
  CorrectiveAction,
  User,
  Session,
  Invitation,
};
