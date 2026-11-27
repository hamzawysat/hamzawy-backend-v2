'use strict';
const mongoose = require('mongoose');
const { createSubscriptionSchema } = require('./SubscriptionBase');
const schema = createSubscriptionSchema('air_network', {
  localDetails: {
    networkName: { type: String, trim: true, maxlength: 120, default: '' },
    activationCode: { type: String, trim: true, maxlength: 120, default: '' },
    deviceType: { type: String, trim: true, maxlength: 100, default: '' }
  }
}, 'local_subscriptions');
module.exports = mongoose.models.LocalSubscription || mongoose.model('LocalSubscription', schema);
