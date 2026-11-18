'use strict';

const mongoose = require('mongoose');

const partyRewardSchema = new mongoose.Schema({
  amount: { type: Number, required: true, default: 50, min: 0 },
  paidAt: { type: Date, default: null },
  walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null }
}, { _id: false });

const referralSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, index: true },
  kind: { type: String, enum: ['client', 'fanni'], required: true, index: true },
  inviter: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  invitee: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  code: { type: String, required: true, unique: true, index: true },
  invitedAt: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['pending', 'in_progress', 'eligible', 'completed', 'rejected'], default: 'pending', index: true },
  completedCount: { type: Number, default: 0, min: 0 },
  requiredCount: { type: Number, required: true, enum: [1, 3] },
  inviterReward: { type: partyRewardSchema, default: () => ({ amount: 50 }) },
  inviteeReward: { type: partyRewardSchema, default: () => ({ amount: 50 }) },
  rejectedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni', default: null },
  rejectionReason: { type: String, trim: true, maxlength: 500, default: '' },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni', default: null }
}, { timestamps: true, versionKey: false });

referralSchema.index({ kind: 1, invitee: 1 }, { unique: true });
referralSchema.index({ status: 1, invitedAt: -1 });
referralSchema.index({ kind: 1, inviter: 1, invitedAt: -1 });

module.exports = mongoose.models.Referral || mongoose.model('Referral', referralSchema);
