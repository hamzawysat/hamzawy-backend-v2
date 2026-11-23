'use strict';

const crypto = require('crypto');

function signatureFor(kind, accountId, encoding, length) {
  const prefix = kind === 'client' ? 'C' : 'T';
  return crypto.createHmac('sha256', String(process.env.JWT_SECRET || ''))
    .update(prefix + ':' + String(accountId).toLowerCase())
    .digest(encoding)
    .slice(0, length)
    .toUpperCase();
}

function makeReferralCode(kind, accountId) {
  if (!['client', 'fanni'].includes(kind) || !/^[a-f0-9]{24}$/i.test(String(accountId || ''))) {
    throw new Error('INVALID_REFERRAL_IDENTITY');
  }
  const secret = String(process.env.JWT_SECRET || '');
  if (secret.length < 32) throw new Error('REFERRAL_SECRET_NOT_CONFIGURED');
  const prefix = kind === 'client' ? 'C' : 'T';
  const id = String(accountId).toLowerCase();
  // 22 base64url characters provide a 132-bit MAC while keeping the full code
  // within the existing 50-character storage/API contract.
  const signature = signatureFor(kind, id, 'base64url', 22);
  return prefix + '-' + id + '-' + signature;
}

function readReferralCode(value) {
  const code = String(value || '').trim().toUpperCase();
  const match = /^(C|T)-([A-F0-9]{24})-([A-Z0-9_-]{12}|[A-Z0-9_-]{22})$/.exec(code);
  if (!match) return null;
  const kind = match[1] === 'C' ? 'client' : 'fanni';
  const id = match[2].toLowerCase();
  const signature = match[3];
  const expectedSignature = signature.length === 12
    ? signatureFor(kind, id, 'hex', 12)
    : signatureFor(kind, id, 'base64url', 22);
  const expected = match[1] + '-' + id + '-' + expectedSignature;
  const a = Buffer.from(expected);
  const b = Buffer.from(code);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { kind, inviterId: id, code };
}

module.exports = { makeReferralCode, readReferralCode };
