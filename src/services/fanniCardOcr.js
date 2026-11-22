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

function getImageDimensions(buffer) {
  if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buffer.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16), height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16) };
    if (kind === 'VP8 ') {
      const marker = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
      if (marker >= 0 && marker + 7 <= buffer.length) return { width: buffer.readUInt16LE(marker + 3) & 0x3fff, height: buffer.readUInt16LE(marker + 5) & 0x3fff };
    }
    if (kind === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
      return { width: 1 + b1 + ((b2 & 0x3f) << 8), height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)) };
    }
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset++; continue; }
      const marker = buffer[offset + 1]; offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
      offset += length;
    }
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 2) === 'P4') {
    let offset = 2;
    const token = () => {
      while (offset < buffer.length) {
        if (buffer[offset] === 35) { while (offset < buffer.length && buffer[offset] !== 10) offset++; }
        else if (buffer[offset] <= 32) offset++;
        else break;
      }
      const start = offset; while (offset < buffer.length && buffer[offset] > 32) offset++;
      return buffer.toString('ascii', start, offset);
    };
    const width = Number(token()), height = Number(token());
    if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0) return { width, height };
  }
  return null;
}

function getNumericOcrRegions(imageBuffer) {
  const dimensions = getImageDimensions(imageBuffer);
  if (!dimensions || !dimensions.width || !dimensions.height) return [];
  const { width, height } = dimensions;
  const split = Math.round(height * 0.32);
  return [
    { left: 0, top: 0, width, height: Math.round(height * 0.68) },
    { left: 0, top: split, width, height: height - split },
    { left: Math.round(width * 0.08), top: Math.round(height * 0.12), width: Math.round(width * 0.84), height: Math.round(height * 0.76) }
  ].filter(region => region.width >= 120 && region.height >= 40);
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

  // Retry the full image with numeric-only segmentation, then inspect
  // overlapping upper, lower and central card regions. This reduces
  // background/layout noise without inventing or repairing any digit.
  if (candidates.size !== 1) {
    try {
      for (const pageSegMode of ['6', '11', '7', '13']) {
        await worker.setParameters({
          tessedit_pageseg_mode: pageSegMode,
          tessedit_char_whitelist: '0123456789٠١٢٣٤٥٦٧٨٩',
          user_defined_dpi: '300'
        });
        const numericResult = await worker.recognize(imageBuffer);
        for (const id of extractNationalIds(String(numericResult?.data?.text || ''))) candidates.add(id);
        if (candidates.size === 1) break;
      }
      if (candidates.size !== 1) {
        for (const rectangle of getNumericOcrRegions(imageBuffer)) {
          await worker.setParameters({
            tessedit_pageseg_mode: '7',
            tessedit_char_whitelist: '0123456789٠١٢٣٤٥٦٧٨٩',
            user_defined_dpi: '300'
          });
          const regionResult = await worker.recognize(imageBuffer, { rectangle });
          for (const id of extractNationalIds(String(regionResult?.data?.text || ''))) candidates.add(id);
          if (candidates.size === 1) break;
        }
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
async function terminateWorkerForTests() {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
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
  setWorkerFactoryForTests,
  terminateWorkerForTests,
  extractNationalIds
};
