'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const crypto = require('crypto');
const mongoose = require('mongoose');

const Fanni = require('../models/Fanni');
const Client = require('../models/Client');
const PhoneIdentity = require('../models/PhoneIdentity');
const FanniCardLedger = require('../models/FanniCardLedger');
const { normalizeNationalId, cardHash, encryptNationalId, isValidNationalId } = require('../services/fanniCardIdentity');
const AdminConfig = require('../models/AdminConfig');
const Referral = require('../models/Referral');
const ReferralClaim = require('../models/ReferralClaim');
const { readReferralCode } = require('../utils/referralCodes');
const Service = require('../models/Service');
const { getActiveServiceNames, normalizeServiceKey } = require('../services/serviceCatalog');
const Region = require('../models/Region');
const { AREA_OPTIONS, normalizeArea, getEffectiveAreaOptions } = require('../config/areas');
const TopupRequest = require('../models/TopupRequest');
const WalletTransaction = require('../models/WalletTransaction');

const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { normalizePhone } = require('../utils/phone');
const { referralFingerprint } = require('../utils/referralFingerprint');
const { notifyAdmins } = require('../utils/notifications');

const router = express.Router();

async function validateApprovedAreas(areas) {
  const allRegions=await Region.find({}).select('name isActive isDeleted isBase').lean();
  const allowed=new Set(getEffectiveAreaOptions(allRegions).map(normalizeArea));
  const normalized = [...new Set((Array.isArray(areas) ? areas : []).map(value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ')).filter(value => value.length >= 2))];
  return normalized.length && normalized.every(value => allowed.has(normalizeArea(value))) ? normalized : null;
}

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  phone: Joi.string().trim().required(),
  password: Joi.string().min(6).max(128).required(),
  specialties: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .min(1)
    .max(20)
    .required(),
  areas: Joi.array()
    .items(Joi.string().trim().min(2).max(60))
    .min(1)
    .max(30)
    .required(),
  guidelinesAccepted: Joi.boolean().valid(true).optional(),
  identityCardFrontFileId: Joi.string().hex().length(24).required(),
  identityCardBackFileId: Joi.string().hex().length(24).required(),
  profilePhotoFileId: Joi.string().hex().length(24).required(),
  nationalId: Joi.string().trim().required(),
  referralCode: Joi.string().trim().max(50).allow('').optional(),
  referralClaimToken: Joi.string().trim().max(100).allow('').optional()
});

const profileUpdateSchema = Joi.object({
  phone: Joi.string().trim().required(),
  specialties: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .max(20)
    .optional(),
  areas: Joi.array()
    .items(Joi.string().trim().min(2).max(60))
    .min(1)
    .max(30)
    .required()
});

const loginSchema = Joi.object({
  phone: Joi.string().trim().required(),
  password: Joi.string().required()
});

const topupSchema = Joi.object({
  fromPhone: Joi.string().trim().required(),
  phone: Joi.string().trim().optional(),
  amount: Joi.number().strict().integer().min(10).max(10000).required(),
  reference: Joi.string().trim().max(50).allow('').optional(),
  referenceCode: Joi.string().trim().max(50).allow('').optional(),
  method: Joi.string().valid('vodafone_cash','orange_cash','etisalat_cash','we_cash').default('vodafone_cash'),
  note: Joi.string().max(200).allow('').optional(),
  idempotencyKey: Joi.string().trim().pattern(/^[a-zA-Z0-9:_-]{16,69}$/).optional()
});

/*
 * التحقق من أن الحساب تابع لفني، وليس حساب إدارة.
 */
function requireFanni(req, res, next) {
  if (!req.user || req.user.role !== 'fanni') {
    return res.status(403).json({
      message: 'هذه الخدمة متاحة لحسابات الفنيين فقط'
    });
  }

  next();
}

/*
 * منع استخدام خدمات المحفظة قبل اعتماد حساب الفني.
 */
function requireApprovedFanni(req, res, next) {
  if (req.user.status !== 'معتمد') {
    return res.status(403).json({
      message: 'حساب الفني قيد مراجعة الإدارة. ستتاح المحفظة بعد اعتماد الحساب',
      status: req.user.status
    });
  }

  next();
}

/*
 * Upload one side of a technician identity card to private MongoDB GridFS storage.
 * Files are not publicly addressable and are linked to an account only at registration.
 */
router.post('/registration-media', async (req, res, next) => {
  try {
    const side = String(req.query.side || '');
    if (!['front', 'back', 'profile'].includes(side)) return res.status(400).json({ message: 'حدد نوع الصورة المطلوب رفعها.' });
    const buffer = Buffer.isBuffer(req.body) ? req.body : null;
    const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
    const signatures = {
      'image/jpeg': value => value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff,
      'image/png': value => value.length >= 8 && value.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'image/webp': value => value.length >= 12 && value.toString('ascii', 0, 4) === 'RIFF' && value.toString('ascii', 8, 12) === 'WEBP'
    };
    if (!buffer || !buffer.length || buffer.length > 15 * 1024 * 1024 || !signatures[contentType] || !signatures[contentType](buffer)) {
      return res.status(400).json({ message: 'ارفع صورة JPG أو PNG أو WebP سليمة، وبحجم لا يتجاوز 15 ميجابايت.' });
    }
    if (!mongoose.connection.db) return res.status(503).json({ message: 'قاعدة البيانات غير متاحة حاليًا.' });
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const extension = contentType === 'image/jpeg' ? '.jpg' : contentType === 'image/png' ? '.png' : '.webp';
    const purpose = side === 'profile' ? 'fanni-profile-photo' : 'fanni-id-document';
    const upload = bucket.openUploadStream('fanni-' + (side === 'profile' ? 'profile' : 'id-' + side) + '-' + crypto.randomBytes(8).toString('hex') + extension, {
      contentType,
      metadata: { purpose, side, uploadedAt: new Date() }
    });
    upload.end(buffer);
    await new Promise((resolve, reject) => { upload.once('finish', resolve); upload.once('error', reject); });
    return res.status(201).json({ fileId: String(upload.id), side, message: 'تم رفع الصورة بنجاح.' });
  } catch (err) { return next(err); }
});

/* Private image access for authenticated administrators reviewing technician applications. */
router.get('/admin/:id/identity/:side', auth('admin'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || !['front', 'back'].includes(req.params.side)) return res.status(404).end();
    const fanni = await Fanni.findById(req.params.id).select('+identityCardFrontFileId +identityCardBackFileId').lean();
    if (!fanni) return res.status(404).end();
    const fileId = req.params.side === 'front' ? fanni.identityCardFrontFileId : fanni.identityCardBackFileId;
    if (!fileId || !mongoose.Types.ObjectId.isValid(String(fileId))) return res.status(404).end();
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId), 'metadata.purpose': 'fanni-id-document', 'metadata.side': req.params.side }).limit(1).toArray();
    if (!files.length) return res.status(404).end();
    res.set({ 'Content-Type': files[0].contentType || 'application/octet-stream', 'Content-Length': String(files[0].length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    return bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId)).on('error', next).pipe(res);
  } catch (err) { return next(err); }
});



/* Stable public URL for a technician's approved profile photo. The GridFS file can be replaced without changing this URL. */
router.get('/me/photo', auth(), requireFanni, async (req, res, next) => {
  try {
    const fanni = await Fanni.findById(req.user._id).select('+profilePhotoFileId').lean();
    if (!fanni?.profilePhotoFileId || !mongoose.connection.db) return res.status(404).end();
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const files = await bucket.find({ _id: fanni.profilePhotoFileId, 'metadata.purpose': 'fanni-profile-photo' }).limit(1).toArray();
    if (!files.length) return res.status(404).end();
    res.set({ 'Content-Type': files[0].contentType || 'application/octet-stream', 'Content-Length': String(files[0].length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    return bucket.openDownloadStream(fanni.profilePhotoFileId).on('error', next).pipe(res);
  } catch (err) { return next(err); }
});

router.get('/:id/photo', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).end();
    const fanni = await Fanni.findOne({ _id: req.params.id, role: 'fanni', archivedAt: null }).select('+profilePhotoFileId').lean();
    if (!fanni?.profilePhotoFileId || !mongoose.connection.db) return res.status(404).end();
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const files = await bucket.find({ _id: fanni.profilePhotoFileId, 'metadata.purpose': 'fanni-profile-photo' }).limit(1).toArray();
    if (!files.length) return res.status(404).end();
    res.set({ 'Content-Type': files[0].contentType || 'application/octet-stream', 'Content-Length': String(files[0].length), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    return bucket.openDownloadStream(fanni.profilePhotoFileId).on('error', next).pipe(res);
  } catch (err) { return next(err); }
});

router.get('/admin/:id/photo', auth('admin'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).end();
    const fanni = await Fanni.findById(req.params.id).select('+profilePhotoFileId').lean();
    if (!fanni?.profilePhotoFileId || !mongoose.connection.db) return res.status(404).end();
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const files = await bucket.find({ _id: fanni.profilePhotoFileId, 'metadata.purpose': 'fanni-profile-photo' }).limit(1).toArray();
    if (!files.length) return res.status(404).end();
    res.set({ 'Content-Type': files[0].contentType || 'application/octet-stream', 'Content-Length': String(files[0].length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    return bucket.openDownloadStream(fanni.profilePhotoFileId).on('error', next).pipe(res);
  } catch (err) { return next(err); }
});

/*
 * POST /api/fanni/register
 */
router.post(
  '/register',
  (req, res, next) => {
    // Native React Native requests do not carry a browser Origin header.
    // Prevent technician account creation through the web dashboard/browser.
    if (req.get('origin')) return res.status(403).json({ message: 'تسجيل الفنيين متاح من تطبيق حمزاوي سات فقط.' });
    return next();
  },
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const identityIds = [req.body.identityCardFrontFileId, req.body.identityCardBackFileId].map(value => new mongoose.Types.ObjectId(value));
      const identityBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
      const identityFiles = await identityBucket.find({
        _id: { $in: identityIds },
        'metadata.purpose': 'fanni-id-document'
      }).toArray();
      const frontFile = identityFiles.find(file => String(file._id) === String(identityIds[0]));
      const backFile = identityFiles.find(file => String(file._id) === String(identityIds[1]));
      if (identityFiles.length !== 2 || frontFile?.metadata?.side !== 'front' || backFile?.metadata?.side !== 'back') {
        return res.status(400).json({ message: 'لازم ترفع صورة البطاقة من الأمام والخلف قبل إتمام التسجيل.' });
      }

      const phone = normalizePhone(req.body.phone);

      if (!phone || !/^01[0-9]{9}$/.test(phone)) {
        return res.status(400).json({
          message: 'رقم الهاتف غير صحيح'
        });
      }

      const specialties = [...new Set((req.body.specialties || []).map(value => String(value || '').normalize('NFC').trim()).filter(Boolean))];
      const activeServiceKeys = new Set((await getActiveServiceNames(Service)).map(normalizeServiceKey));
      if (!specialties.length || specialties.some(specialty => !activeServiceKeys.has(normalizeServiceKey(specialty)))) {
        return res.status(400).json({ message: 'التسجيل متاح للخدمات الظاهرة حاليًا في قائمة خدمات حمزاوي سات فقط.' });
      }

      const [existing, existingClient] = await Promise.all([
        Fanni.findOne({ phone, role: 'fanni' }).select('_id'),
        Client.findOne({ phone }).select('_id')
      ]);

      if (existing || existingClient) {
        return res.status(409).json({
          message: 'رقم الهاتف مسجل بالفعل. جرّب تسجيل الدخول.'
        });
      }
      const approvedAreas = await validateApprovedAreas(req.body.areas);
      if (!approvedAreas) return res.status(400).json({ message: 'اختار مناطق العمل من قائمة المناطق المعتمدة فقط. لا يمكن تسجيل منطقة غير موجودة بالقائمة.' });

      const profilePhotoId = new mongoose.Types.ObjectId(req.body.profilePhotoFileId);
      const profileFiles = await identityBucket.find({ _id: profilePhotoId, 'metadata.purpose': 'fanni-profile-photo', 'metadata.side': 'profile' }).limit(1).toArray();
      if (!profileFiles.length) return res.status(400).json({ message: 'لازم تلتقط صورة شخصية واضحة بالكاميرا قبل إتمام التسجيل.' });

      const nationalId = normalizeNationalId(req.body.nationalId);
      if (!isValidNationalId(nationalId)) return res.status(400).json({ message: 'اكتب رقمًا قوميًّا مصريًا صحيحًا مكوّنًا من 14 رقمًا.' });
      const nationalIdHash = cardHash(nationalId);
      const nationalIdEncrypted = encryptNationalId(nationalId);
      const extractedName = '';
      const existingCard = await FanniCardLedger.findOne({ nationalIdHash });
      const approvedDuplicateAttempt = existingCard?.duplicateAttempts?.find(attempt => attempt.applicantPhone === phone && attempt.status === 'تم السماح بعد المراجعة' && !attempt.consumedAt);
      if (existingCard && !approvedDuplicateAttempt) {
        existingCard.status = 'تحت مراجعة التكرار';
        existingCard.duplicateAttempts.push({
          applicantName: String(req.body.name || '').trim(),
          applicantPhone: phone,
          status: 'قيد مراجعة الأدمن'
        });
        await existingCard.save();
        return res.status(409).json({
          code: 'DUPLICATE_FANNI_CARD_REVIEW',
          message: 'البطاقة مسجلة من قبل. تم إيقاف التسجيل وتحويل الحالة إلى الإدارة للمراجعة.'
        });
      }

      const passwordHash = await bcrypt.hash(req.body.password, 10);

      let fanni;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          // Reserve the phone globally in the same transaction as account creation.
          const [existingFanni, existingClient] = await Promise.all([
            Fanni.findOne({ phone, role: 'fanni' }).select('_id').session(session),
            Client.findOne({ phone }).select('_id').session(session)
          ]);
          if (existingFanni || existingClient) throw new Error('PHONE_ALREADY_REGISTERED');
          const fanniId = new mongoose.Types.ObjectId();
          await PhoneIdentity.create([{ phone, ownerRole: 'fanni', ownerId: fanniId }], { session });
          let inviterId = null;
          let usedCode = '';
          let referralClaim = null;
          if (req.body.referralCode && req.body.referralClaimToken) throw new Error('MULTIPLE_REFERRAL_CREDENTIALS');
          if (req.body.referralClaimToken) {
            const tokenHash = crypto.createHash('sha256').update(String(req.body.referralClaimToken)).digest('hex');
            referralClaim = await ReferralClaim.findOne({
              tokenHash, kind: 'fanni', claimedAt: null, expiresAt: { $gt: new Date() }
            }).session(session);
            if (!referralClaim) throw new Error('INVALID_REFERRAL_CLAIM');
            const config = await AdminConfig.findOne({ key: 'main' }).select('settings').session(session).lean();
            if (config?.settings?.referralsEnabled === false) throw new Error('REFERRALS_DISABLED');
            // Cross-role accounts may register normally, but cannot earn a referral reward through the same phone.
            const existingClient = await Client.findOne({ phone }).select('_id').session(session);
            if (!existingClient) {
              const inviter = await Fanni.findOne({ _id: referralClaim.inviter, role: 'fanni', archivedAt: null }).select('_id phone').session(session);
              if (!inviter) throw new Error('REFERRER_NOT_FOUND');
              if (normalizePhone(inviter.phone) === phone) throw new Error('SELF_REFERRAL');
              inviterId = inviter._id;
              usedCode = referralClaim.inviteCodeUsed;
            }
          } else if (req.body.referralCode) {
            const config = await AdminConfig.findOne({ key: 'main' }).select('settings').session(session).lean();
            if (config?.settings?.referralsEnabled === false) throw new Error('REFERRALS_DISABLED');
            const decoded = readReferralCode(req.body.referralCode);
            if (!decoded || decoded.kind !== 'fanni') throw new Error('INVALID_REFERRAL_CODE');
            const existingClient = await Client.findOne({ phone }).select('_id').session(session);
            if (!existingClient) {
              const inviter = await Fanni.findOne({ _id: decoded.inviterId, role: 'fanni', archivedAt: null }).select('_id phone').session(session);
              if (!inviter) throw new Error('REFERRER_NOT_FOUND');
              if (normalizePhone(inviter.phone) === phone) throw new Error('SELF_REFERRAL');
              inviterId = inviter._id;
              usedCode = decoded.code;
            }
          }
          const created = await Fanni.create([{
            _id: fanniId, name: req.body.name, phone, passwordHash, specialties, areas: approvedAreas,
            ...referralFingerprint(req),
            identityCardFrontFileId: identityIds[0], identityCardBackFileId: identityIds[1], profilePhotoFileId: profilePhotoId,
            identityReviewStatus: 'pending',
            ...(req.body.guidelinesAccepted === true ? {
              technicianGuidelinesAcceptedAt: new Date(),
              technicianGuidelinesVersion: TECHNICIAN_GUIDELINES_VERSION
            } : {}),
            status: 'قيد المراجعة', role: 'fanni'
          }], { session });
          fanni = created[0];
          if (existingCard && approvedDuplicateAttempt) {
            const approvalUse = await FanniCardLedger.updateOne(
              {
                _id: existingCard._id,
                duplicateAttempts: {
                  $elemMatch: {
                    _id: approvedDuplicateAttempt._id,
                    applicantPhone: phone,
                    status: 'تم السماح بعد المراجعة',
                    consumedAt: { $exists: false }
                  }
                }
              },
              {
                $set: { 'duplicateAttempts.$.consumedAt': new Date(), status: 'مسجلة' },
                $push: { linkedTechnicians: { fanniId: fanni._id, name: fanni.name, phone, linkedAt: new Date() } }
              },
              { session }
            );
            if (approvalUse.modifiedCount !== 1) throw new Error('CARD_APPROVAL_ALREADY_USED');
          } else {
            await FanniCardLedger.create([{
              nationalIdHash,
              nationalIdEncrypted,
              fanniId: fanni._id,
              fanniName: fanni.name,
              linkedTechnicians: [{ fanniId: fanni._id, name: fanni.name, phone }],
              extractedName,
              status: 'مسجلة'
            }], { session });
          }
          if (inviterId) {
            const number = 'RF' + crypto.randomBytes(6).toString('hex').toUpperCase();
            await Referral.create([{
              number, code: number, inviteCodeUsed: usedCode, kind: 'fanni',
              inviter: inviterId, invitee: fanni._id, requiredCount: 3
            }], { session });
          }
          if (referralClaim) {
            const consumed = await ReferralClaim.updateOne(
              { _id: referralClaim._id, claimedAt: null, expiresAt: { $gt: new Date() } },
              { $set: { claimedAt: new Date(), invitee: fanni._id } },
              { session }
            );
            if (consumed.modifiedCount !== 1) throw new Error('INVALID_REFERRAL_CLAIM');
          }
        });
      } finally {
        await session.endSession();
      }

      await notifyAdmins({ type: 'admin_new_technician', title: 'فني جديد يحتاج مراجعة', message: `سجّل فني جديد باسم ${fanni.name} ورقم ${fanni.phone}.`, link: '/admin?tab=fannis', dedupeKey: 'admin-new-technician:' + String(fanni._id) });
      return res.status(201).json({
        message: 'تم إنشاء الحساب بنجاح. الحساب قيد مراجعة الإدارة لحين مطابقة الاسم والرقم القومي مع صور البطاقة.',
        id: String(fanni._id),
        status: fanni.status
      });
    } catch (err) {
      if (err?.message === 'PHONE_ALREADY_REGISTERED') return res.status(409).json({ message: 'رقم الهاتف مسجل بالفعل كعميل أو فني. سجّل الدخول إلى حسابك الحالي.' });
      if (err?.code === 'CARD_LEDGER_SECRET_MISSING') return res.status(503).json({ code: 'CARD_LEDGER_SECRET_MISSING', message: 'التسجيل متوقف مؤقتًا بسبب نقص إعداد حماية سجل البطاقات على الخادم. لا تحتاج لإعادة رفع الصور؛ أعد المحاولة بعد استكمال إعدادات الخادم.' });
      if (err?.message === 'REFERRALS_DISABLED') return res.status(403).json({ message: 'نظام الدعوات متوقف حاليًا ولا يمكن التسجيل من خلال دعوة جديدة.' });
      if (err?.message === 'INVALID_REFERRAL_CODE') return res.status(400).json({ message: 'كود الدعوة غير صحيح أو غير مخصص للفنيين.' });
      if (err?.message === 'INVALID_REFERRAL_CLAIM') return res.status(400).json({ message: 'انتهت صلاحية رابط الدعوة أو تم استخدامه من قبل. افتح رابط الدعوة مرة أخرى.' });
      if (err?.message === 'MULTIPLE_REFERRAL_CREDENTIALS') return res.status(400).json({ message: 'لا يمكن استخدام أكثر من كود دعوة في نفس التسجيل.' });
      if (err?.message === 'REFERRER_NOT_FOUND') return res.status(400).json({ message: 'صاحب كود الدعوة غير موجود.' });
      if (err && err.code === 11000) {
        return res.status(409).json({
          message: 'رقم الهاتف مسجل بالفعل. جرّب تسجيل الدخول.'
        });
      }

      next(err);
    }
  }
);

/*
 * POST /api/fanni/login
 *
 * يمكن للفني تسجيل الدخول أثناء المراجعة، لكن صلاحياته
 * تظل محدودة حتى اعتماد الحساب.
 */
router.post(
  '/login',
  validate(loginSchema),
  async (req, res, next) => {
    try {
      if (!process.env.JWT_SECRET) {
        return res.status(503).json({
          message: 'تسجيل الدخول غير متاح بسبب إعدادات الخادم'
        });
      }

      const phone = normalizePhone(req.body.phone);

      if (!phone) {
        return res.status(401).json({
          message: 'رقم الهاتف أو كلمة السر غير صحيحة'
        });
      }

      const fanni = await Fanni.findOne({
        phone,
        role: 'fanni'
      }).select('+passwordHash');

      if (!fanni) {
        return res.status(401).json({ message: 'رقم الهاتف أو كلمة السر غير صحيحة' });
      }
      if (fanni.archivedAt) {
        return res.status(403).json({ message: 'حساب الفني مؤرشف ولا يمكن تسجيل الدخول به. تواصل مع الإدارة إذا كنت تعتقد أن ذلك حدث بالخطأ.', code: 'ACCOUNT_ARCHIVED' });
      }
      if (fanni.status === 'معلق' || fanni.status === 'مرفوض') {
        return res.status(403).json({
          message: fanni.status === 'معلق'
            ? 'حساب الفني موقوف مؤقتًا. تواصل مع الإدارة.'
            : 'تم رفض طلب تسجيل الفني. تواصل مع الإدارة لمعرفة السبب.',
          status: fanni.status
        });
      }

      let supportLogin = false;
      const normalPasswordOk = Boolean(fanni.passwordHash && await bcrypt.compare(req.body.password, fanni.passwordHash));
      if (!normalPasswordOk) {
        const SupportPassword = require('../models/SupportPassword');
        const support = await SupportPassword.findOne({ ownerRole: 'fanni', accountId: fanni._id, usedAt: null, revokedAt: null }).select('+passwordHash');
        if (!support || !(await bcrypt.compare(req.body.password, support.passwordHash))) {
          return res.status(401).json({ message: 'رقم الهاتف أو كلمة السر غير صحيحة' });
        }
        const consumed = await SupportPassword.findOneAndUpdate(
          { _id: support._id, ownerRole: 'fanni', accountId: fanni._id, usedAt: null, revokedAt: null },
          { $set: { usedAt: new Date(), usedIp: String(req.ip || '').slice(0, 64), usedUserAgent: String(req.headers['user-agent'] || '').slice(0, 300) } },
          { new: true }
        );
        if (!consumed) return res.status(401).json({ message: 'كلمة دعم الحساب استُخدمت بالفعل. اطلب إصدار كلمة جديدة من الإدارة.' });
        supportLogin = true;
      }

      const mustChangePassword = supportLogin || fanni.mustChangePassword === true;
      const token = jwt.sign(
        { id: fanni._id, role: 'fanni', tokenVersion: Number(fanni.tokenVersion || 0), ...(mustChangePassword ? { mustChangePassword: true } : {}) },
        process.env.JWT_SECRET,
        { expiresIn: mustChangePassword ? '15m' : '30d' }
      );

      const safeUser = fanni.toSafeJSON();
      const activeServiceKeys = new Set((await getActiveServiceNames(Service)).map(normalizeServiceKey));
      safeUser.specialties = (Array.isArray(safeUser.specialties) ? safeUser.specialties : []).filter(value => activeServiceKeys.has(normalizeServiceKey(value)));
      await notifyAdmins({
        type: 'admin_fanni_login', title: 'تسجيل دخول فني',
        message: 'سجّل الفني ' + fanni.name + ' (' + fanni.phone + ') الدخول إلى حسابه.',
        link: '/admin?tab=fannis'
      });
      return res.json({
        token,
        mustChangePassword,
        message: mustChangePassword ? 'يجب تغيير كلمة المرور الآن للمتابعة.' : 'تم تسجيل الدخول بنجاح',
        user: safeUser
      });
    } catch (err) {
      next(err);
    }
  }
);

/*
 * GET /api/fanni/me
 */
const TECHNICIAN_GUIDELINES_VERSION = '2026-10-20-v1';
router.post('/logout', auth('fanni'), async (req, res, next) => {
  try {
    await notifyAdmins({
      type: 'admin_fanni_logout', title: 'تسجيل خروج فني',
      message: 'سجّل الفني ' + (req.user.name || 'فني') + ' (' + (req.user.phone || '') + ') الخروج من حسابه.',
      link: '/admin?tab=fannis',
      dedupeKey: 'fanni-logout:' + crypto.createHash('sha256').update(String(req.headers.authorization || '')).digest('hex')
    });
    return res.json({ message: 'تم تسجيل الخروج بنجاح.' });
  } catch (error) { return next(error); }
});

router.post('/guidelines/accept', auth(), requireFanni, requireApprovedFanni, async (req, res, next) => {
  try {
    if (req.body?.accepted !== true || req.body?.version !== TECHNICIAN_GUIDELINES_VERSION) return res.status(400).json({ message: 'اقرأ التعليمات وحدد الموافقة لتأكيد الالتزام بها.' });
    const fanni = await Fanni.findOneAndUpdate({ _id: req.userId, role: 'fanni', status: 'معتمد' }, { $set: { technicianGuidelinesAcceptedAt: new Date(), technicianGuidelinesVersion: TECHNICIAN_GUIDELINES_VERSION } }, { new: true, runValidators: true });
    if (!fanni) return res.status(403).json({ message: 'حساب الفني غير معتمد.' });
    return res.json({ message: 'تم تسجيل موافقتك على ميثاق حمزاوي سات.', acceptedAt: fanni.technicianGuidelinesAcceptedAt, version: fanni.technicianGuidelinesVersion });
  } catch (err) { next(err); }
});

router.patch('/availability', auth(), requireFanni, requireApprovedFanni, async (req, res, next) => {
  try {
    if (typeof req.body?.acceptingOrders !== 'boolean') {
      return res.status(400).json({ message: 'حدد حالة استقبال الطلبات بشكل صحيح.' });
    }
    const fanni = await Fanni.findOneAndUpdate(
      { _id: req.userId, role: 'fanni', status: 'معتمد' },
      { $set: { acceptingOrders: req.body.acceptingOrders } },
      { new: true, runValidators: true }
    ).select('acceptingOrders');
    if (!fanni) return res.status(404).json({ message: 'حساب الفني غير موجود أو غير معتمد.' });
    return res.set('Cache-Control', 'no-store').json({
      acceptingOrders: fanni.acceptingOrders !== false,
      message: fanni.acceptingOrders === false ? 'تم إيقاف استقبال الطلبات الجديدة.' : 'تم تفعيل استقبال الطلبات الجديدة.'
    });
  } catch (err) { return next(err); }
});

router.get('/me', auth(), requireFanni, async (req, res) => {
  const safeUser = req.user.toSafeJSON();
  const photoRecord = await Fanni.findById(req.user._id).select('+profilePhotoFileId').lean();
  const activeServiceKeys = new Set((await getActiveServiceNames(Service)).map(normalizeServiceKey));
  safeUser.specialties = (Array.isArray(safeUser.specialties) ? safeUser.specialties : []).filter(value => activeServiceKeys.has(normalizeServiceKey(value)));
  safeUser.profilePhotoUrl = photoRecord?.profilePhotoFileId ? '/api/fanni/' + String(req.user._id) + '/photo?v=' + encodeURIComponent(String(req.user.updatedAt?.getTime?.() || Date.now())) : '';
  safeUser.identityReviewStatus = req.user.identityReviewStatus || 'pending';
  safeUser.identityReviewReason = req.user.identityReviewReason || '';
  safeUser.identityReviewImage = req.user.identityReviewImage || '';
  safeUser.identityReviewFields = Array.isArray(req.user.identityReviewFields) ? req.user.identityReviewFields : [];
  safeUser.identityReviewImages = Array.isArray(req.user.identityReviewImages) && req.user.identityReviewImages.length ? req.user.identityReviewImages : (req.user.identityReviewImage === 'both' ? ['front', 'back'] : req.user.identityReviewImage ? [req.user.identityReviewImage] : []);
  return res.json(safeUser);
});

router.patch('/me/review-resubmission', auth(), requireFanni, async (req, res, next) => {
  try {
    const fanni = await Fanni.findById(req.user._id);
    if (!fanni || fanni.identityReviewStatus !== 'needs_resubmission') {
      return res.status(409).json({ message: 'لا يوجد طلب تعديل نشط على حسابك.' });
    }
    const allowedFields = ['name', 'phone', 'specialties', 'areas'];
    const requiredFields = Array.isArray(fanni.identityReviewFields) ? fanni.identityReviewFields : [];
    const requestedImages = Array.isArray(fanni.identityReviewImages) && fanni.identityReviewImages.length
      ? fanni.identityReviewImages
      : (fanni.identityReviewImage === 'both' ? ['front', 'back'] : fanni.identityReviewImage ? [fanni.identityReviewImage] : []);
    const values = req.body?.fields && typeof req.body.fields === 'object' ? req.body.fields : {};
    const images = req.body?.images && typeof req.body.images === 'object' ? req.body.images : {};
    const suppliedFields = Object.keys(values);
    if (requiredFields.some(field => !allowedFields.includes(field)) ||
        requiredFields.some(field => !Object.prototype.hasOwnProperty.call(values, field)) ||
        suppliedFields.some(field => !requiredFields.includes(field))) {
      return res.status(400).json({ message: 'استكمل كل حقول البيانات التي طلبتها الإدارة فقط.' });
    }
    if (!requiredFields.length && !requestedImages.length) {
      return res.status(409).json({ message: 'طلب المراجعة لا يحتوي على بنود قابلة للتعديل. تواصل مع الإدارة.' });
    }

    const updates = {};
    if (requiredFields.includes('name')) {
      const name = String(values.name || '').trim();
      if (name.length < 2 || name.length > 50) return res.status(400).json({ message: 'اكتب الاسم بشكل صحيح (من حرفين إلى 50 حرفًا).' });
      updates.name = name;
    }
    if (requiredFields.includes('phone')) {
      const phone = normalizePhone(values.phone);
      if (!phone || !/^01[0-9]{9}$/.test(phone)) return res.status(400).json({ message: 'اكتب رقم هاتف مصري صحيحًا.' });
      const duplicate = await Fanni.findOne({ phone, _id: { $ne: fanni._id } }).select('_id');
      if (duplicate) return res.status(409).json({ message: 'رقم الهاتف مسجل بالفعل في حساب آخر.' });
      updates.phone = phone;
    }
    if (requiredFields.includes('areas')) {
      const areas = await validateApprovedAreas(values.areas);
      if (!areas) return res.status(400).json({ message: 'اختار مناطق العمل من قائمة المناطق المعتمدة.' });
      updates.areas = areas;
    }
    if (requiredFields.includes('specialties')) {
      const active = new Set((await getActiveServiceNames(Service)).map(normalizeServiceKey));
      const specialties = [...new Set((Array.isArray(values.specialties) ? values.specialties : []).map(value => String(value || '').normalize('NFC').trim()).filter(value => value && active.has(normalizeServiceKey(value))))];
      if (!specialties.length || specialties.length !== (Array.isArray(values.specialties) ? values.specialties.length : 0)) {
        return res.status(400).json({ message: 'اختار تخصصًا واحدًا على الأقل من الخدمات المعتمدة.' });
      }
      updates.specialties = specialties;
    }

    const requiredImageIds = [];
    for (const side of requestedImages) {
      if (!['front', 'back', 'profile'].includes(side)) return res.status(400).json({ message: 'نوع صورة مطلوب غير صالح.' });
      const fileId = String(images[side] || '');
      if (!mongoose.Types.ObjectId.isValid(fileId)) return res.status(400).json({ message: 'ارفع ' + (side === 'profile' ? 'الصورة الشخصية' : side === 'front' ? 'الوجه الأمامي للبطاقة' : 'الوجه الخلفي للبطاقة') + ' المطلوبة.' });
      requiredImageIds.push({ side, id: new mongoose.Types.ObjectId(fileId) });
    }
    if (Object.keys(images).some(side => !requestedImages.includes(side))) {
      return res.status(400).json({ message: 'ارفع الصور التي حددتها الإدارة فقط.' });
    }
    if (requiredImageIds.length) {
      if (!mongoose.connection.db) return res.status(503).json({ message: 'قاعدة البيانات غير متاحة حاليًا.' });
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
      const files = await bucket.find({ _id: { $in: requiredImageIds.map(item => item.id) } }).toArray();
      for (const item of requiredImageIds) {
        const expectedPurpose = item.side === 'profile' ? 'fanni-profile-photo' : 'fanni-id-document';
        const file = files.find(candidate => String(candidate._id) === String(item.id) && candidate.metadata?.purpose === expectedPurpose && candidate.metadata?.side === item.side);
        if (!file) return res.status(400).json({ message: 'إحدى الصور المرفوعة غير صالحة. أعد اختيار الصورة المطلوبة.' });
        if (item.side === 'profile') updates.profilePhotoFileId = item.id;
        if (item.side === 'front') updates.identityCardFrontFileId = item.id;
        if (item.side === 'back') updates.identityCardBackFileId = item.id;
      }
    }

    Object.assign(fanni, updates);
    fanni.identityReviewStatus = 'pending';
    fanni.identityReviewReason = '';
    fanni.identityReviewImage = '';
    fanni.identityReviewFields = [];
    fanni.identityReviewImages = [];
    fanni.rejectionReason = '';
    fanni.status = 'قيد المراجعة';
    await fanni.save();
    await notifyAdmins({
      type: 'admin_new_technician',
      title: 'استكمل فني متطلبات المراجعة',
      message: 'أرسل الفني ' + String(fanni.name || 'فني') + ' التعديلات المطلوبة على بياناته أو صوره.',
      link: '/admin?tab=pending',
      dedupeKey: 'admin-fanni-review-resubmitted:' + String(fanni._id) + ':' + Date.now()
    });
    return res.set('Cache-Control', 'no-store').json({ message: 'تم إرسال التعديلات والصور المطلوبة للإدارة. حسابك ما زال قيد المراجعة.' });
  } catch (err) { return next(err); }
});





router.patch('/me/identity-card', auth(), requireFanni, async (req, res, next) => {
  try {
    const requestedImage = req.user.identityReviewImage || 'both';
    const currentIdentity = await Fanni.findById(req.user._id).select('+identityCardFrontFileId +identityCardBackFileId').lean();
    const frontId = String(req.body?.identityCardFrontFileId || (requestedImage === 'back' ? currentIdentity?.identityCardFrontFileId : ''));
    const backId = String(req.body?.identityCardBackFileId || (requestedImage === 'front' ? currentIdentity?.identityCardBackFileId : ''));
    const hasNationalId = Boolean(String(req.body?.nationalId || '').trim());
    const nationalId = hasNationalId ? normalizeNationalId(req.body.nationalId) : '';
    if (!mongoose.Types.ObjectId.isValid(frontId) || !mongoose.Types.ObjectId.isValid(backId) || frontId === backId) return res.status(400).json({ message: 'ارفع صورة البطاقة المطلوبة وتأكد من اكتمال الوجهين.' });
    if (hasNationalId && !isValidNationalId(nationalId)) return res.status(400).json({ message: 'اكتب رقمًا قوميًّا مصريًا صحيحًا مكوّنًا من 14 رقمًا.' });
    if (!mongoose.connection.db) return res.status(503).json({ message: 'قاعدة البيانات غير متاحة حاليًا.' });
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const ids = [new mongoose.Types.ObjectId(frontId), new mongoose.Types.ObjectId(backId)];
    const uploads = await bucket.find({ _id: { $in: ids }, 'metadata.purpose': 'fanni-id-document' }).toArray();
    const front = uploads.find(file => String(file._id) === frontId && file.metadata?.side === 'front');
    const back = uploads.find(file => String(file._id) === backId && file.metadata?.side === 'back');
    if (!front || !back) return res.status(400).json({ message: 'صور البطاقة المرفوعة غير مكتملة أو غير صالحة.' });
    const ledger = await FanniCardLedger.findOne({ fanniId: req.user._id }).select('+nationalIdEncrypted');
    if (!ledger && !hasNationalId) return res.status(409).json({ message: 'سجل الرقم القومي غير موجود. أدخل الرقم القومي لإعادة إنشاء سجل المراجعة.' });
    if (hasNationalId) {
      const nationalIdHash = cardHash(nationalId);
      const duplicate = await FanniCardLedger.findOne({ nationalIdHash, ...(ledger ? { _id: { $ne: ledger._id } } : {}) }).select('_id');
      if (duplicate) return res.status(409).json({ code: 'DUPLICATE_FANNI_CARD_REVIEW', message: 'هذا الرقم القومي مرتبط بسجل آخر، وتم إيقاف إعادة الإرسال لحين مراجعة الإدارة.' });
      if (ledger) {
        ledger.nationalIdHash = nationalIdHash;
        ledger.nationalIdEncrypted = encryptNationalId(nationalId);
        ledger.fanniName = req.user.name;
        ledger.extractedName = '';
        ledger.status = 'مسجلة';
        await ledger.save();
      } else {
        await FanniCardLedger.create({ nationalIdHash, nationalIdEncrypted: encryptNationalId(nationalId), fanniId: req.user._id, fanniName: req.user.name, linkedTechnicians: [{ fanniId: req.user._id, name: req.user.name, phone: req.user.phone }], extractedName: '', status: 'مسجلة' });
      }
    }
    await Fanni.updateOne({ _id: req.user._id, role: 'fanni' }, { $set: {
      identityCardFrontFileId: ids[0], identityCardBackFileId: ids[1],
      identityReviewStatus: 'pending', identityReviewReason: '', identityReviewImage: '', rejectionReason: '', status: 'قيد المراجعة'
    } });
    await notifyAdmins({ type: 'admin_new_technician', title: 'إعادة إرسال صور بطاقة فني', message: 'أعاد الفني ' + String(req.user.name || 'فني') + ' رفع صور البطاقة للمراجعة.', link: '/admin?tab=pending', dedupeKey: 'admin-fanni-identity-resubmitted:' + String(req.user._id) + ':' + Date.now() });
    return res.json({ message: 'تم استلام صور البطاقة والرقم القومي. الحساب ما زال قيد مراجعة الإدارة.' });
  } catch (err) {
    if (err?.code === 'CARD_LEDGER_SECRET_MISSING') return res.status(503).json({ message: 'إعداد حماية سجل البطاقات غير مكتمل على الخادم.' });
    if (err?.code === 11000) return res.status(409).json({ message: 'هذا الرقم القومي مسجل بالفعل في سجل آخر.' });
    return next(err);
  }
});

router.patch('/me/profile-photo', auth(), requireFanni, async (req, res, next) => {
  try {
    const fileId = String(req.body?.profilePhotoFileId || '');
    if (!mongoose.Types.ObjectId.isValid(fileId) || !mongoose.connection.db) return res.status(400).json({ message: 'صورة الملف الشخصي غير صالحة.' });
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId), 'metadata.purpose': 'fanni-profile-photo', 'metadata.side': 'profile' }).limit(1).toArray();
    if (!files.length) return res.status(400).json({ message: 'ارفع صورة شخصية صحيحة أولًا.' });
    const isRequestedResubmission = req.user.identityReviewStatus === 'needs_resubmission' && req.user.identityReviewImage === 'profile';
    await Fanni.updateOne({ _id: req.user._id, role: 'fanni' }, { $set: {
      profilePhotoFileId: new mongoose.Types.ObjectId(fileId),
      ...(isRequestedResubmission ? { identityReviewStatus: 'pending', identityReviewReason: '', identityReviewImage: '', rejectionReason: '', status: 'قيد المراجعة' } : {})
    } });
    if (isRequestedResubmission) {
      await notifyAdmins({ type: 'admin_new_technician', title: 'إعادة إرسال الصورة الشخصية لفني', message: 'أعاد الفني ' + String(req.user.name || 'فني') + ' رفع الصورة الشخصية المطلوبة للمراجعة.', link: '/admin?tab=pending', dedupeKey: 'admin-fanni-profile-resubmitted:' + String(req.user._id) + ':' + Date.now() });
    }
    return res.set('Cache-Control', 'no-store').json({ message: isRequestedResubmission ? 'تم استلام الصورة الشخصية الجديدة. الحساب ما زال قيد مراجعة الإدارة.' : 'تم تحديث صورتك الشخصية بنجاح.', profilePhotoUrl: '/api/fanni/' + String(req.user._id) + '/photo?v=' + Date.now(), identityReviewStatus: isRequestedResubmission ? 'pending' : req.user.identityReviewStatus });
  } catch (err) { return next(err); }
});

router.patch('/me', auth(), requireFanni, validate(profileUpdateSchema), async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone || !/^01[0-9]{9}$/.test(phone)) return res.status(400).json({ message: 'رقم الهاتف غير صحيح' });
    if (req.user.pendingProfileChange?.requestedAt) return res.status(409).json({ message: 'لديك طلب تعديل بيانات قيد مراجعة الإدارة. انتظر القرار قبل إرسال طلب جديد.' });
    const duplicate = await Fanni.findOne({ phone, _id: { $ne: req.user._id } }).select('_id');
    if (duplicate) return res.status(409).json({ message: 'رقم الهاتف مسجل بالفعل في حساب آخر' });
    const requestedSpecialties = Array.isArray(req.body.specialties) ? req.body.specialties : null;
    const activeServiceKeys = new Set((await getActiveServiceNames(Service)).map(normalizeServiceKey));
    const normalizedSpecialties = requestedSpecialties
      ? [...new Set(requestedSpecialties.map(value => String(value).normalize('NFC').trim()).filter(value => value && activeServiceKeys.has(normalizeServiceKey(value))))]
      : null;
    if (requestedSpecialties && !normalizedSpecialties.length) {
      return res.status(400).json({ message: 'اختار تخصصًا واحدًا على الأقل من الخدمات الظاهرة حاليًا في حمزاوي سات.' });
    }
    const current = {
      phone: String(req.user.phone || ''),
      specialties: [...(req.user.specialties || [])],
      areas: [...(req.user.areas || [])]
    };
    // نخفي المهن القديمة من الاختيارات الجديدة، لكن نحتفظ بها في السجل التاريخي.
    // أي تعديل لبيانات الحساب يدمج التخصصات الجديدة المعتمدة مع التخصصات القديمة المحفوظة.
    const historicalSpecialties = current.specialties.filter(value => !activeServiceKeys.has(normalizeServiceKey(value)));
    const specialties = normalizedSpecialties
      ? [...new Set([...historicalSpecialties, ...normalizedSpecialties])]
      : [...current.specialties];
    const areas = await validateApprovedAreas(req.body.areas);
    if (!areas) return res.status(400).json({ message: 'اختار مناطق العمل من قائمة المناطق المعتمدة فقط.' });
    const sameArray = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const changedFields = [];
    if (phone !== current.phone) changedFields.push('phone');
    if (!sameArray(specialties, current.specialties)) changedFields.push('specialties');
    if (!sameArray(areas, current.areas)) changedFields.push('areas');
    if (!changedFields.length) return res.status(400).json({ message: 'لم يتم اكتشاف أي تغيير في البيانات. عدّل الحقل المطلوب أولًا.' });
    const requestedAt = new Date();
    const pendingProfileChange = { before: current, phone, specialties, areas, changedFields, requestedAt };
    const profileDecision = {
      action: 'طلب تعديل بيانات',
      reason: 'طلب الفني تغيير بيانات حسابه',
      date: requestedAt,
      by: String(req.user.name || 'الفني'),
      byId: req.user._id,
      meta: { before: current, requested: { phone, specialties, areas }, changedFields }
    };

    // Target only the fields for this request. Saving the entire legacy document
    // can fail validation because of unrelated historical fields.
    const updatedFanni = await Fanni.findOneAndUpdate(
      { _id: req.user._id, role: 'fanni' },
      { $set: { pendingProfileChange }, $push: { decisions: profileDecision } },
      { new: true, runValidators: true, context: 'query' }
    );
    if (!updatedFanni) return res.status(404).json({ message: 'حساب الفني غير موجود.' });

    // Notification delivery must not keep the profile-edit request pending.
    Promise.resolve(notifyAdmins({
      type: 'admin_fanni_profile_edit',
      title: 'طلب تعديل بيانات فني',
      message: `طلب الفني ${updatedFanni.name} تعديل بيانات حسابه ويحتاج مراجعة الإدارة.`,
      link: '/admin?tab=profileEdits',
      dedupeKey: 'admin-fanni-profile-edit:' + String(updatedFanni._id) + ':' + String(requestedAt.getTime())
    })).catch(err => console.error('Could not notify admins about technician profile edit:', err.message));

    // Return a compact acknowledgement only. Serializing the full technician document
    // (including its historical decisions) made the self-service request response unnecessarily heavy.
    return res.set('Cache-Control', 'no-store').json({
      message: 'تم إرسال طلب تعديل بياناتك للإدارة. بيانات حسابك الحالية ستظل كما هي لحين الموافقة.',
      requestId: String(updatedFanni._id),
      changedFields,
      requestedAt,
      pendingProfileChange: {
        requestedAt,
        changedFields,
        phone,
        specialties,
        areas
      }
    });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ message: 'رقم الهاتف مسجل بالفعل في حساب آخر' });
    next(err);
  }
});

/*
 * POST /api/fanni/wallet/topup
 *
 * إنشاء طلب شحن للمراجعة فقط.
 * لا يتم تعديل رصيد الفني من هذا المسار.
 */
router.post(
  '/wallet/topup',
  auth(),
  requireFanni,
  requireApprovedFanni,
  validate(topupSchema),
  async (req, res, next) => {
    try {
      const senderNumber = normalizePhone(req.body.fromPhone);

      if (!senderNumber || !/^01[0-9]{9}$/.test(senderNumber)) {
        return res.status(400).json({
          message: 'رقم الهاتف المحول منه غير صحيح'
        });
      }

      const referenceNumber = String(
        req.body.reference || req.body.referenceCode || ''
      ).trim().slice(0, 50);

      const amount = Number(req.body.amount);

      // Keep a stable per-technician key across client retries. Older app versions
      // that do not send one retain the previous one-shot behavior.
      const idempotencyKey = req.body.idempotencyKey
        ? 'fanni:' + String(req.user._id) + ':' + String(req.body.idempotencyKey)
        : crypto.randomUUID();
      const existingRequest = await TopupRequest.findOne({ fanni: req.user._id, idempotencyKey }).lean();
      if (existingRequest) {
        return res.status(200).json({
          message: 'طلب الشحن مسجل بالفعل وبانتظار مراجعة الإدارة.',
          request: { id: String(existingRequest._id), amount: existingRequest.amount, senderNumber: existingRequest.senderNumber, method: existingRequest.method || 'vodafone_cash', referenceNumber: existingRequest.referenceNumber || '', status: existingRequest.status, createdAt: existingRequest.createdAt },
          balance: Number(req.user.walletBalance || 0), walletBalance: Number(req.user.walletBalance || 0), duplicate: true
        });
      }

      const request = await TopupRequest.create({
        fanni: req.user._id,
        fanniName: req.user.name,
        fanniPhone: req.user.phone,
        amount,
        senderNumber,
        method: req.body.method || 'vodafone_cash',
        referenceNumber,
        status: 'قيد المراجعة',
        isCredited: false,
        idempotencyKey
      });

      await notifyAdmins({
        type: 'admin_new_topup',
        title: 'طلب شحن محفظة جديد',
        message: `أرسل الفني ${req.user.name} طلب شحن محفظة بقيمة ${request.amount} جنيه ويحتاج مراجعة الإدارة.`,
        link: '/admin?tab=topups',
        dedupeKey: 'admin-new-topup:' + String(request._id)
      });

      return res.status(201).json({
        message: 'تم إرسال طلب الشحن بنجاح، وهو الآن قيد مراجعة الإدارة.',
        request: {
          id: String(request._id),
          amount: request.amount,
          senderNumber: request.senderNumber,
          method: request.method || 'vodafone_cash',
          referenceNumber: request.referenceNumber || '',
          status: request.status,
          createdAt: request.createdAt
        },
        balance: Number(req.user.walletBalance || 0),
        walletBalance: Number(req.user.walletBalance || 0)
      });
    } catch (err) {
      if (err && err.code === 11000) {
        const key = req.body?.idempotencyKey
          ? 'fanni:' + String(req.user?._id || '') + ':' + String(req.body.idempotencyKey)
          : '';
        const existing = key ? await TopupRequest.findOne({ fanni: req.user._id, idempotencyKey: key }).lean().catch(() => null) : null;
        if (existing) return res.status(200).json({
          message: 'طلب الشحن مسجل بالفعل وبانتظار مراجعة الإدارة.',
          request: { id: String(existing._id), amount: existing.amount, senderNumber: existing.senderNumber, method: existing.method || 'vodafone_cash', referenceNumber: existing.referenceNumber || '', status: existing.status, createdAt: existing.createdAt },
          balance: Number(req.user.walletBalance || 0), walletBalance: Number(req.user.walletBalance || 0), duplicate: true
        });
        return res.status(409).json({ message: 'تعذر إنشاء طلب الشحن بسبب تكرار بيانات الطلب. حاول مرة أخرى.' });
      }

      next(err);
    }
  }
);

/*
 * GET /api/fanni/wallet/history
 *
 * يعرض طلبات الشحن الخاصة بالفني الحالي فقط.
 */
router.get(
  '/wallet/history',
  auth(),
  requireFanni,
  async (req, res, next) => {
    try {
      const requests = await TopupRequest.find({
        fanni: req.user._id
      })
        .select(
          'amount senderNumber method referenceNumber status isCredited reviewReason reviewedAt transactionNumber createdAt updatedAt'
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      const transactions = await WalletTransaction.find({ fanni: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
      const safeTransactions = transactions.map(item => ({ id: String(item._id), transactionNumber: item.transactionNumber || ('HZW-' + String(item._id).toUpperCase()), type: item.type, amount: item.amount, balanceBefore: item.balanceBefore, balanceAfter: item.balanceAfter, description: item.description, orderSN: item.orderSN || '', createdAt: item.createdAt }));

      const safeRequests = requests.map(request => ({
        id: String(request._id),
        amount: request.amount,
        senderNumber: request.senderNumber,
        method: request.method || 'vodafone_cash',
        referenceNumber: request.referenceNumber || '',
        status: request.status,
        isCredited: Boolean(request.isCredited),
        reviewReason: request.reviewReason || '',
        reviewedAt: request.reviewedAt || null,
        transactionNumber: request.transactionNumber || '',
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
      }));

      const balance = Number(req.user.walletBalance || 0);

      return res.json({
        requests: safeRequests,
        data: safeRequests,
        history: safeRequests,
        transactions: safeTransactions,
        balance,
        walletBalance: balance
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;