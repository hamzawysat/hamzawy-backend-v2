'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  type: { type: String, enum: ['maintenance','air_network','iptv'], required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  price: { type: Number, min: 0, max: 100000000, required: true },
  durationDays: { type: Number, min: 1, max: 3650, required: true },
  visitCount: { type: Number, min: 0, max: 100, default: 0 },
  includedServices: [{ type: String, trim: true, maxlength: 160 }],
  excludedSupplies: [{ type: String, trim: true, maxlength: 160 }],
  allowedDevices: { type: Number, min: 1, max: 20, default: 1 },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
schema.index({ type: 1, active: 1, createdAt: -1 });
module.exports = mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', schema);
