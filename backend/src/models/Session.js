/**
 * Session Mongoose Model.
 * Server-side opaque session token stored by SHA-256 hash with MongoDB TTL expiration.
 */
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL auto-cleanup
    },
    absoluteExpiresAt: {
      type: Date,
      required: true,
    },
    userAgent: {
      type: String,
      default: '',
    },
    ip: {
      type: String,
      default: '',
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

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
