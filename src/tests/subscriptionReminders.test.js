'use strict';

const assert = require('node:assert/strict');

const events = [];
const clientNotifications = [];
const adminNotifications = [];
let subscriptions = [];

function mockModule(request, exports) {
  const id = require.resolve(request);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const models = ['maintenance', 'air_network', 'iptv'].map(type => ({
  type,
  updateMany: async (filter, update) => {
    events.push({ kind: 'expire', type, filter, update });
    return { modifiedCount: 1 };
  }
}));

mockModule('../models/subscriptionRepository', {
  models,
  findSubscriptions: async (filter, options) => {
    events.push({ kind: 'query', filter, options });
    return subscriptions;
  },
  findSubscriptionById: async () => null
});
mockModule('../models/SubscriptionVisit', {
  find: () => ({ select() { return this; }, lean: async () => [] })
});
mockModule('../utils/notifications', {
  createNotification: async payload => {
    events.push({ kind: 'client-notification', payload });
    clientNotifications.push(payload);
  },
  notifyAdmins: async payload => {
    events.push({ kind: 'admin-notification', payload });
    adminNotifications.push(payload);
  }
});

const { runSubscriptionReminders } = require('../services/subscriptionReminders');
const {
  adminNotificationCategoryForType,
  isAdminNotificationEnabled
} = require('../utils/adminNotificationPreferences');

const now = new Date(2026, 10, 28, 12, 0, 0, 0);
function dateAtCalendarOffset(days, hour = 18) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function main() {
  subscriptions = [];
  for (const type of ['maintenance', 'air_network', 'iptv']) {
    for (const days of [7, 2, 1, 0]) {
      subscriptions.push({
        _id: type + '-' + days,
        type,
        code: 'TEST-' + type + '-' + days,
        client: 'client-' + type,
        clientName: 'عميل اختبار',
        status: days === 0 ? 'expired' : 'active',
        endsAt: dateAtCalendarOffset(days, days === 0 ? 0 : 18)
      });
    }
  }

  await runSubscriptionReminders(now);

  assert.equal(clientNotifications.length, 6,
    'each of the three subscription types should notify the client at 2 days and on expiry day');
  assert.equal(adminNotifications.length, 12,
    'each of the three subscription types should notify admins at 7, 2, 1 and 0 days');

  for (const type of ['maintenance', 'air_network', 'iptv']) {
    const rows = adminNotifications.filter(item => item.dedupeKey.includes(type + '-'));
    assert.equal(rows.length, 4, type + ' must have all four admin reminder milestones');
    assert.deepEqual(
      rows.map(item => Number(item.dedupeKey.split(':').pop())).sort((a, b) => b - a),
      [7, 2, 1, 0],
      type + ' admin reminder days must remain unchanged'
    );
    const clientRows = clientNotifications.filter(item => item.dedupeKey.includes(type + '-'));
    assert.equal(clientRows.length, 2, type + ' client must receive only 2-day and day-zero reminders');
  }

  const dayZeroClient = clientNotifications.find(item => item.dedupeKey.includes('maintenance-0'));
  const dayZeroAdmin = adminNotifications.find(item => item.dedupeKey.includes('maintenance-0'));
  assert.ok(dayZeroClient, 'midday run must still queue the client reminder for an endsAt midnight expiry');
  assert.match(dayZeroClient.title, /انتهى الاشتراك اليوم/);
  assert.ok(dayZeroAdmin, 'midday run must still queue the admin reminder for day zero');
  assert.match(dayZeroAdmin.message, /ينتهي اليوم/);

  const firstExpiryIndex = events.findIndex(item => item.kind === 'expire');
  const lastReminderIndex = Math.max(
    events.map(item => item.kind).lastIndexOf('client-notification'),
    events.map(item => item.kind).lastIndexOf('admin-notification')
  );
  assert.ok(firstExpiryIndex > lastReminderIndex,
    'due reminders must be queued before active subscriptions are marked expired');
  assert.ok(events.filter(item => item.kind === 'expire').every(item =>
    item.filter.status === 'active' && item.filter.endsAt.$lte.getTime() === now.getTime() &&
    item.update.$set.status === 'expired'
  ), 'expiry update must retain the existing active-to-expired rule');

  assert.equal(adminNotificationCategoryForType('admin_subscription_expiry'), 'subscriptions');
  assert.equal(isAdminNotificationEnabled('admin_subscription_expiry', {}), true);
  assert.equal(isAdminNotificationEnabled('admin_subscription_expiry', { subscriptions: false }), false,
    'the existing subscriptions preference must control expiry reminders');

  const previousKeys = [
    ...clientNotifications.map(item => item.dedupeKey),
    ...adminNotifications.map(item => item.dedupeKey)
  ].sort();
  clientNotifications.length = 0;
  adminNotifications.length = 0;
  events.length = 0;
  await runSubscriptionReminders(now);
  const repeatedKeys = [
    ...clientNotifications.map(item => item.dedupeKey),
    ...adminNotifications.map(item => item.dedupeKey)
  ].sort();
  assert.deepEqual(repeatedKeys, previousKeys,
    'dedupe keys must remain stable across repeated runs for the same subscription and reminder day');

  console.log('Subscription reminder tests: 3 subscription types, 4 admin milestones, 2 client milestones, day-zero ordering, preferences and stable dedupe keys passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
