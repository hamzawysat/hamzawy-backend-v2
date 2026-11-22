'use strict';

process.env.NODE_ENV = 'test';
process.env.CARD_LEDGER_SECRET = 'synthetic-ocr-test-secret-at-least-32-characters';

const { readFanniCard, terminateWorkerForTests, extractNationalIds } = require('../services/fanniCardOcr');

const { execFileSync } = require('node:child_process');

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
    'png:-'
  ], { encoding: null, maxBuffer: 10 * 1024 * 1024 });
}

async function main() {
  const expected = '12345678901234'; // Synthetic test string; never a real person's ID.
  const fixture = makeSyntheticCardImage(expected);
  try {
    const result = await readFanniCard(fixture);
    if (result.nationalId !== expected) {
      throw new Error('OCR did not exactly match the synthetic 14-digit fixture');
    }
    if (result.extractedName) throw new Error('Digit-only synthetic fixture unexpectedly produced a name');
    const arabicDigits = extractNationalIds('١٢٣٤٥٦٧٨٩٠١٢٣٤');
    if (extractNationalIds('1234567890123').length !== 0) {
      throw new Error('OCR accepted a value shorter than 14 digits');
    }
    if (arabicDigits.length !== 1 || arabicDigits[0] !== expected) {
      throw new Error('Arabic-Indic digit normalization did not match the synthetic expected value');
    }
    console.log('Real Tesseract OCR integration test: exact synthetic 14-digit match passed');
  } finally {
    await terminateWorkerForTests();
  }
}

main().catch(error => {
  console.error('Synthetic OCR integration test failed:', error?.message || 'unknown test failure');
  process.exitCode = 1;
});
