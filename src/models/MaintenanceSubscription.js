'use strict';
const mongoose = require('mongoose');
const { createSubscriptionSchema } = require('./SubscriptionBase');
const schema = createSubscriptionSchema('maintenance', {
  maintenanceDetails: {
    dishSize: { type: String, trim: true, maxlength: 60, default: '' },
    receiverType: { type: String, trim: true, maxlength: 100, default: '' },
    visitsIncluded: { type: Number, min: 0, max: 100, default: 0 }
  }
}, 'maintenance_subscriptions');
module.exports = mongoose.models.MaintenanceSubscription || mongoose.model('MaintenanceSubscription', schema);
