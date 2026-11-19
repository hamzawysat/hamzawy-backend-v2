'use strict';

const mongoose = require('mongoose');

const duplicateAttemptSchema = new mongoose.Schema({
  applicantName: { type: String, trim: true, maxlength: 100, required: true },
  applicantPhone: { type: String, trim: true, maxlength: 20, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['قيد مراجعة الأدمن', 'تكرار مؤكد', 'تم السماح بعد المراجعة'], default: 'قيد مراجعة الأدمن' },
  reviewedAt: Date,
  consumedAt: Date,
  reviewedBy: { type: String, maxlength: 100 },
  reviewNote: { type: String, maxlength: 500 }
}, { _id: true });

const fanniCardLedgerSchema = new mongoose.Schema({
  nationalIdHash: { type: String, required: true, unique: true },
  nationalIdEncrypted: { type: String, required: true, select: false },
  fanniId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni', default: null, index: true },
  fanniName: { type: String, required: true, trim: true, maxlength: 100, index: true },
  linkedTechnicians: [{ fanniId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni' }, name: { type: String, trim: true, maxlength: 100 }, phone: { type: String, trim: true, maxlength: 20 }, linkedAt: { type: Date, default: Date.now } }],
  extractedName: { type: String, trim: true, maxlength: 100, default: '' },
  firstRegisteredAt: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['مسجلة', 'تحت مراجعة التكرار'], default: 'مسجلة', index: true },
  duplicateAttempts: { type: [duplicateAttemptSchema], default: [] },
  lastReviewedAt: Date,
  lastReviewedBy: { type: String, maxlength: 100 },
  lastReviewNote: { type: String, maxlength: 500 }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.FanniCardLedger || mongoose.model('FanniCardLedger', fanniCardLedgerSchema);
