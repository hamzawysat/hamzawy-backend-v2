'use strict';

const mongoose = require('mongoose');

const storeProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  sourceId: { type: String, trim: true, maxlength: 120, default: '' },
  imageStatus: { type: String, trim: true, maxlength: 200, default: '' },
  category: { type: String, trim: true, maxlength: 80, default: 'غير مصنف', index: true },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  details: { type: String, trim: true, maxlength: 5000, default: '' },
  price: { type: Number, required: true, min: 0, max: 100000000 },
  originalPrice: { type: Number, min: 0, max: 100000000, default: null },
  offerText: { type: String, trim: true, maxlength: 200, default: '' },
  type: { type: String, enum: ['product', 'subscription'], default: 'product', index: true },
  subscriptionDuration: { type: String, trim: true, maxlength: 60, default: '' },
  imageUrl: { type: String, trim: true, maxlength: 1000, default: '' },
  imageFileId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  isActive: { type: Boolean, default: true, index: true },
  isAdvertised: { type: Boolean, default: false, index: true },
  adAudience: { type: String, enum: ['both', 'client', 'fanni'], default: 'both' },
  adPriority: { type: Number, min: 0, max: 100, default: 0 },
  adExpiresAt: { type: Date, default: null },
  stock: { type: Number, min: 0, default: null }
}, { timestamps: true });

storeProductSchema.index({ isActive: 1, createdAt: -1 });
module.exports = mongoose.model('StoreProduct', storeProductSchema);
