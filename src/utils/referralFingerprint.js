'use strict';

const crypto = require('crypto');

function hashSignal(label, value) {
  const secret = String(process.env.JWT_SECRET || '');
  const input = String(value || '').trim();
  if (secret.length < 32 || !input) return '';
  return crypto.createHmac('sha256', secret).update(label + ':' + input).digest('hex');
}

function referralFingerprint(req) {
  const ip = String(req?.ip || '').trim();
  const userAgent = String(req?.headers?.['user-agent'] || '').trim().slice(0, 500);
  return {
    registrationIpHash: hashSignal('referral-ip', ip),
    registrationUserAgentHash: hashSignal('referral-user-agent', userAgent)
  };
}

module.exports = { referralFingerprint };
