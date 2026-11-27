'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['maintenance','air_network','iptv'], required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', default: null },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  clientName: { type: String, trim: true, maxlength: 100, default: '' },
  clientPhone: { type: String, trim: true, maxlength: 20, default: '' },
  address: { type: String, trim: true, maxlength: 500, default: '' },
  amount: { type: Number, min: 0, max: 100000000, required: true },
  durationDays: { type: Number, min: 1, max: 3650, required: true },
  startsAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['pending','active','paused','expired','cancelled'], default: 'active', index: true },
  dishSize: { type: String, trim: true, maxlength: 60, default: '' },
  receiverType: { type: String, trim: true, maxlength: 100, default: '' },
  deviceType: { type: String, trim: true, maxlength: 100, default: '' },
  networkName: { type: String, trim: true, maxlength: 120, default: '' },
  activationCode: { type: String, trim: true, maxlength: 120, default: '' },
  portalUrl: { type: String, trim: true, maxlength: 500, default: '' },
  iptvUsernameEncrypted: { type: String, select: false, default: '' },
  iptvPasswordEncrypted: { type: String, select: false, default: '' },
  allowedDevices: { type: Number, min: 1, max: 20, default: 1 },
  visitsIncluded: { type: Number, min: 0, max: 100, default: 0 },
  includedServices: [{ type: String, trim: true, maxlength: 160 }],
  excludedSupplies: [{ type: String, trim: true, maxlength: 160 }],
  notes: { type: String, trim: true, maxlength: 1500, default: '' },
  renewalRequest: { paymentMethod: { type: String, enum: ['wallet','transfer'] }, paymentStatus: { type: String, enum: ['pending','paid','rejected'], default: 'pending' }, requestedAt: { type: Date, default: null }, amount: { type: Number, min: 0, default: 0 } },
  history: [{ action: String, note: String, by: String, at: { type: Date, default: Date.now } }]
}, { timestamps: true, discriminatorKey: 'subscriptionModel' });
schema.index({ client: 1, status: 1, endsAt: 1 });
schema.index({ type: 1, status: 1, endsAt: 1 });
module.exports = mongoose.models.UnifiedSubscription || mongoose.model('UnifiedSubscription', schema);
