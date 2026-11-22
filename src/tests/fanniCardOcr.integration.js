'use strict';

process.env.NODE_ENV = 'test';
process.env.CARD_LEDGER_SECRET = 'synthetic-ocr-test-secret-at-least-32-characters';

const { readFanniCard, terminateWorkerForTests, extractNationalIds, isValidNationalId, isClearArabicName, extractArabicName } = require('../services/fanniCardOcr');

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

function makeSyntheticCardImage(value) {
  // Render a card-like PNG with a real system font, but entirely fictional content.
  return execFileSync('convert', [
    '-size', '1600x760', 'xc:white',
    '-stroke', '#111111', '-strokewidth', '5', '-fill', 'none',
    '-draw', 'rectangle 24,24 1576,736',
    '-stroke', '#777777', '-strokewidth', '2',
    '-draw', 'line 60,170 1540,170',
    '-draw', 'rectangle 1210,220 1510,500',
    '-fill', '#111111', '-stroke', 'none', '-font', 'DejaVu-Sans',
    '-pointsize', '76', '-gravity', 'south', '-annotate', '+0+115', value,
    '-pointsize', '74', '-gravity', 'north', '-annotate', '+0+210', 'سيد كارم',
    'png:-'
  ], { encoding: null, maxBuffer: 10 * 1024 * 1024 });
}

function makeDegradedCardImage(image) {
  // Simulate a dim, low-resolution phone capture with mild hand movement.
  return execFileSync('convert', [
    'png:-', '-resize', '42%', '-brightness-contrast', '-28x-12',
    '-blur', '0x0.45', '-resize', '1600x760!', 'png:-'
  ], { input: image, encoding: null, maxBuffer: 10 * 1024 * 1024 });
}

async function main() {
  const expected = '29801010100017'; // Fictional structure-valid test value; not a real person's ID.
  const fixture = makeSyntheticCardImage(expected);
  try {
    const result = await readFanniCard(fixture);
    if (result.nationalId !== expected) {
      throw new Error('OCR did not exactly match the synthetic 14-digit fixture');
    }
    if (result.extractedName !== 'سيد كارم') throw new Error('OCR did not exactly match the synthetic Arabic-name fixture');
    const arabicDigits = extractNationalIds('٢٩٨٠١٠١٠١٠٠٠١٧');
    if (extractNationalIds('1234567890123').length !== 0) {
      throw new Error('OCR accepted a value shorter than 14 digits');
    }
    if (arabicDigits.length !== 1 || arabicDigits[0] !== expected) {
      throw new Error('Arabic-Indic digit normalization did not match the synthetic expected value');
    }
    if (!isValidNationalId(expected) || isValidNationalId('29802300100017')) {
      throw new Error('Egyptian national ID structure/date validation failed');
    }
    if (isClearArabicName('ya pm l sy Sai fe Be in Pres تس Agee v')) {
      throw new Error('Garbled Latin OCR text was accepted as an Arabic name');
    }
    if (!isClearArabicName('سيد كارم')) {
      throw new Error('A clear two-part Arabic name was rejected');
    }
    if (!isClearArabicName('سيد كارم محمد عبد الله')) {
      throw new Error('A clear four-part Arabic name was rejected');
    }
    if (extractArabicName('ya pm l sy Sai fe Be in Pres تس Agee v')) {
      throw new Error('Garbled OCR text must not be stored as the card name');
    }
    const degradedFixture = makeDegradedCardImage(fixture);
    const degradedResult = await readFanniCard(degradedFixture);
    if (degradedResult.nationalId !== expected || degradedResult.extractedName !== 'سيد كارم') {
      throw new Error('Enhanced OCR did not recover the exact 14-digit ID from a dim, mildly blurred fixture');
    }
    // Optional private real-card regression: pass the attachment path and expected
    // values through local environment variables. The photo and its PII are never
    // copied into the repository, test artifacts, logs, or CI.
    if (process.env.FANNI_OCR_FIXTURE) {
      const realCard = readFileSync(process.env.FANNI_OCR_FIXTURE);
      const expectedRealId = String(process.env.FANNI_OCR_EXPECTED_ID || '').replace(/\D/g, '');
      const expectedRealName = String(process.env.FANNI_OCR_EXPECTED_NAME || '').normalize('NFC').replace(/\s+/g, ' ').trim();
      if (!/^\d{14}$/.test(expectedRealId)) {
        throw new Error('Private card test requires a 14-digit FANNI_OCR_EXPECTED_ID environment value');
      }
      const realCardResult = await readFanniCard(realCard);
      if (realCardResult.nationalId !== expectedRealId) {
        throw new Error('Private real-card OCR fixture did not exactly match its expected national ID');
      }
      if (expectedRealName && realCardResult.extractedName !== expectedRealName) {
        throw new Error('Private real-card OCR fixture did not exactly match its expected Arabic name');
      }
      if (expectedRealName && !isClearArabicName(realCardResult.extractedName)) {
        throw new Error('Private real-card OCR fixture did not produce a validated Arabic name');
      }
      console.log('Private real-card OCR regression passed (PII values withheld)');
    }
    console.log('Real Tesseract OCR integration test: clean and degraded-image exact 14-digit matches passed');
  } finally {
    await terminateWorkerForTests();
  }
}

main().catch(error => {
  console.error('Synthetic OCR integration test failed:', error?.message || 'unknown test failure');
  process.exitCode = 1;
});
