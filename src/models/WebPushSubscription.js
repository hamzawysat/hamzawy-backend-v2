'use strict';

const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  recipientRole: { type: String, enum: ['client', 'fanni', 'admin'], required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { _id: false });

const subscriptionSchema = new mongoose.Schema({
  // Keep the original owner fields for backward compatibility with existing records.
  recipientRole: { type: String, enum: ['client', 'fanni', 'admin'], required: true, index: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  endpoint: { type: String, required: true, unique: true, maxlength: 2048 },
  keys: {
    p256dh: { type: String, required: true, maxlength: 200 },
    auth: { type: String, required: true, maxlength: 100 }
  },
  expirationTime: { type: Number, default: null },
  // One browser endpoint can belong to more than one signed-in account.
  recipients: { type: [recipientSchema], default: [] }
}, { timestamps: true });

subscriptionSchema.index({ recipientRole: 1, recipientId: 1 });
subscriptionSchema.index({ 'recipients.recipientRole': 1, 'recipients.recipientId': 1 });

module.exports = mongoose.model('WebPushSubscription', subscriptionSchema);
