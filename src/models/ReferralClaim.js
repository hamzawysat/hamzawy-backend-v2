'use strict';

const mongoose = require('mongoose');

const referralClaimSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  kind: { type: String, enum: ['fanni'], required: true, default: 'fanni', index: true },
  inviter: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni', required: true, index: true },
  inviteCodeUsed: { type: String, required: true, maxlength: 50 },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  claimedAt: { type: Date, default: null, index: true },
  invitee: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni', default: null }
}, { timestamps: true, versionKey: false });

referralClaimSchema.index({ inviter: 1, createdAt: -1 });

module.exports = mongoose.models.ReferralClaim || mongoose.model('ReferralClaim', referralClaimSchema);
