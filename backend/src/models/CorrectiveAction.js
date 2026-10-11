/**
 * CorrectiveAction Mongoose Model (CAPA Loop).
 * Tracks root-cause investigations, corrective actions, and recurrence auditing.
 */
const mongoose = require('mongoose');
const { STAGE_ORDER } = require('../config/qualityStages.config');

const CA_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED'];
const ROOT_CAUSE_CATEGORIES = [
  'MACHINE',
  'MATERIAL',
  'METHOD',
  'OPERATOR',
  'ENVIRONMENT',
  'UNKNOWN',
];

const correctiveActionSchema = new mongoose.Schema(
  {
    actionNumber: {
      type: String,
      required: [true, 'Action number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    stage: {
      type: String,
      required: [true, 'Originating stage is required'],
      enum: {
        values: STAGE_ORDER,
        message: '{VALUE} is not a valid stage',
      },
      index: true,
    },
    defectCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      default: null,
      index: true,
    },
    sourceRoll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FabricRoll',
      default: null,
      index: true,
    },
    rootCauseCategory: {
      type: String,
      required: true,
      enum: {
        values: ROOT_CAUSE_CATEGORIES,
        message: '{VALUE} is not a valid root cause category',
      },
      default: 'UNKNOWN',
    },
    description: {
      type: String,
      required: [true, 'Description / action plan is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    owner: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
      maxlength: [100, 'Owner name cannot exceed 100 characters'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: CA_STATUSES,
        message: '{VALUE} is not a valid action status',
      },
      default: 'OPEN',
      index: true,
    },
    verificationNote: {
      type: String,
      trim: true,
      maxlength: [1000, 'Verification note cannot exceed 1000 characters'],
      default: null,
    },
    doneAt: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
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

const CorrectiveAction = mongoose.model('CorrectiveAction', correctiveActionSchema);

module.exports = {
  CorrectiveAction,
  CA_STATUSES,
  ROOT_CAUSE_CATEGORIES,
};
