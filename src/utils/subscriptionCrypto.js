'use strict';
const crypto = require('crypto');
function key() {
  const raw = String(process.env.SUBSCRIPTION_ENCRYPTION_KEY || '').trim();
  if (!raw) throw new Error('SUBSCRIPTION_ENCRYPTION_KEY_MISSING');
  const value = Buffer.from(raw, 'base64');
  if (value.length !== 32) throw new Error('SUBSCRIPTION_ENCRYPTION_KEY_INVALID');
  return value;
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
