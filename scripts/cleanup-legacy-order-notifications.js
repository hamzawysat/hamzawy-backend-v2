'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Order = require('../src/models/Order');
const StoreOrder = require('../src/models/StoreOrder');
const Notification = require('../src/models/Notification');
const {
  buildOrderNotificationFilter,
  dismissOrderNotifications,
  buildStoreOrderNotificationFilter,
  dismissStoreOrderNotifications
} = require('../src/utils/notifications');

const TERMINAL_ORDER_STATUSES = [
  'ملغي',
  'تم الانتهاء',
  'منتهي',
  'اعتذار',
  'منتهي - اعتذار',
  'مؤرشف'
];
const TERMINAL_STORE_ORDER_STATUSES = ['مكتمل', 'مرفوض', 'ملغي'];
const FOCUS_CLIENT = /sayed|karem|mohamed|محمد|سيد|كريم/i;

async function inBatches(items, size, worker) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker));
  }
}

async function inspectOrders({ orders, buildFilter, dismiss, report, label, nameField, amountField, idField }) {
  await inBatches(orders, 40, async order => {
    const filter = buildFilter(order);
    const before = filter ? await Notification.countDocuments(filter) : 0;
    const candidates = filter
      ? await Notification.find(filter).select('_id type title message createdAt isActive readAt').sort({ createdAt: 1 }).limit(10).lean()
      : [];
    let modified = 0;

    if (process.argv.includes('--apply') && before > 0) {
      const result = await dismiss(order);
      modified = Number(result.modifiedCount ?? result.nModified ?? 0);
    }

    const remaining = filter ? await Notification.countDocuments(filter) : 0;
    const remainingRows = filter
      ? await Notification.find(filter).select('_id title message').sort({ createdAt: 1 }).limit(10).lean()
      : [];

    report.push({
      kind: label,
      [idField]: String(order.sn || order._id),
      client: order[nameField] || '',
      amount: order[amountField] ?? '',
      status: order.status,
      matchedBefore: before,
      modified,
      candidateNotifications: candidates.map(item => ({
        id: String(item._id),
        type: item.type || '',
        title: item.title || '',
        message: item.message || '',
        createdAt: item.createdAt || null,
        isActive: item.isActive !== false,
        readAt: item.readAt || null
      })),
      remainingActiveOrUnread: remaining,
      remainingNotificationIds: remainingRows.map(item => String(item._id))
    });
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDB();

  try {
    const [orders, storeOrders] = await Promise.all([
      Order.find({ status: { $in: TERMINAL_ORDER_STATUSES } })
        .select('_id sn status clientName budget createdAt')
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      StoreOrder.find({ status: { $in: TERMINAL_STORE_ORDER_STATUSES } })
        .select('_id status buyerName total createdAt')
        .sort({ createdAt: 1, _id: 1 })
        .lean()
    ]);

    const serviceReport = [];
    const storeReport = [];

    await Promise.all([
      inspectOrders({
        orders,
        buildFilter: order => buildOrderNotificationFilter(order._id, order.sn, order),
        dismiss: order => dismissOrderNotifications(order._id, order.sn, order),
        report: serviceReport,
        label: 'service_order',
        nameField: 'clientName',
        amountField: 'budget',
        idField: 'sn'
      }),
      inspectOrders({
        orders: storeOrders,
        buildFilter: order => buildStoreOrderNotificationFilter(order._id, order),
        dismiss: order => dismissStoreOrderNotifications(order._id, order),
        report: storeReport,
        label: 'store_order',
        nameField: 'buyerName',
        amountField: 'total',
        idField: 'orderId'
      })
    ]);

    const allReports = [...serviceReport, ...storeReport];
    const matchedBefore = allReports.reduce((sum, item) => sum + item.matchedBefore, 0);
    const remainingAfter = allReports.reduce((sum, item) => sum + item.remainingActiveOrUnread, 0);
    console.log(JSON.stringify({
      mode: apply ? 'APPLY' : 'DRY_RUN',
      terminalServiceOrdersScanned: orders.length,
      terminalStoreOrdersScanned: storeOrders.length,
      notificationsMatchedBefore: matchedBefore,
      notificationsRemainingAfter: remainingAfter,
      focusOrders: allReports.filter(item => FOCUS_CLIENT.test(item.client)),
      serviceOrders: serviceReport,
      storeOrders: storeReport
    }, null, 2));

    if (!apply) {
      console.log('Dry run only. Re-run with --apply to close the listed admin notifications.');
    } else if (remainingAfter !== 0) {
      process.exitCode = 2;
      console.error('Cleanup finished but some matching active/unread notifications remain.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async error => {
  console.error('Legacy order notification cleanup failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
