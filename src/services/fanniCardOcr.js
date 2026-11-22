'use strict';

const crypto = require('crypto');
const { createWorker } = require('tesseract.js');

let workerPromise = null;
let workerFactory = createWorker;

function getLedgerSecret() {
  const secret = String(process.env.CARD_LEDGER_SECRET || '');
  if (secret.length < 32) {
    const error = new Error('CARD_LEDGER_SECRET_MISSING');
    error.code = 'CARD_LEDGER_SECRET_MISSING';
    throw error;
  }
  return secret;
}

function normalizeDigits(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function normalizeNationalId(value) {
  const digits = normalizeDigits(value).replace(/\D/g, '');
  return digits.length === 14 ? digits : '';
}

function cardHash(nationalId) {
  return crypto.createHmac('sha256', getLedgerSecret()).update(normalizeNationalId(nationalId)).digest('hex');
}

function encryptNationalId(nationalId) {
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

async function getWorker() {
  if (!workerPromise) {
    workerPromise = workerFactory('ara+eng', 1, {
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      logger: () => {}
    }).catch(error => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function extractArabicName(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.replace(/[^\p{L}\p{M}\s]/gu, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const candidates = lines.filter(line => /[\u0600-\u06ff]/.test(line) && line.length >= 5 && line.length <= 100);
  return candidates.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length)[0] || '';
}

function extractNationalIds(text) {
  const normalized = normalizeDigits(text);
  // OCR can split printed ID digits with punctuation or line spacing.
  // Accept harmless visual separators, but still require exactly 14 digits.
  const matches = normalized.match(/(?<!\d)(?:\d[\s\-–—.,،:;|\/\\]*){13}\d(?!\d)/g) || [];
  return [...new Set(matches.map(normalizeNationalId).filter(Boolean))];
}

async function readFanniCard(imageBuffer) {
  if (!Buffer.isBuffer(imageBuffer) || !imageBuffer.length) {
    const error = new Error('CARD_IMAGE_UNREADABLE');
    error.code = 'CARD_IMAGE_UNREADABLE';
    throw error;
  }
  const worker = await getWorker();
  let text = '';
  const candidates = new Set();
  // First pass preserves Arabic text for extracting the applicant name.
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    tessedit_char_whitelist: '',
    user_defined_dpi: '300'
  });
  const fullResult = await worker.recognize(imageBuffer);
  text = String(fullResult?.data?.text || '');
  for (const id of extractNationalIds(text)) candidates.add(id);

  // Card photos vary in rotation, framing and text layout. Retry the same
  // source image with several numeric-only segmentation modes; never infer
  // or repair individual digits, and still accept exactly one 14-digit ID.
  if (candidates.size !== 1) {
    try {
      for (const pageSegMode of ['6', '11', '7', '13']) {
        await worker.setParameters({
          tessedit_pageseg_mode: pageSegMode,
          tessedit_char_whitelist: '0123456789٠١٢٣٤٥٦٧٨٩',
          user_defined_dpi: '300'
        });
        const numericResult = await worker.recognize(imageBuffer);
        const numericText = String(numericResult?.data?.text || '');
        for (const id of extractNationalIds(numericText)) candidates.add(id);
        if (candidates.size === 1) break;
      }
    } finally {
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: '',
        user_defined_dpi: '300'
      });
    }
  }
  const ids = [...candidates];
  if (ids.length !== 1) {
    const error = new Error('CARD_OCR_UNCLEAR');
    error.code = 'CARD_OCR_UNCLEAR';
    throw error;
  }
  return { nationalId: ids[0], extractedName: extractArabicName(text) };
}
function setWorkerFactoryForTests(factory) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('OCR_TEST_HOOK_DISABLED');
  }
  workerPromise = null;
  workerFactory = typeof factory === 'function' ? factory : createWorker;
}

module.exports = {
  readFanniCard,
  normalizeNationalId,
  cardHash,
  encryptNationalId,
  decryptNationalId,
  setWorkerFactoryForTests
};
