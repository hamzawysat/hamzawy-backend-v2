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
if (!/createHmac\('sha256'/.test(ocr)) {
  throw new Error('Duplicate prevention must retain only a keyed one-way fingerprint');
}
console.log('Technician registration privacy checks: passed');
