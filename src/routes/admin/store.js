'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { normalizeStoreCategoryName, buildStoreCategories } = require('../../utils/storeCategories');

function createAdminStoreRouter({ auth, Joi, StoreProduct, StoreOrder, AdminConfig, notifyAdmins, createNotification, writeAdminAudit }) {
  const router = express.Router();
  const categorySchema = Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    imageUrl: Joi.string().max(1000).allow('').custom((value, helpers) => {
      if (!value || value.startsWith('http://') || value.startsWith('https://')) return value;
      const prefix = '/api/store/media/';
      if (value.startsWith(prefix) && /^[a-f0-9]{24}$/i.test(value.slice(prefix.length))) return value;
      return helpers.error('string.uri');
    }).default(''),
    imageFileId: Joi.string().hex().length(24).allow(null).default(null)
  }).unknown(false);
  const productSchema = Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    category: Joi.string().trim().max(80).allow('').default('عام'),
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


  async function hasValidCategoryImageReference(value) {
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
      'metadata.purpose': 'store-category'
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
      const isCategoryImage = String(req.query.purpose || '') === 'category';
      const purpose = isCategoryImage ? 'store-category' : 'store-product';
      if (req.query.purpose && !['category', 'product'].includes(String(req.query.purpose))) {
        return res.status(400).json({ message: 'نوع الصورة غير صالح.' });
      }
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
      const extension = contentType === 'image/jpeg' ? '.jpg' : contentType === 'image/png' ? '.png' : '.webp';
      const upload = bucket.openUploadStream((isCategoryImage ? 'store-category-' : 'store-product-') + Date.now() + extension, {
        contentType,
        metadata: { purpose, uploadedBy: String(req.user?._id || ''), createdAt: new Date() }
      });
      const completed = new Promise((resolve, reject) => {
        upload.once('finish', resolve);
        upload.once('error', reject);
      });
      upload.end(buffer);
      await completed;
      const imageFileId = String(upload.id);
      await writeAdminAudit(req, isCategoryImage ? 'رفع صورة قسم متجر إلى MongoDB' : 'رفع صورة منتج إلى MongoDB', isCategoryImage ? 'store-category-media' : 'store-media', imageFileId, contentType + ' ' + buffer.length + ' bytes');
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

  router.put('/store/categories/:name', auth('admin'), async (req, res, next) => {
    try {
      const oldName = normalizeStoreCategoryName(req.params.name);
      const checked = categorySchema.validate(req.body || {}, { abortEarly: false });
      if (!oldName || checked.error) return res.status(400).json({ message: 'راجع اسم القسم والصورة.' });
      if (!await hasValidCategoryImageReference(checked.value)) return res.status(400).json({ message: 'مرجع صورة القسم غير صالح أو الصورة غير موجودة في MongoDB.' });
      const newName = normalizeStoreCategoryName(checked.value.name);
      const config = await AdminConfig.findOne({ key: 'main' });
      const configured = Array.isArray(config?.storeCategories) ? config.storeCategories : [];
      const existingIndex = configured.findIndex(item => normalizeStoreCategoryName(item?.name) === oldName);
      const productExists = await StoreProduct.exists({ category: oldName });
      if (!productExists && existingIndex < 0) return res.status(404).json({ message: 'القسم غير موجود.' });
      if (newName !== oldName) {
        const productCollision = await StoreProduct.exists({ category: newName });
        const categoryCollision = configured.some((item, index) => index !== existingIndex && normalizeStoreCategoryName(item?.name) === newName);
        if (productCollision || categoryCollision) return res.status(409).json({ message: 'يوجد قسم آخر بهذا الاسم بالفعل.' });
        await StoreProduct.updateMany({ category: oldName }, { $set: { category: newName } });
      }
      const nextCategories = configured.map(item => typeof item?.toObject === 'function' ? item.toObject() : { ...item });
      const previousImageFileId = existingIndex >= 0 ? nextCategories[existingIndex].imageFileId : null;
      const entry = {
        name: newName,
        imageUrl: checked.value.imageUrl || '',
        imageFileId: checked.value.imageFileId ? new mongoose.Types.ObjectId(checked.value.imageFileId) : null,
        createdAt: existingIndex >= 0 ? nextCategories[existingIndex].createdAt || new Date() : new Date(),
        updatedAt: new Date()
      };
      if (existingIndex >= 0) nextCategories[existingIndex] = entry;
      else nextCategories.push(entry);
      const savedConfig = config || new AdminConfig({ key: 'main' });
      savedConfig.storeCategories = nextCategories;
      await savedConfig.save();
      if (previousImageFileId && String(previousImageFileId) !== String(entry.imageFileId || '') && mongoose.connection.db) {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
        await bucket.delete(new mongoose.Types.ObjectId(previousImageFileId)).catch(() => {});
      }
      await writeAdminAudit(req, newName === oldName ? 'تعديل إعدادات قسم المتجر' : 'إعادة تسمية قسم المتجر', 'store-categories', oldName, newName + (entry.imageUrl ? '؛ صورة مخصصة' : '؛ صورة تلقائية من المنتجات'));
      return res.set('Cache-Control', 'no-store').json({ message: 'تم حفظ إعدادات القسم.', category: { name: newName, imageUrl: entry.imageUrl, imageFileId: entry.imageFileId ? String(entry.imageFileId) : null } });
    } catch (error) { return next(error); }
  });

  router.delete('/store/categories/:name', auth('admin'), async (req, res, next) => {
    try {
      const name = normalizeStoreCategoryName(req.params.name);
      if (!name) return res.status(400).json({ message: 'اسم القسم غير صالح.' });
      if (name === 'عام') return res.status(400).json({ message: 'لا يمكن حذف قسم عام الافتراضي.' });
      const config = await AdminConfig.findOne({ key: 'main' });
      const configured = Array.isArray(config?.storeCategories) ? config.storeCategories : [];
      const existing = configured.find(item => normalizeStoreCategoryName(item?.name) === name);
      const productCount = await StoreProduct.countDocuments({ category: name });
      if (!existing && !productCount) return res.status(404).json({ message: 'القسم غير موجود.' });
      if (productCount) await StoreProduct.updateMany({ category: name }, { $set: { category: 'عام' } });
      if (config) {
        config.storeCategories = configured.filter(item => normalizeStoreCategoryName(item?.name) !== name);
        await config.save();
      }
      if (existing?.imageFileId && mongoose.connection.db) {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
        await bucket.delete(new mongoose.Types.ObjectId(existing.imageFileId)).catch(() => {});
      }
      await writeAdminAudit(req, 'حذف قسم من المتجر', 'store-categories', name, 'productsMovedTo=عام; productCount=' + productCount);
      return res.set('Cache-Control', 'no-store').json({ message: productCount ? 'تم حذف القسم ونقل منتجاته إلى قسم عام.' : 'تم حذف القسم.' , movedProducts: productCount });
    } catch (error) { return next(error); }
  });

  router.get('/store/products', auth('admin'), async (req, res, next) => {
    try {
      const [products, config] = await Promise.all([
        StoreProduct.find({}).sort({ createdAt: -1 }).limit(500).lean(),
        AdminConfig.findOne({ key: 'main' }).select('storeCategories').lean()
      ]);
      const categories = buildStoreCategories(products, config?.storeCategories, { includeEmpty: true });
      return res.set('Cache-Control', 'no-store').json({ products, categories });
    } catch (error) { return next(error); }
  });
  router.post('/store/products/import', auth('admin'), async (req, res, next) => {
    try {
      const rows = Array.isArray(req.body?.products) ? req.body.products : [];
      if (!rows.length || rows.length > 500) {
        return res.status(400).json({ message: 'ارفع من 1 إلى 500 منتج في الدفعة الواحدة.' });
      }
      const validRows = [];
      const errors = [];
      const duplicates = [];
      const seen = new Set();
      const normalizeKey = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
      const productKey = value => normalizeKey(value.name) + '::' + normalizeKey(value.category || 'عام');

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || {};
        const rowNumber = Number.isInteger(Number(row.rowNumber)) && Number(row.rowNumber) > 0 ? Number(row.rowNumber) : index + 2;
        const source = row.product && typeof row.product === 'object' && !Array.isArray(row.product) ? row.product : row;
        const checked = productSchema.validate(source, { abortEarly: false, convert: true });
        if (checked.error) {
          errors.push({ rowNumber, name: String(source.name || '').slice(0, 120), message: checked.error.details.map(detail => detail.message).join('؛ ') });
          continue;
        }
        if (!await hasValidImageReference(checked.value)) {
          errors.push({ rowNumber, name: checked.value.name, message: 'رابط صورة المنتج أو مرجع الصورة غير صالح.' });
          continue;
        }
        const key = productKey(checked.value);
        if (seen.has(key)) {
          duplicates.push({ rowNumber, name: checked.value.name, message: 'المنتج مكرر داخل ملف الاستيراد بنفس الاسم والقسم.' });
          continue;
        }
        seen.add(key);
        validRows.push({ rowNumber, product: checked.value, key });
      }

      if (validRows.length) {
        const existing = await StoreProduct.find({
          $or: validRows.map(item => ({
            name: new RegExp('^' + String(item.product.name).replace(/[.*+?^${}()|[\]\\]/g, '\\  router.post('/store/products', auth('admin'), async (req, res, next) => {') + '
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
, 'i'),
            category: item.product.category || 'عام'
          }))
        }).select('name category').lean();
        const existingKeys = new Set(existing.map(productKey));
        const toInsert = [];
        for (const item of validRows) {
          if (existingKeys.has(item.key)) {
            duplicates.push({ rowNumber: item.rowNumber, name: item.product.name, message: 'المنتج موجود بالفعل بنفس الاسم والقسم؛ تم تخطيه لمنع التكرار.' });
          } else {
            toInsert.push(item.product);
            existingKeys.add(item.key);
          }
        }
        const inserted = toInsert.length ? await StoreProduct.insertMany(toInsert, { ordered: false }) : [];
        if (inserted.length) {
          await writeAdminAudit(req, 'استيراد منتجات المتجر من ملف CSV', 'store-import', 'bulk', 'imported=' + inserted.length + '; duplicates=' + duplicates.length + '; errors=' + errors.length);
        }
        return res.set('Cache-Control', 'no-store').status(inserted.length ? 201 : 200).json({
          message: 'انتهى استيراد ملف المنتجات.',
          importedCount: inserted.length,
          duplicateCount: duplicates.length,
          errorCount: errors.length,
          errors,
          duplicates
        });
      }

      return res.set('Cache-Control', 'no-store').json({
        message: 'لم تتم إضافة منتجات. راجع الصفوف المكررة أو التي تحتوي على أخطاء.',
        importedCount: 0,
        duplicateCount: duplicates.length,
        errorCount: errors.length,
        errors,
        duplicates
      });
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
