'use strict';

const { chromium } = require('playwright');

const fs = require('fs');
const path = require('path');

function verifyAdminDashboardSource() {
  const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const shell = read('frontend/js/admin-shell.js');
  const core = read('frontend/js/admin-core.js');
  const stats = read('frontend/js/admin/clients-render.js');
  const header = read('frontend/css/admin-header.css');
  const html = read('frontend/admin.html');
  const quickActions = (shell.match(/onclick="adminQuickAction\(/g) || []).length;
  const requiredSections = ['الطلبات والعملاء', 'الفنيون', 'المحافظ والمالية', 'المتجر والخدمات', 'خدمة العملاء', 'إدارة النظام'];
  const sectionPositions = requiredSections.map(label => core.indexOf("label:'" + label + "'"));
  if (!shell.includes('class="admin-topbar') ||
      !shell.includes('class="admin-header-search') ||
      !shell.includes("setTab('notifications')") ||
      !shell.includes('mode=account') ||
      !shell.includes('onclick="logout()"') ||
      shell.includes('قنوات حمزاوي سات الرسمية') ||
      shell.includes('visualEditorLink') ||
      !shell.includes('goBack()') ||
      !shell.includes('goAdminHome()') ||
      !shell.includes('القائمة الرئيسية') ||
      !shell.includes('رجوع داخل لوحة الإدارة')) {
    throw new Error('Admin dashboard header, navigation controls, or removed channels section regression');
  }
  if (quickActions !== 4 || !shell.includes('طلبات اليوم') ||
      !shell.includes('عملاء جدد') || !shell.includes('شكاوى جديدة') ||
      !shell.includes('فنيين بانتظار الاعتماد') ||
      shell.includes("filter(item=>item.value>0)")) {
    throw new Error('Admin dashboard KPI or quick-action regression');
  }
  const adminContent = read('frontend/js/admin/support-render.js');
  const adminActions = read('frontend/js/admin/support-actions.js');
  const adminCss = read('frontend/css/admin-layout.css');
  const publicRoute = read('src/routes/public.js');
  const platformRoute = read('src/routes/admin/platform.js');
  const fanniRender = read('frontend/js/fanni-render.js');
  const fanniDashboard = read('frontend/js/fanni-dashboard.js');
  if (!shell.includes("setTab('orders');state.filterOrder='__new';applyOrderFilter()") ||
      !shell.includes("setTab('pending')") ||
      !shell.includes("if(action==='advertisement'){setTab('content')") ||
      shell.includes("window.open('/client.html'") || shell.includes("window.open('/fanni.html'")) {
    throw new Error('Admin quick actions must open the matching internal pending lists and announcement editor');
  }
  if (!adminCss.includes('grid-template-columns:repeat(2,minmax(0,1fr))') ||
      !adminCss.includes('justify-content:center') ||
      !adminContent.includes('content-announcement-audience') ||
      !adminContent.includes('faq-audience')) {
    throw new Error('Admin buttons or content audience controls regression');
  }
  if (!adminActions.includes('announcementAudience') ||
      !adminActions.includes('audience,active:true') ||
      !platformRoute.includes("Joi.string().valid('client','fanni','both')") ||
      !publicRoute.includes("req.query.role || 'client'") ||
      !fanniRender.includes('renderFanniPublicContent') ||
      !fanniDashboard.includes("apiGet('/api/content?role=fanni')")) {
    throw new Error('Client/technician announcement and FAQ audience targeting regression');
  }
  if (sectionPositions.some(position => position < 0) ||
      sectionPositions.some((position, index) => index > 0 && position <= sectionPositions[index - 1])) {
    throw new Error('Admin dashboard section order regression');
  }
  if (!core.includes("label:'نظرة عامة'") ||
      !stats.includes('إحصائيات الطلبات الشهرية') ||
      stats.includes('stat-card')) {
    throw new Error('Admin overview/statistics merge regression');
  }
  if (!header.includes('.admin-topbar') ||
      !html.includes('admin-header.css?v=20261118-admin-actions-audience1')) {
    throw new Error('Admin dashboard header stylesheet/cache regression');
  }
}
verifyAdminDashboardSource();

const BASE = process.env.SONAA_SMOKE_BASE || 'http://127.0.0.1:4173';
const pages = [
  { path: '/index.html', name: 'home' },
  { path: '/client.html', name: 'client' },
  { path: '/fanni.html', name: 'technician' },
  { path: '/admin-smoke-panel-20261105', name: 'admin' },
  { path: '/password.html?role=client', name: 'password' },
  { path: '/support.html', name: 'support' },
  { path: '/admin-setup.html', name: 'admin-setup' }
];

function apiResponse(pathname) {
  if (pathname.endsWith('/services')) {
    return { categories: [{ label: 'اختبار', services: ['كهرباء'] }], services: ['كهرباء'] };
  }
  if (pathname.endsWith('/areas')) return { areas: ['القاهرة', 'الجيزة'] };
  if (pathname.endsWith('/content')) return { content: [] };
  if (pathname.endsWith('/wallet-settings')) return {};
  if (pathname.includes('/notifications')) return { notifications: [], unreadCount: 0 };
  if (pathname.includes('/page-visits')) return { ok: true };
  return { ok: true, data: [], requests: [], cases: [], recoveries: [] };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const overflow = [];

  try {
    for (const viewport of [
      { name: 'desktop', width: 1365, height: 900 },
      { name: 'mobile', width: 360, height: 800 }
    ]) {
      for (const target of pages) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        if (target.name === 'technician' && viewport.name === 'mobile') {
          await page.addInitScript(() => {
            const nativeSetInterval = window.setInterval.bind(window);
            window.__sonaaIntervalDelays = [];
            window.setInterval = (handler, delay, ...args) => {
              window.__sonaaIntervalDelays.push(Number(delay));
              return nativeSetInterval(handler, delay, ...args);
            };
          });
        }
        const pageErrors = [];
        const badLocalResponses = [];

        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('response', response => {
          const url = new URL(response.url());
          if (url.origin === BASE && (response.status() === 404 || response.status() >= 500)) {
            badLocalResponses.push(response.status() + ' ' + url.pathname);
          }
        });

        if (process.env.SONAA_SMOKE_REAL_API !== '1') {
          await page.route('**/api/**', async route => {
            const url = new URL(route.request().url());
            await route.fulfill({
              status: 200,
              contentType: 'application/json; charset=utf-8',
              body: JSON.stringify(apiResponse(url.pathname))
            });
          });
        }

        try {
          const response = await page.goto(BASE + target.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
          if (!response || response.status() !== 200) {
            failures.push(target.name + '/' + viewport.name + ': page did not return HTTP 200');
          }
          await page.waitForTimeout(900);

          // Dedicated visual-feedback regression checks for all three dashboards.
          if (['client', 'technician', 'admin'].includes(target.name)) {
            const cssVersion = await page.locator('link[rel="stylesheet"][href*="ui-light-surfaces.css"]').evaluateAll(items =>
              items.map(item => new URL(item.href).searchParams.get('v')));
            if (cssVersion.length !== 1 || cssVersion[0] !== '20261117-button-feedback-v3') {
              failures.push(target.name + '/' + viewport.name + ': central interaction stylesheet cache version is stale or duplicated');
            }

            const visualTargets = await page.evaluate(targetName => {
              const root = document.querySelector('#app');
              if (!root) return false;
              const button = document.createElement('button');
              button.type = 'button';
              button.textContent = 'اختبار ضغط';
              button.dataset.visualFeedbackTest = 'button';
              const tablist = document.createElement('div');
              tablist.setAttribute('role', 'tablist');
              let tab;
              if (targetName === 'client') {
                tablist.className = 'client-wallet-tabs';
                tab = document.createElement('button');
                tab.className = 'client-wallet-tab is-active';
              } else if (targetName === 'technician') {
                tablist.className = 'fanni-wallet-tabs';
                tab = document.createElement('button');
                tab.className = 'fanni-wallet-tab is-active';
              } else {
                tab = document.createElement('button');
                tab.className = 'admin-topup-owner-tab is-active';
              }
              tab.type = 'button';
              tab.setAttribute('role', 'tab');
              tab.setAttribute('aria-selected', 'true');
              tab.textContent = 'اختبار تبويب';
              tab.dataset.visualFeedbackTest = 'tab';
              tablist.append(tab);
              root.append(button, tablist);
              return true;
            }, target.name);
            if (!visualTargets) {
              failures.push(target.name + '/' + viewport.name + ': could not mount visual-feedback test controls');
            } else {
              const selectedTabStyle = await page.locator('[data-visual-feedback-test="tab"]').evaluate(element => {
                const style = getComputedStyle(element);
                return { backgroundImage: style.backgroundImage, boxShadow: style.boxShadow };
              });
              if (selectedTabStyle.backgroundImage === 'none' || selectedTabStyle.boxShadow === 'none') {
                failures.push(target.name + '/' + viewport.name + ': selected tab has no visible active-state styling');
              }

              for (const selector of ['[data-visual-feedback-test="button"]', '[data-visual-feedback-test="tab"]']) {
                const targetControl = page.locator(selector);
                await targetControl.scrollIntoViewIfNeeded();
                const bounds = await targetControl.boundingBox();
                if (!bounds) {
                  failures.push(target.name + '/' + viewport.name + ': visual-feedback control has no layout box');
                  continue;
                }
                const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                await page.mouse.move(center.x, center.y);
                // Loading/auth overlays can sit above the dashboard root in smoke mode.
                // Remove only a hit-tested blocker for this isolated visual fixture.
                await page.evaluate(({ x, y, selector }) => {
                  const control = document.querySelector(selector);
                  const hit = document.elementFromPoint(x, y);
                  if (control && hit && hit !== control && !control.contains(hit)) {
                    const knownOverlay = hit.closest('#clientLoadingOverlay,#fanniLoadingOverlay,.client-loading-overlay,.fanni-loading-overlay');
                    const hitStyle = getComputedStyle(hit);
                    const isExternalOverlay = !hit.closest('#app') && !['BODY','HTML'].includes(hit.tagName) &&
                      ['fixed','absolute'].includes(hitStyle.position) && Number(hitStyle.zIndex) > 0;
                    const blocker = knownOverlay || (isExternalOverlay ? hit : null);
                    if (blocker && blocker !== control && !control.contains(blocker)) blocker.remove();
                  }
                }, { ...center, selector });
                await page.mouse.move(center.x, center.y);
                await page.mouse.down();
                // Let the 140ms background transition reach its final pressed color.
                await page.waitForTimeout(180);
                const pressedStyle = await targetControl.evaluate(element => {
                  const style = getComputedStyle(element);
                  return {
                    backgroundColor: style.backgroundColor,
                    transform: style.transform,
                    animationName: style.animationName,
                    boxShadow: style.boxShadow
                  };
                });
                await page.mouse.up();
                const pressedRgb = pressedStyle.backgroundColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                const expectedPressedRgb = [169, 130, 46];
                const pressedColorMatches = Boolean(pressedRgb) &&
                  pressedRgb.slice(1).every((channel, index) =>
                    Math.abs(Number(channel) - expectedPressedRgb[index]) <= 4);
                if (pressedStyle.transform === 'none' ||
                    !pressedColorMatches ||
                    pressedStyle.animationName !== 'sonaa-button-press-pulse' ||
                    pressedStyle.boxShadow === 'none') {
                  failures.push(target.name + '/' + viewport.name + ': ' + selector +
                    ' missing press feedback (' + JSON.stringify(pressedStyle) + ')');
                }
              }
            }
          }

          if (target.name !== 'home' && !await page.locator('#app, #setupForm, #main, main.wrap').count()) {
            failures.push(target.name + '/' + viewport.name + ': expected page root was not rendered');
          }

          const dimensions = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            document: document.documentElement.scrollWidth
          }));
          if (dimensions.document > dimensions.viewport + 2) {
            overflow.push(target.name + '/' + viewport.name + ': ' + dimensions.document + 'px content in ' + dimensions.viewport + 'px viewport');
          }

          if (viewport.name === 'desktop') {
            if (target.name === 'client') {
              await page.locator('#accountPhone').fill('123');
              await page.locator('#accountPassword').fill('x');
              await page.locator('.account-submit').click();
              await page.getByText('رقم الموبايل غير صحيح؛ اكتب 11 رقمًا يبدأ بـ 01.').waitFor({ state: 'visible', timeout: 3000 });

              const clientHeadStyles = await page.locator('head link[rel="stylesheet"]').evaluateAll(items => items.map(item => new URL(item.href).pathname));
              const clientStyleOrder = [
                '/css/client-foundation.css',
                '/css/client-layout.css',
                '/css/theme.css',
                '/css/hamzawy-sat-brand.css',
                '/css/client-components.css'
              ].map(path => clientHeadStyles.indexOf(path));
              const clientHtmlSource = await (await page.request.get(BASE + '/frontend/client.html')).text();
              const clientActionsSource = await (await page.request.get(BASE + '/frontend/js/client-actions.js')).text();
              const clientAccountSource = await (await page.request.get(BASE + '/frontend/js/client-account.js')).text();
              const clientRenderSource = await (await page.request.get(BASE + '/frontend/js/client-render.js')).text();
              const behaviorScripts = await page.locator('script[src="/js/page-behaviors.js"]').evaluateAll(items => items.map(item => item.dataset.sonaaFeatures || item.dataset.sonaaFeature || ''));
              const clientScriptPaths = await page.locator('script[src]').evaluateAll(items => items.map(item => new URL(item.src).pathname).filter(path => path.startsWith('/js/')));
              const clientComponentsSource = await (await page.request.get(BASE + '/frontend/css/client-components.css')).text();
              const clientLayoutSource = await (await page.request.get(BASE + '/frontend/css/client-layout.css')).text();
              const sharedEditorSource = await (await page.request.get(BASE + '/frontend/js/editor.js')).text();
              const orderPollingIntervals = (clientActionsSource.match(/},\s*25000\);/g) || []).length;
              if (!sharedEditorSource.includes('function getEffectiveData(data)') ||
                  !sharedEditorSource.includes('function clearMobileOverrideProperties(data,properties)') ||
                  !sharedEditorSource.includes("clearMobileOverrideProperties(data,[property])") ||
                  (sharedEditorSource.split("clearMobileOverrideProperties(data,['translateX','translateY'])").length - 1) < 2 ||
                  !sharedEditorSource.includes('const data=getSelectedData(),effective=getEffectiveData(data)') ||
                  !sharedEditorSource.includes('originX:Number(effective.translateX)||0,originY:Number(effective.translateY)||0') ||
                  !sharedEditorSource.includes('const x=(Number(effective.translateX)||0)+dx,y=(Number(effective.translateY)||0)+dy')) {
                failures.push('client/desktop: editor changes do not consistently apply to shared desktop/mobile layout data');
              }
              if (clientStyleOrder.some(index => index < 0) ||
                  clientStyleOrder.some((index, position) => position > 0 && index <= clientStyleOrder[position - 1]) ||
                  /<style\b/i.test(clientHtmlSource) ||
                  clientHtmlSource.includes(':root{--navy:') ||
                  clientHtmlSource.includes('#app .client-section-tabs{')) {
                failures.push('client/desktop: stylesheet extraction or cascade order is incorrect');
              }
              if (/<style\b/i.test(clientAccountSource) || /<style\b/i.test(clientRenderSource) ||
                  !clientLayoutSource.includes('.account-top-nav{') ||
                  !clientComponentsSource.includes('body .support-float{position:fixed!important;left:16px!important;right:auto!important;bottom:85px!important;top:auto!important;z-index:80!important}') ||
                  !clientComponentsSource.includes('body .global-refresh-float{position:fixed!important;left:16px!important;right:auto!important;bottom:85px!important;top:auto!important;z-index:80!important}') ||
                  !clientLayoutSource.includes('.global-refresh.is-refreshing svg{animation:global-refresh-spin 1s linear infinite}')) {
                failures.push('client/desktop: dynamic CSS remains in JavaScript or extracted component rules are missing');
              }
              if (orderPollingIntervals < 2 ||
                  !/setInterval\(refreshTrackedChatSilently,\s*10000\)/.test(clientActionsSource) ||
                  clientActionsSource.includes('},3000);') ||
                  clientActionsSource.includes('},2000);')) {
                failures.push('client/desktop: customer polling does not follow the 25s/10s project cadence');
              }
              if (behaviorScripts.length !== 1 ||
                  !behaviorScripts[0].includes('client-global-refresh') ||
                  !behaviorScripts[0].includes('sticky-tabs') ||
                  new Set(clientScriptPaths).size !== clientScriptPaths.length) {
                failures.push('client/desktop: client JavaScript features are missing or a module is loaded more than once');
              }

              const editorSectionValues = {
                new: 'client:new-order',
                orders: 'client:my-orders',
                track: 'client:track',
                wallet: 'client:wallet',
                subscriptions: 'client:subscriptions',
                store: 'client:store',
                complaint: 'client:complaint'
              };
              const clientSections = Object.keys(editorSectionValues);
              const editorOptions = await page.evaluate(async () => {
                const response = await fetch('/editor.html');
                const markup = await response.text();
                const editorDocument = new DOMParser().parseFromString(markup, 'text/html');
                return [...editorDocument.querySelectorAll('#subPageSelect option')].map(option => option.value);
              });
              const editorScript = await (await page.request.get(BASE + '/frontend/js/editor.js')).text();
              for (const section of clientSections) {
                const optionValue = editorSectionValues[section];
                if (!editorOptions.includes(optionValue) || !editorScript.includes(optionValue)) {
                  failures.push('client/desktop: shared editor is missing the ' + section + ' section');
                }
                const previewResponse = await page.goto(BASE + '/client.html?preview=true&section=' + section, {
                  waitUntil: 'domcontentloaded', timeout: 15000
                });
                if (!previewResponse || previewResponse.status() !== 200) {
                  failures.push('client/desktop: preview route failed for ' + section);
                  continue;
                }
                await page.waitForFunction(expected => window.IS_EDITOR_PREVIEW === true && state.tab === expected,
                  section, { timeout: 5000 });
              }

              await page.goto(BASE + '/client.html?preview=true&section=new', { waitUntil: 'domcontentloaded' });
              await page.waitForFunction(() => state.tab === 'new', null, { timeout: 5000 });
              await page.evaluate(() => window.postMessage({ action: 'openSection', section: 'wallet' }, '*'));
              await page.waitForFunction(() => state.tab === 'wallet', null, { timeout: 5000 });
              await page.goto(BASE + '/client.html', { waitUntil: 'domcontentloaded' });
              await page.locator('#accountPhone').waitFor({ state: 'visible', timeout: 5000 });

              if (process.env.SONAA_SMOKE_REAL_API === '1') {
                await page.locator('#accountPhone').fill('01012345670');
                await page.locator('#accountPassword').fill('ClientSmokePass123');
                await page.locator('.account-submit').click();
                await page.waitForFunction(() => !!localStorage.getItem('sonaa_client_account_token'), { timeout: 10000 });
                await page.waitForFunction(() => !!state.account && !!state.accountToken, { timeout: 10000 });
                await page.locator('nav.client-section-tabs').waitFor({ state: 'visible', timeout: 10000 });
                const customerTabIds = ['home', 'new', 'orders', 'wallet', 'subscriptions', 'store', 'complaint'];
                const customerTabButtons = page.locator('nav.client-section-tabs button[onclick^="setTab("]');
                if (await customerTabButtons.count() !== customerTabIds.length) {
                  failures.push('client/desktop: expected seven customer top navigation buttons');
                }
                if (await page.locator('.client-section-tabs').count() !== 1 || await page.locator('nav.fixed.bottom-0').count() !== 0 ||
                    await page.locator('.dashboard-top-shell').evaluate(shell => getComputedStyle(shell).position !== 'sticky')) {
                  failures.push('client/desktop: customer navigation is not pinned beneath the sticky dashboard header');
                }
                if (await page.locator('.client-home-dashboard').count() !== 1 || await page.evaluate(() => state.tab) !== 'home') {
                  failures.push('client/desktop: customer dashboard did not open on the home section');
                }
                for (let tabIndex = 0; tabIndex < customerTabIds.length; tabIndex++) {
                  await customerTabButtons.nth(tabIndex).click();
                  await page.waitForFunction(expected => state.tab === expected, customerTabIds[tabIndex], { timeout: 5000 });
                }

                // Exercise the shared visual editor against the isolated MongoDB-backed API.
                const adminLogin = await page.request.post(BASE + '/api/admin/login', {
                  data: { phone: '01012345678', password: 'AdminSmokePass123' }
                });
                if (adminLogin.status() !== 200) {
                  failures.push('client/desktop: editor admin login failed with HTTP ' + adminLogin.status());
                } else {
                  const adminSession = await adminLogin.json();
                  await page.evaluate(token => localStorage.setItem('admin_token_v3', token), adminSession.token);
                  const editorResponse = await page.goto(BASE + '/editor.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
                  if (!editorResponse || editorResponse.status() !== 200) {
                    failures.push('client/desktop: visual editor route failed');
                  } else {
                    const preview = page.frameLocator('#previewFrame');
                    await preview.locator('#app .account-slogan').waitFor({ state: 'visible', timeout: 10000 });
                    await page.locator('#editModeBtn').click();
                    await preview.locator('#app .account-slogan').click();
                    await page.locator('#ctrlText').fill('اختبار حفظ واسترجاع المحرر');
                    await page.locator('#saveBtn').click();
                    await page.getByText('تم الحفظ في MongoDB', { exact: false }).waitFor({ state: 'visible', timeout: 10000 });

                    const layoutResponse = await page.request.get(BASE + '/api/admin/ui-layout/client', {
                      headers: { Authorization: 'Bearer ' + adminSession.token }
                    });
                    const persisted = await layoutResponse.json();
                    const savedText = Object.values(persisted.layout?.elements || {}).some(item => item.text === 'اختبار حفظ واسترجاع المحرر');
                    if (layoutResponse.status() !== 200 || !savedText) {
                      failures.push('client/desktop: editor save was not persisted by the MongoDB-backed API');
                    }

                    await page.locator('[data-device="mobile"]').click();
                    await page.locator('#reloadPreviewBtn').click();
                    await page.waitForFunction(() => document.querySelector('#saveStatus')?.textContent.includes('جاهز'), null, { timeout: 20000 });
                    await preview.locator('#app .account-slogan').waitFor({ state: 'visible', timeout: 10000 });
                    const mobileReloadLayout = await (await page.request.get(BASE + '/api/admin/ui-layout/client', {
                      headers: { Authorization: 'Bearer ' + adminSession.token }
                    })).json();
                    if (!Object.values(mobileReloadLayout.layout?.elements || {}).some(item => item.text === 'اختبار حفظ واسترجاع المحرر')) {
                      failures.push('client/desktop: saved editor text was not retained after mobile preview reload');
                    }
                    await page.locator('[data-device="desktop"]').click();
                    await page.locator('#reloadPreviewBtn').click();
                    await page.waitForFunction(() => document.querySelector('#saveStatus')?.textContent.includes('جاهز'), null, { timeout: 20000 });
                    await preview.locator('#app .account-slogan').waitFor({ state: 'visible', timeout: 10000 });
                    const desktopReloadLayout = await (await page.request.get(BASE + '/api/admin/ui-layout/client', {
                      headers: { Authorization: 'Bearer ' + adminSession.token }
                    })).json();
                    if (!Object.values(desktopReloadLayout.layout?.elements || {}).some(item => item.text === 'اختبار حفظ واسترجاع المحرر')) {
                      failures.push('client/desktop: saved editor text was not retained after desktop preview reload');
                    }

                    const resetLayout = await page.request.delete(BASE + '/api/admin/ui-layout/client', {
                      headers: { Authorization: 'Bearer ' + adminSession.token }
                    });
                    if (resetLayout.status() !== 200) {
                      failures.push('client/desktop: isolated editor test data could not be reset');
                    }
                  }
                }
              }
            } else if (target.name === 'technician') {
              await page.locator('#fanniLoginPhone').fill('123');
              await page.locator('#fanniLoginPassword').fill('x');
              await page.getByRole('button', { name: 'دخول إلى حسابي' }).click();
              await page.getByText('رقم التليفون غير صحيح').waitFor({ state: 'visible', timeout: 3000 });
              if (process.env.SONAA_SMOKE_REAL_API === '1') {
                await page.locator('#fanniLoginPhone').fill('01012345671');
                await page.locator('#fanniLoginPassword').fill('FanniSmokePass123');
                await page.getByRole('button', { name: 'دخول إلى حسابي' }).click();
                await page.waitForFunction(() => !!localStorage.getItem('fanni_token_v4'), { timeout: 10000 });
                const technicianNavigation = await page.evaluate(() => ({
                  tabs: typeof TECHNICIAN_TAB_DEFINITIONS !== 'undefined' ? TECHNICIAN_TAB_DEFINITIONS.map(tab => tab.id) : [],
                  notificationBell: !!document.querySelector('button[aria-label="الإشعارات"]'),
                  supportFloat: !!document.querySelector('a.support-float[href="support.html?role=fanni"]'),
                  topTabs: !!document.querySelector('nav.fanni-dashboard-tabs'),
                  pinnedShell: (() => { const shell = document.querySelector('.dashboard-top-shell'); return !!shell && getComputedStyle(shell).position === 'sticky'; })(),
                  topTabButtons: document.querySelectorAll('nav.fanni-dashboard-tabs button[onclick^="openTechnicianSection("]').length,
                  bottomTabs: document.querySelectorAll('nav.fixed.bottom-0 button[onclick^="openTechnicianSection("]').length,
                  refreshOnLeft: (() => { const button = document.querySelector('#global-refresh'); if (!button) return false; const rect = button.getBoundingClientRect(); return rect.left >= 0 && rect.left < window.innerWidth / 2; })()
                }));
                if (technicianNavigation.tabs.join(',') !== 'home,available,myOrders,wallet,store,profile,support') {
                  failures.push('technician/desktop: expected technician section definitions are missing');
                }
                if (!technicianNavigation.notificationBell) failures.push('technician/desktop: notification bell is missing');
                if (technicianNavigation.supportFloat) failures.push('technician/desktop: floating support shortcut still exists');
                if (!technicianNavigation.topTabs) failures.push('technician/desktop: top navigation is missing');
                if (!technicianNavigation.pinnedShell) failures.push('technician/desktop: navigation is not pinned beneath the sticky dashboard header');
                if (technicianNavigation.topTabButtons !== 7) failures.push('technician/desktop: expected 7 top navigation buttons, found ' + technicianNavigation.topTabButtons);
                if (technicianNavigation.bottomTabs !== 0) failures.push('technician/desktop: bottom navigation should not be present in the browser');
                if (!technicianNavigation.refreshOnLeft) failures.push('technician/desktop: refresh control is not positioned on the left');
                const initialTab = await page.evaluate(() => state.tab);
            if (initialTab !== 'home') failures.push('technician/mobile: dashboard did not open on the home section');
                const pollingStarted = await page.evaluate(() => !!fanniChatsPollTimer && !!fanniMessagesPollTimer);
                if (!pollingStarted) failures.push('technician: chat/message polling did not start after login');
                await page.getByRole('button', { name: /الدعم الفني/ }).first().waitFor({ state: 'visible', timeout: 3000 });
                await page.evaluate(() => setTab('myOrders'));
                await page.getByRole('button', { name: /المهام المكتملة/ }).click();
                await page.getByRole('heading', { name: 'المهام المكتملة' }).waitFor({ state: 'visible', timeout: 3000 });
                await page.getByRole('button', { name: /العروض الجارية/ }).click();
                await page.getByRole('heading', { name: 'عروضي' }).waitFor({ state: 'visible', timeout: 3000 });
                await page.evaluate(() => setTab('profile'));
                await page.getByRole('button', { name: /تغيير كلمة المرور/ }).waitFor({ state: 'visible', timeout: 3000 });
                await page.locator('button[onclick="beginEditProfile()"]').click();
                await page.locator('#fanniEditPhone').fill('01012345672');
                await page.locator('button[onclick="saveProfileChanges()"]').click();
                await page.locator('button[onclick="beginEditProfile()"]').waitFor({ state: 'visible', timeout: 10000 });
                await page.locator('#toast').getByText(/تم إرسال طلب تعديل بيانات/).waitFor({ state: 'visible', timeout: 3000 });
                await page.route('**/api/areas', route => route.fulfill({
                  status: 200,
                  contentType: 'application/json; charset=utf-8',
                  body: JSON.stringify({ message: 'فشل اختبار تحميل المناطق' })
                }));
                await page.locator('#global-refresh').click();
                await page.locator('#toast').getByText(/تعذر تحديث: مناطق العمل/).waitFor({ state: 'visible', timeout: 8000 });
                await page.unroute('**/api/areas');
              }
            } else if (target.name === 'admin') {
              await page.locator('#login-btn').click();
              await page.getByText('اكتب البيانات').waitFor({ state: 'visible', timeout: 3000 });
              const storeFailureRegression = await page.evaluate(async () => {
                if (typeof window.loadStoreProducts !== 'function' || typeof state === 'undefined') return { supported: false };
                const originalTryApi = window.tryApi;
                const originalRender = window.render;
                const originalProducts = state.storeProducts;
                const originalLoading = state.storeProductsLoading;
                const originalError = state.storeProductsLoadError;
                const originalTab = state.tab;
                state.storeProducts = [{ _id: 'smoke-existing-product', name: 'منتج محفوظ للاختبار' }];
                state.storeProductsLoading = false;
                state.storeProductsLoadError = '';
                state.tab = 'store';
                window.render = () => {};
                window.tryApi = async paths => {
                  const endpoint = Array.isArray(paths) ? paths[0] : paths;
                  if (String(endpoint).includes('/products')) throw new Error('simulated temporary store refresh failure');
                  return { rotationSeconds: 5 };
                };
                try {
                  await window.loadStoreProducts();
                  return {
                    supported: true,
                    count: state.storeProducts.length,
                    productId: state.storeProducts[0]?._id,
                    loading: state.storeProductsLoading
                  };
                } finally {
                  window.tryApi = originalTryApi;
                  window.render = originalRender;
                  state.storeProducts = originalProducts;
                  state.storeProductsLoading = originalLoading;
                  state.storeProductsLoadError = originalError;
                  state.tab = originalTab;
                }
              });
              if (!storeFailureRegression.supported ||
                  storeFailureRegression.count !== 1 ||
                  storeFailureRegression.productId !== 'smoke-existing-product' ||
                  storeFailureRegression.loading !== false) {
                failures.push('admin/' + viewport.name + ': a temporary store refresh failure must preserve the existing product list and clear loading state (' + JSON.stringify(storeFailureRegression) + ')');
              }
              if (process.env.SONAA_SMOKE_REAL_API === '1') {
                await page.locator('#login-phone').fill('01012345678');
                await page.locator('#login-pass').fill('AdminSmokePass123');
                await page.locator('#login-btn').click();
                await page.waitForFunction(() => !!localStorage.getItem('admin_token_v3'), { timeout: 10000 });
                await page.waitForTimeout(1200);
              }
            }
          }

          if (viewport.name === 'mobile' && target.name === 'client') {
            const clientTabs = ['new', 'orders', 'track', 'wallet', 'subscriptions', 'store', 'complaint'];
            const loadedClientCss = await page.locator('link[rel="stylesheet"]').evaluateAll(items =>
              items.map(item => new URL(item.href).pathname));
            if (!loadedClientCss.includes('/css/client-foundation.css') ||
                !loadedClientCss.includes('/css/client-layout.css') ||
                !loadedClientCss.includes('/css/client-components.css')) {
              failures.push('client/mobile: one or more extracted client stylesheets are missing');
            }
            for (const tab of clientTabs) {
              await page.goto(BASE + '/client.html?preview=true&section=' + tab, {
                waitUntil: 'domcontentloaded', timeout: 15000
              });
              await page.waitForFunction(expected => window.IS_EDITOR_PREVIEW === true && state.tab === expected,
                tab, { timeout: 5000 });
              const tabDimensions = await page.evaluate(() => ({
                viewport: document.documentElement.clientWidth,
                document: document.documentElement.scrollWidth
              }));
              if (tabDimensions.document > tabDimensions.viewport + 2) {
                overflow.push('client/' + tab + '/mobile: ' + tabDimensions.document + 'px content in ' + tabDimensions.viewport + 'px viewport');
              }
            }
            await page.goto(BASE + '/client.html?preview=true&section=new', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => state.tab === 'new', null, { timeout: 5000 });
            await page.evaluate(() => window.postMessage({ action: 'openSection', section: 'wallet' }, '*'));
            await page.waitForFunction(() => state.tab === 'wallet', null, { timeout: 5000 });
          }


          if (viewport.name === 'mobile' && target.name === 'technician' && process.env.SONAA_SMOKE_REAL_API === '1') {
            await page.locator('#fanniLoginPhone').fill('01012345671');
            await page.locator('#fanniLoginPassword').fill('FanniSmokePass123');
            await page.getByRole('button', { name: 'دخول إلى حسابي' }).click();
            await page.waitForFunction(() => !!localStorage.getItem('fanni_token_v4'), { timeout: 10000 });
            await page.waitForFunction(() => state.tab === 'home', { timeout: 5000 });

            const resources = await page.evaluate(() => ({
              css: [...document.querySelectorAll('link[rel="stylesheet"]')].map(item => item.href).filter(url => url.includes('/css/fanni-')),
              scripts: [...document.querySelectorAll('script[src]')].map(item => item.src).filter(url => url.includes('/js/fanni-'))
            }));
            if (new Set(resources.css).size !== resources.css.length || new Set(resources.scripts).size !== resources.scripts.length) {
              failures.push('technician/mobile: duplicate CSS or JavaScript module references detected');
            }

            const expectedTabs = [
              ['الرئيسية', 'home'],
              ['فرص العمل', 'available'],
              ['طلباتي', 'myOrders'],
              ['المحفظة', 'wallet'],
              ['المتجر', 'store'],
              ['حسابي', 'profile']
            ];
            for (const [label, tab] of expectedTabs) {
              try {
                const tabButton = page.locator(`button[onclick="openTechnicianSection('${tab}')"]`).first();
                await tabButton.click({ timeout: 8000 });
                await page.waitForTimeout(120);
                const isActive = await page.evaluate(expected => [...document.querySelectorAll('button')]
                  .some(button => button.getAttribute('onclick') === "openTechnicianSection('" + expected + "')" &&
                    button.classList.contains('is-active')), tab);
                if (!isActive) failures.push('technician/mobile: navigation did not activate the ' + tab + ' section');
              } catch (error) {
                failures.push('technician/mobile: ' + tab + ' navigation click failed: ' + error.message);
                throw error;
              }
            }

            await page.locator('button[onclick="openTechnicianSection(\'home\')"]').first().click();
            await page.locator('.fanni-home-dashboard').waitFor({ state: 'visible', timeout: 3000 });
            const homeStatsCount = await page.locator('.fanni-home-dashboard [data-home-stat]').count();
            if (homeStatsCount !== 4) failures.push('technician/mobile: home dashboard must show all four summary statistics');

            const polling = await page.evaluate(() => ({
              chats: !!fanniChatsPollTimer,
              messages: !!fanniMessagesPollTimer,
              bell: !!document.querySelector('button[aria-label="الإشعارات"]'),
              intervals: window.__sonaaIntervalDelays || []
            }));
            if (!polling.chats || !polling.messages || !polling.bell ||
                polling.intervals.filter(delay => delay === 25000).length !== 1 ||
                polling.intervals.filter(delay => delay === 10000).length < 1) {
              failures.push('technician/mobile: chat polling must run at 25s and 10s and keep the notification bell');
            }

            await page.evaluate(() => {
              Object.defineProperty(document, 'hidden', { configurable: true, value: true });
              document.dispatchEvent(new Event('visibilitychange'));
            });
            const stopped = await page.evaluate(() => !fanniChatsPollTimer && !fanniMessagesPollTimer);
            await page.evaluate(() => {
              Object.defineProperty(document, 'hidden', { configurable: true, value: false });
              document.dispatchEvent(new Event('visibilitychange'));
            });
            const resumed = await page.evaluate(() => !!fanniChatsPollTimer && !!fanniMessagesPollTimer);
            if (!stopped || !resumed) failures.push('technician/mobile: polling did not stop/resume with page visibility');

            await page.locator('button[onclick="openTechnicianSection(\'support\')"]:visible').first().click({ timeout: 8000 });
            await page.waitForURL(url => url.pathname.endsWith('/support.html') && url.searchParams.get('role') === 'fanni', { timeout: 5000 });
          }

          if (pageErrors.length) failures.push(target.name + '/' + viewport.name + ': ' + pageErrors.join(' | '));
          if (badLocalResponses.length) failures.push(target.name + '/' + viewport.name + ': ' + badLocalResponses.join(', '));
        } catch (error) {
          failures.push(target.name + '/' + viewport.name + ': ' + error.message);
        } finally {
          await page.close();
        }
      }
    }
    // Regression: an existing admin session restored directly into #store must hydrate
    // the saved product list and ad-rotation setting without logging out and back in.
    const storeRestorePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const storeApiCalls = [];
    const storePageErrors = [];
    storeRestorePage.on('pageerror', error => storePageErrors.push(error.message));
    await storeRestorePage.addInitScript(() => {
      localStorage.setItem('admin_token_v3', 'store-tab-restore-smoke-token');
      localStorage.setItem('admin_token', 'store-tab-restore-smoke-token');
      localStorage.setItem('token', 'store-tab-restore-smoke-token');
      localStorage.setItem('auth_token', 'store-tab-restore-smoke-token');
    });
    await storeRestorePage.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      storeApiCalls.push(url.pathname);
      let body = apiResponse(url.pathname);
      if (url.pathname.endsWith('/admin/store/products')) {
        body = {
          products: [{ _id: 'store-restore-smoke-product', name: 'منتج استعادة المتجر', category: 'عام', price: 125, isActive: true, isAdvertised: false }],
          categories: [{ name: 'عام', productCount: 1, imageUrl: '', fallbackImageUrl: '', customImageUrl: '', imageFileId: null, hasCustomImage: false }]
        };
      } else if (url.pathname.endsWith('/admin/store/ad-settings')) {
        body = { rotationSeconds: 10 };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(body)
      });
    });
    try {
      const response = await storeRestorePage.goto(BASE + '/admin-smoke-panel-20261105#store', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      if (!response || response.status() !== 200) failures.push('admin/store-restore: admin page did not return HTTP 200');
      await storeRestorePage.getByText('منتج استعادة المتجر').waitFor({ state: 'visible', timeout: 6000 });
      const rotationSettingsToggle = storeRestorePage.getByRole('button', { name: /مدة عرض صورة الإعلان/ });
      await rotationSettingsToggle.waitFor({ state: 'visible', timeout: 5000 });
      if (await rotationSettingsToggle.getAttribute('aria-expanded') !== 'false') {
        failures.push('admin/store-restore: ad rotation settings should start collapsed');
      }
      await rotationSettingsToggle.click();
      const savedRotation = await storeRestorePage.locator('#store-ad-rotation-seconds').inputValue();
      if (savedRotation !== '10') failures.push('admin/store-restore: saved ad rotation setting was not restored (expected 10, received ' + savedRotation + ')');
      if (!storeApiCalls.includes('/api/admin/store/products')) failures.push('admin/store-restore: restored store tab did not request saved products');
      if (!storeApiCalls.includes('/api/admin/store/ad-settings')) failures.push('admin/store-restore: restored store tab did not request saved ad settings');
      if (storePageErrors.length) failures.push('admin/store-restore: ' + storePageErrors.join(' | '));
    } catch (error) {
      failures.push('admin/store-restore: ' + error.message);
    } finally {
      await storeRestorePage.close();
    }

  } finally {
    await browser.close();
  }

  if (overflow.length) {
    console.log('RESPONSIVE OVERFLOW WARNINGS:');
    for (const item of overflow) console.log('- ' + item);
  }

  if (failures.length) {
    console.error('FRONTEND BROWSER SMOKE TESTS FAILED:');
    for (const item of failures) console.error('- ' + item);
    process.exitCode = 1;
  } else {
    console.log('Frontend browser smoke tests passed: ' + pages.length + ' pages x 2 viewports = ' + (pages.length * 2) + ' page loads.');
    console.log('Responsive overflow warnings: ' + overflow.length);
  }
})();
