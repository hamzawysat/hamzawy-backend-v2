'use strict';
const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Client = require('../models/Client');
const WalletTransaction = require('../models/WalletTransaction');
const Fanni = require('../models/Fanni');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { modelForType, findSubscriptions, findSubscriptionOne, findSubscriptionById } = require('../models/subscriptionRepository');
const SubscriptionVisit = require('../models/SubscriptionVisit');
const { auth } = require('../middleware/auth');
const { clientAuth } = require('../middleware/clientAuth');
const { createNotification, notifyAdmins } = require('../utils/notifications');
const { encrypt, decrypt } = require('../utils/subscriptionCrypto');
const router = express.Router();
const TYPES = ['maintenance','air_network','iptv'];
const planSchema = Joi.object({
  type: Joi.string().valid(...TYPES).required(), name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(1000).allow('').default(''), price: Joi.number().strict().min(0).max(100000000).required(),
  durationDays: Joi.number().integer().min(1).max(3650).required(), visitCount: Joi.number().integer().min(0).max(100).default(0),
  includedServices: Joi.array().items(Joi.string().trim().max(160)).max(30).default([]),
  excludedSupplies: Joi.array().items(Joi.string().trim().max(160)).max(30).default([]),
  allowedDevices: Joi.number().integer().min(1).max(20).default(1), settings: Joi.object().unknown(true).default({}), active: Joi.boolean().default(true)
}).unknown(false);
const createSchema = Joi.object({
  clientPhone: Joi.string().trim().min(7).max(20).required(), type: Joi.string().valid(...TYPES).required(),
  planId: Joi.string().hex().length(24).allow('').optional(), amount: Joi.number().strict().min(0).max(100000000).optional(),
  durationDays: Joi.number().integer().min(1).max(3650).optional(), startsAt: Joi.date().iso().optional(),
  address: Joi.string().trim().max(500).allow('').default(''), dishSize: Joi.string().trim().max(60).allow('').default(''),
  receiverType: Joi.string().trim().max(100).allow('').default(''), deviceType: Joi.string().trim().max(100).allow('').default(''),
  networkName: Joi.string().trim().max(120).allow('').default(''), activationCode: Joi.string().trim().max(120).allow('').default(''),
  portalUrl: Joi.string().trim().uri({ scheme: ['http','https'] }).max(500).allow('').default(''),
  iptvUsername: Joi.string().trim().max(150).allow('').default(''), iptvPassword: Joi.string().max(300).allow('').default(''),
  allowedDevices: Joi.number().integer().min(1).max(20).optional(), visitsIncluded: Joi.number().integer().min(0).max(100).optional(),
  notes: Joi.string().trim().max(1500).allow('').default('')
}).unknown(false);
const planPatchSchema = Joi.object({
  type: Joi.string().valid(...TYPES), name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(1000).allow(''), price: Joi.number().strict().min(0).max(100000000),
  durationDays: Joi.number().integer().min(1).max(3650), visitCount: Joi.number().integer().min(0).max(100),
  includedServices: Joi.array().items(Joi.string().trim().max(160)).max(30),
  excludedSupplies: Joi.array().items(Joi.string().trim().max(160)).max(30),
  allowedDevices: Joi.number().integer().min(1).max(20), settings: Joi.object().unknown(true), active: Joi.boolean()
}).min(1).unknown(false);
const visitSchema = Joi.object({
  subscriptionId: Joi.string().hex().length(24).required(), technicianId: Joi.string().hex().length(24).required(),
  scheduledAt: Joi.date().iso().required()
}).unknown(false);
const safeClient = (s) => {
  const v = { ...s };
  delete v.iptvUsernameEncrypted;
  delete v.iptvPasswordEncrypted;
  delete v.__legacyMigrationHash;
  if (v.entertainmentDetails) {
    v.entertainmentDetails = { ...v.entertainmentDetails };
    delete v.entertainmentDetails.usernameEncrypted;
    delete v.entertainmentDetails.passwordEncrypted;
  }
  return v;
};
async function attachVisitSubscriptions(visits, fields) {
  return Promise.all(visits.map(async visit => {
    const subscription = await findSubscriptionById(visit.subscription, { lean: true });
    const summary = subscription ? Object.fromEntries(fields.filter(field => subscription[field] !== undefined).map(field => [field, subscription[field]])) : null;
    return { ...visit, subscription: summary };
  }));
}
function makeCode() { return 'HS-' + crypto.randomBytes(5).toString('hex').toUpperCase(); }
function publicServiceName(type) { return type === 'maintenance' ? 'صيانة سنوية' : type === 'air_network' ? 'اشتراك محلي' : 'اشتراك ترفيهي'; }
function publicDescription(value) { return String(value || '').replace(/iptv/gi, 'اشتراك ترفيهي').replace(/شبكات?\s*هوائية?/gi, 'اشتراك محلي').replace(/هوائي|هواء/gi, 'محلي'); }

// Public plan catalog; prices and durations are always controlled by administration.
router.get('/plans', async (req, res, next) => {
  try {
    const filter = { active: true };
    if (TYPES.includes(String(req.query.type || ''))) filter.type = String(req.query.type);
    const plans = await SubscriptionPlan.find(filter).select('-settings').sort({ type: 1, price: 1 }).lean();
    const publicPlans = plans.map(p => ({ ...p, name: publicServiceName(p.type), description: publicDescription(p.description) }));
    return res.set('Cache-Control','no-store').json({ plans: publicPlans });
  } catch (e) { return next(e); }
});

// Customer sees only their own subscriptions and their IPTV credentials.
router.get('/client/mine', clientAuth, async (req, res, next) => {
  try {
    const subscriptions = await findSubscriptions({ client: req.clientId }, { select: '+iptvUsernameEncrypted +iptvPasswordEncrypted', sort: { createdAt: -1 } });
    const visits = await SubscriptionVisit.find({ client: req.clientId }).sort({ scheduledAt: 1 }).lean();
    const enriched = subscriptions.map(s => {
      if (s.type === 'iptv') {
        try { s.iptvUsername = decrypt(s.iptvUsernameEncrypted); } catch (_) { s.iptvUsername = ''; }
        try { s.iptvPassword = decrypt(s.iptvPasswordEncrypted); } catch (_) { s.iptvPassword = ''; }
      }
      delete s.iptvUsernameEncrypted; delete s.iptvPasswordEncrypted;
      if (s.entertainmentDetails) {
        delete s.entertainmentDetails.usernameEncrypted;
        delete s.entertainmentDetails.passwordEncrypted;
      }
      delete s.__legacyMigrationHash;
      return s;
    });
    return res.set('Cache-Control','no-store').json({ subscriptions: enriched, visits });
  } catch (e) { return next(e); }
});

// Customer requests a subscription; activation/payment remains an explicit admin decision.
router.post('/client/request', clientAuth, async (req, res, next) => {
  try {
    const { error, value } = Joi.object({
      planId: Joi.string().hex().length(24).required(),
      paymentMethod: Joi.string().valid('wallet','transfer').required(),
      notes: Joi.string().trim().max(1000).allow('').default('')
    }).unknown(false).validate(req.body || {});
    if (error) return res.status(400).json({ message: 'حدد الباقة وطريقة الدفع قبل إرسال طلب الاشتراك.' });
    const plan = await SubscriptionPlan.findOne({ _id: value.planId, active: true }).lean();
    if (!plan) return res.status(404).json({ message: 'الباقة غير متاحة حاليًا.' });
    const existing = await findSubscriptionOne({
      client: req.clientId, plan: plan._id,
      status: { $in: ['pending','active','paused'] },
      endsAt: { $gte: new Date() }
    }, { lean: true });
    if (existing) return res.status(409).json({ message: existing.status === 'pending' ? 'لديك طلب اشتراك قيد مراجعة الإدارة بالفعل.' : 'لديك اشتراك قائم في هذه الباقة بالفعل.' });
    if (value.paymentMethod === 'wallet') {
      const client = await Client.findOne({ _id: req.clientId, archivedAt: null, status: 'نشط', walletFrozen: { $ne: true } }).select('walletBalance walletFrozen').lean();
      if (!client) return res.status(403).json({ message: 'محفظتك غير متاحة حاليًا. اختار التحويل أو تواصل مع الإدارة.' });
      if (Number(client.walletBalance || 0) < Number(plan.price || 0)) return res.status(409).json({ message: 'رصيد المحفظة غير كافٍ لقيمة الباقة. اختار التحويل أو اشحن المحفظة.' });
    }
    const startsAt = new Date();
    const Model = modelForType(plan.type);
    const subscription = await Model.create({
      code: makeCode(), type: plan.type, plan: plan._id, client: req.clientId,
      clientName: String(req.client.name || ''), clientPhone: String(req.client.phone || ''),
      amount: Number(plan.price || 0), durationDays: Number(plan.durationDays || 30),
      startsAt, endsAt: new Date(startsAt.getTime() + Number(plan.durationDays || 30) * 86400000),
      status: 'pending', paymentMethod: value.paymentMethod, paymentStatus: 'pending',
      paymentRequestedAt: new Date(), visitsIncluded: Number(plan.visitCount || 0),
      includedServices: plan.includedServices || [], excludedSupplies: plan.excludedSupplies || [],
      allowedDevices: Number(plan.allowedDevices || 1), notes: value.notes,
      history: [{ action: 'requested', note: 'طلب العميل الاشتراك بطريقة ' + (value.paymentMethod === 'wallet' ? 'محفظة التطبيق' : 'تحويل أموال'), by: 'العميل' }]
    });
    await notifyAdmins({
      type: 'admin_subscription_request', title: 'طلب اشتراك جديد',
      message: 'طلب العميل ' + String(req.client.name || '') + ' الاشتراك في ' + plan.name + ' — طريقة الدفع: ' + (value.paymentMethod === 'wallet' ? 'محفظة التطبيق' : 'تحويل أموال') + (value.notes ? ' — ملاحظات: ' + value.notes : ''),
      link: '/admin?tab=commerceSubscriptions',
      dedupeKey: 'subscription-request:' + String(subscription._id)
    });
    return res.status(202).json({
      message: 'تم تسجيل طلب الاشتراك بطريقة ' + (value.paymentMethod === 'wallet' ? 'محفظة التطبيق' : 'تحويل الأموال') + '. سيظهر الطلب لدى الإدارة، ولن يتم الخصم أو التفعيل قبل المراجعة.',
      subscription: safeClient(subscription.toObject())
    });
  } catch (e) { return next(e); }
});

router.post('/client/request-renewal', clientAuth, async (req, res, next) => {
  try {
    const { error, value } = Joi.object({ subscriptionId: Joi.string().hex().length(24).required(), paymentMethod: Joi.string().valid('wallet','transfer').required() }).unknown(false).validate(req.body || {});
    if (error) return res.status(400).json({ message: 'حدد الاشتراك وطريقة الدفع قبل إرسال طلب التجديد.' });
    const subscription = await findSubscriptionOne({ _id: value.subscriptionId, client: req.clientId, status: { $in: ['active','expired','paused'] } });
    if (!subscription) return res.status(404).json({ message: 'الاشتراك غير موجود بحسابك أو لا يقبل التجديد.' });
    if (subscription.renewalRequest?.paymentStatus === 'pending') return res.status(409).json({ message: 'لديك طلب تجديد قيد المراجعة بالفعل.' });
    const amount = Number(subscription.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) return res.status(409).json({ message: 'قيمة التجديد غير صحيحة. تواصل مع الإدارة.' });
    if (value.paymentMethod === 'wallet') {
      const client = await Client.findOne({ _id: req.clientId, status: 'نشط', walletFrozen: { $ne: true } }).select('walletBalance walletFrozen');
      if (!client) return res.status(403).json({ message: 'المحفظة غير متاحة حاليًا. اختار التحويل أو تواصل مع الإدارة.' });
      if (Number(client.walletBalance || 0) < amount) return res.status(409).json({ message: 'رصيد المحفظة غير كافٍ. اختار التحويل أو اشحن المحفظة.' });
    }
    subscription.renewalRequest = { paymentMethod: value.paymentMethod, paymentStatus: 'pending', requestedAt: new Date(), amount };
    subscription.history.push({ action: 'renewal_requested', note: 'طلب تجديد بطريقة ' + (value.paymentMethod === 'wallet' ? 'محفظة العميل' : 'تحويل أموال'), by: 'العميل' });
    await subscription.save();
    const paymentLabel = value.paymentMethod === 'wallet' ? 'محفظة العميل' : 'تحويل أموال';
    await notifyAdmins({ type:'admin_subscription_renewal_request', title:'طلب تجديد اشتراك', message:'طلب العميل ' + String(req.client.name || '') + ' تجديد الاشتراك ' + subscription.code + ' — طريقة الدفع: ' + paymentLabel + ' — القيمة الحالية: ' + amount + ' جنيه', link:'/admin?tab=commerceSubscriptions', dedupeKey:'subscription-renewal-request:' + String(subscription._id) + ':' + String(subscription.renewalRequest.requestedAt.getTime()) });
    return res.status(202).json({ message:'تم إرسال طلب التجديد بطريقة ' + paymentLabel + '. سيتم مراجعة الطلب وتأكيد السداد من الإدارة. لم يتم خصم أي مبلغ الآن.' });
  } catch (e) { return next(e); }
});

router.post('/client/request-visit', clientAuth, async (req, res, next) => {
  try {
    const { error, value } = Joi.object({ subscriptionId: Joi.string().hex().length(24).required(), preferredAt: Joi.date().iso().optional(), note: Joi.string().trim().max(500).allow('').default('') }).unknown(false).validate(req.body || {});
    if (error) return res.status(400).json({ message: 'بيانات طلب الزيارة غير صحيحة.' });
    const subscription = await findSubscriptionOne({ _id:value.subscriptionId, client:req.clientId, type:'maintenance', status:'active', endsAt:{ $gt:new Date() } }, { lean: true });
    if (!subscription) return res.status(404).json({ message:'لا يوجد اشتراك صيانة ساري على حسابك.' });
    await notifyAdmins({ type:'admin_subscription_visit_request', title:'طلب زيارة صيانة', message:'طلب العميل ' + String(req.client.name||'') + ' زيارة للاشتراك ' + subscription.code + (value.note ? ' — '+value.note : ''), link:'/admin?tab=commerceSubscriptions', dedupeKey:'subscription-visit-request:'+String(subscription._id)+':'+Date.now() });
    return res.status(202).json({ message:'تم إرسال طلب الزيارة للإدارة، وسيتم تأكيد الموعد معك.' });
  } catch(e) { return next(e); }
});

// Admin-only management API. Existing commerce subscriptions remain untouched.
router.get('/admin/plans', auth('admin'), async (req, res, next) => {
  try { return res.json({ plans: await SubscriptionPlan.find({}).sort({ createdAt: -1 }).lean() }); }
  catch (e) { return next(e); }
});
router.post('/admin/plans', auth('admin'), async (req, res, next) => {
  try {
    const { error, value } = planSchema.validate(req.body || {});
    if (error) return res.status(400).json({ message: 'راجع بيانات الخطة والسعر والمدة.' });
    const plan = await SubscriptionPlan.create(value);
    return res.status(201).json({ message: 'تم إنشاء الخطة.', plan });
  } catch (e) { return next(e); }
});
router.patch('/admin/plans/:id', auth('admin'), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الخطة غير صالح.' });
  try {
    const { error, value } = planPatchSchema.validate(req.body || {});
    if (error) return res.status(400).json({ message: 'بيانات التعديل غير صحيحة.' });
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ message: 'الخطة غير موجودة.' });
    return res.json({ message: 'تم تحديث الخطة.', plan });
  } catch (e) { return next(e); }
});
router.get('/admin/list', auth('admin'), async (req, res, next) => {
  try {
    const filter = {};
    if (TYPES.includes(String(req.query.type || ''))) filter.type = String(req.query.type);
    if (['pending','active','paused','expired','cancelled'].includes(String(req.query.status || ''))) filter.status = String(req.query.status);
    if (req.query.expiring === '7') { filter.status = 'active'; filter.endsAt = { $gte: new Date(), $lte: new Date(Date.now() + 7*86400000) }; }
    if (req.query.q) { const q = String(req.query.q).trim().slice(0,100); filter.$or = [{ code: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i') },{ clientName: new RegExp(q,'i') },{ clientPhone: new RegExp(q,'i') }]; }
    const subscriptions = await findSubscriptions(filter, { select: '+iptvUsernameEncrypted +iptvPasswordEncrypted', sort: { endsAt: 1 }, limit: 500 });
    const rows = subscriptions.map(s => { const v = safeClient(s); if (v.type === 'iptv') { try { v.iptvUsername = decrypt(s.iptvUsernameEncrypted); } catch (_) { v.iptvUsername = ''; } try { v.iptvPassword = decrypt(s.iptvPasswordEncrypted); } catch (_) { v.iptvPassword = ''; } } return v; });
    return res.json({ subscriptions: rows });
  } catch (e) { return next(e); }
});
router.post('/admin/create', auth('admin'), async (req, res, next) => {
  try {
    const { error, value } = createSchema.validate(req.body || {});
    if (error) return res.status(400).json({ message: 'راجع بيانات الاشتراك.' });
    const client = await Client.findOne({ phone: value.clientPhone, archivedAt: null });
    if (!client) return res.status(404).json({ message: 'رقم العميل غير مسجل.' });
    const plan = value.planId ? await SubscriptionPlan.findOne({ _id: value.planId, type: value.type }).lean() : null;
    if (value.planId && !plan) return res.status(404).json({ message: 'الخطة غير موجودة أو نوعها مختلف.' });
    const amount = Number(value.amount ?? plan?.price);
    const durationDays = Number(value.durationDays ?? plan?.durationDays);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) return res.status(400).json({ message: 'يجب تحديد سعر ومدة صحيحين من إعدادات الإدارة.' });
    if (value.type === 'iptv' && (!value.iptvUsername || !value.iptvPassword)) return res.status(400).json({ message: 'بيانات دخول IPTV مطلوبة.' });
    const startsAt = value.startsAt ? new Date(value.startsAt) : new Date();
    const SubscriptionModel = modelForType(value.type);
    const subscriptionData = {
      ...value, code: makeCode(), plan: plan?._id || null, client: client._id, clientName: client.name, clientPhone: client.phone,
      amount, durationDays, startsAt, endsAt: new Date(startsAt.getTime() + durationDays*86400000),
      visitsIncluded: value.visitsIncluded ?? plan?.visitCount ?? 0,
      includedServices: plan?.includedServices || [], excludedSupplies: plan?.excludedSupplies || [],
      allowedDevices: value.allowedDevices ?? plan?.allowedDevices ?? 1,
      iptvUsernameEncrypted: value.iptvUsername ? encrypt(value.iptvUsername) : '',
      iptvPasswordEncrypted: value.iptvPassword ? encrypt(value.iptvPassword) : '',
      maintenanceDetails: value.type === 'maintenance' ? { dishSize: value.dishSize || '', receiverType: value.receiverType || '', visitsIncluded: value.visitsIncluded ?? plan?.visitCount ?? 0 } : undefined,
      localDetails: value.type === 'air_network' ? { networkName: value.networkName || '', activationCode: value.activationCode || '', deviceType: value.deviceType || '' } : undefined,
      entertainmentDetails: value.type === 'iptv' ? { deviceType: value.deviceType || '', portalUrl: value.portalUrl || '', usernameEncrypted: value.iptvUsername ? encrypt(value.iptvUsername) : '', passwordEncrypted: value.iptvPassword ? encrypt(value.iptvPassword) : '', allowedDevices: value.allowedDevices ?? plan?.allowedDevices ?? 1 } : undefined,
      history: [{ action: 'created', note: 'إنشاء الاشتراك', by: String(req.user?.name || 'الإدارة') }]
    };
    const subscription = await SubscriptionModel.create(subscriptionData);
    if (value.type === 'iptv') { subscription.iptvUsername = undefined; subscription.iptvPassword = undefined; }
    await createNotification({ recipientRole: 'client', recipientId: client._id, type: 'subscription_activated', title: 'تم تفعيل اشتراكك', message: 'تم تفعيل اشتراك ' + subscription.code + ' حتى ' + subscription.endsAt.toLocaleDateString('ar-EG'), link: '/client' });
    const created = safeClient(subscription.toObject());
    if (value.type === 'iptv') { created.iptvUsername = value.iptvUsername; created.iptvPassword = value.iptvPassword; }
    return res.status(201).json({ message: 'تم إنشاء الاشتراك وتفعيله.', subscription: created });
  } catch (e) { return next(e); }
});
router.patch('/admin/:id/status', auth('admin'), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الاشتراك غير صالح.' });
  const { error, value } = Joi.object({ status: Joi.string().valid('active','paused','cancelled').required(), note: Joi.string().trim().max(500).allow('').default('') }).unknown(false).validate(req.body || {});
  if (error) return res.status(400).json({ message: 'الحالة غير صحيحة.' });
  let session;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      const subscription = await findSubscriptionById(req.params.id, { session });
      if (!subscription) { result = { kind: 'missing' }; return; }
      const wasPending = subscription.status === 'pending';
      const needsInitialActivation = value.status === 'active' && subscription.paymentStatus === 'pending' && Boolean(subscription.paymentRequestedAt);
      let transactionNumber = '';
      if (needsInitialActivation) {
        if (subscription.paymentMethod === 'wallet' && Number(subscription.amount || 0) > 0) {
          const paymentKey = 'unified-subscription-initial:' + String(subscription._id);
          const prior = await WalletTransaction.findOne({ client: subscription.client, idempotencyKey: paymentKey }).session(session).lean();
          if (!prior) {
            const client = await Client.findOne({
              _id: subscription.client, archivedAt: null, status: 'نشط',
              walletFrozen: { $ne: true }, walletBalance: { $gte: Number(subscription.amount || 0) }
            }).session(session);
            if (!client) { result = { kind: 'insufficient' }; return; }
            const before = Number(client.walletBalance || 0);
            const updated = await Client.findOneAndUpdate({
              _id: client._id, archivedAt: null, status: 'نشط',
              walletFrozen: { $ne: true }, walletBalance: { $gte: Number(subscription.amount || 0) }
            }, { $inc: { walletBalance: -Number(subscription.amount || 0) } }, {
              new: true, session, runValidators: true
            });
            if (!updated) { result = { kind: 'insufficient' }; return; }
            const transaction = new WalletTransaction({
              client: client._id, type: 'client_subscription_payment',
              amount: -Number(subscription.amount || 0), balanceBefore: before,
              balanceAfter: Number(updated.walletBalance),
              description: 'تفعيل ' + publicServiceName(subscription.type) + ' ' + subscription.code + ' من محفظة العميل',
              idempotencyKey: paymentKey
            });
            await transaction.save({ session });
            transactionNumber = transaction.transactionNumber || '';
          } else transactionNumber = prior.transactionNumber || '';
        }
        subscription.paymentStatus = 'paid';
        subscription.startsAt = new Date();
        subscription.endsAt = new Date(subscription.startsAt.getTime() + Number(subscription.durationDays) * 86400000);
      }
      subscription.status = value.status;
      subscription.history.push({
        action: value.status,
        note: value.note || (wasPending && value.status === 'active' ? 'مراجعة طلب الاشتراك وتأكيد السداد' : 'تحديث الحالة من الإدارة'),
        by: String(req.user?.name || 'الإدارة')
      });
      if (transactionNumber) subscription.history.push({ action: 'payment_received', note: 'رقم العملية: ' + transactionNumber, by: String(req.user?.name || 'الإدارة') });
      await subscription.save({ session });
      result = { kind: 'updated', subscription, wasPending, needsInitialActivation, transactionNumber };
    });
    if (result?.kind === 'missing') return res.status(404).json({ message: 'الاشتراك غير موجود.' });
    if (result?.kind === 'insufficient') return res.status(409).json({ message: 'رصيد محفظة العميل غير كافٍ. لم يتم تفعيل الاشتراك أو خصم أي مبلغ.' });
    if (result?.needsInitialActivation) {
      await createNotification({
        recipientRole: 'client', recipientId: result.subscription.client,
        type: 'subscription_activated', title: 'تم تفعيل اشتراكك',
        message: 'تم تفعيل الاشتراك ' + result.subscription.code + ' حتى ' + result.subscription.endsAt.toLocaleDateString('ar-EG'),
        link: '/client'
      });
    }
    return res.json({
      message: result?.needsInitialActivation ? 'تم تأكيد السداد وتفعيل الاشتراك.' : 'تم تحديث حالة الاشتراك.',
      subscription: safeClient(result.subscription.toObject()),
      transactionNumber: result.transactionNumber || ''
    });
  } catch (e) { return next(e); }
  finally { if (session) await session.endSession(); }
});
router.post('/admin/:id/renew', auth('admin'), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الاشتراك غير صالح.' });
  const { error, value } = Joi.object({ amount: Joi.number().strict().min(0).max(100000000).required(), durationDays: Joi.number().integer().min(1).max(3650).required() }).unknown(false).validate(req.body || {});
  if (error) return res.status(400).json({ message: 'حدد سعر ومدة التجديد.' });
  let session;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      const s = await findSubscriptionById(req.params.id, { session });
      if (!s) { result = { kind: 'missing' }; return; }
      let transactionNumber = '';
      const request = s.renewalRequest;
      if (request?.paymentStatus === 'pending' && request.paymentMethod === 'wallet' && Number(value.amount) > 0) {
        const paymentKey = 'special-subscription-renewal:' + String(s._id) + ':' + String(request.requestedAt?.getTime?.() || 0);
        const prior = await WalletTransaction.findOne({ client: s.client, idempotencyKey: paymentKey }).session(session).lean();
        if (!prior) {
          const client = await Client.findOne({ _id: s.client, archivedAt: null, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: Number(value.amount) } }).session(session);
          if (!client) { result = { kind: 'insufficient' }; return; }
          const before = Number(client.walletBalance || 0);
          const updated = await Client.findOneAndUpdate(
            { _id: client._id, archivedAt: null, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: Number(value.amount) } },
            { $inc: { walletBalance: -Number(value.amount) } }, { new: true, session, runValidators: true }
          );
          if (!updated) { result = { kind: 'insufficient' }; return; }
          const transaction = new WalletTransaction({
            client: client._id, type: 'client_subscription_payment', amount: -Number(value.amount),
            balanceBefore: before, balanceAfter: Number(updated.walletBalance),
            description: 'تجديد ' + publicServiceName(s.type) + ' ' + s.code + ' من محفظة العميل',
            idempotencyKey: paymentKey
          });
          await transaction.save({ session });
          transactionNumber = transaction.transactionNumber || '';
        } else transactionNumber = prior.transactionNumber || '';
        request.paymentStatus = 'paid';
      } else if (request?.paymentStatus === 'pending' && request.paymentMethod === 'transfer') {
        request.paymentStatus = 'paid';
      }
      const start = s.endsAt > new Date() ? s.endsAt : new Date();
      s.amount = value.amount; s.durationDays = value.durationDays; s.startsAt = start; s.endsAt = new Date(start.getTime()+value.durationDays*86400000); s.status = 'active';
      if (request?.paymentMethod === 'wallet') s.history.push({ action: 'renewed', note: 'تجديد من محفظة العميل لمدة '+value.durationDays+' يوم', by: String(req.user?.name || 'الإدارة') });
      else if (request?.paymentMethod === 'transfer') s.history.push({ action: 'renewed', note: 'تجديد بعد مراجعة التحويل لمدة '+value.durationDays+' يوم', by: String(req.user?.name || 'الإدارة') });
      else s.history.push({ action: 'renewed', note: 'تجديد لمدة '+value.durationDays+' يوم', by: String(req.user?.name || 'الإدارة') });
      if (transactionNumber) s.history.push({ action: 'payment_received', note: 'رقم العملية: '+transactionNumber, by: String(req.user?.name || 'الإدارة') });
      await s.save({ session });
      result = { kind: 'renewed', subscription: s };
    });
    if (result?.kind === 'missing') return res.status(404).json({ message: 'الاشتراك غير موجود.' });
    if (result?.kind === 'insufficient') return res.status(409).json({ message: 'رصيد محفظة العميل غير كافٍ. لم يتم التجديد أو الخصم.' });
    await createNotification({ recipientRole: 'client', recipientId: result.subscription.client, type: 'subscription_renewed', title: 'تم تجديد اشتراكك', message: 'تم تجديد الاشتراك ' + result.subscription.code, link: '/client' });
    return res.json({ message: 'تم تجديد الاشتراك وتأكيد طريقة السداد.', subscription: safeClient(result.subscription.toObject()) });
  } catch (e) { return next(e); }
  finally { if (session) await session.endSession(); }
});
router.post('/admin/visits', auth('admin'), async (req, res, next) => {
  const { error, value } = visitSchema.validate(req.body || {});
  if (error) return res.status(400).json({ message: 'بيانات الزيارة غير صحيحة.' });
  try {
    const subscription = await findSubscriptionById(value.subscriptionId);
    const technician = await Fanni.findOne({ _id: value.technicianId, role: 'fanni', status: 'معتمد', archivedAt: null });
    if (!subscription || !technician) return res.status(404).json({ message: 'الاشتراك أو الفني غير موجود أو غير معتمد.' });
    if (subscription.type !== 'maintenance' || subscription.status !== 'active') return res.status(409).json({ message: 'يمكن إسناد الزيارات لاشتراك صيانة سنوية ساري فقط.' });
    const visit = await SubscriptionVisit.create({ subscription: subscription._id, client: subscription.client, technician: technician._id, scheduledAt: value.scheduledAt, createdBy: String(req.user?.name || 'الإدارة') });
    await createNotification({ recipientRole: 'fanni', recipientId: technician._id, type: 'subscription_visit_assigned', title: 'زيارة صيانة جديدة', message: 'تم إسناد زيارة لك للاشتراك ' + subscription.code, link: '/fanni' });
    await createNotification({ recipientRole: 'client', recipientId: subscription.client, type: 'subscription_visit_scheduled', title: 'تم تحديد موعد زيارة', message: 'موعد الزيارة ' + new Date(value.scheduledAt).toLocaleString('ar-EG'), link: '/client' });
    return res.status(201).json({ message: 'تم إسناد الزيارة للفني.', visit });
  } catch (e) { return next(e); }
});
router.get('/admin/visits', auth('admin'), async (req, res, next) => {
  try {
    const rows = await SubscriptionVisit.find({}).populate('technician','name phone').populate('client','name phone').sort({ scheduledAt: 1 }).limit(500).lean();
    return res.json({ visits: await attachVisitSubscriptions(rows, ['code','type']) });
  } catch (e) { return next(e); }
});

// Technicians can access only visits assigned to their authenticated account; no IPTV credentials or prices are returned.
router.get('/technician/visits', auth('fanni'), async (req, res, next) => {
  try {
    const rows = await SubscriptionVisit.find({ technician: req.user._id, status: { $in: ['scheduled','in_progress','awaiting_client_confirmation'] } }).populate('client','name phone').sort({ scheduledAt: 1 }).lean();
    const visits = await attachVisitSubscriptions(rows, ['code','address']);
    return res.set('Cache-Control','no-store').json({ visits });
  } catch (e) { return next(e); }
});
router.patch('/technician/visits/:id', auth('fanni'), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الزيارة غير صالح.' });
  const { error, value } = Joi.object({ status: Joi.string().valid('in_progress','completed').required(), workDescription: Joi.string().trim().max(2000).allow('').default('') }).unknown(false).validate(req.body || {});
  if (error) return res.status(400).json({ message: 'بيانات تنفيذ الزيارة غير صحيحة.' });
  try {
    const visit = await SubscriptionVisit.findOne({ _id: req.params.id, technician: req.user._id, status: { $in: ['scheduled','in_progress','awaiting_client_confirmation'] } });
    if (!visit) return res.status(404).json({ message: 'الزيارة غير موجودة ضمن الزيارات المسندة إليك.' });
    if (visit.status === 'awaiting_client_confirmation') return res.status(409).json({ message: 'تم إرسال طلب إنهاء الخدمة بالفعل، وفي انتظار تأكيد العميل.' });
    visit.workDescription = value.workDescription;
    if (value.status === 'in_progress') visit.status = 'in_progress';
    if (value.status === 'completed') {
      visit.technicianCompletedAt = visit.technicianCompletedAt || new Date();
      visit.status = visit.clientConfirmedAt ? 'completed' : 'awaiting_client_confirmation';
      if (visit.status === 'completed') visit.completedAt = new Date();
    }
    await visit.save();
    if (value.status === 'completed') await createNotification({ recipientRole: 'client', recipientId: visit.client, type: 'subscription_visit_awaiting_confirmation', title: 'الفني طلب تأكيد إنهاء الخدمة', message: 'الفني أنهى العمل. راجع الزيارة وأكد إنهاء الخدمة لإغلاقها.', link: '/client' });
    return res.json({ message: visit.status === 'completed' ? 'تم تأكيد إنهاء الخدمة من الطرفين.' : value.status === 'completed' ? 'تم إرسال طلب إنهاء الخدمة للعميل، والزيارة لم تُغلق بعد.' : 'تم تحديث الزيارة.', visit });
  } catch (e) { return next(e); }
});

router.post('/client/visits/:id/confirm-completion', clientAuth, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الزيارة غير صالح.' });
  try {
    const visit = await SubscriptionVisit.findOne({ _id: req.params.id, client: req.clientId });
    if (!visit) return res.status(404).json({ message: 'الزيارة غير موجودة بحسابك.' });
    if (!visit.technicianCompletedAt && visit.status !== 'awaiting_client_confirmation') return res.status(409).json({ message: 'لا يمكن تأكيد الإنهاء قبل أن يرسل الفني طلب إنهاء الخدمة.' });
    if (visit.clientConfirmedAt) return res.json({ message: 'سبق تأكيد إنهاء هذه الزيارة.', visit });
    visit.clientConfirmedAt = new Date();
    if (visit.technicianCompletedAt) {
      visit.status = 'completed';
      visit.completedAt = new Date();
    }
    await visit.save();
    if (visit.status === 'completed') await createNotification({ recipientRole: 'fanni', recipientId: visit.technician, type: 'subscription_visit_completed', title: 'العميل أكد إنهاء الخدمة', message: 'أكد العميل إنهاء الزيارة. تم إغلاق الخدمة.', link: '/fanni' });
    return res.json({ message: visit.status === 'completed' ? 'تم تأكيد الطرفين وإغلاق الخدمة.' : 'تم تسجيل تأكيدك، وفي انتظار إنهاء الفني للخدمة.', visit });
  } catch (e) { return next(e); }
});

module.exports = router;
