'use strict';
const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Client = require('../models/Client');
const Fanni = require('../models/Fanni');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UnifiedSubscription = require('../models/UnifiedSubscription');
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
const visitSchema = Joi.object({
  subscriptionId: Joi.string().hex().length(24).required(), technicianId: Joi.string().hex().length(24).required(),
  scheduledAt: Joi.date().iso().required()
}).unknown(false);
const safeClient = (s) => {
  const v = { ...s };
  delete v.iptvPasswordEncrypted;
  return v;
};
function makeCode() { return 'HS-' + crypto.randomBytes(5).toString('hex').toUpperCase(); }
function publicClientSubscription(s) {
  const v = s.toObject ? s.toObject() : { ...s };
  if (v.type === 'iptv') {
    try { v.iptvPassword = decrypt(v.iptvPasswordEncrypted); } catch (_) { v.iptvPassword = ''; }
  }
  delete v.iptvPasswordEncrypted;
  return v;
}

// Public plan catalog; prices and durations are always controlled by administration.
router.get('/plans', async (req, res, next) => {
  try {
    const filter = { active: true };
    if (TYPES.includes(String(req.query.type || ''))) filter.type = String(req.query.type);
    const plans = await SubscriptionPlan.find(filter).sort({ type: 1, price: 1 }).lean();
    return res.set('Cache-Control','no-store').json({ plans });
  } catch (e) { return next(e); }
});

// Customer sees only their own subscriptions and their IPTV credentials.
router.get('/client/mine', clientAuth, async (req, res, next) => {
  try {
    const subscriptions = await UnifiedSubscription.find({ client: req.clientId }).sort({ createdAt: -1 }).lean();
    const visits = await SubscriptionVisit.find({ client: req.clientId }).sort({ scheduledAt: 1 }).lean();
    const enriched = subscriptions.map(s => {
      if (s.type === 'iptv') { try { s.iptvPassword = decrypt(s.iptvPasswordEncrypted); } catch (_) { s.iptvPassword = ''; } }
      delete s.iptvPasswordEncrypted;
      return s;
    });
    return res.set('Cache-Control','no-store').json({ subscriptions: enriched, visits });
  } catch (e) { return next(e); }
});

// Customer requests a subscription; activation/payment remains an explicit admin decision.
router.post('/client/request', clientAuth, async (req, res, next) => {
  try {
    const { error, value } = Joi.object({ planId: Joi.string().hex().length(24).required(), notes: Joi.string().trim().max(1000).allow('').default('') }).unknown(false).validate(req.body || {});
    if (error) return res.status(400).json({ message: 'بيانات طلب الاشتراك غير صحيحة.' });
    const plan = await SubscriptionPlan.findOne({ _id: value.planId, active: true }).lean();
    if (!plan) return res.status(404).json({ message: 'الباقة غير متاحة حاليًا.' });
    const existing = await UnifiedSubscription.findOne({ client: req.clientId, plan: plan._id, status: { $in: ['active','paused'] }, endsAt: { $gte: new Date() } }).lean();
    if (existing) return res.status(409).json({ message: 'لديك اشتراك قائم في هذه الباقة بالفعل.' });
    await notifyAdmins({ type: 'admin_subscription_request', title: 'طلب اشتراك جديد', message: 'طلب العميل ' + String(req.client.name || '') + ' الاشتراك في ' + plan.name, link: '/admin?tab=commerceSubscriptions', dedupeKey: 'subscription-request:' + String(req.clientId) + ':' + String(plan._id) + ':' + Date.now() });
    return res.status(202).json({ message: 'تم إرسال طلب الاشتراك للإدارة. سيتم التواصل معك لتأكيد التفعيل والسداد.' });
  } catch (e) { return next(e); }
});

router.post('/client/request-renewal', clientAuth, async (req, res, next) => {
  try {
    const { error, value } = Joi.object({ subscriptionId: Joi.string().hex().length(24).required() }).unknown(false).validate(req.body || {});
    if (error) return res.status(400).json({ message: 'معرّف الاشتراك غير صالح.' });
    const subscription = await UnifiedSubscription.findOne({ _id: value.subscriptionId, client: req.clientId, status: { $in: ['active','expired','paused'] } }).lean();
    if (!subscription) return res.status(404).json({ message: 'الاشتراك غير موجود بحسابك أو لا يقبل التجديد.' });
    await notifyAdmins({ type:'admin_subscription_renewal_request', title:'طلب تجديد اشتراك', message:'طلب العميل ' + String(req.client.name || '') + ' تجديد الاشتراك ' + subscription.code, link:'/admin?tab=commerceSubscriptions', dedupeKey:'subscription-renewal-request:' + String(subscription._id) + ':' + Date.now() });
    return res.status(202).json({ message:'تم إرسال طلب التجديد للإدارة. سيتم التواصل معك لتأكيد السعر والسداد.' });
  } catch (e) { return next(e); }
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
    const { error, value } = planSchema.fork(['type','name','price','durationDays'], s => s.optional()).min(1).validate(req.body || {});
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
    if (['active','paused','expired','cancelled'].includes(String(req.query.status || ''))) filter.status = String(req.query.status);
    if (req.query.expiring === '7') { filter.status = 'active'; filter.endsAt = { $gte: new Date(), $lte: new Date(Date.now() + 7*86400000) }; }
    if (req.query.q) { const q = String(req.query.q).trim().slice(0,100); filter.$or = [{ code: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i') },{ clientName: new RegExp(q,'i') },{ clientPhone: new RegExp(q,'i') }]; }
    const subscriptions = await UnifiedSubscription.find(filter).select('+iptvPasswordEncrypted').sort({ endsAt: 1 }).limit(500).lean();
    const rows = subscriptions.map(s => { const v = safeClient(s); if (v.type === 'iptv') { try { v.iptvPassword = decrypt(s.iptvPasswordEncrypted); } catch (_) { v.iptvPassword = ''; } } return v; });
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
    const subscription = await UnifiedSubscription.create({
      ...value, code: makeCode(), plan: plan?._id || null, client: client._id, clientName: client.name, clientPhone: client.phone,
      amount, durationDays, startsAt, endsAt: new Date(startsAt.getTime() + durationDays*86400000),
      visitsIncluded: value.visitsIncluded ?? plan?.visitCount ?? 0,
      includedServices: plan?.includedServices || [], excludedSupplies: plan?.excludedSupplies || [],
      allowedDevices: value.allowedDevices ?? plan?.allowedDevices ?? 1,
      iptvPasswordEncrypted: value.iptvPassword ? encrypt(value.iptvPassword) : '',
      history: [{ action: 'created', note: 'إنشاء الاشتراك', by: String(req.user?.name || 'الإدارة') }]
    });
    if (value.type === 'iptv') subscription.iptvPassword = undefined;
    await createNotification({ recipientRole: 'client', recipientId: client._id, type: 'subscription_activated', title: 'تم تفعيل اشتراكك', message: 'تم تفعيل اشتراك ' + subscription.code + ' حتى ' + subscription.endsAt.toLocaleDateString('ar-EG'), link: '/client' });
    const created = safeClient(subscription.toObject());
    if (value.type === 'iptv') created.iptvPassword = value.iptvPassword;
    return res.status(201).json({ message: 'تم إنشاء الاشتراك وتفعيله.', subscription: created });
  } catch (e) { return next(e); }
});
router.patch('/admin/:id/status', auth('admin'), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الاشتراك غير صالح.' });
  const { error, value } = Joi.object({ status: Joi.string().valid('active','paused','cancelled').required(), note: Joi.string().trim().max(500).allow('').default('') }).unknown(false).validate(req.body || {});
  if (error) return res.status(400).json({ message: 'الحالة غير صحيحة.' });
  try {
    const s = await UnifiedSubscription.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'الاشتراك غير موجود.' });
    s.status = value.status; s.history.push({ action: value.status, note: value.note, by: String(req.user?.name || 'الإدارة') });
    await s.save();
    return res.json({ message: 'تم تحديث حالة الاشتراك.', subscription: safeClient(s.toObject()) });
  } catch (e) { return next(e); }
});
router.post('/admin/:id/renew', auth('admin'), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الاشتراك غير صالح.' });
  const { error, value } = Joi.object({ amount: Joi.number().strict().min(0).max(100000000).required(), durationDays: Joi.number().integer().min(1).max(3650).required() }).unknown(false).validate(req.body || {});
  if (error) return res.status(400).json({ message: 'حدد سعر ومدة التجديد.' });
  try {
    const s = await UnifiedSubscription.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'الاشتراك غير موجود.' });
    const start = s.endsAt > new Date() ? s.endsAt : new Date();
    s.amount = value.amount; s.durationDays = value.durationDays; s.startsAt = start; s.endsAt = new Date(start.getTime()+value.durationDays*86400000); s.status = 'active';
    s.history.push({ action: 'renewed', note: 'تجديد لمدة '+value.durationDays+' يوم', by: String(req.user?.name || 'الإدارة') });
    await s.save();
    await createNotification({ recipientRole: 'client', recipientId: s.client, type: 'subscription_renewed', title: 'تم تجديد اشتراكك', message: 'تم تجديد الاشتراك ' + s.code, link: '/client' });
    return res.json({ message: 'تم تجديد الاشتراك.', subscription: safeClient(s.toObject()) });
  } catch (e) { return next(e); }
});
router.post('/admin/visits', auth('admin'), async (req, res, next) => {
  const { error, value } = visitSchema.validate(req.body || {});
  if (error) return res.status(400).json({ message: 'بيانات الزيارة غير صحيحة.' });
  try {
    const subscription = await UnifiedSubscription.findById(value.subscriptionId);
    const technician = await Fanni.findOne({ _id: value.technicianId, role: 'fanni', status: 'معتمد', archivedAt: null });
    if (!subscription || !technician) return res.status(404).json({ message: 'الاشتراك أو الفني غير موجود أو غير معتمد.' });
    const visit = await SubscriptionVisit.create({ subscription: subscription._id, client: subscription.client, technician: technician._id, scheduledAt: value.scheduledAt, createdBy: String(req.user?.name || 'الإدارة') });
    await createNotification({ recipientRole: 'fanni', recipientId: technician._id, type: 'subscription_visit_assigned', title: 'زيارة صيانة جديدة', message: 'تم إسناد زيارة لك للاشتراك ' + subscription.code, link: '/fanni' });
    await createNotification({ recipientRole: 'client', recipientId: subscription.client, type: 'subscription_visit_scheduled', title: 'تم تحديد موعد زيارة', message: 'موعد الزيارة ' + new Date(value.scheduledAt).toLocaleString('ar-EG'), link: '/client' });
    return res.status(201).json({ message: 'تم إسناد الزيارة للفني.', visit });
  } catch (e) { return next(e); }
});
router.get('/admin/visits', auth('admin'), async (req, res, next) => {
  try { return res.json({ visits: await SubscriptionVisit.find({}).populate('subscription','code type').populate('technician','name phone').sort({ scheduledAt: 1 }).limit(500).lean() }); }
  catch (e) { return next(e); }
});

// Technicians can access only visits assigned to their authenticated account; no IPTV credentials or prices are returned.
router.get('/technician/visits', auth('fanni'), async (req, res, next) => {
  try {
    const visits = await SubscriptionVisit.find({ technician: req.user._id, status: { $in: ['scheduled','in_progress'] } }).populate('subscription','code type address dishSize receiverType deviceType networkName').populate('client','name phone').sort({ scheduledAt: 1 }).lean();
    return res.set('Cache-Control','no-store').json({ visits });
  } catch (e) { return next(e); }
});
router.patch('/technician/visits/:id', auth('fanni'), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الزيارة غير صالح.' });
  const { error, value } = Joi.object({ status: Joi.string().valid('in_progress','completed').required(), workDescription: Joi.string().trim().max(2000).allow('').default(''), beforePhotos: Joi.array().items(Joi.string().uri().max(500)).max(8).default([]), afterPhotos: Joi.array().items(Joi.string().uri().max(500)).max(8).default([]) }).unknown(false).validate(req.body || {});
  if (error) return res.status(400).json({ message: 'بيانات تنفيذ الزيارة غير صحيحة.' });
  try {
    const visit = await SubscriptionVisit.findOne({ _id: req.params.id, technician: req.user._id });
    if (!visit) return res.status(404).json({ message: 'الزيارة غير موجودة ضمن الزيارات المسندة إليك.' });
    visit.status = value.status; visit.workDescription = value.workDescription;
    if (value.beforePhotos.length) visit.beforePhotos = value.beforePhotos;
    if (value.afterPhotos.length) visit.afterPhotos = value.afterPhotos;
    if (value.status === 'completed') visit.completedAt = new Date();
    await visit.save();
    return res.json({ message: 'تم تحديث الزيارة.', visit });
  } catch (e) { return next(e); }
});
module.exports = router;
