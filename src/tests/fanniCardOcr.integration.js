'use strict';

process.env.NODE_ENV = 'test';
process.env.CARD_LEDGER_SECRET = 'synthetic-ocr-test-secret-at-least-32-characters';

const { readFanniCard, terminateWorkerForTests, extractNationalIds } = require('../services/fanniCardOcr');

const DIGITS = {
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00001','01110']
};

function makeSyntheticPbm(value) {
  const scale = 16, marginX = 48, marginY = 48, digitWidth = 6;
  const width = marginX * 2 + value.length * digitWidth * scale;
  const height = marginY * 2 + 7 * scale;
  const rowBytes = Math.ceil(width / 8);
  const pixels = Buffer.alloc(rowBytes * height);
  for (let index = 0; index < value.length; index++) {
    const glyph = DIGITS[value[index]];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] !== '1') continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = marginX + index * digitWidth * scale + col * scale + dx;
            const y = marginY + row * scale + dy;
            pixels[y * rowBytes + (x >> 3)] |= 1 << (7 - (x & 7));
          }
        }
      }
    }
  }
  return Buffer.concat([Buffer.from('P4\n' + width + ' ' + height + '\n', 'ascii'), pixels]);
}

async function main() {
  const expected = '12345678901234'; // Synthetic test string; never a real person's ID.
  const fixture = makeSyntheticPbm(expected);
  try {
    const result = await readFanniCard(fixture);
    if (result.nationalId !== expected) {
      throw new Error('OCR did not exactly match the synthetic 14-digit fixture');
    }
    if (result.extractedName) throw new Error('Digit-only synthetic fixture unexpectedly produced a name');
    const arabicDigits = extractNationalIds('١٢٣٤٥٦٧٨٩٠١٢٣٤');
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
