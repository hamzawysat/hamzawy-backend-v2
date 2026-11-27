'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const mongoose = require('mongoose');
const crypto = require('crypto');

const Fanni = require('../models/Fanni');
const FanniCardLedger = require('../models/FanniCardLedger');
const Client = require('../models/Client');
const Notification = require('../models/Notification');
const TopupRequest = require('../models/TopupRequest');
const Order = require('../models/Order');
const Rating = require('../models/Rating');
const Complaint = require('../models/Complaint');
const WalletTransaction = require('../models/WalletTransaction');
const StoreProduct = require('../models/StoreProduct');
const StoreOrder = require('../models/StoreOrder');
const { createNotification, notifyAdmins } = require('../utils/notifications');
const Service = require('../models/Service');
const { getActiveServiceNames } = require('../services/serviceCatalog');
const Region = require('../models/Region');
const { AREA_OPTIONS } = require('../config/areas');
const AdminConfig = require('../models/AdminConfig');
const AdminAuditLog = require('../models/AdminAuditLog');
const SupportCase = require('../models/SupportCase');
const PageVisit = require('../models/PageVisit');

const {
  CATEGORIES,
  ALL_SERVICES,
  normalizeServiceName,
  findCategoryByService,
  findCategoryByLabel
} = require('../config/professions');

const { auth, defaultAdminPermissions, ADMIN_PERMISSION_KEYS } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();

// Authenticated mobile container for the exact web admin console.
// The bearer token is copied into same-origin storage before any admin scripts run,
// so every existing web-console action and permission guard remains authoritative.
router.get('/mobile-panel', auth('admin'), (req, res, next) => {
  try {
    const authorization = String(req.headers.authorization || '');
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ message: 'جلسة الإدارة غير صالحة.' });
    const filePath = path.join(__dirname, '../../frontend/admin.html');
    let html = fs.readFileSync(filePath, 'utf8');
    const tokenLiteral = JSON.stringify(token).replace(/</g, '\\u003c');
    const bootstrap = `<base href="/"><script>
      (function () {
        window.__SONAA_CON_APP__ = true;
        var token = ${tokenLiteral};
        localStorage.setItem('admin_token_v3', token);
        localStorage.setItem('admin_token', token);
        localStorage.setItem('token', token);
        localStorage.setItem('auth_token', token);
      })();
    </script>`;
    html = html.replace(/<head([^>]*)>/i, (head) => head + bootstrap);
    return res.status(200).set('Cache-Control', 'no-store, no-cache, must-revalidate').type('html').send(html);
  } catch (error) {
    return next(error);
  }
});

const createAdminServicesRouter = require('./admin/services');
const createAdminPlatformRouter = require('./admin/platform');
const createAdminOperationsRouter = require('./admin/operations');
const createAdminFanniProfilesRouter = require('./admin/fanniProfiles');
const createAdminOffersRouter = require('./admin/offers');
const createAdminOrdersRouter = require('./admin/orders');
const createAdminComplaintsRouter = require('./admin/complaints');
const createAdminUsersRouter = require('./admin/users');
const createAdminClientsRouter = require('./admin/clients');
const createAdminWalletRouter = require('./admin/wallet');
const createAdminClientWalletRouter = require('./admin/clientWallet');
const ClientTopupRequest = require('../models/ClientTopupRequest');
const { findSubscriptions } = require('../models/subscriptionRepository');
const createAdminFanniManagementRouter = require('./admin/fanniManagement');
const createAdminStoreRouter = require('./admin/store');
const createAdminFanniCardLedgerRouter = require('./admin/fanniCardLedger');
const createAdminArchiveRouter = require('./admin/archive');
const createAdminClientProfilesRouter = require('./admin/clientProfiles');

const ADMIN_TOKEN_EXPIRY = '1d';
const CON_ADMIN_TOKEN_EXPIRY = '30d';
const MAX_LIST_LIMIT = 500;

const loginSchema = Joi.object({
  phone: Joi.string().trim().optional(),
  email: Joi.string().trim().email().optional(),
  password: Joi.string().min(1).required()
}).or('phone', 'email');

const amountSchema = Joi.number()
  .strict()
  .min(0)
  .max(100000000)
  .required();

const reasonSchema = Joi.string().trim().max(500).allow('');

const complaintStatusSchema = Joi.string().valid(
  'جديدة',
  'قيد المراجعة',
  'تم الحل',
  'مرفوضة'
);

function publicFanni(fanni) {
  const item = typeof fanni.toObject === 'function'
    ? fanni.toObject()
    : { ...fanni };
  delete item.passwordHash;
  delete item.__v;
  const activeSpecialties = Array.isArray(item.specialties) ? item.specialties : [];
  const statusMap = {
    'معتمد': 'approved',
    'قيد المراجعة': 'pending',
    'مرفوض': 'rejected',
    'معلق': 'disabled'
  };
  return {
    ...item,
    status: statusMap[item.status] || 'pending',
    actualStatus: item.status,
    isApproved: item.status === 'معتمد',
    isDisabled: item.status === 'معلق',
    specialties: activeSpecialties,
    activeSpecialties,
    balance: Number(item.walletBalance || 0),
    skill: activeSpecialties.join('، '),
    service: activeSpecialties.join('، ')
  };
}

function publicTopup(request) {
  const item = typeof request.toObject === 'function' ? request.toObject() : { ...request };
  const statusMap = { 'قيد المراجعة': 'pending', 'مقبول': 'approved', 'مرفوض': 'rejected' };
  return {
    ...item,
    status: statusMap[item.status] || 'pending',
    actualStatus: item.status,
    fromPhone: item.senderNumber || '',
    phone: item.fanniPhone || ''
  };
}

function adminName(req) { return String(req.user?.name || 'الإدارة').slice(0, 50); }
function decision(req, action, reason = '') {
  return { action, reason: String(reason || '').trim().slice(0, 500), date: new Date(), by: adminName(req), byId: req.user?._id };
}
function validId(value) { return mongoose.isValidObjectId(value); }
function sendBadId(res) { return res.status(400).json({ message: 'معرّف غير صالح' }); }
function getLoginPhone(body) {
  const raw = String(body.phone || body.email || '').trim();
  if (raw.includes('@')) {
    const configuredEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const configuredPhone = String(process.env.ADMIN_PHONE || '').trim();
    if (!configuredEmail || !configuredPhone || raw.toLowerCase() !== configuredEmail) { return null; }
    return normalizePhone(configuredPhone);
  }
  return normalizePhone(raw);
}

router.post('/bootstrap', async (req, res, next) => {
  try {
    const configuredSecret = String(process.env.ADMIN_SETUP_SECRET || '');
    const suppliedSecret = typeof req.body?.secret === 'string' ? req.body.secret : '';
    if (configuredSecret.length < 32 || suppliedSecret.length < 32) {
      return res.status(503).json({ message: 'إعداد إنشاء حساب الإدارة غير مكتمل' });
    }
    const expected = Buffer.from(configuredSecret, 'utf8');
    const supplied = Buffer.from(suppliedSecret, 'utf8');
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      return res.status(403).json({ message: 'المفتاح السري غير صحيح' });
    }
    const adminCount = await Fanni.countDocuments({ role: 'admin' });
    if (adminCount > 0) {
      return res.status(409).json({ message: 'يوجد حساب إدارة بالفعل. تم إيقاف إنشاء الحساب الأول.' });
    }
    const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const configuredPhone = String(process.env.ADMIN_PHONE || '').trim();
    const password = String(process.env.ADMIN_PASSWORD || '');
    const name = String(process.env.ADMIN_NAME || 'إدارة صناع').trim();
    if (!email || !Joi.string().email().validate(email).value || !configuredPhone || password.length < 12 || name.length < 2 || name.length > 50) {
      return res.status(503).json({ message: 'راجع إعدادات ADMIN_EMAIL وADMIN_PHONE وADMIN_PASSWORD وADMIN_NAME على الخادم' });
    }
    const phone = normalizePhone(configuredPhone);
    if (!phone || !/^01[0-9]{9}$/.test(phone)) {
      return res.status(503).json({ message: 'رقم الإدارة الموجود في إعدادات الخادم غير صالح' });
    }
    const existingPhone = await Fanni.findOne({ phone }).select('_id');
    if (existingPhone) {
      return res.status(409).json({ message: 'رقم الإدارة مستخدم بالفعل في حساب موجود. لم يتم تغيير أي حساب.' });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ message: 'إعداد JWT_SECRET غير موجود على الخادم' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await Fanni.create({
      name, phone, passwordHash, specialties: ['إدارة'], areas: ['الإدارة'], status: 'معتمد', role: 'admin',
      decisions: [{ action: 'تسجيل', reason: 'إنشاء أول حساب إدارة', date: new Date(), by: 'النظام' }]
    });
    return res.status(201).json({
      message: 'تم إنشاء أول حساب إدارة بنجاح. احتفظ ببيانات الدخول في مكان آمن.',
      user: { id: String(admin._id), name: admin.name, phone: admin.phone, role: admin.role }
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'الحساب أو رقم الهاتف موجود بالفعل. لم يتم إنشاء حساب مكرر.' });
    }
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ message: 'تسجيل الدخول غير متاح بسبب إعدادات الخادم' });
    }
    const phone = getLoginPhone(req.body);
    if (!phone) { return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' }); }
    const admin = await Fanni.findOne({ phone, $or: [{ role: 'admin' }, { adminRole: { $in: ['مشرف', 'مشرف أول', 'مدير', 'قراءة فقط'] } }] }).select('+passwordHash');
    if (!admin || !admin.passwordHash || !(await bcrypt.compare(req.body.password, admin.passwordHash))) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }
    if (admin.status === 'معلق' || admin.status === 'مرفوض') {
      return res.status(403).json({ message: 'حساب الإدارة غير مسموح له بالدخول' });
    }
    const token = jwt.sign({ id: admin._id, role: admin.role, adminRole: admin.adminRole || null, tokenVersion: Number(admin.tokenVersion || 0) }, process.env.JWT_SECRET, { expiresIn: ADMIN_TOKEN_EXPIRY });
    return res.json({ token, user: { id: String(admin._id), name: admin.name, phone: admin.phone, role: admin.role, adminRole: admin.adminRole || null } });
  } catch (err) { next(err); }
});
// Dedicated 30-day session for the Sonaa CON native app.
// Browser admin sessions intentionally remain limited to ADMIN_TOKEN_EXPIRY (1d).
router.post('/con-login', validate(loginSchema), async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ message: 'تسجيل الدخول غير متاح بسبب إعدادات الخادم' });
    }
    const phone = getLoginPhone(req.body);
    if (!phone) return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    const admin = await Fanni.findOne({
      phone,
      $or: [
        { role: 'admin' },
        { adminRole: { $in: ['مشرف', 'مشرف أول', 'مدير', 'قراءة فقط'] } }
      ]
    }).select('+passwordHash');
    if (!admin || !admin.passwordHash || !(await bcrypt.compare(req.body.password, admin.passwordHash))) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }
    if (admin.status === 'معلق' || admin.status === 'مرفوض') {
      return res.status(403).json({ message: 'حساب الإدارة غير مسموح له بالدخول' });
    }
    const token = jwt.sign({
      id: admin._id,
      role: admin.role,
      adminRole: admin.adminRole || null,
      tokenVersion: Number(admin.tokenVersion || 0),
      client: 'sonaa-con',
      scope: 'admin'
    }, process.env.JWT_SECRET, { expiresIn: CON_ADMIN_TOKEN_EXPIRY, audience: 'sonaa-con' });
    return res.json({
      token,
      user: {
        id: String(admin._id),
        name: admin.name,
        phone: admin.phone,
        role: admin.role,
        adminRole: admin.adminRole || null
      }
    });
  } catch (err) { next(err); }
});

router.use(createAdminComplaintsRouter({
  auth, validate, Joi, complaintStatusSchema, MAX_LIST_LIMIT,
  validId, sendBadId, Complaint, Order, adminName, writeAdminAudit, createNotification
}));

router.get(['/counts', '/stats'], auth('admin'), async (req, res, next) => {
  try {
    const activeServices = await getActiveServiceNames(Service);
    const acceptedFanniFilter = {
      archivedAt: null,
      $and: [
        { $or: [ { role: 'fanni' }, { role: { $ne: 'admin' }, specialties: { $exists: true, $ne: [] }, adminRole: null } ] },
        { specialties: { $in: activeServices } },
        { status: { $in: ['معتمد', 'معلق'] } }
      ]
    };
    const [technicians, verifiedTechnicians, clients] = await Promise.all([
      Fanni.countDocuments(acceptedFanniFilter),
      Fanni.countDocuments({ ...acceptedFanniFilter, status: 'معتمد' }),
      Client.countDocuments({ archivedAt: null })
    ]);
    return res.set('Cache-Control', 'no-store').json({
      counts: { technicians, verifiedTechnicians, clients }
    });
  } catch (err) { next(err); }
});

router.use(createAdminArchiveRouter({
  auth, Joi, Client, Fanni, adminName, writeAdminAudit, validId, sendBadId
}));

router.use(createAdminFanniProfilesRouter({
  Region,
  Service,
  AREA_OPTIONS,
  ALL_SERVICES,
  auth,
  validate,
  Joi,
  Fanni,
  Rating,
  Order,
  WalletTransaction,
  TopupRequest,
  AdminAuditLog,
  bcrypt,
  createNotification,
  writeAdminAudit,
  publicFanni,
  validId,
  sendBadId,
  decision,
  adminName,
  MAX_LIST_LIMIT,
  reasonSchema
}));

router.use(createAdminFanniManagementRouter({
  auth, validate, Joi, reasonSchema, Fanni, FanniCardLedger, Rating, Order,
  TopupRequest, WalletTransaction, adminName, decision, publicFanni,
  validId, sendBadId, writeAdminAudit, createNotification
}));

router.use(createAdminWalletRouter({
  auth, validate, Joi, amountSchema, reasonSchema, validId, sendBadId,
  mongoose, Fanni, TopupRequest, Order, WalletTransaction,
  adminName, decision, publicFanni, publicTopup, writeAdminAudit,
  createNotification, MAX_LIST_LIMIT
}));

router.use(createAdminClientWalletRouter({
  auth, validate, Joi, mongoose, Client, ClientTopupRequest, WalletTransaction, Order,
  adminName, writeAdminAudit, createNotification, validId, sendBadId, MAX_LIST_LIMIT
}));


router.use(createAdminStoreRouter({ auth, Joi, mongoose, Client, Fanni, WalletTransaction, StoreProduct, StoreOrder, AdminConfig, notifyAdmins, createNotification, writeAdminAudit }));

// Legacy destructive client endpoints are intentionally retired at the API boundary.
router.delete('/clients/:phone/account', auth('admin'), (req, res) => {
  return res.status(410).json({
    message: 'الحذف النهائي للحسابات متوقف. استخدم الأرشفة مع كتابة السبب.',
    code: 'PERMANENT_DELETE_DISABLED'
  });
});

router.delete('/clients/:phone', auth('admin'), (req, res) => {
  return res.status(410).json({
    message: 'حذف حساب العميل أو طلباته من هذا المسار متوقف نهائيًا. استخدم الأرشفة دون المساس بالسجلات.',
    code: 'PERMANENT_DELETE_DISABLED'
  });
});

router.use(createAdminOffersRouter({ auth, Order, Fanni, adminName, writeAdminAudit }));
router.use(createAdminOrdersRouter({
  auth, validate, Joi, ALL_SERVICES, Service, reasonSchema, MAX_LIST_LIMIT,
  Order, WalletTransaction, Fanni, AdminConfig, mongoose,
  normalizePhone, adminName, writeAdminAudit, createNotification, requireRootAdmin
}));

function notImplemented(msg){ return (req,res)=>res.status(501).json({message: msg}); }

const ADMIN_ROLES = ['مشرف', 'مشرف أول', 'مدير', 'قراءة فقط'];
function isRootAdmin(user) {
  const configuredPhone = normalizePhone(String(process.env.ADMIN_PHONE || ''));
  return Boolean(user && user.role === 'admin' && configuredPhone && normalizePhone(String(user.phone || '')) === configuredPhone);
}
function requireRootAdmin(req, res) {
  if (!isRootAdmin(req.user)) {
    res.status(403).json({ message: 'إدارة المناصب محصورة في المدير العام' });
    return false;
  }
  return true;
}
function publicAdminUser(user) {
  return { id: String(user._id), name: user.name, phone: user.phone, role: user.role, isRootAdmin: isRootAdmin(user), adminRole: user.adminRole || (isRootAdmin(user) ? 'مدير عام' : (user.role === 'admin' ? 'مشرف' : null)), status: user.status, adminPermissions: user.adminPermissions || {} };
}
router.use(createAdminUsersRouter({
  auth, Fanni, ADMIN_ROLES, MAX_LIST_LIMIT, validId, sendBadId,
  requireRootAdmin, isRootAdmin, publicAdminUser, defaultAdminPermissions,
  ADMIN_PERMISSION_KEYS, adminName, writeAdminAudit
}));

async function getAdminConfig() {
  let config = await AdminConfig.findOne({ key: 'main' });
  if (!config) config = await AdminConfig.create({ key: 'main' });
  return config;
}
async function writeAdminAudit(req, action, category, target, details) {
  try {
    await AdminAuditLog.create({
      action: String(action || '').slice(0, 100),
      category: String(category || 'admin').slice(0, 50),
      target: String(target || '').slice(0, 200),
      details: String(details || '').slice(0, 3000),
      adminName: adminName(req),
      adminId: String(req.user?._id || ''),
      ip: String(req.ip || '').slice(0, 80)
    });
  } catch (err) { console.error('Could not write admin audit log:', err.message); }
}

router.use(createAdminClientsRouter({ auth, Joi, Client, normalizePhone, adminName, writeAdminAudit }));
router.use(createAdminClientProfilesRouter({
  auth, Client, Order, Complaint, WalletTransaction, findSubscriptions,
  ClientTopupRequest, StoreOrder, SupportCase, AdminAuditLog, validId, sendBadId
}));

// GET /clients is provided by the platform router and lists registered Client accounts only.


router.use(createAdminServicesRouter({
  Service,
  CATEGORIES,
  findCategoryByService,
  findCategoryByLabel,
  mongoose,
  Joi,
  auth,
  writeAdminAudit
}));
router.use(createAdminPlatformRouter({
  auth,
  Joi,
  getAdminConfig,
  writeAdminAudit,
  adminName,
  Order,
  Complaint,
  Client,
  Rating,
  Fanni,
  AdminAuditLog,
  PageVisit,
  normalizePhone,
  bcrypt
}));
router.use(createAdminOperationsRouter({
  Region,
  Joi,
  adminName,
  writeAdminAudit,
  auth,
  mongoose,
  normalizePhone,
  Fanni,
  Client,
  Notification
}));

router.use(createAdminFanniCardLedgerRouter({ auth, writeAdminAudit, adminName }));

module.exports = router;
