'use strict';
const crypto = require('crypto');

const V2_SALT = Buffer.from('hamzawy-sat:subscription-credentials:v2', 'utf8');
const V2_INFO = Buffer.from('aes-256-gcm:iptv-credentials', 'utf8');

// Derive a purpose-specific key at runtime. Never persist or expose the source secret or key.
function secretBytes() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('SUBSCRIPTION_ENCRYPTION_UNAVAILABLE');
  }
  return Buffer.from(secret, 'utf8');
}

function keyV2() {
  return Buffer.from(crypto.hkdfSync('sha256', secretBytes(), V2_SALT, V2_INFO, 32));
}

// Legacy key retained only to read ciphertext written by the previous implementation.
// All newly encrypted values use HKDF-derived v2 keys.
function keyV1() {
  const secret = secretBytes().toString('utf8').trim();
  return crypto.createHash('sha256')
    .update('hamzawy-sat:subscription-credentials:v1:' + secret, 'utf8')
    .digest();
}

function encrypt(value) {
  if (value === undefined || value === null || value === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyV2(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ['v2', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

function decrypt(value) {
  if (value === undefined || value === null || value === '') return '';
  const parts = String(value).split('.');
  let key;
  let iv;
  let tag;
  let data;
  if (parts.length === 4 && parts[0] === 'v2') {
    [, iv, tag, data] = parts;
    key = keyV2();
  } else if (parts.length === 3) {
    // Backward-compatible read path for existing records. Re-encrypt on next credential update.
    [iv, tag, data] = parts;
    key = keyV1();
  } else {
    throw new Error('SUBSCRIPTION_CIPHERTEXT_INVALID');
  }
  if (!iv || !tag || data === undefined) throw new Error('SUBSCRIPTION_CIPHERTEXT_INVALID');
  const ivBytes = Buffer.from(iv, 'base64');
  const tagBytes = Buffer.from(tag, 'base64');
  const encryptedBytes = Buffer.from(data, 'base64');
  if (ivBytes.length !== 12 || tagBytes.length !== 16) throw new Error('SUBSCRIPTION_CIPHERTEXT_INVALID');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBytes);
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([decipher.update(encryptedBytes), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
