'use strict';

const fs = require('node:fs');
const path = require('node:path');
const route = fs.readFileSync(path.join(__dirname, '../routes/fanni.js'), 'utf8');
const ledger = fs.readFileSync(path.join(__dirname, '../models/FanniCardLedger.js'), 'utf8');
const ocr = fs.readFileSync(path.join(__dirname, '../services/fanniCardOcr.js'), 'utf8');

if (/encryptNationalId|nationalIdEncrypted\s*:/.test(route)) {
  throw new Error('New technician registrations must not write reversible national ID data');
}
if (!/cardData\.nationalId\s*=\s*''/.test(route)) {
  throw new Error('The OCR national ID must be discarded immediately after keyed hashing');
}
if (!/console\.error\('Technician card OCR unavailable:',\s*String\(ocrError\?\.code/.test(route)) {
  throw new Error('OCR error logs must contain only a fixed error code');
}
if (!/nationalIdEncrypted:\s*\{\s*type:\s*String,\s*required:\s*false,\s*select:\s*false\s*\}/.test(ledger)) {
  throw new Error('Legacy encrypted ID field must not be required for new ledger records');
}
if (!/if \(!isValidNationalId\(cardData\?\.nationalId\)\)/.test(route)) {
  throw new Error('Registration must stop before hashing or saving a missing/invalid national ID');
}
if (!/nationalIdManual: Joi\.string\(\)/.test(route) || !/manualNationalId/.test(route)) {
  throw new Error('Registration must provide a validated manual national ID fallback');
}
if (!/isClearArabicName\(cardData\.extractedName\) \? cardData\.extractedName : ''/.test(route)) {
  throw new Error('Unreadable OCR names must be discarded rather than stored in the card ledger');
}
if (!/if \(!isValidNationalId\(nationalId\)\)/.test(ocr)) {
  throw new Error('The card hash helper must reject empty or invalid national IDs');
}
if (!/createHmac\('sha256'/.test(ocr)) {
  throw new Error('Duplicate prevention must retain only a keyed one-way fingerprint');
}
console.log('Technician registration privacy checks: passed');
