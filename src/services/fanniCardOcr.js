'use strict';

const crypto = require('crypto');
const { spawnSync } = require('node:child_process');
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

function isValidNationalId(value) {
  const digits = normalizeNationalId(value);
  if (!digits || !/^[23]\d{13}$/.test(digits)) return false;
  const year = (digits[0] === '2' ? 1900 : 2000) + Number(digits.slice(1, 3));
  const month = Number(digits.slice(3, 5));
  const day = Number(digits.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false;
  const governorate = digits.slice(7, 9);
  return new Set(['01','02','03','04','11','12','13','14','15','16','17','18','19','21','22','23','24','25','26','27','28','29','31','32','33','34','35','88']).has(governorate);
}

function isClearArabicName(value) {
  const name = String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name || name.length < 5 || name.length > 100) return false;
  if (!/^[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0640\u064b-\u065f\u0670\s]+$/u.test(name)) return false;
  const parts = name.split(' ').filter(Boolean);
  return parts.length >= 2 && parts.length <= 5 && parts.every(part => part.length >= 2 && /[\u0621-\u064a\u066e-\u06d3]/u.test(part));
}

function cardHash(nationalId) {
  if (!isValidNationalId(nationalId)) {
    const error = new Error('CARD_NATIONAL_ID_INVALID');
    error.code = 'CARD_NATIONAL_ID_INVALID';
    throw error;
  }
  return crypto.createHmac('sha256', getLedgerSecret()).update(normalizeNationalId(nationalId)).digest('hex');
}

function encryptNationalId(nationalId) {
  if (!isValidNationalId(nationalId)) {
    const error = new Error('CARD_NATIONAL_ID_INVALID');
    error.code = 'CARD_NATIONAL_ID_INVALID';
    throw error;
  }
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

function extractArabicName(text, confidenceLines = [], overallConfidence = null) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.normalize('NFC').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const candidates = lines.filter(isClearArabicName);
  const scored = candidates.filter(candidate => {
    if (Array.isArray(confidenceLines) && confidenceLines.length) {
      const matchingLine = confidenceLines.find(item => String(item?.text || '').normalize('NFC').replace(/\s+/g, ' ').trim() === candidate);
      return Boolean(matchingLine && Number(matchingLine.confidence) >= 50);
    }
    return overallConfidence == null || !Number.isFinite(Number(overallConfidence)) || Number(overallConfidence) >= 50;
  });
  return scored.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length || b.length - a.length)[0] || '';
}

function extractNationalIds(text) {
  const normalized = normalizeDigits(text);
  // OCR can split printed ID digits with punctuation or line spacing.
  // Accept harmless visual separators, but still require exactly 14 digits.
  const matches = normalized.match(/(?<!\d)(?:\d[\s\-–—.,،:;|\/\\]*){13}\d(?!\d)/g) || [];
  return [...new Set(matches.map(normalizeNationalId).filter(isValidNationalId))];
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
  // Egyptian national-ID digits are printed in the lower band of the front.
  // Overlapping bottom crops prevent names, portrait and hologram artwork from
  // confusing the numeric recognizer when the uploaded frame contains a card.
  const regions = [
    { left: 0, top: Math.round(height * 0.48), width, height: Math.round(height * 0.52) },
    { left: Math.round(width * 0.04), top: Math.round(height * 0.56), width: Math.round(width * 0.92), height: Math.round(height * 0.34) },
    { left: Math.round(width * 0.08), top: Math.round(height * 0.62), width: Math.round(width * 0.84), height: Math.round(height * 0.28) },
    { left: 0, top: Math.round(height * 0.34), width, height: Math.round(height * 0.66) },
    { left: Math.round(width * 0.05), top: Math.round(height * 0.10), width: Math.round(width * 0.90), height: Math.round(height * 0.82) }
  ];
  return regions.filter(region => region.width >= 120 && region.height >= 40);
}
function buildEnhancedImageVariants(imageBuffer) {
  // ImageMagick is used when available; original bytes always remain a fallback.
  // Bound output dimensions and execution time because uploaded images are untrusted.
  const variants = [imageBuffer];
  const recipes = [
    // Local contrast + restrained exposure lift for dim industrial phone photos.
    ['-auto-orient', '-resize', '2600x2600>', '-resize', '180%', '-colorspace', 'Gray', '-deskew', '40%', '-brightness-contrast', '18x30', '-clahe', '24x24+128+3', '-unsharp', '0x1.4+1.0+0.02'],
    // Normalize uneven illumination and reduce low-frequency glare/shadow.
    ['-auto-orient', '-resize', '2600x2600>', '-resize', '160%', '-colorspace', 'Gray', '-deskew', '40%', '-lat', '35x35+8%', '-contrast-stretch', '1%x1%', '-despeckle', '-adaptive-sharpen', '0x1.2'],
    // Gamma lift retains faint strokes while recovering dark print.
    ['-auto-orient', '-resize', '2600x2600>', '-resize', '180%', '-colorspace', 'Gray', '-gamma', '1.45', '-brightness-contrast', '8x28', '-unsharp', '0x1.8+0.8+0.02'],
    // Alternate local-contrast path for glare and washed-out card backgrounds.
    ['-auto-orient', '-resize', '2600x2600>', '-colorspace', 'Gray', '-clahe', '18x18+160+4', '-gamma', '1.2', '-contrast', '-sharpen', '0x1.3']
  ];
  for (const recipe of recipes) {
    try {
      const result = spawnSync('convert', [
        '-limit', 'memory', '256MiB', '-limit', 'map', '512MiB',
        '-limit', 'disk', '512MiB', '-', ...recipe, 'png:-'
      ], { input: imageBuffer, encoding: null, timeout: 12000, maxBuffer: 24 * 1024 * 1024 });
      if (!result.error && result.status === 0 && result.stdout?.length > 100) variants.push(result.stdout);
    } catch (_) {
      // Keep the original image path operational on hosts without ImageMagick.
    }
  }
  return variants;
}

async function readFanniCard(imageBuffer) {
  if (!Buffer.isBuffer(imageBuffer) || !imageBuffer.length) {
    const error = new Error('CARD_IMAGE_UNREADABLE');
    error.code = 'CARD_IMAGE_UNREADABLE';
    throw error;
  }
  const worker = await getWorker();
  const candidates = new Set();
  let bestName = '';
  let bestNameConfidence = -1;
  const variants = buildEnhancedImageVariants(imageBuffer);

  // Try the untouched image and several bounded enhancement passes. Tesseract's
  // adaptive thresholding handles uneven lighting; alternate PSM modes help
  // cards photographed at angles or with busy backgrounds.
  for (let variantIndex = 0; variantIndex < variants.length; variantIndex++) {
    const variant = variants[variantIndex];
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: '',
      user_defined_dpi: '300',
      thresholding_method: '2',
      thresholding_window_size: '0.33',
      thresholding_kfactor: '0.34'
    });
    const fullResult = await worker.recognize(variant);
    const fullText = String(fullResult?.data?.text || '');
    for (const id of extractNationalIds(fullText)) candidates.add(id);
    const name = extractArabicName(fullText, fullResult?.data?.lines, fullResult?.data?.confidence);
    const nameConfidence = Number(fullResult?.data?.confidence || 0);
    if (name && nameConfidence > bestNameConfidence) {
      bestName = name;
      bestNameConfidence = nameConfidence;
    }
    if (candidates.size === 1 && bestName) break;

    // Numeric-focused OCR on the full card and overlapping regions.
    try {
      for (const pageSegMode of ['6', '11', '7', '13']) {
        await worker.setParameters({
          tessedit_pageseg_mode: pageSegMode,
          tessedit_char_whitelist: '0123456789٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          classify_bln_numeric_mode: '1',
          load_system_dawg: '0',
          load_freq_dawg: '0',
          user_defined_dpi: '300',
          thresholding_method: '2',
          thresholding_window_size: '0.33',
          thresholding_kfactor: '0.34'
        });
        const numericResult = await worker.recognize(variant);
        for (const id of extractNationalIds(String(numericResult?.data?.text || ''))) candidates.add(id);
        if (candidates.size === 1) break;
      }
      if (candidates.size !== 1 && variantIndex < 4) {
        for (const rectangle of getNumericOcrRegions(variant)) {
          await worker.setParameters({
            tessedit_pageseg_mode: '7',
            tessedit_char_whitelist: '0123456789٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
            classify_bln_numeric_mode: '1',
            load_system_dawg: '0',
            load_freq_dawg: '0',
            user_defined_dpi: '300',
            thresholding_method: '2',
            thresholding_window_size: '0.33',
            thresholding_kfactor: '0.34'
          });
          const regionResult = await worker.recognize(variant, { rectangle });
          for (const id of extractNationalIds(String(regionResult?.data?.text || ''))) candidates.add(id);
          if (candidates.size === 1) break;
        }
      }
    } finally {
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: '',
        user_defined_dpi: '300',
        thresholding_method: '2',
        thresholding_window_size: '0.33',
        thresholding_kfactor: '0.34'
      });
    }
    if (candidates.size > 1) break;
  }

  const ids = [...candidates].filter(isValidNationalId);
  if (ids.length !== 1) {
    const error = new Error('CARD_OCR_UNCLEAR');
    error.code = 'CARD_OCR_UNCLEAR';
    throw error;
  }
  return { nationalId: ids[0], extractedName: bestName };
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
  extractNationalIds,
  isValidNationalId,
  isClearArabicName,
  extractArabicName
};
