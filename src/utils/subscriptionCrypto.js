'use strict';
const crypto = require('crypto');

// Reuse the server's existing JWT secret; no extra deployment secret is required.
// A separate context label prevents this key from being reused for JWT signing.
function key() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (secret.length < 32) throw new Error('JWT_SECRET_MISSING_OR_TOO_SHORT');
  return crypto.createHash('sha256').update('hamzawy-sat:subscription-credentials:v1:' + secret, 'utf8').digest();
}
function encrypt(value) {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}
function decrypt(value) {
  if (!value) return '';
  const [iv, tag, data] = String(value).split('.');
  if (!iv || !tag || !data) throw new Error('SUBSCRIPTION_CIPHERTEXT_INVALID');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
module.exports = { encrypt, decrypt };
