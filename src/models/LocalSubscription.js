'use strict';
const mongoose = require('mongoose');
const Base = require('./UnifiedSubscription');
const schema = new mongoose.Schema({
  localDetails: {
    networkName: { type: String, trim: true, maxlength: 120, default: '' },
    activationCode: { type: String, trim: true, maxlength: 120, default: '' },
    deviceType: { type: String, trim: true, maxlength: 100, default: '' }
  }
}, { _id: false });
module.exports = mongoose.models.LocalSubscription || Base.discriminator('LocalSubscription', schema, 'air_network');
