'use strict';

// Egyptian national-ID validation and privacy-preserving ledger primitives.
// No OCR engine, network service, or host-specific dependency is used here.
const crypto = require('crypto');
function normalizeDigits(value) {
  return String(value || '').replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}
function normalizeNationalId(value) {
  const digits = normalizeDigits(value).replace(/\D/g, '');
  return digits.length === 14 ? digits : '';
}
function isValidNationalId(value) {
  const digits = normalizeNationalId(value);
  if (!digits || !/^[23]\d{13}$/.test(digits)) return false;
  const year = (digits[0] === '2' ? 1900 : 2000) + Number(digits.slice(1, 3));
  const month = Number(digits.slice(3, 5));
  const day = Number(digits.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  return new Set(['01','02','03','04','11','12','13','14','15','16','17','18','19','21','22','23','24','25','26','27','28','29','31','32','33','34','35','88']).has(digits.slice(7, 9));
}
function getLedgerSecret() {
  const secret = String(process.env.CARD_LEDGER_SECRET || '');
  if (secret.length < 32) { const error = new Error('CARD_LEDGER_SECRET_MISSING'); error.code = 'CARD_LEDGER_SECRET_MISSING'; throw error; }
  return secret;
}
function cardHash(nationalId) {
  if (!isValidNationalId(nationalId)) { const error = new Error('CARD_NATIONAL_ID_INVALID'); error.code = 'CARD_NATIONAL_ID_INVALID'; throw error; }
  return crypto.createHmac('sha256', getLedgerSecret()).update(normalizeNationalId(nationalId)).digest('hex');
}
function encryptNationalId(nationalId) {
  if (!isValidNationalId(nationalId)) { const error = new Error('CARD_NATIONAL_ID_INVALID'); error.code = 'CARD_NATIONAL_ID_INVALID'; throw error; }
  const key = crypto.createHash('sha256').update(getLedgerSecret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(normalizeNationalId(nationalId), 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}
function decryptNationalId(value) {
  const [ivHex, tagHex, encryptedHex] = String(value || '').split(':');
  if (!ivHex || !tagHex || !encryptedHex) return '';
  const key = crypto.createHash('sha256').update(getLedgerSecret()).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
}
module.exports = { normalizeDigits, normalizeNationalId, isValidNationalId, cardHash, encryptNationalId, decryptNationalId };
