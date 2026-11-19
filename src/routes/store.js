'use strict';

const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');
const StoreProduct = require('../models/StoreProduct');
const StoreOrder = require('../models/StoreOrder');
const AdminConfig = require('../models/AdminConfig');
const { buildStoreCategories } = require('../utils/storeCategories');
const Client = require('../models/Client');
const Fanni = require('../models/Fanni');
const WalletTransaction = require('../models/WalletTransaction');
const { auth } = require('../middleware/auth');
const { clientAuth } = require('../middleware/clientAuth');
const { notifyAdmins, createNotification } = require('../utils/notifications');

const router = express.Router();
const orderSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).max(1000).default(1),
  note: Joi.string().trim().max(1000).allow('').default(''),
  paymentMethod: Joi.string().valid('wallet', 'cash_on_delivery').optional(),
  expectedPrice: Joi.number().min(0).max(100000000).optional(),
  idempotencyKey: Joi.string().pattern(/^[a-zA-Z0-9:_-]{16,150}$/).optional()
}).unknown(false);

router.get('/media/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).end();
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const [productReference, categoryReference] = await Promise.all([
      StoreProduct.exists({ imageFileId: fileId }),
      AdminConfig.exists({ key: 'main', storeCategories: { $elemMatch: { imageFileId: fileId } } })
    ]);
    if (!productReference && !categoryReference) return res.status(404).end();
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const files = await bucket.find({
      _id: fileId,
      'metadata.purpose': productReference ? 'store-product' : 'store-category'
    }).toArray();
    if (!files.length) return res.status(404).end();
    res.set({
      'Content-Type': files[0].contentType || 'application/octet-stream',
      'Content-Length': String(files[0].length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    });
    return bucket.openDownloadStream(fileId).on('error', next).pipe(res);
  } catch (error) { return next(error); }
});


router.get('/advertisement/current', async (req, res, next) => {
  try {
    const config = await AdminConfig.findOne({ key: 'main' }).select('storeAdRotationSeconds').lean();
    const configuredSeconds = Number(config?.storeAdRotationSeconds);
    const rotationSeconds = Number.isInteger(configuredSeconds) && configuredSeconds >= 5 && configuredSeconds <= 60 ? configuredSeconds : 5;
    const now = Date.now();
    const rotationMs = rotationSeconds * 1000;
    const slot = Math.floor(now / rotationMs);
    const filter = {
      isActive: true,
      isAdvertised: true,
      $and: [
        { $or: [{ adExpiresAt: null }, { adExpiresAt: { $exists: false } }, { adExpiresAt: { $gt: new Date(now) } }] },
        { $or: [{ stock: null }, { stock: { $exists: false } }, { stock: { $gt: 0 } }] }
      ]
    };
    const products = await StoreProduct.find(filter)
      .sort({ adPriority: -1, createdAt: -1, _id: 1 })
      .select('name price imageUrl imageFileId adPriority createdAt')
      .lean();
    const eligible = products
      .map(product => ({ ...product, imageUrl: product.imageFileId ? '/api/store/media/' + String(product.imageFileId) : (product.imageUrl || '') }))
      .filter(product => {
        const imageUrl = String(product.imageUrl || '').trim();
        return Boolean(String(product.name || '').trim()) && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || new RegExp('^/api/store/media/[a-f0-9]{24}$', 'i').test(imageUrl));
      });
    const currentAdvertisement = eligible.length ? eligible[slot % eligible.length] : null;
    const nextChangeAt = (slot + 1) * rotationMs;
    return res.set('Cache-Control', 'no-store').json({
      currentAdvertisement,
      rotationSeconds,
      serverTime: now,
      nextChangeAt,
      slot: eligible.length ? slot % eligible.length : null,
      totalAdvertisements: eligible.length
    });
  } catch (error) { return next(error); }
});

router.get('/products', async (req, res, next) => {
  try {
    const [products, config] = await Promise.all([
      StoreProduct.find({ isActive: true }).sort({ createdAt: -1 }).select('name category description details price originalPrice offerText type subscriptionDuration imageUrl imageFileId stock createdAt isAdvertised adAudience adPriority adExpiresAt').lean(),
      AdminConfig.findOne({ key: 'main' }).select('storeAdRotationSeconds storeCategories').lean()
    ]);
    const configuredSeconds = Number(config?.storeAdRotationSeconds);
    const adRotationSeconds = Number.isInteger(configuredSeconds) && configuredSeconds >= 5 && configuredSeconds <= 60 ? configuredSeconds : 5;
    const publicProducts = products.map(product => ({ ...product, category: String(product.category || 'عام').trim() || 'عام', imageUrl: product.imageFileId ? '/api/store/media/' + String(product.imageFileId) : (product.imageUrl || '') }));
    const categories = buildStoreCategories(publicProducts, config?.storeCategories);
    return res.set('Cache-Control', 'no-store').json({ products: publicProducts, categories, adRotationSeconds });
  } catch (error) { return next(error); }
});


const bulkOrderSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    productId: Joi.string().hex().length(24).required(),
    quantity: Joi.number().integer().min(1).max(1000).required(),
    expectedPrice: Joi.number().min(0).max(100000000).optional()
  }).unknown(false)).min(1).max(50).required(),
  note: Joi.string().trim().max(1000).allow('').default(''),
  paymentMethod: Joi.string().valid('wallet', 'cash_on_delivery').required(),
  idempotencyKey: Joi.string().pattern(/^[a-zA-Z0-9:_-]{16,150}$/).required()
}).unknown(false);

async function submitBulkOrder(req, res, next, role) {
  let session = null;
  try {
    const { error, value } = bulkOrderSchema.validate(req.body || {}, { abortEarly: false });
    if (error) return res.status(400).json({ message: 'راجع المنتجات والكميات وطريقة الدفع.' });
    if (role === 'fanni' && req.user?.role !== 'fanni') return res.status(403).json({ message: 'الشراء متاح لحسابات الفنيين فقط.' });
    const buyer = role === 'client' ? req.client : req.user;
    if (!buyer?._id) return res.status(401).json({ message: 'سجّل الدخول لإرسال طلب الشراء.' });
    if (role === 'fanni' && buyer.status !== 'معتمد') return res.status(403).json({ message: 'الشراء من المتجر متاح للفنيين المعتمدين فقط.' });

    const quantities = new Map();
    const expectedPrices = new Map();
    for (const item of value.items) {
      quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
      if (item.expectedPrice !== undefined) {
        const previousExpectedPrice = expectedPrices.get(item.productId);
        if (previousExpectedPrice !== undefined && Number(previousExpectedPrice) !== Number(item.expectedPrice)) {
          return res.status(400).json({ message: 'يوجد اختلاف في السعر المتوقع لنفس المنتج داخل السلة. راجع السلة وحاول مرة أخرى.' });
        }
        expectedPrices.set(item.productId, item.expectedPrice);
      }
    }
    if ([...quantities.values()].some(quantity => quantity > 1000)) return res.status(400).json({ message: 'الحد الأقصى لكمية المنتج الواحد هو 1000.' });

    const duplicate = await StoreOrder.findOne({ buyerRole: role, buyerId: buyer._id, requestKey: value.idempotencyKey }).lean();
    if (duplicate) return res.status(200).json({
      message: 'طلب الشراء مسجل بالفعل.',
      balance: Number(buyer.walletBalance || 0),
      order: { id: String(duplicate._id), productName: duplicate.productName, items: duplicate.items || [], quantity: duplicate.quantity, total: duplicate.total, status: duplicate.status, paymentMethod: duplicate.paymentMethod, paymentStatus: duplicate.paymentStatus, createdAt: duplicate.createdAt },
      duplicate: true
    });

    session = await mongoose.startSession();
    session.startTransaction();
    const orderItems = [];
    let total = 0;
    let totalQuantity = 0;
    for (const [productId, quantity] of quantities) {
      const product = await StoreProduct.findOne({ _id: productId, isActive: true }).session(session);
      if (!product) {
        await session.abortTransaction();
        return res.status(409).json({ message: 'أحد المنتجات لم يعد متاحًا. حدّث السلة وراجعها قبل الإرسال.' });
      }
      const expectedPrice = expectedPrices.get(productId);
      if (expectedPrice !== undefined && Number(expectedPrice) !== Number(product.price)) {
        await session.abortTransaction();
        return res.status(409).json({
          priceChanged: true,
          changedItems: [{ productId: String(product._id), productName: product.name, previousPrice: Number(expectedPrice), currentPrice: Number(product.price) }],
          message: 'تغير سعر المنتج "' + product.name + '" منذ إضافته للسلة. راجع السعر الجديد قبل تأكيد الطلب.'
        });
      }
      if (product.type === 'subscription') {
        await session.abortTransaction();
        return res.status(400).json({ message: 'طلبات الاشتراكات تُرسل منفردة ولا يمكن دمجها مع سلة المنتجات.' });
      }
      let stockReserved = false;
      if (product.stock !== null && product.stock !== undefined) {
        const reserved = await StoreProduct.findOneAndUpdate(
          { _id: product._id, isActive: true, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true, session }
        );
        if (!reserved) {
          await session.abortTransaction();
          return res.status(409).json({ message: 'الكمية المطلوبة من "' + product.name + '" غير متاحة حاليًا.' });
        }
        stockReserved = true;
      }
      const unitPrice = Number(product.price);
      const lineTotal = Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100;
      total += lineTotal;
      totalQuantity += quantity;
      orderItems.push({
        product: product._id, productName: product.name, productType: product.type || 'product',
        subscriptionDuration: product.subscriptionDuration || '', unitPrice, quantity, stockReserved, total: lineTotal
      });
    }
    total = Math.round((total + Number.EPSILON) * 100) / 100;

    let paymentMethod = 'عند الاستلام';
    let paymentStatus = 'غير مدفوع';
    let updatedBuyer = null;
    let balanceBefore = 0;
    if (value.paymentMethod === 'wallet') {
      if (role === 'client') {
        const client = await Client.findOne({ _id: buyer._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: total } }).session(session);
        if (!client) {
          await session.abortTransaction();
          const current = await Client.findById(buyer._id).select('walletBalance walletFrozen').lean();
          return res.status(409).json({
            message: current?.walletFrozen ? 'محفظتك مجمدة حاليًا. تقدر تختار الدفع عند الاستلام.' : 'رصيد محفظتك غير كافٍ لهذا الطلب. تقدر تختار الدفع عند الاستلام أو تشحن محفظتك.',
            required: total, balance: Number(current?.walletBalance || 0), canUseCashOnDelivery: true
          });
        }
        balanceBefore = Number(client.walletBalance || 0);
        updatedBuyer = await Client.findOneAndUpdate(
          { _id: client._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: total } },
          { $inc: { walletBalance: -total } }, { new: true, session, runValidators: true }
        );
        paymentMethod = 'محفظة العميل';
      } else {
        const fanni = await Fanni.findOne({ _id: buyer._id, status: 'معتمد', isFrozen: { $ne: true }, walletBalance: { $gte: total } }).session(session);
        if (!fanni) {
          await session.abortTransaction();
          const current = await Fanni.findById(buyer._id).select('walletBalance isFrozen status').lean();
          return res.status(409).json({
            message: current?.isFrozen ? 'محفظتك مجمدة حاليًا. تقدر تختار الدفع عند الاستلام.' : 'رصيد محفظتك غير كافٍ لهذا الطلب. تقدر تكمل والدفع يكون عند الاستلام.',
            required: total, balance: Number(current?.walletBalance || 0), canUseCashOnDelivery: true
          });
        }
        balanceBefore = Number(fanni.walletBalance || 0);
        updatedBuyer = await Fanni.findOneAndUpdate(
          { _id: fanni._id, status: 'معتمد', isFrozen: { $ne: true }, walletBalance: { $gte: total } },
          { $inc: { walletBalance: -total } }, { new: true, session, runValidators: true }
        );
        paymentMethod = 'محفظة الفني';
      }
      if (!updatedBuyer) {
        await session.abortTransaction();
        return res.status(409).json({ message: 'الرصيد اتغير أثناء تنفيذ الطلب. حدّث الصفحة وحاول مرة تانية، أو اختار الدفع عند الاستلام.', canUseCashOnDelivery: true });
      }
      paymentStatus = 'مدفوع';
    }

    const first = orderItems[0];
    const order = new StoreOrder({
      product: first.product,
      items: orderItems,
      productName: orderItems.length === 1 ? first.productName : 'طلب متعدد المنتجات (' + orderItems.length + ' منتجات)',
      productType: 'product',
      unitPrice: total,
      quantity: totalQuantity,
      stockReserved: orderItems.some(item => item.stockReserved),
      total,
      buyerRole: role, buyerId: buyer._id, buyerName: buyer.name || 'مستخدم',
      buyerPhone: buyer.phone || '', buyerNote: value.note,
      paymentMethod, paymentStatus, walletCharged: paymentStatus === 'مدفوع', requestKey: value.idempotencyKey,
      statusHistory: [{ status: 'جديد', note: 'تم استلام طلب متعدد المنتجات', by: buyer.name || 'المستخدم' }]
    });
    await order.save({ session });

    if (paymentStatus === 'مدفوع') {
      await new WalletTransaction({
        ...(role === 'client' ? { client: buyer._id, type: 'client_store_payment' } : { fanni: buyer._id, type: 'fanni_store_payment' }),
        amount: -total, balanceBefore, balanceAfter: Number(updatedBuyer.walletBalance),
        description: 'شراء ' + orderItems.length + ' منتجات من متجر حمزاوي سات',
        idempotencyKey: 'store-order:' + String(order._id)
      }).save({ session });
    }
    await session.commitTransaction();

    await notifyAdmins({
      type: 'admin_store_order', title: 'طلب شراء جديد',
      message: 'طلب متعدد المنتجات (' + orderItems.length + ') من ' + order.buyerName + ' بإجمالي ' + total + ' جنيه — الدفع: ' + paymentMethod + '.',
      link: '/admin.html?tab=storeOrders', dedupeKey: 'store-order:' + String(order._id)
    });
    return res.status(201).json({
      message: paymentStatus === 'مدفوع'
        ? 'تم تأكيد طلبك وخصم إجمالي المبلغ من محفظتك بنجاح. الإدارة هتتواصل معاك لتجهيز الطلب.'
        : 'تم إرسال طلبك المجمع بنجاح. الدفع هيكون عند الاستلام، والإدارة هتتواصل معاك لتأكيد التفاصيل.',
      balance: updatedBuyer ? Number(updatedBuyer.walletBalance) : undefined,
      order: { id: String(order._id), productName: order.productName, items: order.items, quantity: order.quantity, total: order.total, status: order.status, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, createdAt: order.createdAt }
    });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction().catch(() => {});
    if (error?.code === 11000) {
      const buyer = role === 'client' ? req.client : req.user;
      const duplicate = await StoreOrder.findOne({ buyerRole: role, buyerId: buyer?._id, requestKey: req.body?.idempotencyKey }).lean().catch(() => null);
      if (duplicate) return res.status(200).json({ message: 'طلب الشراء مسجل بالفعل.', order: { id: String(duplicate._id), productName: duplicate.productName, items: duplicate.items || [], quantity: duplicate.quantity, total: duplicate.total, status: duplicate.status, paymentMethod: duplicate.paymentMethod, paymentStatus: duplicate.paymentStatus, createdAt: duplicate.createdAt }, duplicate: true });
    }
    return next(error);
  } finally {
    if (session) await session.endSession().catch(() => {});
  }
}

async function submitOrder(req, res, next, role) {
  let session = null;
  let requestValue = null;
  let reservedProductId = null;
  let reservedQuantity = 0;
  try {
    const { error, value } = orderSchema.validate(req.body || {}, { abortEarly: false });
    requestValue = value;
    if (error) return res.status(400).json({ message: 'راجع بيانات طلب الشراء وطريقة الدفع.' });
    if (role === 'fanni' && req.user?.role !== 'fanni') return res.status(403).json({ message: 'الشراء متاح لحسابات الفنيين فقط.' });
    const buyer = role === 'client' ? req.client : req.user;
    if (!buyer || !buyer._id) return res.status(401).json({ message: 'سجّل الدخول لإرسال طلب الشراء.' });
    if (role === 'fanni' && buyer.status !== 'معتمد') return res.status(403).json({ message: 'الشراء من المتجر متاح للفنيين المعتمدين فقط.' });

    if (!value.idempotencyKey) return res.status(400).json({ message: 'حدّث الصفحة وحاول إرسال الطلب مرة أخرى.' });
    const duplicate = await StoreOrder.findOne({ buyerRole: role, buyerId: buyer._id, requestKey: value.idempotencyKey }).lean();
    if (duplicate) {
      return res.status(200).json({
        message: 'طلب الشراء مسجل بالفعل.',
        balance: Number(buyer.walletBalance || 0),
        order: { id: String(duplicate._id), productName: duplicate.productName, quantity: duplicate.quantity, total: duplicate.total, status: duplicate.status, paymentMethod: duplicate.paymentMethod, paymentStatus: duplicate.paymentStatus, createdAt: duplicate.createdAt },
        duplicate: true
      });
    }
    session = await mongoose.startSession();
    session.startTransaction();

    const product = await StoreProduct.findOne({ _id: value.productId, isActive: true }).session(session);
    if (!product) {
      if (session?.inTransaction()) await session.abortTransaction();
      return res.status(404).json({ message: 'المنتج غير متاح حاليًا.' });
    }
    if (value.expectedPrice !== undefined && Number(value.expectedPrice) !== Number(product.price)) {
      await session.abortTransaction();
      return res.status(409).json({
        priceChanged: true,
        currentPrice: Number(product.price),
        productName: product.name,
        message: 'تغير سعر المنتج منذ فتح نافذة الشراء. راجع السعر الجديد قبل تأكيد الطلب.'
      });
    }
    const isSubscription = product.type === 'subscription';
    if (!isSubscription && !['wallet', 'cash_on_delivery'].includes(value.paymentMethod)) {
      if (session?.inTransaction()) await session.abortTransaction();
      return res.status(400).json({ message: 'اختار طريقة الدفع: من المحفظة أو عند الاستلام.' });
    }

    if (product.stock !== null && product.stock !== undefined) {
      const reserved = await StoreProduct.findOneAndUpdate(
        { _id: product._id, isActive: true, stock: { $gte: value.quantity } },
        { $inc: { stock: -value.quantity } },
        session ? { new: true, session } : { new: true }
      );
      if (!reserved) {
        if (session?.inTransaction()) await session.abortTransaction();
        return res.status(409).json({ message: 'الكمية المطلوبة غير متاحة حاليًا.' });
      }
      reservedProductId = product._id;
      reservedQuantity = value.quantity;
    }

    const total = Math.round((Number(product.price) * value.quantity + Number.EPSILON) * 100) / 100;
    let paymentMethod = 'غير محدد';
    let paymentStatus = 'غير مدفوع';
    let updatedClient = null;
    let balanceBefore = 0;

    if (!isSubscription) {
      if (value.paymentMethod === 'cash_on_delivery') {
        paymentMethod = 'عند الاستلام';
      } else if (role === 'client') {
        const client = await Client.findOne({
          _id: buyer._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: total }
        }).session(session);
        if (!client) {
          await session.abortTransaction();
          const current = await Client.findById(buyer._id).select('walletBalance walletFrozen').lean();
          return res.status(409).json({
            message: current?.walletFrozen
              ? 'محفظتك مجمدة حاليًا. تقدر تختار الدفع عند الاستلام.'
              : 'رصيد محفظتك غير كافٍ لهذا الطلب. تقدر تختار الدفع عند الاستلام أو تشحن محفظتك.',
            required: total,
            balance: Number(current?.walletBalance || 0),
            canUseCashOnDelivery: true
          });
        }
        balanceBefore = Number(client.walletBalance || 0);
        updatedClient = await Client.findOneAndUpdate(
          { _id: client._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: total } },
          { $inc: { walletBalance: -total } },
          { new: true, session, runValidators: true }
        );
        if (!updatedClient) {
          await session.abortTransaction();
          return res.status(409).json({ message: 'الرصيد اتغير أثناء تنفيذ الطلب. حدّث الصفحة وحاول مرة تانية، أو اختار الدفع عند الاستلام.', canUseCashOnDelivery: true });
        }
        paymentMethod = 'محفظة العميل';
        paymentStatus = 'مدفوع';
      } else {
        const fanni = await Fanni.findOne({
          _id: buyer._id, status: 'معتمد', isFrozen: { $ne: true }, walletBalance: { $gte: total }
        }).session(session);
        if (!fanni) {
          await session.abortTransaction();
          const current = await Fanni.findById(buyer._id).select('walletBalance isFrozen status').lean();
          return res.status(409).json({
            message: current?.isFrozen
              ? 'محفظتك مجمدة حاليًا. تقدر تختار الدفع عند الاستلام.'
              : 'رصيد محفظتك غير كافٍ لهذا الطلب. تقدر تكمل والدفع يكون عند الاستلام.',
            required: total,
            balance: Number(current?.walletBalance || 0),
            canUseCashOnDelivery: true
          });
        }
        balanceBefore = Number(fanni.walletBalance || 0);
        updatedClient = await Fanni.findOneAndUpdate(
          { _id: fanni._id, status: 'معتمد', isFrozen: { $ne: true }, walletBalance: { $gte: total } },
          { $inc: { walletBalance: -total } },
          { new: true, session, runValidators: true }
        );
        if (!updatedClient) {
          await session.abortTransaction();
          return res.status(409).json({ message: 'الرصيد اتغير أثناء تنفيذ الطلب. اختار الدفع عند الاستلام وحاول مرة تانية.', canUseCashOnDelivery: true });
        }
        paymentMethod = 'محفظة الفني';
        paymentStatus = 'مدفوع';
      }
    }

    const order = new StoreOrder({
      product: product._id, productName: product.name, productType: product.type || 'product',
      subscriptionDuration: product.subscriptionDuration || '', unitPrice: product.price,
      quantity: value.quantity, stockReserved: Boolean(reservedProductId), total,
      buyerRole: role, buyerId: buyer._id, buyerName: buyer.name || 'مستخدم',
      buyerPhone: buyer.phone || '', buyerNote: value.note,
      paymentMethod, paymentStatus, walletCharged: paymentStatus === 'مدفوع',
      ...(value.idempotencyKey ? { requestKey: value.idempotencyKey } : {}),
      statusHistory: [{ status: 'جديد', note: 'تم استلام طلب الشراء', by: buyer.name || 'المستخدم' }]
    });
    await order.save({ session });

    if (session && ['محفظة العميل', 'محفظة الفني'].includes(paymentMethod)) {
      await new WalletTransaction({
        ...(role === 'client' ? { client: buyer._id, type: 'client_store_payment' } : { fanni: buyer._id, type: 'fanni_store_payment' }), amount: -total,
        balanceBefore, balanceAfter: Number(updatedClient.walletBalance),
        description: 'شراء ' + order.productName + ' من متجر حمزاوي سات',
        idempotencyKey: 'store-order:' + String(order._id)
      }).save({ session });
    }

    await session.commitTransaction();

    await notifyAdmins({
      type: 'admin_store_order', title: 'طلب شراء جديد',
      message: 'طلب ' + order.productName + ' من ' + order.buyerName + ' بإجمالي ' + order.total + ' جنيه — الدفع: ' + paymentMethod + '.',
      link: '/admin.html?tab=storeOrders', dedupeKey: 'store-order:' + String(order._id)
    });

    return res.status(201).json({
      message: isSubscription
        ? (role === 'client' ? 'تم إرسال طلب الاشتراك أو التجديد للإدارة. هنتواصل معاك لتأكيد التفاصيل وطريقة الدفع.' : 'تم إرسال طلب الاشتراك أو التجديد للإدارة لتأكيد التفاصيل وطريقة الدفع.')
        : paymentMethod === 'محفظة العميل' ? 'تم تأكيد طلبك والدفع من محفظتك بنجاح. الإدارة هتتواصل معاك لتجهيز الطلب.'
        : paymentMethod === 'محفظة الفني' ? 'تم تأكيد طلبك وخصم المبلغ من محفظتك بنجاح. الإدارة هتتواصل معاك لتجهيز الطلب.'
        : 'تم إرسال طلبك بنجاح. الدفع هيكون عند الاستلام، والإدارة هتتواصل معاك لتأكيد التفاصيل.',
      balance: updatedClient ? Number(updatedClient.walletBalance) : undefined,
      order: {
        id: String(order._id), productName: order.productName, quantity: order.quantity,
        total: order.total, status: order.status, paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus, createdAt: order.createdAt
      }
    });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction().catch(() => {});
    if (!session && reservedProductId && reservedQuantity) {
      await StoreProduct.updateOne({ _id: reservedProductId }, { $inc: { stock: reservedQuantity } }).catch(() => {});
    }
    if (error?.code === 11000 && requestValue?.idempotencyKey) {
      const duplicate = await StoreOrder.findOne({ buyerRole: role, buyerId: role === 'client' ? req.client?._id : req.user?._id, requestKey: requestValue.idempotencyKey }).lean().catch(() => null);
      if (duplicate) return res.status(200).json({ message: 'طلب الشراء مسجل بالفعل.', order: { id: String(duplicate._id), productName: duplicate.productName, quantity: duplicate.quantity, total: duplicate.total, status: duplicate.status, paymentMethod: duplicate.paymentMethod, paymentStatus: duplicate.paymentStatus, createdAt: duplicate.createdAt }, duplicate: true });
    }
    return next(error);
  } finally {
    if (session) await session.endSession().catch(() => {});
  }
}

router.post('/client/orders/bulk', clientAuth, (req, res, next) => submitBulkOrder(req, res, next, 'client'));
router.post('/fanni/orders/bulk', auth('fanni'), (req, res, next) => submitBulkOrder(req, res, next, 'fanni'));
router.post('/client/orders', clientAuth, (req, res, next) => submitOrder(req, res, next, 'client'));
router.post('/fanni/orders', auth('fanni'), (req, res, next) => submitOrder(req, res, next, 'fanni'));

router.get('/client/orders', clientAuth, async (req, res, next) => {
  try {
    const orders = await StoreOrder.find({ buyerRole: 'client', buyerId: req.client._id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.set('Cache-Control', 'no-store').json({ orders });
  } catch (error) { return next(error); }
});
router.get('/fanni/orders', auth('fanni'), async (req, res, next) => {
  try {
    const orders = await StoreOrder.find({ buyerRole: 'fanni', buyerId: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.set('Cache-Control', 'no-store').json({ orders });
  } catch (error) { return next(error); }
});

module.exports = router;
