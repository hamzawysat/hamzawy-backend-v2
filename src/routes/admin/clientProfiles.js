'use strict';

const express = require('express');

function createAdminClientProfilesRouter({
  auth, Client, Order, Complaint, WalletTransaction, ClientSubscription,
  ClientTopupRequest, StoreOrder, SupportCase, AdminAuditLog, validId, sendBadId
}) {
  const router = express.Router();

  router.get('/clients/:id/profile', auth('admin'), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return sendBadId(res);
      const client = await Client.findById(req.params.id)
        .select('-passwordHash -tokenVersion').lean();
      if (!client) return res.status(404).json({ message: 'حساب العميل غير موجود.' });

      const [orders, walletTransactions, subscriptions, topups, storeOrders, supportCases] = await Promise.all([
        Order.find({ $or: [{ clientAccount: client._id }, { clientPhone: client.phone }] })
          .sort({ createdAt: -1, _id: -1 }).limit(100).lean(),
        WalletTransaction.find({ client: client._id })
          .sort({ createdAt: -1, _id: -1 }).limit(100).lean(),
        ClientSubscription.find({ client: client._id })
          .sort({ createdAt: -1, _id: -1 }).limit(100).lean(),
        ClientTopupRequest.find({ client: client._id })
          .sort({ createdAt: -1, _id: -1 }).limit(100).lean(),
        StoreOrder.find({ buyerRole: 'client', buyerId: client._id })
          .sort({ createdAt: -1, _id: -1 }).limit(100).lean(),
        SupportCase.find({ ownerRole: 'client', ownerId: client._id })
          .sort({ lastMessageAt: -1, _id: -1 }).limit(100).lean()
      ]);

      const orderNumbers = orders.map(order => order.sn).filter(Boolean);
      const complaints = orderNumbers.length
        ? await Complaint.find({ sn: { $in: orderNumbers } }).sort({ createdAt: -1, _id: -1 }).limit(100).lean()
        : [];
      const auditLogs = await AdminAuditLog.find({
        category: 'clients', target: String(client._id)
      }).sort({ createdAt: -1, _id: -1 }).limit(100).lean();

      return res.set('Cache-Control', 'no-store').json({
        client,
        orders,
        walletTransactions,
        subscriptions,
        topups,
        storeOrders,
        complaints,
        supportCases,
        auditLogs,
        totals: {
          orders: orders.length,
          walletTransactions: walletTransactions.length,
          subscriptions: subscriptions.length,
          topups: topups.length,
          storeOrders: storeOrders.length,
          complaints: complaints.length,
          supportCases: supportCases.length,
          auditLogs: auditLogs.length
        }
      });
    } catch (error) { return next(error); }
  });

  return router;
}

module.exports = createAdminClientProfilesRouter;
