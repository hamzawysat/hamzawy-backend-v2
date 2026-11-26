'use strict';

const crypto = require('crypto');

function hashSignal(label, value) {
  const secret = String(process.env.JWT_SECRET || '');
  const input = String(value || '').trim();
  if (!input) return '';
  // لو JWT_SECRET قصير، نستخدم fallback ثابت عشان البصمة متبقاش فاضية
  // ونقول "مفيش اشتباه" بالغلط. الـ fallback ده ثابت على السيرفر كله
  // فبيفضل يميز الأجهزة عن بعض، بس مش آمن زي secret طويل.
  const key = secret.length >= 32 ? secret : 'referral-fingerprint-fallback-v1';
  return crypto.createHmac('sha256', key).update(label + ':' + input).digest('hex');
}

function getRealIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded;
  return String(req?.ip || '').trim();
}

function referralFingerprint(req) {
  const ip = getRealIp(req);
  const userAgent = String(req?.headers?.['user-agent'] || '').trim().slice(0, 500);
  // deviceId بيتبعت من التطبيق / المتصفح
  const deviceId = String(req?.body?.deviceId || req?.headers?.['x-device-id'] || '').trim().slice(0, 200);
  const registrationIpHash = hashSignal('referral-ip', ip);
  const registrationUserAgentHash = hashSignal('referral-user-agent', userAgent);
  const registrationDeviceIdHash = hashSignal('referral-device-id', deviceId);
  const fingerprintMissing = !registrationIpHash && !registrationUserAgentHash && !registrationDeviceIdHash;
  return {
    registrationIpHash,
    registrationUserAgentHash,
    registrationDeviceIdHash,
    _fingerprintMissing: fingerprintMissing,
    _deviceIdPresent: Boolean(deviceId)
  };
}

module.exports = { referralFingerprint, hashSignal, getRealIp };
