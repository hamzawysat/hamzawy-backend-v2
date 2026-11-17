'use strict';

const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  status: { type: String, enum: ['accepted', 'partial', 'failed', 'no_devices', 'not_configured', 'error'], default: 'no_devices' },
  attempted: { type: Number, min: 0, default: 0 },
  accepted: { type: Number, min: 0, default: 0 },
  failed: { type: Number, min: 0, default: 0 },
  attempts: { type: Number, min: 0, default: 0 },
  lastAttemptAt: { type: Date, default: null },
  lastError: { type: String, trim: true, maxlength: 240, default: '' }
}, { _id: false });

const schema = new mongoose.Schema({
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true, unique: true, index: true },
  recipientRole: { type: String, enum: ['client', 'fanni', 'admin'], required: true, index: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  type: { type: String, required: true, maxlength: 50, index: true },
  channels: {
    expo: { type: channelSchema, default: () => ({}) },
    fcm: { type: channelSchema, default: () => ({}) },
    webPush: { type: channelSchema, default: () => ({}) }
  },
  overallStatus: { type: String, enum: ['accepted', 'partial', 'failed', 'no_devices', 'error'], default: 'no_devices', index: true },
  lastAttemptAt: { type: Date, default: null, index: true },
  nextAttemptAt: { type: Date, default: null, index: true },
  retryLockUntil: { type: Date, default: null, index: true }
}, { timestamps: true });

schema.index({ createdAt: -1 });
schema.index({ recipientRole: 1, recipientId: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationDelivery', schema);
