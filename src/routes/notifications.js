'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const PushToken = require('../models/PushToken');
const WebPushSubscription = require('../models/WebPushSubscription');
const NotificationDelivery = require('../models/NotificationDelivery');
const { getVapidKeys, isAllowedPushEndpoint } = require('../utils/webPush');
const { normalizeNotificationLink, notifyAdmins } = require('../utils/notifications');
const { auth, canAccessAdmin, isRootAdmin } = require('../middleware/auth');
const { clientAuth } = require('../middleware/clientAuth');

const router = express.Router();

function owner(req, role) {
  return role === 'client' ? req.clientId : req.userId;
}

function roleAuth(role) {
  if (role === 'client') return clientAuth;
  if (role === 'fanni') return auth('fanni');
  return (req, res, next) => auth()(req, res, () => {
    if (req.user?.role !== 'admin' && !req.user?.adminRole) return res.status(403).json({ message: 'هذه الإشعارات مخصصة لحسابات الإدارة.' });
    const scopedReq = { ...req, path: '/notifications' + String(req.path || '/'), method: req.method };
    if (!isRootAdmin(req.user) && !canAccessAdmin(req.user, scopedReq)) return res.status(403).json({ message: 'هذا الإجراء خارج صلاحيات الإشعارات لمنصبك الإداري.' });
    return next();
  });
}

router.get('/admin/delivery-log', roleAuth('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (['client', 'fanni', 'admin'].includes(String(req.query.role || ''))) filter.recipientRole = String(req.query.role);
    if (['accepted', 'partial', 'failed', 'no_devices', 'error'].includes(String(req.query.status || ''))) filter.overallStatus = String(req.query.status);
    const entries = await NotificationDelivery.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.set('Cache-Control', 'no-store').json({
      deliveries: entries.map(item => ({
        id: String(item._id), notificationId: String(item.notificationId), role: item.recipientRole,
        recipientId: String(item.recipientId), type: item.type, overallStatus: item.overallStatus,
        channels: item.channels, createdAt: item.createdAt, lastAttemptAt: item.lastAttemptAt
      }))
    });
  } catch (error) { return next(error); }
});

router.get('/web-push-public-key',(req,res)=>{const k=getVapidKeys();if(!k)return res.status(503).json({message:'إشعارات الويب غير مهيأة على الخادم.'});return res.set('Cache-Control','no-store').json({publicKey:k.pub.toString('base64url')});});
function mountRoleRoutes(role) {
  const guard = roleAuth(role);

  router.post('/' + role + '/web-subscription',guard,async(req,res,next)=>{try{if(role==='fanni'&&req.user?.role!=='fanni')return res.status(403).json({message:'تسجيل إشعارات الفنيين يتطلب حساب فني.'});if(role==='admin'&&req.user?.role!=='admin'&&!req.user?.adminRole)return res.status(403).json({message:'تسجيل إشعارات الإدارة يتطلب حسابًا إداريًا.'});const s=req.body?.subscription,endpoint=typeof s?.endpoint==='string'?s.endpoint.trim():'',p256dh=s?.keys?.p256dh,authSecret=s?.keys?.auth;if(!endpoint||endpoint.length>2048||!isAllowedPushEndpoint(endpoint)||typeof p256dh!=='string'||p256dh.length>200||typeof authSecret!=='string'||authSecret.length>100)return res.status(400).json({message:'بيانات اشتراك إشعارات المتصفح غير صالحة.'});await WebPushSubscription.findOneAndUpdate({endpoint},{$set:{endpoint,keys:{p256dh,auth:authSecret},expirationTime:Number.isFinite(s.expirationTime)?s.expirationTime:null},$setOnInsert:{recipientRole:role,recipientId:owner(req,role)},$addToSet:{recipients:{recipientRole:role,recipientId:owner(req,role)}}},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});return res.json({message:'تم تفعيل إشعارات المتصفح لهذا الحساب.'});}catch(e){return next(e);}});
  router.delete('/'+role+'/web-subscription',guard,async(req,res,next)=>{try{const endpoint=typeof req.body?.endpoint==='string'?req.body.endpoint.trim():'';if(!endpoint)return res.status(400).json({message:'عنوان اشتراك المتصفح مطلوب.'});const recipientId=owner(req,role);const subscription=await WebPushSubscription.findOne({endpoint});if(!subscription)return res.json({deleted:0});await WebPushSubscription.updateOne({_id:subscription._id},{$pull:{recipients:{recipientRole:role,recipientId}}});const updated=await WebPushSubscription.findById(subscription._id).lean();if(!updated)return res.json({deleted:1});if(String(updated.recipientId)===String(recipientId)&&updated.recipientRole===role){const nextRecipient=updated.recipients?.[0];if(nextRecipient)await WebPushSubscription.updateOne({_id:updated._id},{$set:{recipientRole:nextRecipient.recipientRole,recipientId:nextRecipient.recipientId}});else await WebPushSubscription.deleteOne({_id:updated._id});}return res.json({deleted:1});}catch(e){return next(e);}});
  router.post('/' + role + '/push-token', guard, async (req, res, next) => {
    try {
      if (role === 'fanni' && req.user?.role !== 'fanni') {
        return res.status(403).json({ message: 'تسجيل إشعارات الفنيين يتطلب حساب فني.' });
      }
      if (role === 'admin' && req.user?.role !== 'admin' && !req.user?.adminRole) return res.status(403).json({ message: 'تسجيل إشعارات الإدارة يتطلب حسابًا إداريًا.' });
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      const isExpoToken = /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(token);
      const requestedPlatform = String(req.body?.platform || '').trim();
      const isFcmToken = requestedPlatform === 'fcm-android' && token.length >= 40 && token.length <= 200 && !/\s/.test(token);
      if (!isExpoToken && !isFcmToken) {
        return res.status(400).json({ message: 'رمز إشعارات الجهاز غير صالح.' });
      }
      const platform = isFcmToken ? 'fcm-android' : (['android', 'ios'].includes(requestedPlatform) ? requestedPlatform : 'android');
      await PushToken.findOneAndUpdate(
        { token },
        { $set: { recipientRole: role, recipientId: owner(req, role), platform } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      return res.status(200).json({ message: 'تم تسجيل جهاز الإشعارات.' });
    } catch (error) { return next(error); }
  });

  router.delete('/' + role + '/push-token', guard, async (req, res, next) => {
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (!token) return res.status(400).json({ message: 'رمز الإشعارات مطلوب.' });
      const result = await PushToken.deleteOne({
        token, recipientRole: role, recipientId: owner(req, role)
      });
      return res.json({ message: 'تم إلغاء تسجيل جهاز الإشعارات.', deleted: result.deletedCount || 0 });
    } catch (error) { return next(error); }
  });

  router.get('/' + role, guard, async (req, res, next) => {
    try {
      const recipientId = owner(req, role);
      const [unreadNotifications, recentReadNotifications] = await Promise.all([
        // Return every unread item so login replay never silently drops older
        // requests/orders simply because the inbox's recent-history window is full.
        Notification.find({ recipientRole: role, recipientId, isActive: { $ne: false }, readAt: null }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
        Notification.find({ recipientRole: role, recipientId, isActive: { $ne: false }, readAt: { $ne: null } }).sort({ updatedAt: -1, createdAt: -1 }).limit(50).lean()
      ]);
      const notifications = [...unreadNotifications, ...recentReadNotifications]
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
      const unreadCount = unreadNotifications.length;
      return res.set('Cache-Control', 'no-store').json({
        notifications: notifications.map(item => ({
          id: String(item._id), type: item.type, title: item.title,
          message: item.message, link: normalizeNotificationLink(item.link || '', item.type),
          read: Boolean(item.readAt), createdAt: item.updatedAt || item.createdAt,
          replyEnabled: Boolean(item.replyEnabled), reply: item.reply?.message ? { message: item.reply.message, sentAt: item.reply.sentAt } : null
        })),
        unreadCount
      });
    } catch (error) { return next(error); }
  });

  router.post('/' + role + '/:id/reply', guard, async (req, res, next) => {
    try {
      if (!['client', 'fanni'].includes(role)) return res.status(403).json({ message: 'الرد متاح للعملاء والفنيين فقط.' });
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الإشعار غير صالح' });
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (message.length < 1 || message.length > 1000) return res.status(400).json({ message: 'اكتب ردًا من حرف إلى 1000 حرف.' });
      const now = new Date();
      const updated = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipientRole: role, recipientId: owner(req, role), type: 'admin_message', replyEnabled: true, isActive: { $ne: false }, 'reply.message': { $exists: false } },
        { $set: { reply: { message, senderRole: role, senderId: owner(req, role), sentAt: now } } },
        { new: true, runValidators: true }
      ).lean();
      if (!updated) {
        const owned = await Notification.findOne({ _id: req.params.id, recipientRole: role, recipientId: owner(req, role), isActive: { $ne: false } }).select('replyEnabled reply.message').lean();
        if (!owned) return res.status(404).json({ message: 'الإشعار غير موجود.' });
        if (!owned.replyEnabled) return res.status(409).json({ message: 'هذا الإشعار لا يسمح بالرد.' });
        return res.status(409).json({ message: 'تم إرسال ردك بالفعل، لا يمكن إرسال رد آخر.' });
      }
      void notifyAdmins({
        type: 'admin_message_reply',
        title: 'رد جديد على إشعار إداري',
        message: (role === 'client' ? 'رد من عميل: ' : 'رد من فني: ') + updated.title + ' — ' + message.slice(0, 180),
        link: '/admin?tab=notifications',
        relatedEntityType: 'notification',
        relatedEntityId: updated._id
      });
      return res.status(201).json({ message: 'تم إرسال ردك بنجاح.', reply: { message: updated.reply.message, sentAt: updated.reply.sentAt } });
    } catch (error) { return next(error); }
  });

  router.patch('/' + role + '/read-all', guard, async (req, res, next) => {
    try {
      const result = await Notification.updateMany(
        { recipientRole: role, recipientId: owner(req, role), isActive: { $ne: false }, readAt: null },
        { $set: { readAt: new Date() } }
      );
      return res.json({ message: 'تم تعليم الإشعارات كمقروءة', modified: result.modifiedCount || 0 });
    } catch (error) { return next(error); }
  });

  router.patch('/' + role + '/:id/read', guard, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'معرّف الإشعار غير صالح' });
      const item = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipientRole: role, recipientId: owner(req, role), isActive: { $ne: false }, readAt: null },
        { $set: { readAt: new Date() } }, { new: true }
      );
      if (!item) {
        const exists = await Notification.exists({ _id: req.params.id, recipientRole: role, recipientId: owner(req, role), isActive: { $ne: false } });
        if (!exists) return res.status(404).json({ message: 'الإشعار غير موجود' });
      }
      return res.json({ message: 'تم تعليم الإشعار كمقروء' });
    } catch (error) { return next(error); }
  });
}

mountRoleRoutes('client');
mountRoleRoutes('fanni');
mountRoleRoutes('admin');

module.exports = router;
