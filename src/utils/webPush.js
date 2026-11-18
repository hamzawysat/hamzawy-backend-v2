'use strict';

const crypto = require('node:crypto');
const Sub = require('../models/WebPushSubscription');

const enc = value => Buffer.from(value).toString('base64url');
const dec = value => Buffer.from(String(value || ''), 'base64url');
// Keep queued pushes available through temporary device/network downtime.
const PUSH_TTL_SECONDS = 86400;
const CURRENT_PUBLIC_ORIGIN = 'https://www.hamzawy-sat.dynv6.net';
const LEGACY_PUBLIC_HOSTS = new Set(['hamzawy-backend-v2-production.up.railway.app', 'hamzawy-sat.vercel.app']);

function isAllowedPushEndpoint(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname.toLowerCase();
    return host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
      || host === 'web.push.apple.com' || host.endsWith('.push.apple.com')
      || host === 'notify.windows.com' || host.endsWith('.notify.windows.com');
  } catch (_) { return false; }
}

function normalizeNotificationPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '/';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw.slice(0, 200);
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && (url.origin === CURRENT_PUBLIC_ORIGIN || LEGACY_PUBLIC_HOSTS.has(url.hostname.toLowerCase()))) {
      return ((url.pathname || '/') + url.search + url.hash).slice(0, 200);
    }
  } catch (_) {}
  return '/';
}

function extract(salt, ikm) { return crypto.createHmac('sha256', salt).update(ikm).digest(); }
function expand(prk, info, length) {
  let previous = Buffer.alloc(0), output = Buffer.alloc(0), counter = 1;
  while (output.length < length) {
    previous = crypto.createHmac('sha256', prk)
      .update(Buffer.concat([previous, Buffer.from(info), Buffer.from([counter++])])).digest();
    output = Buffer.concat([output, previous]);
  }
  return output.subarray(0, length);
}

function getVapidKeys() {
  const pub = dec(process.env.VAPID_PUBLIC_KEY), priv = dec(process.env.VAPID_PRIVATE_KEY);
  if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32) return null;
  try {
    const privateKey = crypto.createPrivateKey({
      key: { kty: 'EC', crv: 'P-256', x: enc(pub.subarray(1, 33)), y: enc(pub.subarray(33)), d: enc(priv) },
      format: 'jwk'
    });
    const derived = crypto.createPublicKey(privateKey).export({ format: 'jwk' });
    if (derived.x !== enc(pub.subarray(1, 33)) || derived.y !== enc(pub.subarray(33))) return null;
    return { pub, priv };
  } catch (_) { return null; }
}

function jwt(endpoint, keys) {
  const url = new URL(endpoint);
  const key = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', x: enc(keys.pub.subarray(1, 33)), y: enc(keys.pub.subarray(33)), d: enc(keys.priv) },
    format: 'jwk'
  });
  const header = enc(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = enc(Buffer.from(JSON.stringify({
    aud: url.origin, exp: Math.floor(Date.now() / 1000) + 43200,
    sub: process.env.VAPID_SUBJECT || 'mailto:admin@sonaa.app'
  })));
  const data = header + '.' + claims;
  return data + '.' + enc(crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' }));
}

function encrypt(subscription, payload) {
  const ua = dec(subscription.keys.p256dh), auth = dec(subscription.keys.auth);
  if (ua.length !== 65 || ua[0] !== 4 || auth.length < 16 || auth.length > 32) throw new Error('Invalid Web Push keys');
  const ephemeral = crypto.createECDH('prime256v1');
  ephemeral.generateKeys();
  const serverPublic = ephemeral.getPublicKey();
  const shared = ephemeral.computeSecret(ua);
  const ikm = expand(extract(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua, serverPublic]), 32);
  const salt = crypto.randomBytes(16), prk = extract(salt, ikm);
  const cek = expand(prk, 'Content-Encoding: aes128gcm\0', 16);
  const nonce = expand(prk, 'Content-Encoding: nonce\0', 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([Buffer.from(JSON.stringify(payload)), Buffer.from([2])])),
    cipher.final(), cipher.getAuthTag()
  ]);
  const header = Buffer.alloc(21);
  salt.copy(header); header.writeUInt32BE(4096, 16); header[20] = serverPublic.length;
  return Buffer.concat([header, serverPublic, encrypted]);
}

async function removeSubscriptionRecipient(subscription, notification) {
  const role = notification.recipientRole;
  const recipientId = String(notification.recipientId || '');
  const ownerMatches = subscription.recipientRole === role &&
    String(subscription.recipientId || '') === recipientId;
  const recipients = Array.isArray(subscription.recipients) ? subscription.recipients : [];

  if (recipients.length) {
    await Sub.updateOne(
      { _id: subscription._id },
      { $pull: { recipients: { recipientRole: role, recipientId: notification.recipientId } } }
    );
    const updated = await Sub.findById(subscription._id).lean();
    if (!updated) return;
    const remaining = Array.isArray(updated.recipients) ? updated.recipients : [];
    if (!remaining.length) {
      await Sub.deleteOne({ _id: updated._id });
    } else if (ownerMatches) {
      await Sub.updateOne(
        { _id: updated._id },
        { $set: { recipientRole: remaining[0].recipientRole, recipientId: remaining[0].recipientId } }
      );
    }
    return;
  }

  if (ownerMatches) await Sub.deleteOne({ _id: subscription._id });
}

async function sendOne(subscription, notification, keys) {
  if (Number.isFinite(subscription.expirationTime) && subscription.expirationTime > 0 && subscription.expirationTime <= Date.now()) {
    await removeSubscriptionRecipient(subscription, notification).catch(() => {});
    return { status: 'expired' };
  }
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    await removeSubscriptionRecipient(subscription, notification).catch(() => {});
    return { status: 'invalid_endpoint' };
  }
  const body = encrypt(subscription, {
    title: String(notification.title || 'إشعار من حمزاوي سات').slice(0, 100),
    body: String(notification.message || '').slice(0, 300),
    data: { url: normalizeNotificationPath(notification.link), notificationId: String(notification.notificationId || '') }
  });
  const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(5000) : undefined;
  const response = await fetch(subscription.endpoint, {
    method: 'POST', redirect: 'manual',
    headers: {
      TTL: String(PUSH_TTL_SECONDS), Urgency: 'high',
      'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm',
      Authorization: 'vapid t=' + jwt(subscription.endpoint, keys) + ', k=' + enc(keys.pub)
    },
    body, ...(signal ? { signal } : {})
  });
  if (response.status === 404 || response.status === 410) {
    await removeSubscriptionRecipient(subscription, notification).catch(() => {});
    return { status: 'gone', httpStatus: response.status };
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).replace(/[\r\n]+/g, ' ').slice(0, 180);
    let provider = 'unknown';
    try { provider = new URL(subscription.endpoint).hostname; } catch (_) {}
    console.error('Web Push endpoint rejected delivery:', response.status, 'provider:', provider, 'detail:', detail || 'no detail');
    return { status: 'rejected', httpStatus: response.status, provider };
  }
  return { status: 'accepted', httpStatus: response.status };
}

async function sendWebPushNotification(notification) {
  const keys = getVapidKeys();
  if (!keys) {
    console.error('Web Push is not configured: VAPID key pair is missing, invalid, or mismatched.');
    return { status: 'not_configured', attempted: 0, accepted: 0, failed: 0 };
  }
  try {
    const subscriptions = Sub.find({
      $or: [
        { recipientRole: notification.recipientRole, recipientId: notification.recipientId },
        { recipients: { $elemMatch: { recipientRole: notification.recipientRole, recipientId: notification.recipientId } } }
      ]
    }).sort({ _id: 1 }).lean().cursor();
    // Stream subscriptions in bounded batches: a hard query limit silently skipped
    // every browser after the first 200 registered endpoints.
    let attempted = 0, accepted = 0, failed = 0;
    const results = [];
    let firstFailure = null;
    let batch = [];
    const deliverBatch = async items => {
      const batchResults = await Promise.all(items.map(async subscription => {
        try { return await sendOne(subscription, notification, keys); }
        catch (error) {
          console.error('Web Push delivery attempt failed:', error.message);
          return { status: 'error' };
        }
      }));
      attempted += batchResults.length;
      for (const result of batchResults) {
        if (result.status === 'accepted') accepted += 1;
        else {
          failed += 1;
          if (!firstFailure) firstFailure = result;
        }
        // Keep the diagnostic response bounded even when an account has many devices.
        if (results.length < 20) results.push(result);
      }
    };
    for await (const subscription of subscriptions) {
      batch.push(subscription);
      if (batch.length >= 25) {
        await deliverBatch(batch);
        batch = [];
      }
    }
    if (batch.length) await deliverBatch(batch);
    if (firstFailure && !results.some(result => result.status !== 'accepted')) results.push(firstFailure);
    console.info('Web Push delivery summary:', JSON.stringify({
      role: notification.recipientRole, attempted, accepted, failed
    }));
    return { status: 'completed', attempted, accepted, failed, results };
  } catch (error) {
    console.error('Web Push delivery failed:', error.message);
    return { status: 'error', attempted: 0, accepted: 0, failed: 1 };
  }
}

module.exports = { sendWebPushNotification, getVapidKeys, isAllowedPushEndpoint, normalizeNotificationPath };
