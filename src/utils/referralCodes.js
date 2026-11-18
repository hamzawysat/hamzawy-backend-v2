'use strict';

const crypto = require('crypto');

function makeReferralCode(kind, accountId) {
  if (!['client', 'fanni'].includes(kind) || !/^[a-f0-9]{24}$/i.test(String(accountId || ''))) {
    throw new Error('INVALID_REFERRAL_IDENTITY');
  }
  const secret = String(process.env.JWT_SECRET || '');
  if (secret.length < 32) throw new Error('REFERRAL_SECRET_NOT_CONFIGURED');
  const prefix = kind === 'client' ? 'C' : 'T';
  const id = String(accountId).toLowerCase();
  const signature = crypto.createHmac('sha256', secret).update(prefix + ':' + id).digest('hex').slice(0, 12);
  return prefix + '-' + id + '-' + signature;
}

function readReferralCode(value) {
  const code = String(value || '').trim().toUpperCase();
  const match = /^(C|T)-([A-F0-9]{24})-([A-F0-9]{12})$/.exec(code);
  if (!match) return null;
  const kind = match[1] === 'C' ? 'client' : 'fanni';
  const expected = makeReferralCode(kind, match[2]);
  const a = Buffer.from(expected);
  const b = Buffer.from(code);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { kind, inviterId: match[2].toLowerCase(), code };
}

module.exports = { makeReferralCode, readReferralCode };
