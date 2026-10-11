/**
 * Invitation Mongoose Model.
 * Represents single-use manager onboarding invitations stored by SHA-256 hash.
 */
const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    role: {
      type: String,
      required: true,
      enum: ['manager'],
      default: 'manager',
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
      index: true,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Invitation = mongoose.model('Invitation', invitationSchema);

module.exports = Invitation;
