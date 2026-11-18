'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Referral = require('../models/Referral');
const Client = require('../models/Client');
const Fanni = require('../models/Fanni');
const AdminConfig = require('../models/AdminConfig');
const AdminAuditLog = require('../models/AdminAuditLog');
const { auth } = require('../middleware/auth');
const { makeReferralCode } = require('../utils/referralCodes');

const router = express.Router();
const isAdmin = user => Boolean(user && (user.role === 'admin' || user.adminRole));
const actorName = req => String(req.user?.name || req.user?.phone || 'الإدارة').slice(0, 120);

router.get('/me', auth(), async (req, res, next) => {
  try {
    const kind = req.user?.role === 'client' ? 'client' : req.user?.role === 'fanni' ? 'fanni' : null;
    if (!kind) return res.status(403).json({ message: 'الخدمة متاحة للعملاء والفنيين فقط.' });
    const accountId = req.userId || req.user?._id;
    const config = await AdminConfig.findOne({ key: 'main' }).select('settings').lean();
    const code = makeReferralCode(kind, String(accountId));
    const base = String(process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '') ||
      (req.get('origin') || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const path = kind === 'client' ? '/client.html' : '/fanni.html';
    const url = base + path + '?ref=' + encodeURIComponent(code);
    const referrals = await Referral.find({ kind, inviter: accountId }).sort({ invitedAt: -1 }).limit(100).lean();
    return res.set('Cache-Control', 'no-store').json({
      enabled: config?.settings?.referralsEnabled !== false,
      kind, code, url, referrals,
      totals: { count: referrals.length, completed: referrals.filter(x => x.status === 'completed').length }
    });
  } catch (err) { next(err); }
});

router.get('/admin/summary', auth('admin'), async (req, res, next) => {
  try {
    const config = await AdminConfig.findOne({ key: 'main' }).select('settings').lean();
    const [total, clients, technicians, statuses, rewards] = await Promise.all([
      Referral.countDocuments({}),
      Referral.countDocuments({ kind: 'client' }),
      Referral.countDocuments({ kind: 'fanni' }),
      Referral.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Referral.aggregate([{ $group: {
        _id: '$kind',
        inviterPaid: { $sum: { $cond: [{ $ne: ['$inviterReward.paidAt', null] }, '$inviterReward.amount', 0] } },
        inviteePaid: { $sum: { $cond: [{ $ne: ['$inviteeReward.paidAt', null] }, '$inviteeReward.amount', 0] } },
        inviterDue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'eligible'] }, { $eq: ['$inviterReward.paidAt', null] }] }, '$inviterReward.amount', 0] } },
        inviteeDue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'eligible'] }, { $eq: ['$inviteeReward.paidAt', null] }] }, '$inviteeReward.amount', 0] } }
      } }])
    ]);
    return res.set('Cache-Control', 'no-store').json({
      enabled: config?.settings?.referralsEnabled !== false,
      total, clients, technicians,
      statuses: Object.fromEntries(statuses.map(x => [x._id, x.count])),
      rewards
    });
  } catch (err) { next(err); }
});

router.get('/admin/list', auth('admin'), async (req, res, next) => {
  try {
    const filter = {};
    if (['client', 'fanni'].includes(String(req.query.kind))) filter.kind = String(req.query.kind);
    if (['pending', 'in_progress', 'eligible', 'completed', 'rejected'].includes(String(req.query.status))) filter.status = String(req.query.status);
    if (req.query.from || req.query.to) {
      filter.invitedAt = {};
      if (req.query.from && !Number.isNaN(Date.parse(req.query.from))) filter.invitedAt.$gte = new Date(req.query.from);
      if (req.query.to && !Number.isNaN(Date.parse(req.query.to))) filter.invitedAt.$lte = new Date(req.query.to);
    }
    if (req.query.paid === 'yes') filter.$and = [{ 'inviterReward.paidAt': { $ne: null } }, { 'inviteeReward.paidAt': { $ne: null } }];
    if (req.query.paid === 'no') filter.$or = [{ 'inviterReward.paidAt': null }, { 'inviteeReward.paidAt': null }];
    const rows = await Referral.find(filter).sort({ invitedAt: -1 }).limit(500).lean();
    const ids = [...new Set(rows.flatMap(x => [String(x.inviter), String(x.invitee)]))];
    const [clients, fannis] = await Promise.all([
      Client.find({ _id: { $in: ids } }).select('name phone').lean(),
      Fanni.find({ _id: { $in: ids } }).select('name phone role').lean()
    ]);
    const people = new Map([...clients, ...fannis].map(x => [String(x._id), { id: String(x._id), name: x.name, phone: x.phone }]));
    let result = rows.map(x => ({ ...x, inviterData: people.get(String(x.inviter)) || null, inviteeData: people.get(String(x.invitee)) || null }));
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q) result = result.filter(x => [x.number, x.inviterData?.name, x.inviterData?.phone, x.inviter, x.inviteeData?.name, x.inviteeData?.phone, x.invitee].some(v => String(v || '').toLowerCase().includes(q)));
    return res.set('Cache-Control', 'no-store').json({ referrals: result, data: result });
  } catch (err) { next(err); }
});

router.get('/admin/:id', auth('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'رقم الدعوة غير صالح.' });
    const item = await Referral.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ message: 'الدعوة غير موجودة.' });
    const Model = item.kind === 'client' ? Client : Fanni;
    const [inviter, invitee, transactions] = await Promise.all([
      Model.findById(item.inviter).select('name phone').lean(),
      Model.findById(item.invitee).select('name phone').lean(),
      WalletTransaction.find({ _id: { $in: [item.inviterReward?.walletTransaction, item.inviteeReward?.walletTransaction].filter(Boolean) } }).sort({ createdAt: 1 }).lean()
    ]);
    return res.json({ referral: item, inviter, invitee, transactions });
  } catch (err) { next(err); }
});

router.patch('/admin/settings', auth('admin'), async (req, res, next) => {
  try {
    if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ message: 'قيمة تشغيل النظام غير صحيحة.' });
    const config = await AdminConfig.findOneAndUpdate(
      { key: 'main' }, { $set: { 'settings.referralsEnabled': req.body.enabled } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    await AdminAuditLog.create({
      action: req.body.enabled ? 'تشغيل نظام الدعوات' : 'إيقاف إنشاء الدعوات الجديدة',
      category: 'referrals', target: 'settings',
      details: 'enabled=' + req.body.enabled + '; existing referrals continue to be processed',
      adminName: actorName(req), adminId: String(req.user?._id || ''), ip: String(req.ip || '').slice(0, 80)
    });
    return res.json({ enabled: config.settings.referralsEnabled !== false });
  } catch (err) { next(err); }
});

router.post('/admin/:id/reject', auth('admin'), async (req, res, next) => {
  const reason = String(req.body?.reason || '').trim();
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'رقم الدعوة غير صالح.' });
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ message: 'اكتب سبب رفض واضحًا من 3 إلى 500 حرف.' });
  try {
    const session = await mongoose.startSession();
    let referral;
    try {
      await session.withTransaction(async () => {
        referral = await Referral.findOneAndUpdate({
          _id: req.params.id, status: { $in: ['pending', 'in_progress', 'eligible'] },
          'inviterReward.paidAt': null, 'inviteeReward.paidAt': null
        }, {
          $set: { status: 'rejected', rejectedAt: new Date(), rejectedBy: req.user?._id || null, rejectionReason: reason, reviewedAt: new Date(), reviewedBy: req.user?._id || null }
        }, { new: true, session, runValidators: true });
      });
    } finally { await session.endSession(); }
    if (!referral) return res.status(409).json({ message: 'لا يمكن رفض الدعوة بعد صرف مكافأة أو بعد معالجتها.' });
    await AdminAuditLog.create({
      action: 'رفض دعوة', category: 'referrals', target: String(referral._id),
      details: 'number=' + referral.number + '; reason=' + reason,
      adminName: actorName(req), adminId: String(req.user?._id || ''), ip: String(req.ip || '').slice(0, 80)
    });
    return res.json({ message: 'تم رفض الدعوة وتسجيل السبب.', referral });
  } catch (err) { next(err); }
});

module.exports = router;
