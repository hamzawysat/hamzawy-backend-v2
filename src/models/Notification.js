'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientRole: { type: String, enum: ['client', 'fanni', 'admin'], required: true, index: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  campaignId: { type: String, trim: true, maxlength: 100, index: true, default: undefined },
  type: { type: String, required: true, maxlength: 50 },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  message: { type: String, required: true, trim: true, maxlength: 300 },
  link: { type: String, trim: true, maxlength: 200, default: '' },
  readAt: { type: Date, default: null, index: true },
  isActive: { type: Boolean, default: true, index: true },
  relatedEntityType: { type: String, trim: true, maxlength: 50, default: '' },
  relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  dedupeKey: { type: String, trim: true, maxlength: 200, default: undefined },
  replyEnabled: { type: Boolean, default: false, index: true },
  reply: {
    message: { type: String, trim: true, maxlength: 1000 },
    senderRole: { type: String, enum: ['client', 'fanni'] },
    senderId: { type: mongoose.Schema.Types.ObjectId },
    sentAt: { type: Date }
  }
}, { timestamps: true });

notificationSchema.index({ recipientRole: 1, recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, recipientId: 1, isActive: 1, readAt: 1, updatedAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Notification', notificationSchema);
