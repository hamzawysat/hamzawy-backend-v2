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
  const scale = 16, marginX = 80, digitWidth = 6;
  const width = 1600, height = 760;
  const rowBytes = Math.ceil(width / 8);
  const pixels = Buffer.alloc(rowBytes * height);
  const setBlack = (x, y) => {
    if (x >= 0 && x < width && y >= 0 && y < height) pixels[y * rowBytes + (x >> 3)] |= 1 << (7 - (x & 7));
  };
  const horizontal = (x1, x2, y, thickness = 3) => {
    for (let yOffset = 0; yOffset < thickness; yOffset++) for (let x = x1; x <= x2; x++) setBlack(x, y + yOffset);
  };
  const vertical = (x, y1, y2, thickness = 3) => {
    for (let xOffset = 0; xOffset < thickness; xOffset++) for (let y = y1; y <= y2; y++) setBlack(x + xOffset, y);
  };
  // Plain synthetic card geometry; no real names, photographs, or card data.
  horizontal(24, width - 24, 24); horizontal(24, width - 24, height - 28);
  vertical(24, 24, height - 28); vertical(width - 28, 24, height - 28);
  horizontal(60, width - 60, 170, 2);
  horizontal(60, 1120, 480, 2);
  const portraitLeft = 1210, portraitTop = 220, portraitRight = 1510, portraitBottom = 500;
  horizontal(portraitLeft, portraitRight, portraitTop); horizontal(portraitLeft, portraitRight, portraitBottom);
  vertical(portraitLeft, portraitTop, portraitBottom); vertical(portraitRight, portraitTop, portraitBottom);
  const digitTop = 560;
  for (let index = 0; index < value.length; index++) {
    const glyph = DIGITS[value[index]];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] !== '1') continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = marginX + index * digitWidth * scale + col * scale + dx;
            const y = digitTop + row * scale + dy;
            setBlack(x, y);
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
