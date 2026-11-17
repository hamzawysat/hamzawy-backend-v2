'use strict';

const crypto = require('crypto');
const Notification = require('../models/Notification');
const NotificationDelivery = require('../models/NotificationDelivery');
const PushToken = require('../models/PushToken');
const Fanni = require('../models/Fanni');
const { sendWebPushNotification } = require('./webPush');

const CURRENT_PUBLIC_ORIGIN = 'https://www.hamzawy-sat.dynv6.net';
const LEGACY_PUBLIC_HOSTS = new Set(['hamzawy-backend-v2-production.up.railway.app', 'hamzawy-sat.vercel.app']);
function adminPanelNotificationLink(tab = 'support') {
  const panelPath = String(process.env.ADMIN_PANEL_PATH || '').trim();
  const safeTab = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(String(tab || '')) ? String(tab) : 'support';
  if (!/^\/[A-Za-z0-9_-]{24,120}$/.test(panelPath)) return '/';
  return panelPath + '#' + safeTab;
}

function normalizeNotificationLink(value, type = '') {
  const raw = String(value || '').trim();
  if (['admin_password_recovery', 'admin_password_recovery_message'].includes(String(type))) {
    return '/password.html?role=admin&mode=support';
  }
  if (!raw) return '/';
  // Admin pages are intentionally hidden behind ADMIN_PANEL_PATH. Rewrite old
  // public /admin notification links to the configured private panel route.
  try {
    const parsed = new URL(raw, CURRENT_PUBLIC_ORIGIN);
    const isCurrentHost = parsed.origin === CURRENT_PUBLIC_ORIGIN || LEGACY_PUBLIC_HOSTS.has(parsed.hostname.toLowerCase());
    if (isCurrentHost && /^\/admin(?:\.html)?\/?$/i.test(parsed.pathname)) {
      return adminPanelNotificationLink(parsed.searchParams.get('tab') || 'support');
    }
  } catch (_) {}
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw.slice(0, 200);
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && (url.origin === CURRENT_PUBLIC_ORIGIN || LEGACY_PUBLIC_HOSTS.has(url.hostname.toLowerCase()))) {
      return ((url.pathname || '/') + url.search + url.hash).slice(0, 200);
    }
  } catch (_) {}
  return '/';
}

// Bound all external notification-provider requests so a slow provider cannot
// stall an API action or keep a serverless invocation open indefinitely.
function notificationFetch(url, options = {}) {
  const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(4000) : undefined;
  return globalThis.fetch(url, { ...options, ...(signal ? { signal } : {}) });
}

function channelFor(type) {
  if ([
    'order_new', 'new_order', 'admin_new_order', 'admin_store_order',
    'admin_order_offer_accepted', 'admin_order_cancelled', 'admin_order_completed',
    'admin_fanni_offer', 'admin_price_change_requested', 'admin_client_rating'
  ].includes(type)) return 'order_new';
  if ([
    'fanni_register', 'new_fanni', 'admin_new_technician', 'admin_fanni_profile_edit',
    'admin_fanni_login', 'admin_fanni_logout'
  ].includes(type)) return 'fanni_register';
  if ([
    'client_register', 'new_client', 'admin_new_client', 'admin_client_login', 'admin_client_logout'
  ].includes(type)) return 'client_register';
  if (['password_reset', 'admin_password_recovery', 'admin_password_recovery_message'].includes(type)) return 'password_reset';
  if (['support', 'new_complaint', 'admin_support_request', 'admin_new_complaint', 'admin_support_followup'].includes(type)) return 'support';
  if ([
    'wallet_charge', 'topup_request', 'admin_new_topup', 'admin_client_topup',
    'admin_service_payment_held', 'admin_subscription_request', 'admin_subscription_renewed',
    'wallet_credit', 'fanni_wallet_settlement', 'technician_settlement', 'topup_approved', 'topup_rejected',
    'wallet_debit', 'commission_deducted', 'client_wallet_topup_approved', 'client_wallet_topup_rejected',
    'client_wallet_credit', 'client_wallet_debit', 'client_wallet_settlement', 'client_service_refunded'
  ].includes(type)) return 'wallet_charge';
  return 'support';
}
function destinationFor(type) {
  const destinations = {
    admin_store_order: 'storeOrders', admin_subscription_request: 'commerceSubscriptions',
    admin_new_topup: 'topups', admin_client_topup: 'clients',
    admin_subscription_renewed: 'commerceSubscriptions', admin_client_topup: 'clientWallet',
    admin_new_topup: 'technicians', admin_new_technician: 'technicians',
    admin_fanni_profile_edit: 'technicians', admin_fanni_login: 'technicians',
    admin_fanni_logout: 'technicians', admin_new_client: 'clients',
    admin_client_login: 'clients', admin_client_logout: 'clients',
    admin_service_payment_held: 'orders', admin_order_offer_accepted: 'orders',
    wallet_credit: 'wallets', fanni_wallet_settlement: 'wallets', technician_settlement: 'wallets',
    topup_approved: 'wallets', topup_rejected: 'wallets', wallet_debit: 'wallets', commission_deducted: 'wallets',
    client_wallet_topup_approved: 'wallet', client_wallet_topup_rejected: 'wallet', client_wallet_credit: 'wallet',
    client_wallet_debit: 'wallet', client_wallet_settlement: 'wallet', client_service_refunded: 'wallet',
    admin_order_cancelled: 'orders', admin_order_completed: 'orders',
    admin_fanni_offer: 'orders', admin_price_change_requested: 'orders',
    admin_client_rating: 'orders'
  };
  if (destinations[type]) return destinations[type];
  return ({
    order_new: 'orders', fanni_register: 'technicians', client_register: 'clients',
    password_reset: 'clients', support: 'complaints', wallet_charge: 'technicians'
  })[channelFor(type)];
}
async function firebaseAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({
    iss: serviceAccount.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  });
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const assertion = unsigned + '.' + signer.sign(serviceAccount.private_key, 'base64url');
  const response = await notificationFetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error('Firebase OAuth token request failed: ' + response.status);
  return result.access_token;
}
async function sendFirebasePushNotifications(devices, payload) {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '');
  if (!raw || typeof fetch !== 'function') {
    console.error('FCM push skipped: FIREBASE_SERVICE_ACCOUNT_JSON is not configured; registered devices:', devices.length);
    return { status: 'not_configured', accepted: 0, failed: devices.length, lastError: 'FIREBASE_SERVICE_ACCOUNT_JSON_NOT_CONFIGURED' };
  }
  const account = JSON.parse(raw);
  if (!account.project_id || !account.client_email || !account.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is incomplete');
  const accessToken = await firebaseAccessToken(account);
  const endpoint = 'https://fcm.googleapis.com/v1/projects/' + encodeURIComponent(account.project_id) + '/messages:send';
  const type = String(payload.type || '');
  const data = {
    type: type.slice(0, 50),
    link: normalizeNotificationLink(payload.link),
    destination: destinationFor(type)
  };
  const results = await Promise.all(devices.map(async device => {
    const response = await notificationFetch(endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        token: device.token,
        notification: {
          title: String(payload.title || 'إشعار من صُنّاع').slice(0, 100),
          body: String(payload.message || '').slice(0, 300)
        },
        data,
        android: {
          priority: 'HIGH',
          ttl: '86400s',
          notification: { channel_id: channelFor(type), click_action: 'com.sonaa.nativeadmin.OPEN_NOTIFICATION' }
        },
        webpush: { headers: { TTL: '86400', Urgency: 'high' } },
        apns: { headers: { 'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400), 'apns-priority': '10' } }
      } })
    });
    if (response.status === 404 || response.status === 410) {
      await PushToken.deleteOne({ token: device.token }).catch(() => {});
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 240);
      console.error('FCM delivery failed:', response.status, detail);
      return false;
    }
    return true;
  }));
  const accepted = results.filter(Boolean).length;
  return { accepted, failed: results.length - accepted };
}
async function sendPushNotification({ recipientRole, recipientId, title, message, type, link = '' }) {
  const report = { expo: { status: 'no_devices', attempted: 0, accepted: 0, failed: 0, lastError: '' }, fcm: { status: 'no_devices', attempted: 0, accepted: 0, failed: 0, lastError: '' } };
  try {
    const devices = await PushToken.find({ recipientRole, recipientId }).select('token platform').lean();
    const expo = devices.filter(d => d.platform !== 'fcm-android' && /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(d.token));
    const fcm = devices.filter(d => d.platform === 'fcm-android');
    report.expo.attempted = expo.length;
    report.fcm.attempted = fcm.length;

    if (expo.length && typeof fetch === 'function') {
      const messages = expo.map(d => ({
        to: d.token,
        title: String(title || 'إشعار من صُنّاع').slice(0, 100),
        body: String(message || '').slice(0, 300),
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        ttl: 86400,
        data: { type: String(type || 'general').slice(0, 50), link: normalizeNotificationLink(link), destination: destinationFor(String(type || '')) }
      }));
      for (let start = 0; start < messages.length; start += 100) {
        const batch = messages.slice(start, start + 100);
        const response = await notificationFetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(batch)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          report.expo.failed += batch.length;
          console.error('Expo push request failed:', response.status, JSON.stringify(result).slice(0, 240));
          continue;
        }
        const tickets = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
        for (let i = 0; i < batch.length; i++) {
          const ticket = tickets[i];
          if (ticket?.status === 'ok') report.expo.accepted += 1;
          else {
            report.expo.failed += 1;
            const ticketError = ticket?.details?.error || ticket?.message || ticket?.status || 'missing ticket';
            report.expo.lastError = String(ticketError).slice(0, 240);
            console.error('Expo push ticket rejected:', ticketError);
            if (ticket?.details?.error === 'DeviceNotRegistered') {
              const token = batch[i]?.to;
              if (token) await PushToken.deleteOne({ token }).catch(() => {});
            }
          }
        }
      }
    } else if (expo.length) {
      report.expo.failed = expo.length;
      console.error('Expo push skipped: fetch is unavailable.');
    }

    if (fcm.length) {
      try {
        const result = await sendFirebasePushNotifications(fcm, { title, message, type, link });
        if (result && Number.isFinite(result.accepted)) {
          report.fcm.accepted = result.accepted;
          report.fcm.failed = Math.max(0, fcm.length - result.accepted);
          report.fcm.status = result.status || (report.fcm.failed === 0 ? 'accepted' : report.fcm.accepted > 0 ? 'partial' : 'failed');
          report.fcm.lastError = String(result.lastError || '').slice(0, 240);
        } else {
          report.fcm.failed = fcm.length;
        }
      } catch (error) {
        report.fcm.failed = fcm.length;
        console.error('FCM delivery unavailable:', error.message);
      }
    }

    for (const channel of ['expo', 'fcm']) {
      const item = report[channel];
      if (!item.status || item.status === 'no_devices') item.status = item.attempted === 0 ? 'no_devices' : item.failed === 0 ? 'accepted' : item.accepted > 0 ? 'partial' : 'failed';
    }
    if (devices.length) console.info('Native push delivery summary:', JSON.stringify({ role: recipientRole, ...report }));
    return report;
  } catch (error) {
    console.error('Push notification delivery failed:', error.message);
    report.expo.failed += report.expo.attempted - report.expo.accepted;
    report.fcm.failed += report.fcm.attempted - report.fcm.accepted;
    return report;
  }
}
async function createNotification({ recipientRole, recipientId, type, title, message, link = '', dedupeKey = null }) {
  if (!recipientId || !['client', 'fanni', 'admin'].includes(recipientRole)) return null;
  try {
    const payload = { recipientRole, recipientId, type, title, message, link: normalizeNotificationLink(link, type) };
    let notification, isNew = true;
    if (dedupeKey) {
      const result = await Notification.findOneAndUpdate(
        { dedupeKey }, { $setOnInsert: { ...payload, dedupeKey } },
        { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true }
      );
      notification = result?.value || result;
      isNew = !result?.lastErrorObject?.updatedExisting;
    } else notification = await Notification.create(payload);
    // The database notification is the source of truth. External push providers
    // are best-effort and must never hold the user's primary action indefinitely.
    if (isNew) {
      const deliveryLog = await NotificationDelivery.findOneAndUpdate(
        { notificationId: notification._id },
        { $setOnInsert: {
          notificationId: notification._id, recipientRole, recipientId, type,
          channels: { expo: {}, fcm: {}, webPush: {} }, overallStatus: 'no_devices'
        } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).catch(error => { console.error('Notification delivery audit create failed:', error.message); return null; });
      const attemptedAt = new Date();
      const delivery = await Promise.allSettled([
        sendPushNotification({ recipientRole, recipientId, title, message, type, link: payload.link }),
        sendWebPushNotification({ recipientRole, recipientId, title, message, type, link: payload.link })
      ]);
      const native = delivery[0].status === 'fulfilled' ? delivery[0].value : null;
      const web = delivery[1].status === 'fulfilled' ? delivery[1].value : null;
      const channelState = (result, attempted, accepted, failed, errorText = '') => ({
        status: errorText ? 'error' : attempted === 0 ? 'no_devices' : failed === 0 ? 'accepted' : accepted > 0 ? 'partial' : 'failed',
        attempted, accepted, failed, attempts: 1, lastAttemptAt: attemptedAt,
        lastError: String(errorText || '').slice(0, 240)
      });
      const expo = channelState(native?.expo, Number(native?.expo?.attempted || 0), Number(native?.expo?.accepted || 0), Number(native?.expo?.failed || 0), delivery[0].status === 'rejected' ? delivery[0].reason?.message : '');
      const fcm = channelState(native?.fcm, Number(native?.fcm?.attempted || 0), Number(native?.fcm?.accepted || 0), Number(native?.fcm?.failed || 0), delivery[0].status === 'rejected' ? delivery[0].reason?.message : '');
      const webPush = channelState(web, Number(web?.attempted || 0), Number(web?.accepted || 0), Number(web?.failed || 0), delivery[1].status === 'rejected' ? delivery[1].reason?.message : (web?.status === 'not_configured' ? 'VAPID_NOT_CONFIGURED' : ''));
      const channels = { expo, fcm, webPush };
      const totalAttempted = expo.attempted + fcm.attempted + webPush.attempted;
      const totalAccepted = expo.accepted + fcm.accepted + webPush.accepted;
      const totalFailed = expo.failed + fcm.failed + webPush.failed;
      const overallStatus = totalAttempted === 0 ? 'no_devices' : totalFailed === 0 ? 'accepted' : totalAccepted > 0 ? 'partial' : 'failed';
      if (deliveryLog) await NotificationDelivery.updateOne(
        { _id: deliveryLog._id },
        { $set: { channels, overallStatus, lastAttemptAt: attemptedAt } }
      ).catch(error => console.error('Notification delivery audit update failed:', error.message));
      delivery.forEach((result, index) => {
        if (result.status === 'rejected') console.error('Notification channel failed:', index === 0 ? 'native' : 'web', result.reason?.message || 'unknown error');
      });
    }
    return notification;
  } catch (error) { console.error('Notification create failed:', error.message); return null; }
}
async function notifyAdmins({ type, title, message, link = '', dedupeKey = null }) {
  try {
    const admins = await Fanni.find({
      $or: [
        { role: 'admin' },
        { adminRole: { $in: ['مشرف', 'مشرف أول', 'مدير', 'قراءة فقط'] } }
      ]
    }).select('_id').lean();

    if (!admins.length) {
      console.error('Admin notification has no eligible recipients:', type);
      return { targeted: 0, created: 0, failed: 0 };
    }

    const results = await Promise.all(admins.map(async admin => {
      const notification = await createNotification({
        recipientRole: 'admin',
        recipientId: admin._id,
        type,
        title,
        message,
        link,
        dedupeKey: dedupeKey ? dedupeKey + ':' + String(admin._id) : null
      });
      return Boolean(notification);
    }));
    const created = results.filter(Boolean).length;
    const failed = results.length - created;
    if (failed) console.error('Admin notification persistence incomplete:', JSON.stringify({ type, targeted: admins.length, created, failed }));
    else console.info('Admin notifications persisted:', JSON.stringify({ type, targeted: admins.length, created }));
    return { targeted: admins.length, created, failed };
  } catch (error) {
    console.error('Admin notification creation failed:', error.message);
    return { targeted: 0, created: 0, failed: 1 };
  }
}
module.exports = { createNotification, sendPushNotification, notifyAdmins, normalizeNotificationLink };
