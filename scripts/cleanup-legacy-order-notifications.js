'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Order = require('../src/models/Order');
const Notification = require('../src/models/Notification');
const { buildOrderNotificationFilter, dismissOrderNotifications } = require('../src/utils/notifications');

const TERMINAL_ORDER_STATUSES = [
  'ملغي',
  'تم الانتهاء',
  'منتهي',
  'منتهي - اعتذار',
  'اعتذار',
  'مؤرشف'
];

async function inBatches(items, size, worker) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker));
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDB();

  try {
    const orders = await Order.find({ status: { $in: TERMINAL_ORDER_STATUSES } })
      .select('_id sn status clientName budget')
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    let matchedBefore = 0;
    let matchedAfter = 0;
    const report = [];

    await inBatches(orders, 40, async order => {
      const filter = buildOrderNotificationFilter(order._id, order.sn, order);
      const before = filter ? await Notification.countDocuments(filter) : 0;
      matchedBefore += before;
      let modified = 0;

      if (apply && before > 0) {
        const result = await dismissOrderNotifications(order._id, order.sn, order);
        modified = Number(result.modifiedCount ?? result.nModified ?? 0);
      }

      const remaining = filter ? await Notification.countDocuments(filter) : 0;
      matchedAfter += remaining;
      report.push({
        sn: order.sn,
        client: order.clientName || '',
        budget: order.budget || '',
        status: order.status,
        matchedBefore: before,
        modified,
        remainingActiveOrUnread: remaining
      });
    });

    report.sort((a, b) => String(a.sn).localeCompare(String(b.sn)));
    console.log(JSON.stringify({
      mode: apply ? 'APPLY' : 'DRY_RUN',
      terminalOrdersScanned: orders.length,
      notificationsMatchedBefore: matchedBefore,
      notificationsRemainingAfter: matchedAfter,
      focusOrders: report.filter(item => /sayed|karem|mohamed|محمد|سيد|كريم/i.test(item.client)),
      orders: report
    }, null, 2));

    if (!apply) {
      console.log('Dry run only. Re-run with --apply to close the listed admin notifications.');
    } else if (matchedAfter !== 0) {
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
