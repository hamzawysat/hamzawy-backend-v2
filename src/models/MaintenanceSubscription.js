'use strict';
const mongoose = require('mongoose');
const Base = require('./UnifiedSubscription');
const schema = new mongoose.Schema({
  maintenanceDetails: {
    dishSize: { type: String, trim: true, maxlength: 60, default: '' },
    receiverType: { type: String, trim: true, maxlength: 100, default: '' },
    visitsIncluded: { type: Number, min: 0, max: 100, default: 0 }
  }
}, { _id: false });
module.exports = mongoose.models.MaintenanceSubscription || Base.discriminator('MaintenanceSubscription', schema, 'maintenance');
