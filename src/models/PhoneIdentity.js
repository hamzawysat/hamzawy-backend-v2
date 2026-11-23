'use strict';

const mongoose = require('mongoose');

// Globally unique phone reservation shared by client and technician signup.
// Created in the same MongoDB transaction as the account and referral.
const phoneIdentitySchema = new mongoose.Schema({
  phone: { type: String, required: true, trim: true, match: /^01[0-9]{9}$/ },
  ownerRole: { type: String, enum: ['client', 'fanni'], required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true }
}, { timestamps: true, versionKey: false });

phoneIdentitySchema.index({ phone: 1 }, { unique: true });

module.exports = mongoose.models.PhoneIdentity || mongoose.model('PhoneIdentity', phoneIdentitySchema);
