'use strict';

const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const Referral = require('../models/Referral');
const ReferralClaim = require('../models/ReferralClaim');
const Client = require('../models/Client');
const Fanni = require('../models/Fanni');
const AdminConfig = require('../models/AdminConfig');
const AdminAuditLog = require('../models/AdminAuditLog');
const WalletTransaction = require('../models/WalletTransaction');
const { auth } = require('../middleware/auth');
const { clientAuth } = require('../middleware/clientAuth');
const { makeReferralCode, readReferralCode } = require('../utils/referralCodes');
const { refreshReferralProgress } = require('../services/referralRewards');

const router = express.Router();
const prepareFanniReferralLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'محاولات كثيرة لحفظ الدعوة. حاول بعد قليل.' } });
const actorName = req => String(req.user?.name || req.user?.phone || 'الإدارة').slice(0, 120);

async function sendMyReferral(req, res, next, kind, accountId) {
  try {
    const config = await AdminConfig.findOne({ key: 'main' }).select('settings').lean();
    const code = makeReferralCode(kind, String(accountId));
    const base = String(process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '') ||
      (req.get('origin') || (req.protocol + '://' + req.get('host'))).replace(/\/$/, '');
    const path = kind === 'client' ? '/client.html' : '/fanni.html';
    const url = base + path + '?ref=' + encodeURIComponent(code);
    const referrals = await Referral.find({ kind, inviter: accountId }).sort({ invitedAt: -1 }).limit(100).lean();
    return res.set('Cache-Control', 'no-store').json({
      enabled: config?.settings?.referralsEnabled !== false, kind, code, url, referrals,
      totals: { count: referrals.length, completed: referrals.filter(x => x.status === 'completed').length }
    });
  } catch (err) { next(err); }
}

router.get('/me/client', clientAuth, (req, res, next) => sendMyReferral(req, res, next, 'client', req.clientId));
router.get('/me/fanni', auth(), (req, res, next) => {
  if (req.user?.role !== 'fanni') return res.status(403).json({ message: 'الخدمة متاحة للفنيين فقط.' });
  return sendMyReferral(req, res, next, 'fanni', req.userId || req.user._id);
});

// Create a server-side, single-use invitation claim before sending a technician to the APK download page.
router.post('/prepare-fanni', prepareFanniReferralLimiter, async (req, res, next) => {
  try {
    const code = String(req.body?.referralCode || '').trim().slice(0, 50);
    const decoded = readReferralCode(code);
    if (!decoded || decoded.kind !== 'fanni') return res.status(400).json({ message: 'رابط الدعوة غير صالح أو غير مخصص للفنيين.' });
    const config = await AdminConfig.findOne({ key: 'main' }).select('settings').lean();
    if (config?.settings?.referralsEnabled === false) return res.status(403).json({ message: 'نظام الدعوات متوقف حاليًا.' });
    const inviter = await Fanni.findOne({ _id: decoded.inviterId, role: 'fanni', archivedAt: null }).select('_id').lean();
    if (!inviter) return res.status(404).json({ message: 'صاحب كود الدعوة غير موجود.' });
    // Bound claim minting per inviter as well as per source IP. Claims are short-lived
    // handoff credentials, not reusable referral codes.
    const claimsInLastHour = await ReferralClaim.countDocuments({
      inviter: inviter._id,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });
    if (claimsInLastHour >= 50) {
      return res.status(429).json({ message: 'تم تجاوز الحد المسموح لإنشاء روابط التسجيل المؤقتة. حاول بعد ساعة.' });
    }
    const claimToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await ReferralClaim.create({
      tokenHash: crypto.createHash('sha256').update(claimToken).digest('hex'),
      kind: 'fanni', inviter: inviter._id, inviteCodeUsed: decoded.code, expiresAt
    });
    return res.set('Cache-Control', 'no-store').status(201).json({ claimToken, expiresAt });
  } catch (err) { next(err); }
});

router.get('/admin/summary', auth('admin'), async (req, res, next) => {
  try {
    const config = await AdminConfig.findOne({ key: 'main' }).select('settings').lean();
    const [total, clients, technicians, statuses, riskReviewCount, rewards] = await Promise.all([
      Referral.countDocuments({}),
      Referral.countDocuments({ kind: 'client' }),
      Referral.countDocuments({ kind: 'fanni' }),
      Referral.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Referral.countDocuments({ riskFlags: { $exists: true, $ne: [] } }),
      Referral.aggregate([{ $group: {
        _id: '$kind',
        inviterPaid: { $sum: { $cond: [{ $ne: ['$inviterReward.paidAt', null] }, '$inviterReward.amount', 0] } },
        inviteePaid: { $sum: { $cond: [{ $ne: ['$inviteeReward.paidAt', null] }, '$inviteeReward.amount', 0] } },
        inviterDue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'eligible'] }, { $eq: ['$inviterReward.paidAt', null] }, { $eq: [{ $size: { $ifNull: ['$riskFlags', []] } }, 0] }] }, { $cond: [{ $eq: ['$kind', 'fanni'] }, 150, 50] }, 0] } },
        inviteeDue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'eligible'] }, { $eq: ['$inviteeReward.paidAt', null] }, { $eq: [{ $size: { $ifNull: ['$riskFlags', []] } }, 0] }] }, { $cond: [{ $eq: ['$kind', 'fanni'] }, 150, 50] }, 0] } }
      } }])
    ]);
    return res.set('Cache-Control', 'no-store').json({
      enabled: config?.settings?.referralsEnabled !== false,
      total, clients, technicians, riskReviewCount,
      statuses: Object.fromEntries(statuses.map(x => [x._id, x.count])),
      rewards
    });
  } catch (err) { next(err); }
});

router.get('/admin/list', auth('admin'), async (req, res, next) => {
  try {
    const filter = {};
    if (['client', 'fanni'].includes(String(req.query.kind))) filter.kind = String(req.query.kind);
    if (['pending', 'in_progress', 'eligible', 'completed', 'rejected', 'cancelled'].includes(String(req.query.status))) filter.status = String(req.query.status);
    if (req.query.from || req.query.to) {
      filter.invitedAt = {};
      if (req.query.from && !Number.isNaN(Date.parse(req.query.from))) filter.invitedAt.$gte = new Date(req.query.from);
      if (req.query.to && !Number.isNaN(Date.parse(req.query.to))) { const exclusiveEnd = new Date(req.query.to); exclusiveEnd.setDate(exclusiveEnd.getDate() + 1); filter.invitedAt.$lt = exclusiveEnd; }
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

// Explicit administrator review is required before a flagged referral can pay out.
router.post('/admin/:id/approve-risk', auth('admin'), async (req, res, next) => {
  const reason = String(req.body?.reason || '').trim();
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'رقم الدعوة غير صالح.' });
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ message: 'اكتب سبب مراجعة واضحًا من 3 إلى 500 حرف.' });
  try {
    const session = await mongoose.startSession();
    let referral;
    try {
      await session.withTransaction(async () => {
        referral = await Referral.findOne({
          _id: req.params.id, status: { $in: ['pending', 'in_progress', 'eligible'] },
          riskFlags: { $exists: true, $ne: [] },
          'inviterReward.paidAt': null, 'inviteeReward.paidAt': null
        }).session(session);
        if (!referral) throw new Error('REFERRAL_NOT_PENDING_RISK_REVIEW');
        const reviewedFlags = [...(referral.riskFlags || [])];
        referral.riskReviewedFlags = [...new Set([...(referral.riskReviewedFlags || []), ...reviewedFlags])];
        referral.riskFlags = [];
        // A risk hold may be reviewed before the referral reaches its completion threshold.
        // Restore the natural progress state instead of leaving it marked eligible.
        referral.status = Number(referral.completedCount || 0) > 0 ? 'in_progress' : 'pending';
        referral.riskReviewedAt = new Date();
        referral.riskReviewedBy = req.user?._id || null;
        await referral.save({ session });
        await AdminAuditLog.create([{
          action: 'اعتماد دعوة بعد مراجعة الاشتباه',
          category: 'referrals',
          target: String(referral._id),
          details: 'number=' + referral.number + '; flags=' + reviewedFlags.join(',') + '; reason=' + reason,
          adminName: actorName(req),
          adminId: String(req.user?._id || ''),
          ip: String(req.ip || '').slice(0, 80)
        }], { session });
      });
    } finally { await session.endSession(); }
    const outcome = await refreshReferralProgress({ kind: referral.kind, inviteeId: referral.invitee, mongoose });
    const updated = await Referral.findById(referral._id).lean();
    return res.json({ message: updated?.status === 'completed' ? 'تم اعتماد الدعوة وصرف المكافآت المستحقة.' : 'تم رفع تعليق المراجعة؛ لا تزال شروط الاستحقاق قيد التحقق.', referral: updated, outcome });
  } catch (err) {
    if (err?.message === 'REFERRAL_NOT_PENDING_RISK_REVIEW') return res.status(409).json({ message: 'الدعوة ليست معلقة حاليًا لمراجعة أمنية أو سبق صرف مكافآتها.' });
    return next(err);
  }
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

router.post('/admin/:id/cancel', auth('admin'), async (req, res, next) => {
  const reason = String(req.body?.reason || '').trim();
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'رقم الدعوة غير صالح.' });
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ message: 'اكتب سبب إلغاء واضحًا من 3 إلى 500 حرف.' });
  try {
    const session = await mongoose.startSession();
    let referral = null;
    try {
      await session.withTransaction(async () => {
        referral = await Referral.findOneAndUpdate({
          _id: req.params.id,
          status: { $in: ['pending', 'in_progress', 'eligible'] },
          'inviterReward.paidAt': null,
          'inviteeReward.paidAt': null
        }, {
          $set: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: req.user?._id || null,
            cancellationReason: reason
          }
        }, { new: true, runValidators: true, session });
        if (!referral) throw new Error('REFERRAL_NOT_CANCELLABLE');
        await AdminAuditLog.create([{
          action: 'إلغاء دعوة',
          category: 'referrals',
          target: String(referral._id),
          details: 'number=' + referral.number + '; previous progress=' + Number(referral.completedCount || 0) + '/' + Number(referral.requiredCount || 0) + '; reason=' + reason,
          adminName: actorName(req),
          adminId: String(req.user?._id || ''),
          ip: String(req.ip || '').slice(0, 80)
        }], { session });
      });
    } catch (err) {
      if (err?.message === 'REFERRAL_NOT_CANCELLABLE') return res.status(409).json({ message: 'لا يمكن إلغاء الدعوة بعد اكتمالها أو رفضها أو إلغائها أو صرف أي مكافأة منها.' });
      throw err;
    } finally { await session.endSession(); }
    return res.json({ message: 'تم إلغاء الدعوة وإيقاف احتساب أي إنجازات أو مكافآت مستقبلية لها.', referral });
  } catch (err) { next(err); }
});

router.post('/admin/:id/reject', auth('admin'), async (req, res, next) => {
  const reason = String(req.body?.reason || '').trim();
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'رقم الدعوة غير صالح.' });
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ message: 'اكتب سبب رفض واضحًا من 3 إلى 500 حرف.' });
  try {
    const securityHold = await Referral.exists({ _id: req.params.id, riskFlags: { $exists: true, $ne: [] } });
    if (securityHold) return res.status(409).json({ message: 'الدعوة عليها تعليق أمني. راجع تفاصيل الاشتباه واختر اعتمادًا أو رفضًا بعد المراجعة الأمنية.' });
    const session = await mongoose.startSession();
    let referral;
    try {
      await session.withTransaction(async () => {
        referral = await Referral.findOneAndUpdate({
          _id: req.params.id, status: { $in: ['pending', 'in_progress', 'eligible'] },
          riskFlags: { $in: [[], null] },
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

// A flagged referral can only be rejected through the explicit security-review decision.
router.post('/admin/:id/reject-risk', auth('admin'), async (req, res, next) => {
  const reason = String(req.body?.reason || '').trim();
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'رقم الدعوة غير صالح.' });
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ message: 'اكتب نتيجة المراجعة وسبب الرفض من 3 إلى 500 حرف.' });
  try {
    const session = await mongoose.startSession();
    let referral;
    try {
      await session.withTransaction(async () => {
        referral = await Referral.findOne({
          _id: req.params.id, status: 'eligible',
          riskFlags: { $exists: true, $ne: [] },
          'inviterReward.paidAt': null, 'inviteeReward.paidAt': null
        }).session(session);
        if (!referral) throw new Error('REFERRAL_NOT_PENDING_RISK_REVIEW');
        const reviewedFlags = [...(referral.riskFlags || [])];
        referral.riskReviewedFlags = [...new Set([...(referral.riskReviewedFlags || []), ...reviewedFlags])];
        referral.riskFlags = [];
        referral.riskReviewedAt = new Date();
        referral.riskReviewedBy = req.user?._id || null;
        referral.status = 'rejected';
        referral.rejectedAt = new Date();
        referral.rejectedBy = req.user?._id || null;
        referral.rejectionReason = reason;
        referral.reviewedAt = new Date();
        referral.reviewedBy = req.user?._id || null;
        await referral.save({ session });
        await AdminAuditLog.create([{
          action: 'رفض دعوة بعد مراجعة أمنية',
          category: 'referrals',
          target: String(referral._id),
          details: 'number=' + referral.number + '; flags=' + reviewedFlags.join(',') + '; reason=' + reason,
          adminName: actorName(req),
          adminId: String(req.user?._id || ''),
          ip: String(req.ip || '').slice(0, 80)
        }], { session });
      });
    } finally { await session.endSession(); }
    const updated = await Referral.findById(referral._id).lean();
    return res.json({ message: 'تم رفض الدعوة بعد تسجيل المراجعة الأمنية وسبب القرار.', referral: updated });
  } catch (err) {
    if (err?.message === 'REFERRAL_NOT_PENDING_RISK_REVIEW') return res.status(409).json({ message: 'الدعوة ليست معلقة حاليًا لمراجعة أمنية أو سبق صرف مكافآتها.' });
    return next(err);
  }
});

module.exports = router;
