'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'frontend/js/admin-store.js'), 'utf8');
  const helper = source.match(/^function scrollStoreProductEditFormIntoView\(\) \{[\s\S]*?^\}/m);
  assert.ok(helper, 'production admin store scroll helper must exist');
  const editFunction = source.slice(source.indexOf('function editStoreProduct('), source.indexOf('async function deleteStoreProduct('));
  assert.ok(editFunction.includes('scrollStoreProductEditFormIntoView();'), 'editing a product must invoke the scroll helper');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 480 } });
    await page.setContent(`<!doctype html><html><head><style>
      *{box-sizing:border-box}body{margin:0;font:14px sans-serif}
      .scroll-area{height:480px;overflow:auto;position:relative;border:1px solid #ddd}
      .admin-topbar{height:60px;position:sticky;top:0;background:#fff;z-index:2}
      .spacer{height:760px}
      .premium-panel{min-height:220px;padding:16px;background:#f5f5f5}
    </style></head><body><div class="scroll-area"><header class="admin-topbar"></header><div class="spacer"></div><section class="premium-panel"><label for="store-name">اسم المنتج</label><input id="store-name"></section><div style="height:400px"></div></div></body></html>`);
    await page.addScriptTag({ content: helper[0] });
    await page.evaluate(() => window.scrollStoreProductEditFormIntoView());
    await page.waitForFunction(() => {
      const panel = document.querySelector('.premium-panel');
      const header = document.querySelector('.admin-topbar');
      const top = panel.getBoundingClientRect().top;
      return document.querySelector('.scroll-area').scrollTop > 100 && top >= header.getBoundingClientRect().bottom + 8 && top <= header.getBoundingClientRect().bottom + 40;
    }, null, { timeout: 5000 });
    const result = await page.evaluate(() => ({
      scrollTop: document.querySelector('.scroll-area').scrollTop,
      panelTop: Math.round(document.querySelector('.premium-panel').getBoundingClientRect().top),
      headerBottom: Math.round(document.querySelector('.admin-topbar').getBoundingClientRect().bottom)
    }));
    console.log('PASS admin product edit scrolls the nested panel below the sticky header', JSON.stringify(result));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
