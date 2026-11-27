'use strict';
const mongoose = require('mongoose');
const Base = require('./UnifiedSubscription');
const schema = new mongoose.Schema({
  entertainmentDetails: {
    deviceType: { type: String, trim: true, maxlength: 100, default: '' },
    portalUrl: { type: String, trim: true, maxlength: 500, default: '' },
    usernameEncrypted: { type: String, select: false, default: '' },
    passwordEncrypted: { type: String, select: false, default: '' },
    allowedDevices: { type: Number, min: 1, max: 20, default: 1 }
  }
}, { _id: false });
module.exports = mongoose.models.EntertainmentSubscription || Base.discriminator('EntertainmentSubscription', schema, 'iptv');
