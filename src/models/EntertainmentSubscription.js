'use strict';
const mongoose = require('mongoose');
const { createSubscriptionSchema } = require('./SubscriptionBase');
const schema = createSubscriptionSchema('iptv', {
  entertainmentDetails: {
    deviceType: { type: String, trim: true, maxlength: 100, default: '' },
    portalUrl: { type: String, trim: true, maxlength: 500, default: '' },
    usernameEncrypted: { type: String, select: false, default: '' },
    passwordEncrypted: { type: String, select: false, default: '' },
    allowedDevices: { type: Number, min: 1, max: 20, default: 1 }
  }
}, 'entertainment_subscriptions');
module.exports = mongoose.models.EntertainmentSubscription || mongoose.model('EntertainmentSubscription', schema);
