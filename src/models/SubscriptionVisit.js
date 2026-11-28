'use strict';
const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  subscription: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni', default: null, index: true },
  scheduledAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['requested','scheduled','in_progress','awaiting_client_confirmation','completed','cancelled'], default: 'scheduled', index: true },
  workDescription: { type: String, trim: true, maxlength: 2000, default: '' },
  technicianCompletedAt: { type: Date, default: null },
  clientConfirmedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  createdBy: { type: String, trim: true, maxlength: 100, default: 'الإدارة' }
}, { timestamps: true });
schema.index({ technician: 1, scheduledAt: 1, status: 1 });
module.exports = mongoose.models.SubscriptionVisit || mongoose.model('SubscriptionVisit', schema);
