'use strict';

const express = require('express');

function createAdminFanniManagementRouter({
  auth, validate, Joi, reasonSchema, Fanni, FanniCardLedger, Rating, Order,
  TopupRequest, WalletTransaction, adminName, decision, publicFanni,
  validId, sendBadId, writeAdminAudit, createNotification
}) {
  const router = express.Router();

router.post('/fannis/:id/force-password-change', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) return res.status(404).json({ message: 'الفني غير موجود' });
    fanni.mustChangePassword = true;
    fanni.tokenVersion = Number(fanni.tokenVersion || 0) + 1;
    await fanni.save();
    await writeAdminAudit(req, 'إلزام فني بتغيير كلمة المرور', 'fannis', String(fanni._id), 'forced=true');
    return res.json({ message: 'تم إلزام الفني بتغيير كلمة المرور عند تسجيل الدخول القادم، دون طلب كلمة المرور القديمة.', mustChangePassword: true });
  } catch (err) { next(err); }
});
router.delete('/fannis/:id/force-password-change', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) return res.status(404).json({ message: 'الفني غير موجود' });
    fanni.mustChangePassword = false;
    fanni.tokenVersion = Number(fanni.tokenVersion || 0) + 1;
    await fanni.save();
    await writeAdminAudit(req, 'إلغاء إلزام فني بتغيير كلمة المرور', 'fannis', String(fanni._id), 'forced=false');
    return res.json({ message: 'تم إلغاء إلزام الفني بتغيير كلمة المرور.', mustChangePassword: false });
  } catch (err) { next(err); }
});

router.post('/fannis/:id/approve', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null }).select('+identityCardFrontFileId');
    if (!fanni) { return res.status(404).json({ message: 'الفني غير موجود' }); }
    if (fanni.identityCardFrontFileId && fanni.identityReviewStatus !== 'approved') return res.status(409).json({ message: 'لا يمكن اعتماد الفني قبل مراجعة صور البطاقة والرقم القومي من شاشة انتظار الاعتماد.' });
    if (fanni.status === 'معلق') { return res.status(409).json({ message: 'الفني معلق. أعد تفعيله أولاً قبل القبول' }); }
    if (fanni.status === 'معتمد') { return res.json({ message: 'الفني معتمد بالفعل', fanni: publicFanni(fanni) }); }
    fanni.status = 'معتمد'; fanni.rejectionReason = undefined; fanni.suspensionReason = undefined; fanni.suspendedAt = undefined;
    fanni.decisions.push(decision(req, 'موافقة')); await fanni.save();
    await writeAdminAudit(req, 'اعتماد حساب فني', 'fannis', String(fanni._id), `name=${fanni.name}`);
    await createNotification({
      recipientRole: 'fanni', recipientId: fanni._id, type: 'account_approved',
      title: 'تم اعتماد حسابك', message: 'مبروك، الإدارة اعتمدت حسابك وأصبحت تقدر تستخدم خدمات الفني المعتمدة.',
      link: '/fanni', dedupeKey: 'fanni-approved:' + String(fanni._id)
    });
    return res.json({ message: 'تم اعتماد الفني بنجاح', fanni: publicFanni(fanni) });
  } catch (err) { next(err); }
});

router.post('/fannis/:id/reject', auth('admin'), validate(Joi.object({ reason: reasonSchema.optional() })), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) { return res.status(404).json({ message: 'الفني غير موجود' }); }
    if (fanni.status === 'معلق') { return res.status(409).json({ message: 'لا يمكن رفض حساب معلق. أعده للمراجعة أولاً' }); }
    if (fanni.status === 'مرفوض') { return res.json({ message: 'الفني مرفوض بالفعل', fanni: publicFanni(fanni) }); }
    const reason = String(req.body.reason || '').trim();
    fanni.status = 'مرفوض'; fanni.rejectionReason = reason || undefined; fanni.decisions.push(decision(req, 'رفض', reason)); await fanni.save();
    await writeAdminAudit(req, 'رفض حساب فني', 'fannis', String(fanni._id), `name=${fanni.name}; reason=${reason}`);
    return res.json({ message: 'تم رفض الفني', fanni: publicFanni(fanni) });
  } catch (err) { next(err); }
});

router.post('/fannis/:id/disable', auth('admin'), validate(Joi.object({ reason: reasonSchema.optional() })), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) { return res.status(404).json({ message: 'الفني غير موجود' }); }
    if (fanni.status === 'معلق') { return res.json({ message: 'حساب الفني معلق بالفعل', fanni: publicFanni(fanni) }); }
    const reason = String(req.body.reason || '').trim();
    fanni.status = 'معلق'; fanni.suspensionReason = reason || undefined; fanni.suspendedAt = new Date(); fanni.decisions.push(decision(req, 'تعليق', reason)); await fanni.save();
    await writeAdminAudit(req, 'تعليق حساب فني', 'fannis', String(fanni._id), `reason=${reason}`);
    return res.json({ message: 'تم تعليق حساب الفني', fanni: publicFanni(fanni) });
  } catch (err) { next(err); }
});

router.post('/fannis/:id/enable', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) { return res.status(404).json({ message: 'الفني غير موجود' }); }
    if (fanni.status !== 'معلق') { return res.json({ message: 'حساب الفني غير معلق', fanni: publicFanni(fanni) }); }
    const previousDecision = [...(fanni.decisions || [])].reverse().find(item => !['تعليق', 'إعادة تفعيل'].includes(item.action));
    if (previousDecision?.action === 'موافقة') { fanni.status = 'معتمد'; } else if (previousDecision?.action === 'رفض') { fanni.status = 'مرفوض'; } else { fanni.status = 'قيد المراجعة'; }
    fanni.suspensionReason = undefined; fanni.suspendedAt = undefined; fanni.decisions.push(decision(req, 'إعادة تفعيل')); await fanni.save();
    await writeAdminAudit(req, 'إعادة تفعيل حساب فني', 'fannis', String(fanni._id), `status=${fanni.status}`);
    return res.json({ message: 'تمت إعادة تفعيل الحساب', fanni: publicFanni(fanni) });
  } catch (err) { next(err); }
});

// The legacy technician deletion endpoint is retained only as a closed compatibility route.
router.delete('/fannis/:id', auth('admin'), (req, res) => {
  return res.status(410).json({
    message: 'الحذف النهائي للفنيين متوقف. استخدم الأرشفة مع كتابة السبب.',
    code: 'PERMANENT_DELETE_DISABLED'
  });
});

const VALID_LEVELS = ['مبتدئ', 'ممارس', 'محترف', 'خبير مبتدئ', 'خبير', 'خبير أول', 'استشاري فني', 'نخبة', 'أسطوري'];
const VALID_BADGES = ['trusted', 'top_rated', 'verified', 'fast_response', 'premium', 'gold'];

// ترقية مستوى الفني - موثوق مع تاريخ
router.patch('/fannis/:id/level', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const { level, reason } = req.body;
    if (!level || !VALID_LEVELS.includes(String(level).trim())) {
      return res.status(400).json({ message: 'المستوى غير صالح. القيم: ' + VALID_LEVELS.join(', ') });
    }
    const newLevel = String(level).trim();
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) return res.status(404).json({ message: 'الفني غير موجود' });
    const oldLevel = fanni.level;
    if (oldLevel === newLevel) return res.json({ message: 'المستوى هو نفسه بالفعل', fanni: publicFanni(fanni) });
    fanni.level = newLevel;
    fanni.levelHistory.push({ from: oldLevel, to: newLevel, date: new Date(), by: adminName(req), byId: req.user?._id, reason: String(reason||'').slice(0,500) });
    fanni.decisions.push({ action: 'ترقية مستوى', reason: `من ${oldLevel} إلى ${newLevel}. ${String(reason||'').slice(0,400)}`, date: new Date(), by: adminName(req), byId: req.user?._id, meta: { from: oldLevel, to: newLevel } });
    await fanni.save();
    await writeAdminAudit(req, 'تغيير مستوى فني', 'fannis', String(fanni._id), JSON.stringify({ from: oldLevel, to: newLevel, reason: String(reason || '').slice(0,400) }));
    return res.json({ message: `تمت ترقية المستوى من ${oldLevel} إلى ${newLevel}`, fanni: publicFanni(fanni) });
  } catch(e){ next(e); }
});

// شارة الثقة - إضافة / إزالة
router.patch('/fannis/:id/badge', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const { badge, action } = req.body;
    if (!badge || !VALID_BADGES.includes(String(badge).trim())) {
      return res.status(400).json({ message: 'الشارة غير صالحة. القيم: ' + VALID_BADGES.join(', ') });
    }
    const b = String(badge).trim();
    const act = String(action||'add').trim(); // add | remove | toggle
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) return res.status(404).json({ message: 'الفني غير موجود' });
    const hasBadge = Array.isArray(fanni.badges) && fanni.badges.includes(b);
    if (act === 'add' || act === '' || act === 'toggle' && !hasBadge) {
      if (hasBadge) return res.json({ message: 'الشارة موجودة بالفعل', fanni: publicFanni(fanni) });
      fanni.badges.push(b);
      if (!fanni.badgesGrantedAt) fanni.badgesGrantedAt = new Map();
      fanni.badgesGrantedAt.set(b, new Date());
      fanni.decisions.push({ action: 'إضافة شارة', reason: `إضافة شارة ${b}`, date: new Date(), by: adminName(req), byId: req.user?._id, meta: { badge: b } });
    } else {
      if (!hasBadge) return res.json({ message: 'الشارة غير موجودة', fanni: publicFanni(fanni) });
      fanni.badges = fanni.badges.filter(x=>x!==b);
      if (fanni.badgesGrantedAt && fanni.badgesGrantedAt.delete) fanni.badgesGrantedAt.delete(b);
      fanni.decisions.push({ action: 'إزالة شارة', reason: `إزالة شارة ${b}`, date: new Date(), by: adminName(req), byId: req.user?._id, meta: { badge: b } });
    }
    await fanni.save();
    await writeAdminAudit(req, hasBadge && !(act === 'add' || act === '' || act === 'toggle' && !hasBadge) ? 'إزالة شارة فني' : 'إضافة شارة فني', 'fannis', String(fanni._id), `badge=${b}; action=${act}`);
    return res.json({ message: act.includes('add') ? 'تمت إضافة الشارة' : 'تمت إزالة الشارة', fanni: publicFanni(fanni) });
  } catch(e){ next(e); }
});

// ملاحظة داخلية
router.patch('/fannis/:id/note', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const { note } = req.body;
    const clean = String(note||'').trim().slice(0,2000);
    if (!clean) return res.status(400).json({ message: 'الملاحظة لا يمكن أن تكون فارغة' });
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) return res.status(404).json({ message: 'الفني غير موجود' });
    fanni.adminNote = clean;
    fanni.adminNotesHistory.push({ note: clean, date: new Date(), by: adminName(req), byId: req.user?._id });
    fanni.decisions.push({ action: 'تعديل ملاحظة', reason: clean.slice(0,500), date: new Date(), by: adminName(req), byId: req.user?._id });
    await fanni.save();
    await writeAdminAudit(req, 'تعديل ملاحظة فني', 'fannis', String(fanni._id), `noteLength=${clean.length}`);
    return res.json({ message: 'تم حفظ الملاحظة الداخلية', fanni: publicFanni(fanni) });
  } catch(e){ next(e); }
});

// تحكم الإدارة في استقبال الطلبات وحالة اتصال الفني
router.patch('/fannis/:id/availability', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    if (typeof req.body?.acceptingOrders !== 'boolean') {
      return res.status(400).json({ message: 'حدد حالة الفني بشكل صحيح.' });
    }
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) return res.status(404).json({ message: 'الفني غير موجود.' });
    const before = fanni.acceptingOrders !== false;
    const after = req.body.acceptingOrders;
    if (before === after) {
      return res.set('Cache-Control', 'no-store').json({
        acceptingOrders: after,
        message: after ? 'الفني متصل بالفعل ويستقبل الطلبات.' : 'الفني غير متصل بالفعل ولا يستقبل طلبات جديدة.'
      });
    }
    fanni.acceptingOrders = after;
    fanni.decisions.push({
      action: after ? 'توصيل فني' : 'فصل فني',
      reason: 'تغيير حالة استقبال الطلبات من لوحة الإدارة',
      date: new Date(), by: adminName(req), byId: req.user?._id,
      meta: { before, after }
    });
    await fanni.save();
    await writeAdminAudit(
      req,
      after ? 'توصيل فني' : 'فصل فني',
      'fannis',
      String(fanni._id),
      JSON.stringify({ acceptingOrders: after })
    );
    try {
      await createNotification({
        recipientRole: 'fanni',
        recipientId: fanni._id,
        type: 'admin_availability_changed',
        title: after ? 'الإدارة فعّلت استقبال الطلبات' : 'الإدارة أوقفت استقبال الطلبات',
        message: after
          ? 'قامت الإدارة بتفعيل حالتك. أنت الآن متصل ويمكنك استقبال طلبات جديدة.'
          : 'قامت الإدارة بإيقاف استقبال الطلبات الجديدة لحسابك. لن تصلك طلبات جديدة حتى تعيد تفعيل حالتك.',
        link: '/fanni',
        dedupeKey: 'admin-fanni-availability:' + String(fanni._id) + ':' + String(after) + ':' + Date.now()
      });
    } catch (notificationError) {
      console.error('Could not notify technician about admin availability change:', notificationError.message);
    }
    return res.set('Cache-Control', 'no-store').json({
      acceptingOrders: after,
      message: after ? 'تم توصيل الفني وإبلاغه، ويمكنه استقبال الطلبات الجديدة.' : 'تم فصل الفني وإبلاغه، ولن يستقبل طلبات جديدة.'
    });
  } catch (error) { next(error); }
});

// حدود الاستقبال
router.patch('/fannis/:id/limit', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const { maxOrders, maxOffers, dailyLimit, isLimited, reason } = req.body;
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) return res.status(404).json({ message: 'الفني غير موجود' });
    const limits = fanni.limits || {};
    if (maxOrders !== undefined) {
      const v = Number(maxOrders);
      if (!Number.isInteger(v) || v < 0 || v > 1000) return res.status(400).json({ message: 'maxOrders يجب أن يكون 0-1000' });
      limits.maxOrders = v;
    }
    if (maxOffers !== undefined) {
      const v = Number(maxOffers);
      if (!Number.isInteger(v) || v < 0 || v > 1000) return res.status(400).json({ message: 'maxOffers يجب أن يكون 0-1000' });
      limits.maxOffers = v;
    }
    if (dailyLimit !== undefined) {
      const v = Number(dailyLimit);
      if (!Number.isInteger(v) || v < 0 || v > 100) return res.status(400).json({ message: 'dailyLimit يجب أن يكون 0-100' });
      limits.dailyLimit = v;
    }
    if (isLimited !== undefined) {
      if (typeof isLimited !== 'boolean') return res.status(400).json({ message: 'isLimited يجب أن يكون Boolean' });
      limits.isLimited = isLimited;
    }
    if (reason !== undefined) limits.reason = String(reason).slice(0,500);
    fanni.limits = limits;
    fanni.decisions.push({ action: 'تعديل حد', reason: `حدود: ${JSON.stringify(limits)}`, date: new Date(), by: adminName(req), byId: req.user?._id, meta: limits });
    await fanni.save();
    await writeAdminAudit(req, 'تعديل حدود استقبال فني', 'fannis', String(fanni._id), JSON.stringify(limits));
    return res.json({ message: 'تم حفظ حدود الاستقبال', fanni: publicFanni(fanni) });
  } catch(e){ next(e); }
});

router.patch('/fannis/:id/profile-controls', auth('admin'), async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return sendBadId(res);
    const schema = Joi.object({
      trustScore: Joi.number().integer().min(0).max(100).optional(),
      isVerified: Joi.boolean().optional(),
      isFeatured: Joi.boolean().optional(),
      featuredUntil: Joi.date().iso().allow(null).optional()
    }).min(1).required();
    const { error, value } = schema.validate(req.body || {}, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: 'إعدادات الثقة والظهور غير صحيحة' });
    const rawFeaturedUntil = req.body?.featuredUntil;
    const dateOnly = typeof rawFeaturedUntil === 'string' && rawFeaturedUntil.length === 10 && rawFeaturedUntil[4] === '-' && rawFeaturedUntil[7] === '-';
    const normalizedFeaturedUntil = dateOnly ? new Date(String(rawFeaturedUntil) + 'T23:59:59.999Z') : value.featuredUntil;
    if (value.isFeatured === true && normalizedFeaturedUntil && new Date(normalizedFeaturedUntil) <= new Date()) {
      return res.status(400).json({ message: 'تاريخ انتهاء التمييز يجب أن يكون اليوم أو تاريخًا مستقبليًا' });
    }
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null });
    if (!fanni) return res.status(404).json({ message: 'الفني غير موجود' });
    const before = { trustScore: fanni.trustScore, isVerified: fanni.isVerified, isFeatured: fanni.isFeatured, featuredUntil: fanni.featuredUntil };
    if (value.trustScore !== undefined) fanni.trustScore = value.trustScore;
    if (value.isVerified !== undefined) {
      fanni.isVerified = value.isVerified;
      const badges = new Set(Array.isArray(fanni.badges) ? fanni.badges : []);
      if (value.isVerified) badges.add('verified'); else badges.delete('verified');
      fanni.badges = Array.from(badges);
    }
    if (value.isFeatured !== undefined) fanni.isFeatured = value.isFeatured;
    if (Object.prototype.hasOwnProperty.call(value, 'featuredUntil')) fanni.featuredUntil = normalizedFeaturedUntil || undefined;
    if (fanni.isFeatured === false) fanni.featuredUntil = undefined;
    fanni.decisions.push({
      action: 'تعديل الثقة والظهور',
      reason: 'تحديث إعدادات الثقة والتحقق والتمييز من لوحة الإدارة',
      date: new Date(), by: adminName(req), byId: req.user?._id,
      meta: { before, after: { trustScore: fanni.trustScore, isVerified: fanni.isVerified, isFeatured: fanni.isFeatured, featuredUntil: fanni.featuredUntil } }
    });
    await fanni.save();
    await writeAdminAudit(req, 'تعديل الثقة والظهور', 'fannis', String(fanni._id), JSON.stringify({ before, after: { trustScore: fanni.trustScore, isVerified: fanni.isVerified, isFeatured: fanni.isFeatured, featuredUntil: fanni.featuredUntil } }));
    return res.json({ message: 'تم حفظ درجة الثقة والتحقق والظهور', fanni: publicFanni(fanni) });
  } catch (error) { next(error); }
});

// ===== عروض الطلبات - بناء على Order.js الجديد =====

  return router;
}

module.exports = createAdminFanniManagementRouter;
