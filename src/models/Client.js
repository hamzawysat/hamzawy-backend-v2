'use strict';

const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: /^01[0-9]{9}$/
  },
  // HMAC-only signup signals used for referral fraud review; raw IP/UA are never persisted.
  registrationIpHash: { type: String, default: '', select: false },
  registrationUserAgentHash: { type: String, default: '', select: false },
  registrationDeviceIdHash: { type: String, default: '', select: false },
  lastDeviceIdHash: { type: String, default: '', select: false },
  lastLoginIpHash: { type: String, default: '', select: false },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  tokenVersion: { type: Number, default: 0, min: 0 },
  mustChangePassword: { type: Boolean, default: false, index: true },
  walletBalance: { type: Number, default: 0, min: 0 },
  walletFrozen: { type: Boolean, default: false, index: true },
  walletFrozenAt: { type: Date, default: null },
  walletFrozenReason: { type: String, trim: true, maxlength: 500, default: '' },
  status: {
    type: String,
    enum: ['نشط', 'معلق'],
    default: 'نشط',
    index: true
  },

  // Soft archive metadata. The Client document and all related records remain intact.
  // archivedAt is the single source of truth; null means the account is active.
  archivedAt: { type: Date, default: null, index: true },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni', default: null },
  archivedByName: { type: String, trim: true, maxlength: 120, default: '' },
  archiveReason: { type: String, trim: true, maxlength: 1000, default: '' },

  adminNote: { type: String, trim: true, maxlength: 2000, default: '' },
  adminNotesHistory: [{
    note: { type: String, trim: true, maxlength: 2000, required: true },
    date: { type: Date, default: Date.now },
    by: { type: String, trim: true, maxlength: 50, default: 'الإدارة' },
    byId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni' }
  }]
}, {
  timestamps: true
});

clientSchema.index({ archivedAt: 1, createdAt: -1 });

clientSchema.methods.toSafeJSON = function () {
  const data = this.toObject();
  delete data.passwordHash;
  delete data.tokenVersion;
  delete data.__v;
  return data;
};

module.exports = mongoose.model('Client', clientSchema);
