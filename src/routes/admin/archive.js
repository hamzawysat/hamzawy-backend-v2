'use strict';

const express = require('express');
const mongoose = require('mongoose');
const WalletTransaction = require('../../models/WalletTransaction');
const ClientTopupRequest = require('../../models/ClientTopupRequest');
const ClientSubscription = require('../../models/ClientSubscription');
const StoreOrder = require('../../models/StoreOrder');
const SupportCase = require('../../models/SupportCase');
const Notification = require('../../models/Notification');
const TopupRequest = require('../../models/TopupRequest');
const Rating = require('../../models/Rating');
const Order = require('../../models/Order');
const Complaint = require('../../models/Complaint');
const SupportPassword = require('../../models/SupportPassword');
const PhoneIdentity = require('../../models/PhoneIdentity');
const Referral = require('../../models/Referral');
const ReferralClaim = require('../../models/ReferralClaim');
const FanniCardLedger = require('../../models/FanniCardLedger');
const PushToken = require('../../models/PushToken');
const WebPushSubscription = require('../../models/WebPushSubscription');
const NotificationDelivery = require('../../models/NotificationDelivery');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createAdminArchiveRouter({ auth, Joi, Client, Fanni, adminName, writeAdminAudit, validId, sendBadId }) {
  const router = express.Router();
  const archiveReasonSchema = Joi.object({
    reason: Joi.string().trim().min(2).max(1000).required()
  }).required();

  function pagination(query) {
    const page = Math.max(1, Math.min(1000000, Number.parseInt(query.page, 10) || 1));
    const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit, 10) || 25));
    return { page, limit, skip: (page - 1) * limit };
  }

  function searchFilter(search) {
    const term = String(search || '').trim().slice(0, 100);
    if (!term) return {};
    const regex = new RegExp(escapeRegex(term), 'i');
    return { $or: [{ name: regex }, { phone: regex }] };
  }

  router.get('/clients/archive', auth('admin'), async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = { archivedAt: { $ne: null }, ...searchFilter(req.query.search) };
      const [items, total] = await Promise.all([
        Client.find(filter)
          .select('name phone status archivedAt archivedBy archivedByName archiveReason createdAt')
          .sort({ archivedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        Client.countDocuments(filter)
      ]);
      return res.set('Cache-Control', 'no-store').json({
        items, page, limit, total, pages: Math.ceil(total / limit)
      });
    } catch (error) { return next(error); }
  });

  router.get('/fannis/archive', auth('admin'), async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = { role: 'fanni', archivedAt: { $ne: null }, ...searchFilter(req.query.search) };
      const [items, total] = await Promise.all([
        Fanni.find(filter)
          .select('name phone status specialties level archivedAt archivedBy archivedByName archiveReason createdAt')
          .sort({ archivedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        Fanni.countDocuments(filter)
      ]);
      return res.set('Cache-Control', 'no-store').json({
        items, page, limit, total, pages: Math.ceil(total / limit)
      });
    } catch (error) { return next(error); }
  });

  router.post('/clients/:id/archive', auth('admin'), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return sendBadId(res);
      const { error, value } = archiveReasonSchema.validate(req.body || {}, { abortEarly: false });
      if (error) return res.status(400).json({ message: 'سبب الأرشفة إجباري، من حرفين إلى 1000 حرف.' });

      const archivedAt = new Date();
      const client = await Client.findOneAndUpdate(
        { _id: req.params.id, archivedAt: null },
        { $set: {
          archivedAt,
          archivedBy: req.user?._id || null,
          archivedByName: adminName(req),
          archiveReason: value.reason
        }, $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true }
      ).select('name phone status archivedAt archivedBy archivedByName archiveReason');

      if (!client) {
        const exists = await Client.exists({ _id: req.params.id });
        if (!exists) return res.status(404).json({ message: 'حساب العميل غير موجود.' });
        return res.status(409).json({ message: 'حساب العميل مؤرشف بالفعل.' });
      }

      await writeAdminAudit(req, 'أرشفة حساب عميل', 'clients', String(client._id),
        JSON.stringify({ phone: client.phone, reason: value.reason, archivedAt: archivedAt.toISOString() }));
      return res.json({ message: 'تمت أرشفة حساب العميل مع الاحتفاظ بكل سجلاته.', client });
    } catch (error) { return next(error); }
  });

  router.post('/fannis/:id/archive', auth('admin'), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return sendBadId(res);
      const { error, value } = archiveReasonSchema.validate(req.body || {}, { abortEarly: false });
      if (error) return res.status(400).json({ message: 'سبب الأرشفة إجباري، من حرفين إلى 1000 حرف.' });

      const archivedAt = new Date();
      const fanni = await Fanni.findOneAndUpdate(
        { _id: req.params.id, role: 'fanni', archivedAt: null },
        { $set: {
          archivedAt,
          archivedBy: req.user?._id || null,
          archivedByName: adminName(req),
          archiveReason: value.reason
        }, $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true }
      ).select('name phone status archivedAt archivedBy archivedByName archiveReason');

      if (!fanni) {
        const exists = await Fanni.exists({ _id: req.params.id, role: 'fanni' });
        if (!exists) return res.status(404).json({ message: 'حساب الفني غير موجود.' });
        return res.status(409).json({ message: 'حساب الفني مؤرشف بالفعل.' });
      }

      await writeAdminAudit(req, 'أرشفة حساب فني', 'fannis', String(fanni._id),
        JSON.stringify({ phone: fanni.phone, reason: value.reason, archivedAt: archivedAt.toISOString() }));
      return res.json({ message: 'تمت أرشفة حساب الفني مع الاحتفاظ بالهوية والصور وكل السجلات المرتبطة.', fanni });
    } catch (error) { return next(error); }
  });


  async function permanentlyDeleteAccount(req, res, next, kind) {
    const isFanni = kind === 'fanni';
    const Model = isFanni ? Fanni : Client;
    const collection = isFanni ? 'fannis' : 'clients';
    const label = isFanni ? 'الفني' : 'العميل';
    const id = req.params.id;
    if (!validId(id)) return sendBadId(res);

    const mode = String(req.body?.mode || '');
    if (!['all', 'keep'].includes(mode)) {
      return res.status(400).json({ message: 'اختر طريقة الحذف: حذف شامل أو حذف مع الاحتفاظ بالسجلات.' });
    }

    const session = await mongoose.startSession();
    let accountSnapshot = null;
    let deleted = {};
    let mediaIds = [];

    try {
      await session.withTransaction(async () => {
        const accountQuery = isFanni ? { _id: id, role: 'fanni', archivedAt: { $ne: null } } : { _id: id, archivedAt: { $ne: null } };
        let accountQueryBuilder = Model.findOne(accountQuery);
        if (isFanni) accountQueryBuilder = accountQueryBuilder.select('+identityCardFrontFileId +identityCardBackFileId +profilePhotoFileId');
        const account = await accountQueryBuilder.session(session);
        if (!account) {
          const exists = await Model.exists(isFanni ? { _id: id, role: 'fanni' } : { _id: id }).session(session);
          throw Object.assign(new Error(exists ? 'الحساب لم يعد مؤرشفًا.' : 'الحساب غير موجود.'), { statusCode: exists ? 409 : 404 });
        }

        accountSnapshot = { id: String(account._id), name: account.name, phone: account.phone };

        const recipientRole = isFanni ? 'fanni' : 'client';
        // Device credentials are not historical records. Revoke them whenever the
        // account is removed, while preserving browser endpoints shared by others.
        await PushToken.deleteMany({ recipientRole, recipientId: account._id }, { session });
        const subscriptions = await WebPushSubscription.find({
          $or: [
            { recipientRole, recipientId: account._id },
            { recipients: { $elemMatch: { recipientRole, recipientId: account._id } } }
          ]
        }).session(session);
        for (const subscription of subscriptions) {
          const ownerMatches = subscription.recipientRole === recipientRole &&
            String(subscription.recipientId || '') === String(account._id);
          const recipients = Array.isArray(subscription.recipients) ? subscription.recipients : [];
          if (recipients.length) {
            const remaining = recipients.filter(item =>
              item.recipientRole !== recipientRole || String(item.recipientId || '') !== String(account._id));
            if (!remaining.length) {
              await WebPushSubscription.deleteOne({ _id: subscription._id }, { session });
            } else {
              subscription.recipients = remaining;
              if (ownerMatches) {
                subscription.recipientRole = remaining[0].recipientRole;
                subscription.recipientId = remaining[0].recipientId;
              }
              await subscription.save({ session });
            }
          } else if (ownerMatches) {
            await WebPushSubscription.deleteOne({ _id: subscription._id }, { session });
          }
        }

        if (isFanni) {
          mediaIds = [account.identityCardFrontFileId, account.identityCardBackFileId, account.profilePhotoFileId].filter(Boolean);
        }

        if (mode === 'all' && !isFanni) {
          const orders = await Order.find({
            $or: [{ clientAccount: account._id }, { clientPhone: account.phone }]
          }).select('_id sn').session(session).lean();
          const orderIds = orders.map(item => item._id);
          const orderNumbers = orders.map(item => item.sn).filter(Boolean);
          const referrals = await Referral.find({ kind: 'client', $or: [{ inviter: account._id }, { invitee: account._id }] })
            .select('_id').session(session).lean();
          const referralIds = referrals.map(item => item._id);

          // Remove only this client's wallet entries. Other users' financial ledger rows
          // may reference the same order/referral and must remain intact.
          const ownWalletTransactions = await WalletTransaction.deleteMany({ client: account._id }, { session });
          const detachedWalletTransactions = await WalletTransaction.updateMany({
            client: { $ne: account._id },
            $or: [
              { order: { $in: orderIds } },
              { referral: { $in: referralIds } }
            ]
          }, { $set: { order: null, referral: null } }, { session });

          // MongoDB transactions do not support parallel operations on one session.
          const results = [];
          results.push(await Order.deleteMany({ _id: { $in: orderIds } }, { session }));
          results.push(await Complaint.deleteMany({ $or: [{ order: { $in: orderIds } }, { sn: { $in: orderNumbers } }] }, { session }));
          results.push(await Rating.deleteMany({ $or: [{ clientPhone: account.phone }, { orderId: { $in: orderIds } }] }, { session }));
          results.push(await ClientTopupRequest.deleteMany({ client: account._id }, { session }));
          results.push(await ClientSubscription.deleteMany({ client: account._id }, { session }));
          results.push(await StoreOrder.deleteMany({ buyerRole: 'client', buyerId: account._id }, { session }));
          results.push(await SupportCase.deleteMany({ ownerRole: 'client', ownerId: account._id }, { session }));
          results.push(await Notification.deleteMany({ recipientRole: 'client', recipientId: account._id }, { session }));
          await NotificationDelivery.deleteMany({ recipientRole: 'client', recipientId: account._id }, { session });
          // Keep notifications delivered to other roles, but detach links to deleted orders.
          const detachedNotifications = await Notification.updateMany({
            recipientRole: { $ne: 'client' },
            relatedEntityType: 'order',
            relatedEntityId: { $in: orderIds }
          }, { $set: { relatedEntityId: null, relatedEntityType: '', link: '' } }, { session });
          results.push(await SupportPassword.deleteMany({ ownerRole: 'client', accountId: account._id }, { session }));
          results.push(await Referral.deleteMany({ kind: 'client', $or: [{ inviter: account._id }, { invitee: account._id }] }, { session }));
          deleted = {
            orders: results[0].deletedCount || 0,
            complaints: results[1].deletedCount || 0,
            ratings: results[2].deletedCount || 0,
            walletTransactions: ownWalletTransactions.deletedCount || 0,
            otherWalletTransactionsPreserved: detachedWalletTransactions.modifiedCount || 0,
            otherNotificationsDetached: detachedNotifications.modifiedCount || 0,
            topups: results[3].deletedCount || 0,
            subscriptions: results[4].deletedCount || 0,
            storeOrders: results[5].deletedCount || 0,
            supportCases: results[6].deletedCount || 0,
            notifications: results[7].deletedCount || 0,
            supportPasswords: results[8].deletedCount || 0,
            referrals: results[9].deletedCount || 0
          };
        } else if (mode === 'all' && isFanni) {
          const orders = await Order.find({
            $or: [
              { assignedFanni: account._id },
              { 'offers.fanni': account._id },
              { 'offers.fanniId': String(account._id) },
              { 'priceChangeRequests.fanniId': account._id }
            ]
          }).session(session);
          const orderIds = orders.map(item => item._id);
          for (const order of orders) {
            order.offers = (order.offers || []).filter(offer =>
              String(offer.fanni || '') !== String(account._id) && String(offer.fanniId || '') !== String(account._id));
            order.priceChangeRequests = (order.priceChangeRequests || []).filter(item =>
              String(item.fanniId || '') !== String(account._id));
            order.chatMessages = (order.chatMessages || []).filter(message =>
              message.senderRole !== 'fanni' || String(message.senderId || '') !== String(account._id));
            if (String(order.assignedFanni || '') === String(account._id)) {
              order.assignedFanni = null;
              order.assignedFanniName = '';
              order.acceptedOfferId = null;
              order.acceptedOfferPrice = null;
              if (['تم اختيار فني', 'بانتظار تأكيد العميل'].includes(order.status)) {
                order.status = order.offers.length ? 'تم النشر' : 'قيد المراجعة';
              }
            }
            await order.save({ session });
          }

          const referrals = await Referral.find({ kind: 'fanni', $or: [{ inviter: account._id }, { invitee: account._id }] })
            .select('_id').session(session).lean();
          const referralIds = referrals.map(item => item._id);
          const ledgers = await FanniCardLedger.find({
            $or: [{ fanniId: account._id }, { 'linkedTechnicians.fanniId': account._id }]
          }).session(session);

          // Preserve referral reward transactions owned by the other participant.
          const ownWalletTransactions = await WalletTransaction.deleteMany({ fanni: account._id }, { session });
          const detachedWalletTransactions = await WalletTransaction.updateMany({
            fanni: { $ne: account._id },
            referral: { $in: referralIds }
          }, { $set: { referral: null } }, { session });

          // Keep all operations sequential while sharing the transaction session.
          const results = [];
          results.push(await Rating.deleteMany({ $or: [{ fanniId: account._id }, { reviewerId: account._id }] }, { session }));
          results.push(await TopupRequest.deleteMany({ fanni: account._id }, { session }));
          results.push(await StoreOrder.deleteMany({ buyerRole: 'fanni', buyerId: account._id }, { session }));
          results.push(await SupportCase.deleteMany({ ownerRole: 'fanni', ownerId: account._id }, { session }));
          results.push(await Notification.deleteMany({ recipientRole: 'fanni', recipientId: account._id }, { session }));
          await NotificationDelivery.deleteMany({ recipientRole: 'fanni', recipientId: account._id }, { session });
          results.push(await SupportPassword.deleteMany({ ownerRole: 'fanni', accountId: account._id }, { session }));
          results.push(await Referral.deleteMany({ kind: 'fanni', $or: [{ inviter: account._id }, { invitee: account._id }] }, { session }));
          results.push(await ReferralClaim.deleteMany({ $or: [{ inviter: account._id }, { invitee: account._id }] }, { session }));

          for (const ledger of ledgers) {
            const remaining = (ledger.linkedTechnicians || []).filter(item =>
              String(item.fanniId || '') !== String(account._id));
            if (remaining.length) {
              ledger.linkedTechnicians = remaining;
              if (String(ledger.fanniId || '') === String(account._id)) {
                ledger.fanniId = remaining[0].fanniId || null;
                ledger.fanniName = remaining[0].name || ledger.fanniName;
              }
              await ledger.save({ session });
            } else if (String(ledger.fanniId || '') === String(account._id)) {
              await FanniCardLedger.deleteOne({ _id: ledger._id }, { session });
            } else {
              // This ledger belongs to another technician; retain its national-ID record.
              ledger.linkedTechnicians = [];
              await ledger.save({ session });
            }
          }

          deleted = {
            relatedOrdersUpdated: orderIds.length,
            ratings: results[0].deletedCount || 0,
            walletTransactions: ownWalletTransactions.deletedCount || 0,
            otherWalletTransactionsPreserved: detachedWalletTransactions.modifiedCount || 0,
            topups: results[1].deletedCount || 0,
            storeOrders: results[2].deletedCount || 0,
            supportCases: results[3].deletedCount || 0,
            notifications: results[4].deletedCount || 0,
            supportPasswords: results[5].deletedCount || 0,
            referrals: results[6].deletedCount || 0,
            referralClaims: results[7].deletedCount || 0,
            identityLedgersUpdated: ledgers.length
          };
        } else {
          await SupportPassword.deleteMany({ ownerRole: isFanni ? 'fanni' : 'client', accountId: account._id }, { session });
          // A removed technician must not leave usable temporary registration claims
          // pointing to a deleted inviter/invitee account, even when history is kept.
          if (isFanni) {
            await ReferralClaim.deleteMany({
              $or: [{ inviter: account._id }, { invitee: account._id }]
            }, { session });
          }
        }

        await PhoneIdentity.deleteOne({ ownerRole: isFanni ? 'fanni' : 'client', ownerId: account._id }, { session });
        await Model.deleteOne({ _id: account._id }, { session });
      });

      if (isFanni && mode === 'all' && mongoose.connection.db && mediaIds.length) {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
        for (const fileId of mediaIds) {
          try { await bucket.delete(fileId); }
          catch (error) { console.error('Could not remove archived technician media:', String(fileId), error.message); }
        }
      }

      await writeAdminAudit(req, 'حذف نهائي ' + label, collection, accountSnapshot.id,
        JSON.stringify({ mode, name: accountSnapshot.name, phone: accountSnapshot.phone, deleted }));
      return res.set('Cache-Control', 'no-store').json({
        message: mode === 'all'
          ? 'تم حذف الحساب وتنفيذ الحذف الشامل للسجلات المرتبطة وفق نوع الحساب.'
          : 'تم حذف الحساب فقط مع الاحتفاظ بالسجلات والمعاملات التاريخية.',
        deleted
      });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
      return next(error);
    } finally {
      await session.endSession();
    }
  }

  router.delete('/clients/:id/permanent-delete', auth('admin'), (req, res, next) =>
    permanentlyDeleteAccount(req, res, next, 'client'));
  router.delete('/fannis/:id/permanent-delete', auth('admin'), (req, res, next) =>
    permanentlyDeleteAccount(req, res, next, 'fanni'));

  router.post('/clients/:id/restore', auth('admin'), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return sendBadId(res);
      const client = await Client.findOneAndUpdate(
        { _id: req.params.id, archivedAt: { $ne: null } },
        { $set: { archivedAt: null, archivedBy: null, archivedByName: '', archiveReason: '' },
          $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true }
      ).select('name phone status archivedAt');
      if (!client) {
        const exists = await Client.exists({ _id: req.params.id });
        if (!exists) return res.status(404).json({ message: 'حساب العميل غير موجود.' });
        return res.status(409).json({ message: 'حساب العميل غير مؤرشف بالفعل.' });
      }
      await writeAdminAudit(req, 'استعادة حساب عميل من الأرشيف', 'clients', String(client._id),
        JSON.stringify({ phone: client.phone }));
      return res.json({ message: 'تمت استعادة حساب العميل بنفس المعرف.', client });
    } catch (error) { return next(error); }
  });

  router.post('/fannis/:id/restore', auth('admin'), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return sendBadId(res);
      const fanni = await Fanni.findOneAndUpdate(
        { _id: req.params.id, role: 'fanni', archivedAt: { $ne: null } },
        { $set: { archivedAt: null, archivedBy: null, archivedByName: '', archiveReason: '' },
          $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true }
      ).select('name phone status archivedAt');
      if (!fanni) {
        const exists = await Fanni.exists({ _id: req.params.id, role: 'fanni' });
        if (!exists) return res.status(404).json({ message: 'حساب الفني غير موجود.' });
        return res.status(409).json({ message: 'حساب الفني غير مؤرشف بالفعل.' });
      }
      await writeAdminAudit(req, 'استعادة حساب فني من الأرشيف', 'fannis', String(fanni._id),
        JSON.stringify({ phone: fanni.phone }));
      return res.json({ message: 'تمت استعادة حساب الفني بنفس المعرف، مع الاحتفاظ بصوره وسجل هويته.', fanni });
    } catch (error) { return next(error); }
  });

  return router;
}

module.exports = createAdminArchiveRouter;
