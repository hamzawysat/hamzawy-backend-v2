'use strict';

const express = require('express');
const mongoose = require('mongoose');

function createAdminStoreRouter({ auth, Joi, StoreProduct, StoreOrder, AdminConfig, notifyAdmins, createNotification, writeAdminAudit }) {
  const router = express.Router();
  const productSchema = Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    description: Joi.string().trim().max(2000).allow('').default(''),
    details: Joi.string().trim().max(5000).allow('').default(''),
    price: Joi.number().min(0).max(100000000).required(),
    originalPrice: Joi.number().min(0).max(100000000).allow(null).default(null),
    offerText: Joi.string().trim().max(200).allow('').default(''),
    type: Joi.string().valid('product', 'subscription').default('product'),
    subscriptionDuration: Joi.string().trim().max(60).allow('').default(''),
    imageUrl: Joi.string().max(1000).allow('').custom((value, helpers) => { if (!value || /^https?:\/\//i.test(value) || /^\/api\/store\/media\/[a-f0-9]{24}$/i.test(value)) return value; return helpers.error('string.uri'); }).default(''),
    imageFileId: Joi.string().hex().length(24).allow(null).default(null),
    isActive: Joi.boolean().default(true),
    isAdvertised: Joi.boolean().default(false),
    adAudience: Joi.string().valid('both', 'client', 'fanni').default('both'),
    adPriority: Joi.number().integer().min(0).max(100).default(0),
    adExpiresAt: Joi.date().iso().allow(null).default(null),
    stock: Joi.number().integer().min(0).allow(null).default(null)
  }).unknown(false);
  async function hasValidImageReference(value) {
    const imageUrl = String(value.imageUrl || '');
    const mediaPrefix = '/api/store/media/';
    const pathId = imageUrl.startsWith(mediaPrefix) ? imageUrl.slice(mediaPrefix.length) : '';
    const internalPath = /^[a-f0-9]{24}$/i.test(pathId) ? pathId : null;
    if (!value.imageFileId) return !imageUrl.startsWith(mediaPrefix);
    if (!internalPath || internalPath.toLowerCase() !== String(value.imageFileId).toLowerCase()) return false;
    if (!mongoose.connection.db) return false;
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const files = await bucket.find({
      _id: new mongoose.Types.ObjectId(value.imageFileId),
      'metadata.purpose': 'store-product'
    }).limit(1).toArray();
    return files.length === 1;
  }

  const statusSchema = Joi.object({
    status: Joi.string().valid('تم التواصل', 'قيد التجهيز', 'مكتمل', 'ملغي').required(),
    adminNote: Joi.string().trim().max(1000).allow('').default(''),
    paymentMethod: Joi.string().valid('غير محدد', 'محفظة العميل', 'عند الاستلام', 'تحويل').default('غير محدد')
  }).unknown(false);

  router.post('/store/media', auth('admin'), async (req, res, next) => {
    try {
      const buffer = Buffer.isBuffer(req.body) ? req.body : null;
      const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
      const signatures = {
        'image/jpeg': value => value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff,
        'image/png': value => value.length >= 8 && value.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        'image/webp': value => value.length >= 12 && value.toString('ascii', 0, 4) === 'RIFF' && value.toString('ascii', 8, 12) === 'WEBP'
      };
      if (!buffer || !buffer.length || buffer.length > 5 * 1024 * 1024 || !signatures[contentType] || !signatures[contentType](buffer)) {
        return res.status(400).json({ message: 'ارفع صورة JPG أو PNG أو WebP سليمة، وبحجم لا يتجاوز 5 ميجابايت.' });
      }
      if (!mongoose.connection.db) return res.status(503).json({ message: 'قاعدة البيانات غير متاحة حاليًا.' });
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
      const extension = contentType === 'image/jpeg' ? '.jpg' : contentType === 'image/png' ? '.png' : '.webp';
      const upload = bucket.openUploadStream('store-product-' + Date.now() + extension, {
        contentType,
        metadata: { purpose: 'store-product', uploadedBy: String(req.user?._id || ''), createdAt: new Date() }
      });
      const completed = new Promise((resolve, reject) => {
        upload.once('finish', resolve);
        upload.once('error', reject);
      });
      upload.end(buffer);
      await completed;
      const imageFileId = String(upload.id);
      await writeAdminAudit(req, 'رفع صورة منتج إلى MongoDB', 'store-media', imageFileId, contentType + ' ' + buffer.length + ' bytes');
      return res.status(201).json({ imageFileId, imageUrl: '/api/store/media/' + imageFileId, size: buffer.length, contentType });
    } catch (error) { return next(error); }
  });

  router.get('/store/ad-settings', auth('admin'), async (req, res, next) => {
    try {
      const config = await AdminConfig.findOne({ key: 'main' }).select('storeAdRotationSeconds').lean();
      const configuredSeconds = Number(config?.storeAdRotationSeconds);
      const rotationSeconds = Number.isInteger(configuredSeconds) && configuredSeconds >= 5 && configuredSeconds <= 60 ? configuredSeconds : 5;
      return res.set('Cache-Control', 'no-store').json({ rotationSeconds });
    } catch (error) { return next(error); }
  });
  router.put('/store/ad-settings', auth('admin'), async (req, res, next) => {
    try {
      const checked = Joi.object({ rotationSeconds: Joi.number().integer().valid(5, 10, 15, 20, 30, 45, 60).required() }).required().validate(req.body || {}, { abortEarly: false, stripUnknown: true });
      if (checked.error) return res.status(400).json({ message: 'اختار مدة عرض من 5 إلى 60 ثانية.' });
      const config = await AdminConfig.findOneAndUpdate({ key: 'main' }, { $set: { storeAdRotationSeconds: checked.value.rotationSeconds } }, { new: true, upsert: true, setDefaultsOnInsert: true });
      await writeAdminAudit(req, 'تعديل مدة عرض إعلان المتجر', 'store', 'ad-rotation', String(checked.value.rotationSeconds) + ' ثانية');
      return res.set('Cache-Control', 'no-store').json({ message: 'تم حفظ مدة عرض الإعلان.', rotationSeconds: Number(config.storeAdRotationSeconds) || checked.value.rotationSeconds });
    } catch (error) { return next(error); }
  });
  router.get('/store/products', auth('admin'), async (req, res, next) => {
    try {
      const products = await StoreProduct.find({}).sort({ createdAt: -1 }).limit(500).lean();
      return res.set('Cache-Control', 'no-store').json({ products });
    } catch (error) { return next(error); }
  });
  router.post('/store/products', auth('admin'), async (req, res, next) => {
    try {
      const checked = productSchema.validate(req.body || {}, { abortEarly: false });
      if (checked.error) return res.status(400).json({ message: 'راجع اسم المنتج والسعر وباقي البيانات.' });
      if (!await hasValidImageReference(checked.value)) return res.status(400).json({ message: 'مرجع صورة المنتج غير صالح أو الصورة غير موجودة في MongoDB.' });
      const product = await StoreProduct.create(checked.value);
      await writeAdminAudit(req, 'إضافة منتج للمتجر', 'store', String(product._id), product.name);
      return res.status(201).json({ message: 'تمت إضافة المنتج للمتجر.', product });
    } catch (error) { return next(error); }
  });
  router.put('/store/products/:id', auth('admin'), async (req, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) return res.status(400).json({ message: 'معرّف المنتج غير صالح.' });
      const checked = productSchema.validate(req.body || {}, { abortEarly: false });
      if (checked.error) return res.status(400).json({ message: 'راجع بيانات المنتج.' });
      if (!await hasValidImageReference(checked.value)) return res.status(400).json({ message: 'مرجع صورة المنتج غير صالح أو الصورة غير موجودة في MongoDB.' });
      const product = await StoreProduct.findByIdAndUpdate(req.params.id, { $set: checked.value }, { new: true, runValidators: true });
      if (!product) return res.status(404).json({ message: 'المنتج غير موجود.' });
      await writeAdminAudit(req, 'تعديل منتج المتجر', 'store', String(product._id), product.name);
      return res.json({ message: 'تم تحديث المنتج.', product });
    } catch (error) { return next(error); }
  });
  router.delete('/store/products/:id', auth('admin'), async (req, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) return res.status(400).json({ message: 'معرّف المنتج غير صالح.' });
      const product = await StoreProduct.findById(req.params.id);
      if (!product) return res.status(404).json({ message: 'المنتج غير موجود.' });
      const linkedOrders = await StoreOrder.countDocuments({ product: product._id });
      if (linkedOrders > 0) return res.status(409).json({ message: 'لا يمكن حذف هذا المنتج نهائيًا لارتباطه بطلبات سابقة. يمكنك إخفاؤه بدلًا من حذفه للحفاظ على سجل الطلبات.' });
      await StoreProduct.deleteOne({ _id: product._id });
      await writeAdminAudit(req, 'حذف منتج من المتجر نهائيًا', 'store', String(product._id), product.name);
      return res.json({ message: 'تم حذف المنتج نهائيًا.' });
    } catch (error) { return next(error); }
  });
  router.get('/store/orders/count', auth('admin'), async (req, res, next) => {
    try {
      const pendingCount = await StoreOrder.countDocuments({ status: 'جديد' });
      return res.set('Cache-Control', 'no-store').json({ pendingCount });
    } catch (error) { return next(error); }
  });
  router.get('/store/orders', auth('admin'), async (req, res, next) => {
    try {
      const orders = await StoreOrder.find({}).sort({ createdAt: -1 }).limit(500).lean();
      return res.set('Cache-Control', 'no-store').json({ orders });
    } catch (error) { return next(error); }
  });
  router.patch('/store/orders/:id', auth('admin'), async (req, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) return res.status(400).json({ message: 'معرّف المعاملة غير صالح.' });
      const checked = statusSchema.validate(req.body || {}, { abortEarly: false });
      if (checked.error) return res.status(400).json({ message: 'حالة المعاملة غير صالحة.' });
      const order = await StoreOrder.findById(req.params.id);
      if (!order) return res.status(404).json({ message: 'المعاملة غير موجودة.' });
      if (order.status === 'ملغي' && checked.value.status !== 'ملغي') return res.status(409).json({ message: 'الطلب الملغي لا يمكن إعادة فتحه؛ سجّل طلبًا جديدًا عند الحاجة.' });
      if (checked.value.status === 'ملغي' && order.status !== 'ملغي' && order.stockReserved) {
        await StoreProduct.updateOne({ _id: order.product }, { $inc: { stock: order.quantity } });
        order.stockReserved = false;
      }
      order.status = checked.value.status;
      order.adminNote = checked.value.adminNote;
      order.paymentMethod = checked.value.paymentMethod;
      order.statusHistory.push({ status: order.status, note: order.adminNote, by: req.user?.name || 'الإدارة', at: new Date() });
      await order.save();
      await writeAdminAudit(req, 'تحديث حالة طلب متجر', 'store-orders', String(order._id), order.status);
      await createNotification({
        recipientRole: order.buyerRole, recipientId: order.buyerId,
        type: 'store_order_update', title: 'تحديث طلب المتجر',
        message: 'طلب ' + order.productName + ': ' + order.status + '، الدفع: ' + order.paymentMethod + (order.adminNote ? ' — ' + order.adminNote : ''),
        link: order.buyerRole === 'client' ? '/client?tab=store' : '/fanni?tab=store'
      });
      return res.json({ message: 'تم تحديث حالة الطلب وإرسال إشعار لصاحبه.', order });
    } catch (error) { return next(error); }
  });
  return router;
}

module.exports = createAdminStoreRouter;
