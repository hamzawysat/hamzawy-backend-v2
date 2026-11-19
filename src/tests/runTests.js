'use strict';

// Isolated integration/security suite. Never points at production MongoDB.
process.env.NODE_ENV = 'test';
process.env.ALLOWED_ORIGINS = 'https://www.hamzawy-sat.dynv6.net,http://localhost:3000';
process.env.JWT_SECRET = 'sonaa-test-only-secret-change-me';
process.env.ADMIN_PHONE = '01012345678';
process.env.CARD_LEDGER_SECRET = 'test-only-card-ledger-secret-at-least-32-chars';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const errorHandler = require('../middleware/error');
const { canAccessAdmin, isRootAdmin, defaultAdminPermissions } = require('../middleware/auth');

async function run() {
  let mongo;
  let mongoose;
  let app;
  let passed = 0;
  const failures = [];
  let clientToken;
  let secondClientToken;
  let clientId;
  let supportCaseId;
  let orderSN;
  let orderClientToken;
  let adminToken;

  async function test(name, fn) {
    try {
      await fn();
      passed += 1;
      console.log('✓ ' + name);
    } catch (error) {
      failures.push({ name, error });
      console.error('✗ ' + name + ': ' + (error?.message || error));
    }
  }

  try {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    process.env.MONGO_URI = mongo.getUri('sonaa_test');
    app = require('../server');
    mongoose = require('mongoose');

    await test('technician card ledger normalizes Egyptian national-ID digits and encrypts the stored number', async () => {
      const cardOcr = require('../services/fanniCardOcr');
      const nationalId = '٢٩٠٠١٠١٢٣٤٥٦٧٨';
      assert.equal(cardOcr.normalizeNationalId(nationalId), '29001012345678');
      const encrypted = cardOcr.encryptNationalId(nationalId);
      assert.notEqual(encrypted, '29001012345678');
      assert.equal(cardOcr.decryptNationalId(encrypted), '29001012345678');
      assert.equal(cardOcr.cardHash(nationalId), cardOcr.cardHash('29001012345678'));
    });

    await test('technician card ledger is a separate unique national-ID collection and cross-role referrals are skipped', async () => {
      const FanniCardLedger = require('../models/FanniCardLedger');
      const technicianRoutes = fs.readFileSync(path.join(__dirname, '../routes/fanni.js'), 'utf8');
      const clientRoutes = fs.readFileSync(path.join(__dirname, '../routes/client.js'), 'utf8');
      assert.equal(FanniCardLedger.schema.path('nationalIdHash').options.unique, true);
      assert.ok(FanniCardLedger.schema.path('duplicateAttempts').schema.path('consumedAt'));
      assert.ok(technicianRoutes.includes('CARD_APPROVAL_ALREADY_USED'));
      assert.ok(technicianRoutes.includes("FanniCardLedger.create(["));
      assert.ok(technicianRoutes.includes("existingClient = await Client.findOne({ phone })"));
      assert.ok(clientRoutes.includes("existingFanni = await Fanni.findOne({ phone })"));
      assert.ok(technicianRoutes.includes('DUPLICATE_FANNI_CARD_REVIEW'));
    });

    await test('client and technician logout audit notifications are idempotent and never enter push retry loop', async () => {
      const clientRoutes = fs.readFileSync(path.join(__dirname, '../routes/client.js'), 'utf8');
      const technicianRoutes = fs.readFileSync(path.join(__dirname, '../routes/fanni.js'), 'utf8');
      const notificationUtils = fs.readFileSync(path.join(__dirname, '../utils/notifications.js'), 'utf8');
      const clientLogoutStart = clientRoutes.indexOf("router.post('/logout', clientAuth");
      const clientLogoutEnd = clientRoutes.indexOf("\nrouter.get('/me'", clientLogoutStart);
      const clientLogoutRoute = clientRoutes.slice(clientLogoutStart, clientLogoutEnd);
      assert.notEqual(clientLogoutStart, -1, 'client logout route must exist');
      assert.ok(clientLogoutRoute.includes("dedupeKey: 'client-logout:'"), 'client logout route must deduplicate repeated requests for the same session token');
      const clientLoginStart = clientRoutes.indexOf("router.post('/login'");
      const clientLoginEnd = clientRoutes.indexOf("\nrouter.post('/logout'", clientLoginStart);
      assert.doesNotMatch(clientRoutes.slice(clientLoginStart, clientLoginEnd), /client-logout:/, 'logout dedupe key must not be attached to client login');
      assert.ok(technicianRoutes.includes("dedupeKey: 'fanni-logout:'"), 'technician logout should deduplicate repeated requests for the same session token');
      assert.ok(notificationUtils.includes("type: { $nin: ['admin_client_logout', 'admin_fanni_logout'] }"), 'one-shot logout alerts must not be resent by the background push retry worker');
    });

    await test('admin shows technician order availability and restores the last selected section after refresh', async () => {
      const adminPeople = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-people.js'), 'utf8');
      const adminNavigation = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-navigation.js'), 'utf8');
      const adminAuth = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-auth.js'), 'utf8');
      const adminShell = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-shell.js'), 'utf8');
      const adminRoutes = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
      assert.ok(adminPeople.includes('f.acceptingOrders===false'), 'admin technician cards should reflect the persisted receiving-orders state');
      assert.ok(adminPeople.includes('موقف استقبال الطلبات'), 'paused technicians should be visibly marked in the admin');
      assert.ok(adminPeople.includes('يستقبل طلبات جديدة'), 'available technicians should be visibly marked in the admin');
      assert.ok(adminRoutes.includes('...item'), 'admin technician serialization should retain acceptingOrders from the technician record');
      assert.ok(adminNavigation.includes("sonaaAdminLastView"), 'selected admin section should be saved for refresh restoration');
      assert.ok(adminNavigation.includes("sessionStorage.setItem"), 'tab navigation should persist the last selected section in the current browser session');
      assert.ok(adminAuth.includes("sessionStorage?.getItem('sonaaAdminLastView')"), 'admin startup should restore the last selected section after refresh');
      assert.ok(adminAuth.includes('Notification links open their target once'), 'notification deep links should open once and then preserve the selected section');
      assert.ok(adminAuth.includes('return refreshCurrentTab()'), 'restored sections should reload their own data after startup');
      assert.ok(adminShell.includes("pageMode==='home'"), 'the dashboard home view should also remain the selected view after refresh');
    });
    await test('store admin reuses saved product categories and browser catalogs open image-backed category cards', async () => {
      const adminStore = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-store.js'), 'utf8');
      const browserStore = fs.readFileSync(path.join(__dirname, '../../frontend/js/store-ui.js'), 'utf8');
      assert.ok(adminStore.includes('id="store-category"'), 'admin form should offer an existing-category dropdown');
      assert.ok(adminStore.includes('id="store-category-new"'), 'admin form should accept a new category beside the dropdown');
      assert.ok(adminStore.includes("document.getElementById('store-category-new')"), 'new category text should be saved with the product');
      assert.ok(adminStore.includes('function renderStoreCategoryManager(products)'), 'admin should render a dedicated category manager');
      assert.ok(adminStore.includes('saveStoreCategoryFromButton(this)'), 'admin should save category name and image edits');
      assert.ok(adminStore.includes('deleteStoreCategoryFromButton(this)'), 'admin should provide category deletion');
      assert.ok(adminStore.includes('/api/admin/store/media?purpose=category'), 'admin should upload a custom category image');
      assert.ok(browserStore.includes('function setStoreCategory(role,category)'), 'browser store should support entering and leaving a category');
      assert.ok(browserStore.includes('data-store-category'), 'category cards should have an actionable selection');
      assert.ok(browserStore.includes('categoryInfo?.imageUrl||cover?.imageUrl'), 'custom category artwork should override the product-image fallback');
      assert.ok(browserStore.includes('const cover=items.find(p=>String(p.imageUrl||\'\').trim())||items[0]'), 'category artwork should come from a product in that category');
      assert.ok(browserStore.includes('selectedItems.forEach(product=>{h+=renderStoreProductCard(product,role);})'), 'opening a category should show only its products');
    });

    await test('store admin groups product tools and store settings separately and collapses category manager by default', async () => {
      const adminStore = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-store.js'), 'utf8');
      const categoryStart = adminStore.indexOf('function renderStoreCategoryManager(products)');
      const categoryEnd = adminStore.indexOf('async function uploadStoreCategoryImage', categoryStart);
      const categoryRenderer = adminStore.slice(categoryStart, categoryEnd);
      const renderStart = adminStore.indexOf('function renderStore(){');
      const renderEnd = adminStore.indexOf('function renderStoreOrders(){', renderStart);
      const storeRenderer = adminStore.slice(renderStart, renderEnd);
      assert.match(adminStore, /function toggleStoreCategoryManager\(\)/);
      assert.match(categoryRenderer, /state\.storeCategoryManagerOpen=false/);
      assert.match(categoryRenderer, /onclick="toggleStoreCategoryManager\(\)"/);
      assert.match(categoryRenderer, /aria-expanded=/);
      assert.match(categoryRenderer, /isOpen\?'<div class=/, 'category rows should stay hidden until the manager is expanded');
      assert.ok(storeRenderer.includes("const productManagement='<section"), 'product tools should be grouped in their own section');
      assert.ok(storeRenderer.includes("'+csvImporter+form+"), 'CSV import and product form should live in product management');
      assert.ok(storeRenderer.includes("const storeManagement='<section"), 'store settings should be grouped separately');
      assert.ok(storeRenderer.includes("'+renderStoreCategoryManager(products)+rotationSettings"), 'category management and ad rotation should live in store settings');
      assert.ok(storeRenderer.indexOf("'+storeManagement+productManagement")>=0, 'store settings should appear above product and advertisement tools');
      assert.match(adminStore,/function toggleStoreAdRotationSettings\(\)/,'ad rotation settings should have a dedicated collapse toggle');
      assert.match(storeRenderer,/state\.storeAdRotationSettingsOpen=false/,'ad rotation settings should be collapsed by default');
      assert.match(storeRenderer,/rotationOpen\?'<div class=/,'ad rotation controls should stay hidden until expanded');
    });

    await test('only the configured root administrator bypasses the permission matrix', async () => {
      assert.equal(isRootAdmin({ role: 'admin', phone: '01012345678' }), true);
      assert.equal(isRootAdmin({ role: 'admin', phone: '01012345679' }), false);
      assert.equal(canAccessAdmin({ role: 'admin', phone: '01012345679', adminPermissions: { orders: { read: false, write: false } } }, { path: '/orders', method: 'GET' }), true, 'legacy full matrices must not override role defaults');
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مشرف', adminPermissions: { orders: { read: true, write: false } } }, { path: '/api/admin/orders', method: 'GET' }), true);
      assert.equal(canAccessAdmin({ role: 'admin', phone: '01012345679' }, { path: '/settings', method: 'GET' }), false);
      const manager = { role: 'fanni', adminRole: 'مدير' };
      const readOnlySupport = { role: 'fanni', adminRole: 'قراءة فقط' };
      assert.equal(canAccessAdmin(manager, { path: '/password-recovery/admin/support-passwords', method: 'GET' }), true);
      assert.equal(canAccessAdmin(manager, { path: '/password-recovery/admin/support-passwords', method: 'POST' }), true);
      assert.equal(canAccessAdmin(readOnlySupport, { path: '/password-recovery/admin/support-passwords', method: 'GET' }), true);
      assert.equal(canAccessAdmin(readOnlySupport, { path: '/password-recovery/admin/support-passwords', method: 'POST' }), false);
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مدير', adminPermissions: { __customOverrides: true, passwordRecovery: { read: true, write: false } } }, { path: '/password-recovery/admin/support-passwords', method: 'POST' }), false);
    });

    await test('database service catalog supports owner-added services and respects hidden state', async () => {
      const { getActiveServiceNames, isActiveService } = require('../services/serviceCatalog');
      const records = [
        { name: 'تركيب دش', category: 'دش وكاميرات وشاشات', isActive: true },
        { name: 'كهرباء', category: 'خدمات منزلية', isActive: true, isPublic: true },
        { name: 'سباكة', category: 'خدمات منزلية', isActive: false, isPublic: false },
        { name: 'سباك منازل', category: 'السباكة', isActive: true }
      ];
      const fakeService = {
        find: () => ({ select: () => ({ lean: async () => records }) })
      };
      const active = await getActiveServiceNames(fakeService);
      assert.ok(active.includes('كهرباء'), 'new active database services must be accepted without code changes');
      assert.ok(!active.includes('سباكة'), 'hidden services must not be available to clients or technicians');
      assert.ok(!active.includes('سباك منازل'), 'legacy Sonaa services remain hidden until explicitly enabled');
      assert.equal(await isActiveService(fakeService, 'كهرباء'), true);
      assert.equal(await isActiveService(fakeService, 'سباكة'), false);
    });

    await test('technician order matching accepts only explicit current services', async () => {
      const { createFanniCanHandleService } = require('../utils/orderPresentation');
      const { CATEGORIES, normalizeServiceName } = require('../config/professions');
      const canHandle = createFanniCanHandleService({ CATEGORIES, normalizeServiceName });
      assert.equal(canHandle(['صيانة دش'], 'صيانة دش'), true);
      assert.equal(canHandle(['صيانة تكييف'], 'صيانة دش'), false);
      assert.equal(canHandle(['دش وكاميرات وشاشات'], 'صيانة دش'), false, 'a historical category label must not grant every service');
    });

    await test('admin store CSV importer supports Arabic headers, quoted fields and manual column mapping', async () => {
      const adminStore = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-store.js'), 'utf8');
      assert.ok(adminStore.includes('function parseStoreCsvText(sourceText)'), 'admin should parse CSV rows and quoted fields');
      assert.ok(adminStore.includes('function autoMapStoreCsvHeaders(headers)'), 'admin should recognize common Arabic and English column names');
      assert.ok(adminStore.includes('function updateStoreCsvMapping(select)'), 'admin should allow manual column mapping');
      assert.ok(adminStore.includes('function prepareStoreCsvImportRows()'), 'admin should validate rows before import');
      assert.ok(adminStore.includes('/api/admin/store/products/import'), 'admin should submit products through the bulk import endpoint');
      assert.ok(adminStore.includes('استيراد CSV'), 'store management should expose a CSV import action');
      assert.ok(adminStore.includes("TextDecoder('windows-1256')"), 'admin should support Arabic Excel CSV files saved with Windows-1256 encoding');
      assert.ok(adminStore.includes('resultDetails'), 'admin should show row-level import errors and duplicate reasons after submission');
      assert.ok(adminStore.includes('اسم المنتج *') && adminStore.includes('السعر *'), 'product name and price must remain required for imports');
    });

    await test('role defaults are restored and manager can publish orders and moderate offers', async () => {
      const readOnly = { role: 'fanni', adminRole: 'قراءة فقط' };
      assert.equal(canAccessAdmin(readOnly, { path: '/orders', method: 'GET' }), true);
      assert.equal(canAccessAdmin(readOnly, { path: '/orders/SN123456/publish', method: 'POST' }), false);
      const manager = { role: 'fanni', adminRole: 'مدير' };
      assert.equal(canAccessAdmin(manager, { path: '/admin/SN123456/publish', method: 'POST' }), true, 'manager must have the dedicated publish permission on the actual mounted route');
      assert.equal(canAccessAdmin(manager, { path: '/admin/SN123456/voice-reviewed', method: 'POST' }), true, 'manager must be able to record the required voice review');
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مشرف' }, { path: '/admin/SN123456/voice-reviewed', method: 'POST' }), false, 'supervisors without publish permission must not mark voice review complete');
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مشرف' }, { path: '/admin/SN123456/publish', method: 'POST' }), false, 'supervisor must not publish by default');
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مدير', adminPermissions: { __customOverrides: true, publishOrders: { read: true, write: false } } }, { path: '/admin/SN123456/publish', method: 'POST' }), false, 'a custom override must revoke publishing without changing order permissions');
      assert.equal(canAccessAdmin(manager, { path: '/offers/SN123456/0/reject', method: 'POST' }), true);
      assert.equal(defaultAdminPermissions('مشرف').orders.write, true);
      assert.equal(defaultAdminPermissions('مشرف').store.read, true);
      assert.equal(defaultAdminPermissions('مشرف').store.write, false);
      assert.equal(defaultAdminPermissions('مدير').store.write, true);
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مدير' }, { path: '/store/products', method: 'POST' }), true);
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'قراءة فقط' }, { path: '/store/products', method: 'GET' }), true);
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'قراءة فقط' }, { path: '/store/products', method: 'POST' }), false);
      assert.equal(defaultAdminPermissions('مشرف').settings.write, false);
      assert.equal(defaultAdminPermissions('مشرف أول').services.write, true);
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مدير' }, { path: '/fanni-profile-edits', method: 'GET' }), true);
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مدير' }, { path: '/fanni-profile-edits/507f1f77bcf86cd799439011/approve', method: 'POST' }), true);
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مشرف' }, { path: '/fanni-profile-edits', method: 'GET' }), true);
      assert.equal(canAccessAdmin({ role: 'fanni', adminRole: 'مشرف' }, { path: '/fanni-profile-edits/507f1f77bcf86cd799439011/approve', method: 'POST' }), false);
    });

    await test('client wallet admin routes use wallet permissions on the server', async () => {
      const { canAccessAdmin } = require('../middleware/auth');
      const readOnlyWalletAdmin = { role: 'admin', adminRole: 'مشرف', phone: '01000000001' };
      const walletManager = { role: 'admin', adminRole: 'مشرف أول', phone: '01000000002' };
      const topupRead = { method: 'GET', path: '/client-wallet/topup-requests' };
      const topupApprove = { method: 'POST', path: '/client-wallet/topup-requests/abc/approve' };
      const manualCredit = { method: 'POST', path: '/clients/abc/wallet/add-balance' };
      const manualDebit = { method: 'POST', path: '/clients/abc/wallet/deduct-balance' };
      const manualSettlement = { method: 'POST', path: '/clients/abc/wallet/set-balance' };
      assert.equal(canAccessAdmin(readOnlyWalletAdmin, topupRead), true);
      assert.equal(canAccessAdmin(readOnlyWalletAdmin, topupApprove), false);
      assert.equal(canAccessAdmin(readOnlyWalletAdmin, manualCredit), false);
      assert.equal(canAccessAdmin(readOnlyWalletAdmin, manualDebit), false);
      assert.equal(canAccessAdmin(readOnlyWalletAdmin, manualSettlement), false);
      assert.equal(canAccessAdmin(walletManager, topupApprove), true);
      assert.equal(canAccessAdmin(walletManager, manualCredit), true);
      assert.equal(canAccessAdmin(walletManager, manualDebit), true);
      assert.equal(canAccessAdmin(walletManager, manualSettlement), true);
    });

    await test('custom admin permissions separate reading from execution and protect permission management', async () => {
      const user = { role: 'fanni', adminRole: 'مشرف', adminPermissions: { __customOverrides: true, orders: { read: true, write: false }, settings: { read: false, write: false } } };
      assert.equal(canAccessAdmin(user, { path: '/orders', method: 'GET' }), true);
      assert.equal(canAccessAdmin(user, { path: '/orders', method: 'POST' }), false);
      assert.equal(canAccessAdmin(user, { path: '/settings', method: 'GET' }), false);
      assert.equal(canAccessAdmin(user, { path: '/reports', method: 'POST' }), true, 'report generation is read-only even though it uses POST');
      const noDashboardRead = { role: 'fanni', adminRole: 'مشرف', adminPermissions: { __customOverrides: true, dashboard: { read: false, write: false } } };
      assert.equal(canAccessAdmin(noDashboardRead, { path: '/reports', method: 'POST' }), false, 'report generation still respects dashboard read permission');
      assert.equal(canAccessAdmin(user, { path: '/admin-users/123/permissions', method: 'PATCH' }), false);
      assert.equal(canAccessAdmin(user, { path: '/notifications/admin', method: 'GET' }), true);
      const adminSource = fs.readFileSync(path.join(__dirname, '../routes/admin/orders.js'), 'utf8');
      const assignStart = adminSource.indexOf("router.post('/orders/:sn/assign'");
      const assignEnd = adminSource.indexOf("router.get('/wallet/transactions", assignStart);
      assert.match(adminSource.slice(assignStart, assignEnd), /requireRootAdmin\(req, res\)/);
      const walletSource = fs.readFileSync(path.join(__dirname, '../routes/admin/wallet.js'), 'utf8');
      const freezeStart = walletSource.indexOf("router.post('/wallet/freeze/:id'");
      const freezeEnd = walletSource.indexOf("\n  return router;", freezeStart);
      assert.notEqual(freezeStart, -1);
      assert.match(walletSource.slice(freezeStart, freezeEnd), /valid\('freeze', 'unfreeze'\)/);
      assert.equal(canAccessAdmin(user, { path: '/notifications/admin/read-all', method: 'PATCH' }), false);
      const noNotificationRead = { role: 'fanni', adminRole: 'مشرف', adminPermissions: { __customOverrides: true, notifications: { read: false, write: false } } };
      assert.equal(canAccessAdmin(noNotificationRead, { path: '/notifications/admin', method: 'GET' }), false);
    });

    await test('wallet balance mutations are governed by wallet permissions, not technician-list permissions', async () => {
      const user = { role: 'fanni', adminRole: 'مدير', adminPermissions: { __customOverrides: true, fannis: { read: false, write: false }, wallet: { read: true, write: true } } };
      assert.equal(canAccessAdmin(user, { path: '/fannis/507f1f77bcf86cd799439011/set-balance', method: 'POST' }), true);
      user.adminPermissions.wallet.write = false;
      assert.equal(canAccessAdmin(user, { path: '/fannis/507f1f77bcf86cd799439011/set-balance', method: 'POST' }), false);
    });

    await test('browser push assets are wired without removing Expo notifications', async () => {
      const webPush = fs.readFileSync(path.join(__dirname, '../utils/webPush.js'), 'utf8');
      const route = fs.readFileSync(path.join(__dirname, '../routes/notifications.js'), 'utf8');
      const browser = fs.readFileSync(path.join(__dirname, '../../frontend/web-push.js'), 'utf8');
      const worker = fs.readFileSync(path.join(__dirname, '../../frontend/service-worker.js'), 'utf8');
      const delivery = fs.readFileSync(path.join(__dirname, '../utils/notifications.js'), 'utf8');
      assert.match(webPush, /aes-128-gcm/); assert.match(webPush, /VAPID_PUBLIC_KEY/);
      const { isAllowedPushEndpoint, normalizeNotificationPath } = require('../utils/webPush');
      assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/example'), true);
      assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true);
      assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/example'), true);
      assert.equal(isAllowedPushEndpoint('https://wns2-example.notify.windows.com/w/?token=example'), true);
      assert.equal(isAllowedPushEndpoint('https://127.0.0.1/admin'), false);
      assert.equal(isAllowedPushEndpoint('https://example.com/push'), false);
      assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.test/push'), false);
      assert.equal(isAllowedPushEndpoint('http://fcm.googleapis.com/push'), false);
      assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com:8443/push'), false);
      assert.equal(normalizeNotificationPath('https://hamzawy-backend-v2-production.up.railway.app/admin?tab=fannis'), '/admin?tab=fannis');
      assert.equal(normalizeNotificationPath('https://attacker.invalid/admin'), '/');
      assert.match(webPush, /PUSH_TTL_SECONDS = 86400/);
      assert.match(webPush, /TTL: String\(PUSH_TTL_SECONDS\)/);
      assert.match(delivery, /ttl: 86400/); assert.match(delivery, /ttl: '86400s'/); assert.match(delivery, /TTL: '86400'/);
      assert.match(worker, /www\.hamzawy-sat\.dynv6\.net/);
      assert.match(route, /isAllowedPushEndpoint\(endpoint\)/);
      assert.match(route, /web-subscription/); assert.match(browser, /PushManager/);
      assert.match(browser, /const apiUrl=path=>path/);
      assert.match(browser, /pushManager\.subscribe/);
      const previewBootstrap = fs.readFileSync(path.join(__dirname, '../../frontend/js/preview-bootstrap.js'), 'utf8');
      assert.match(previewBootstrap, /window\.__SONAA_PAGE_ROLE__ = 'admin'/);
      assert.doesNotMatch(browser, /vercel\.app/);
      assert.match(worker, /addEventListener\('push'/); assert.match(worker, /notificationTarget/);
      assert.match(worker, /addEventListener\('pushsubscriptionchange'/);
      assert.match(worker, /WEB_PUSH_SUBSCRIPTION_CHANGED/);
      assert.match(browser, /WEB_PUSH_SUBSCRIPTION_CHANGED/);
      assert.doesNotMatch(worker, /LOGO_UPLOAD_HERE/);
      assert.match(route, /normalizeNotificationLink\(item\.link/);
      assert.match(delivery, /sendPushNotification/);
      assert.match(delivery, /sendWebPushNotification/);
      assert.match(delivery, /admin_new_topup: 'topups'/);
      assert.match(delivery, /admin_client_topup: 'clientWallet'/);
      assert.match(delivery, /admin_password_recovery: 'recovery'/);
      assert.match(delivery, /admin_support_request: 'support'/);
      assert.match(delivery, /admin_new_complaint: 'complaints'/);
      assert.match(delivery, /wallet_charge: 'topups'/);
      assert.match(webPush, /function removeSubscriptionRecipient\(subscription, notification\)/);
      assert.match(webPush, /\$pull: \{ recipients:/);
      assert.match(webPush, /removeSubscriptionRecipient\(subscription, notification\)/);
      const deliveryModel = fs.readFileSync(path.join(__dirname, '../models/NotificationDelivery.js'), 'utf8');
      assert.match(route, /admin\/delivery-log/);
      assert.match(delivery, /NotificationDelivery\.findOneAndUpdate/);
      assert.match(delivery, /channels, overallStatus, lastAttemptAt/);
      assert.match(delivery, /retryPendingNotificationDeliveries/);
      assert.match(delivery, /collapseId: 'hamzawy-'/);
      assert.match(delivery, /notificationId: String\(notification\._id\)/);
      assert.match(webPush, /notificationId: String\(notification\.notificationId/);
      assert.match(worker, /tag: data\.notificationId/);
      const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
      assert.match(serverSource, /retryPendingNotificationDeliveries\(25\)/);

      assert.match(deliveryModel, /notificationId/);
      assert.match(deliveryModel, /lastError/);
      assert.doesNotMatch(deliveryModel, /token\s*:/i, 'delivery diagnostics must never store push tokens');
      const clientNotificationUi = fs.readFileSync(path.join(__dirname, '../../frontend/js/client-account.js'), 'utf8');
      const fanniNotificationUi = fs.readFileSync(path.join(__dirname, '../../frontend/js/fanni-notifications.js'), 'utf8');
      assert.match(clientNotificationUi, /subscription_activated/);
      assert.match(clientNotificationUi, /loadClientCommerce\(\)/);
      assert.match(clientNotificationUi, /loadStoreForRole\('client'\)/);
      assert.match(fanniNotificationUi, /client_service_refunded/);
      assert.match(fanniNotificationUi, /loadStoreForRole\('fanni'\)/);
      const adminNotificationUi = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin/support-notifications.js'), 'utf8');
      assert.match(adminNotificationUi, /renderDeliveryAudit/);
      assert.match(adminNotificationUi, /admin\/delivery-log\?limit=30/);
      assert.match(adminNotificationUi, /function renderNotificationHistory[\s\S]*?renderAdminInbox\(\)/);
      assert.match(adminNotificationUi, /function renderNotificationHistory[\s\S]*?admin-delivery-log-list/);
      assert.match(adminNotificationUi, /new URL\(String\(item\.link\|\|''\),window\.location\.origin\)/);
      assert.match(adminNotificationUi, /target\.searchParams\.get\('tab'\)/);



      const walletRoutes = fs.readFileSync(path.join(__dirname, '../routes/admin/wallet.js'), 'utf8');
      assert.match(walletRoutes, /fanni_wallet_settlement/);
      assert.match(walletRoutes, /admin-fanni-wallet-settlement:/);
      assert.match(walletRoutes, /الرصيد بعد العملية/);
    });
    await test('web push public key endpoint fails safely until VAPID keys are configured', async () => {
      delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
      const r = await request(app).get('/api/notifications/web-push-public-key');
      assert.equal(r.status, 503); assert.match(r.body.message, /غير مهيأة/);
    });

    await test('legacy Hamzawy page URLs redirect to the new public domain', async () => {
      const r = await request(app).get('/download.html')
        .set('Host', 'hamzawy-sat.vercel.app');
      assert.equal(r.status, 307);
      assert.equal(r.headers.location, 'https://www.hamzawy-sat.dynv6.net/download.html');
    });

    await test('download page is served on the main domain without leaving it', async () => {
      const r = await request(app).get('/download')
        .set('Host', 'www.hamzawy-sat.dynv6.net');
      assert.equal(r.status, 200);
      assert.match(r.text, /تحميل تطبيق حمزاوي سات/);
    });

    await test('official links page is served on the main domain without leaving it', async () => {
      const r = await request(app).get('/links')
        .set('Host', 'www.hamzawy-sat.dynv6.net');
      assert.equal(r.status, 200);
      assert.match(r.text, /روابطنا الرسمية/);
    });

    await test('homepage responds without exposing Express signature', async () => {
      const r = await request(app).get('/');
      assert.equal(r.status, 200);
      assert.equal(r.headers['x-powered-by'], undefined);
    });

    await test('authentication fails safely when JWT_SECRET is missing and missing technician records are checked before guidelines', async () => {
      const originalSecret = process.env.JWT_SECRET;
      try {
        delete process.env.JWT_SECRET;
        const r = await request(app).get('/api/fanni/me')
          .set('Authorization', 'Bearer invalid-token');
        assert.equal(r.status, 503);
      } finally {
        process.env.JWT_SECRET = originalSecret;
      }

      const availableSource = fs.readFileSync(path.join(__dirname, '../routes/order/available.js'), 'utf8');
      assert.ok(
        availableSource.indexOf('if (!fanni)') < availableSource.indexOf('if (!fanni.technicianGuidelinesAcceptedAt'),
        'missing technician record must return 403 before guideline validation'
      );
    });

    await test('security headers include CSP and disable object embedding', async () => {
      const r = await request(app).get('/');
      const csp = r.headers['content-security-policy'] || '';
      assert.ok(csp.includes("object-src 'none'"));
      assert.ok(csp.includes("frame-ancestors 'self'"));
      assert.ok(!csp.includes("https://*.vercel.app"));
      assert.equal(r.headers['x-frame-options'], 'SAMEORIGIN');
    });

    await test('CSP report-only audits inline scripts without weakening the enforced CSP', async () => {
      const r = await request(app).get('/');
      const enforced = r.headers['content-security-policy'] || '';
      const reportOnly = r.headers['content-security-policy-report-only'] || '';
      assert.ok(enforced.includes("script-src 'self' 'unsafe-inline'"));
      assert.ok(enforced.includes('https://www.hamzawy-sat.dynv6.net'));
      assert.ok(reportOnly.includes("script-src 'self' https://cdn.tailwindcss.com"));
      assert.ok(reportOnly.includes('https://www.hamzawy-sat.dynv6.net'));
      assert.ok(reportOnly.includes("script-src-attr 'none'"));
      assert.ok(!reportOnly.includes("script-src 'self' 'unsafe-inline'"));
      const report = await request(app).post('/api/csp-report')
        .set('Content-Type', 'application/csp-report')
        .send(JSON.stringify({ 'csp-report': { 'violated-directive': 'script-src-elem', 'document-uri': 'https://sonaa-backend-v2.vercel.app/client.html' } }));
      assert.equal(report.status, 204);
    });

    await test('CORS allows configured production origin', async () => {
      const r = await request(app).options('/api/test')
        .set('Origin', 'https://www.hamzawy-sat.dynv6.net')
        .set('Access-Control-Request-Method', 'GET');
      assert.equal(r.headers['access-control-allow-origin'], 'https://www.hamzawy-sat.dynv6.net');
    });

    await test('CORS rejects the retired Vercel frontend origin', async () => {
      const r = await request(app).options('/api/test')
        .set('Origin', 'https://hamzawy-sat.vercel.app')
        .set('Access-Control-Request-Method', 'GET');
      assert.equal(r.headers['access-control-allow-origin'], undefined);
    });

    await test('CORS allows the new public site domain to call its same-origin API', async () => {
      const r = await request(app).options('/api/test')
        .set('Origin', 'https://www.hamzawy-sat.dynv6.net')
        .set('Access-Control-Request-Method', 'GET');
      assert.equal(r.headers['access-control-allow-origin'], 'https://www.hamzawy-sat.dynv6.net');
    });

    await test('CORS does not reflect an arbitrary origin', async () => {
      const r = await request(app).options('/api/test')
        .set('Origin', 'https://attacker.invalid')
        .set('Access-Control-Request-Method', 'GET');
      assert.equal(r.headers['access-control-allow-origin'], undefined);
    });

    await test('health endpoint confirms isolated database connectivity', async () => {
      const r = await request(app).get('/health');
      assert.equal(r.status, 200);
      assert.equal(r.body.ok, true);
      assert.equal(r.body.database, 'connected');
    });

    await test('public services endpoint returns service and category arrays', async () => {
      const r = await request(app).get('/api/services');
      assert.equal(r.status, 200);
      assert.equal(r.body.ok, true);
      assert.ok(Array.isArray(r.body.services));
      assert.ok(Array.isArray(r.body.categories));
    });

    await test('public areas endpoint returns an array', async () => {
      const r = await request(app).get('/api/areas');
      assert.equal(r.status, 200);
      assert.equal(r.body.ok, true);
      assert.ok(Array.isArray(r.body.areas));
    });

    await test('client registration rejects invalid input', async () => {
      const r = await request(app).post('/api/client/register').send({
        name: 'A', phone: 'not-a-phone', password: '123', confirmPassword: 'different'
      });
      assert.equal(r.status, 400);
    });

    await test('client registration creates a session without exposing password hash', async () => {
      const r = await request(app).post('/api/client/register').send({
        name: 'عميل اختبار', phone: '01012345678',
        password: 'TestPass123', confirmPassword: 'TestPass123'
      });
      assert.equal(r.status, 201);
      assert.ok(r.body.token);
      assert.ok(r.body.client.id);
      assert.equal(r.body.client.passwordHash, undefined);
      clientToken = r.body.token;
      clientId = r.body.client.id;
    });

    await test('disabling referrals blocks new invited registrations but allows ordinary registration', async () => {
      const AdminConfig = require('../models/AdminConfig');
      const { makeReferralCode } = require('../utils/referralCodes');
      await AdminConfig.findOneAndUpdate({ key: 'main' }, { $set: { 'settings.referralsEnabled': false } }, { upsert: true, setDefaultsOnInsert: true });
      try {
        const blocked = await request(app).post('/api/client/register').send({
          name: 'عميل دعوة متوقفة', phone: '01012345679',
          password: 'TestPass123', confirmPassword: 'TestPass123',
          referralCode: makeReferralCode('client', clientId)
        });
        assert.equal(blocked.status, 403);
        const ordinary = await request(app).post('/api/client/register').send({
          name: 'عميل بدون دعوة', phone: '01012345680',
          password: 'TestPass123', confirmPassword: 'TestPass123'
        });
        assert.equal(ordinary.status, 201, 'stopping invitations must not stop ordinary registrations');
      } finally {
        await AdminConfig.findOneAndUpdate({ key: 'main' }, { $set: { 'settings.referralsEnabled': true } }, { upsert: true, setDefaultsOnInsert: true });
      }
    });

    await test('duplicate client phone is rejected', async () => {
      const r = await request(app).post('/api/client/register').send({
        name: 'عميل مكرر', phone: '01012345678',
        password: 'TestPass123', confirmPassword: 'TestPass123'
      });
      assert.equal(r.status, 409);
    });

    await test('client login rejects an incorrect password', async () => {
      const r = await request(app).post('/api/client/login').send({
        phone: '01012345678', password: 'WrongPass123'
      });
      assert.equal(r.status, 401);
    });

    await test('client login returns an authenticated session', async () => {
      const r = await request(app).post('/api/client/login').send({
        phone: '01012345678', password: 'TestPass123'
      });
      assert.equal(r.status, 200);
      assert.ok(r.body.token);
      clientToken = r.body.token;
    });

    await test('web push subscription endpoint validates providers and persists/removes only the client subscription', async () => {
      const WebPushSubscription = require('../models/WebPushSubscription');
      const invalid = await request(app).post('/api/notifications/client/web-subscription')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ subscription: { endpoint: 'https://example.com/push', keys: { p256dh: 'test-p256dh', auth: 'test-auth' } } });
      assert.equal(invalid.status, 400, 'untrusted push endpoints must be rejected');

      const endpoint = 'https://fcm.googleapis.com/fcm/send/sonaa-test-subscription';
      const saved = await request(app).post('/api/notifications/client/web-subscription')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ subscription: { endpoint, keys: { p256dh: 'test-p256dh', auth: 'test-auth' } } });
      assert.equal(saved.status, 200);
      const stored = await WebPushSubscription.findOne({ endpoint }).lean();
      assert.ok(stored);
      assert.equal(String(stored.recipientId), String(clientId));
      assert.equal(stored.recipientRole, 'client');

      const removed = await request(app).delete('/api/notifications/client/web-subscription')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ endpoint });
      assert.equal(removed.status, 200);
      assert.equal(removed.body.deleted, 1);
      assert.equal(await WebPushSubscription.countDocuments({ endpoint }), 0);
    });

    await test('technician registration and login preserve pending-review rules and Expo push-token lifecycle', async () => {
      const phone = '01012345681';
      const legacyServiceRegistration = await request(app).post('/api/fanni/register').send({
        name: 'فني تخصص قديم',
        phone: '01012345682',
        password: 'FanniTestPass123',
        specialties: ['صيانة تكييف'],
        areas: ['المعادي']
      });
      assert.equal(legacyServiceRegistration.status, 400, 'legacy professions must not be accepted for new registrations');

      const missingIdentity = await request(app).post('/api/fanni/register').send({
        name: 'فني بدون بطاقة', phone: '01012345683', password: 'FanniTestPass123',
        specialties: ['صيانة دش'], areas: ['المعادي']
      });
      assert.equal(missingIdentity.status, 400, 'registration must reject missing identity card images');

      // Use a complete PNG fixture. OCR is stubbed here because this test covers
      // registration workflow, not OCR accuracy or external language-data downloads.
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=', 'base64');
      const cardOcr = require('../services/fanniCardOcr');
      cardOcr.setWorkerFactoryForTests(async () => ({
        recognize: async () => ({ data: { text: '29001012345678\\nاسم فني الاختبار' } })
      }));
      const frontUpload = await request(app).post('/api/fanni/registration-media?side=front')
        .set('Content-Type', 'image/png').send(png);
      assert.equal(frontUpload.status, 201, JSON.stringify(frontUpload.body));
      const backUpload = await request(app).post('/api/fanni/registration-media?side=back')
        .set('Content-Type', 'image/png').send(png);
      assert.equal(backUpload.status, 201, JSON.stringify(backUpload.body));
      const publicImage = await request(app).get('/api/store/media/' + frontUpload.body.fileId);
      assert.equal(publicImage.status, 404, 'technician identity images must not be publicly served');
      cardOcr.setWorkerFactoryForTests(async () => ({
        recognize: async () => ({ data: { text: '29001012345678\\nاسم فني الاختبار' } })
      }));
      let registration;
      try {
        registration = await request(app).post('/api/fanni/register').send({
          name: 'فني اختبار التسجيل',
          phone,
          password: 'FanniTestPass123',
          specialties: ['صيانة دش'],
          areas: ['المعادي'],
          identityCardFrontFileId: frontUpload.body.fileId,
          identityCardBackFileId: backUpload.body.fileId
        });
      } finally {
        cardOcr.setWorkerFactoryForTests(null);
      }
      assert.equal(registration.status, 201);
      assert.equal(registration.body.status, 'قيد المراجعة');
      assert.equal(registration.body.token, undefined, 'registration must not bypass admin approval');

      const login = await request(app).post('/api/fanni/login').send({
        phone,
        password: 'FanniTestPass123'
      });
      assert.equal(login.status, 200);
      assert.ok(login.body.token);
      assert.equal(login.body.user.status, 'قيد المراجعة');
      assert.equal(login.body.user.passwordHash, undefined);
      const fanniToken = login.body.token;

      const duplicate = await request(app).post('/api/fanni/register').send({
        name: 'فني مكرر', phone, password: 'FanniTestPass123', specialties: ['صيانة دش'], areas: ['المعادي'],
        identityCardFrontFileId: frontUpload.body.fileId, identityCardBackFileId: backUpload.body.fileId
      });
      assert.equal(duplicate.status, 409);

      const wrongPassword = await request(app).post('/api/fanni/login').send({
        phone,
        password: 'WrongFanniPass123'
      });
      assert.equal(wrongPassword.status, 401);

      const PushToken = require('../models/PushToken');
      const expoToken = 'ExponentPushToken[sonaa-phase-two-test-token]';
      const registeredToken = await request(app).post('/api/notifications/fanni/push-token')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ token: expoToken, platform: 'android' });
      assert.equal(registeredToken.status, 200);
      const storedToken = await PushToken.findOne({ token: expoToken }).lean();
      assert.ok(storedToken);
      assert.equal(storedToken.recipientRole, 'fanni');

      const removedToken = await request(app).delete('/api/notifications/fanni/push-token')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ token: expoToken });
      assert.equal(removedToken.status, 200);
      assert.equal(removedToken.body.deleted, 1);
      assert.equal(await PushToken.countDocuments({ token: expoToken }), 0);

      const Fanni = require('../models/Fanni');
      const approvedFanni = await Fanni.findOne({ phone });
      approvedFanni.status = 'معتمد';
      approvedFanni.technicianGuidelinesAcceptedAt = new Date();
      approvedFanni.technicianGuidelinesVersion = '2026-10-20-v1';
      await approvedFanni.save();

      const defaultProfile = await request(app).get('/api/fanni/me').set('Authorization', 'Bearer ' + fanniToken);
      assert.equal(defaultProfile.status, 200);
      assert.equal(defaultProfile.body.acceptingOrders, true, 'existing technicians should default to accepting orders');

      const paused = await request(app).patch('/api/fanni/availability')
        .set('Authorization', 'Bearer ' + fanniToken).send({ acceptingOrders: false });
      assert.equal(paused.status, 200);
      assert.equal(paused.body.acceptingOrders, false);
      const persisted = await Fanni.findById(approvedFanni._id).lean();
      assert.equal(persisted.acceptingOrders, false, 'availability must persist in MongoDB');

      const hiddenOpportunities = await request(app).get('/api/orders/available')
        .set('Authorization', 'Bearer ' + fanniToken);
      assert.equal(hiddenOpportunities.status, 200);
      assert.equal(hiddenOpportunities.body.code, 'TECHNICIAN_NOT_ACCEPTING_ORDERS');
      assert.deepEqual(hiddenOpportunities.body.orders, []);

      const resumed = await request(app).patch('/api/fanni/availability')
        .set('Authorization', 'Bearer ' + fanniToken).send({ acceptingOrders: true });
      assert.equal(resumed.status, 200);
      assert.equal(resumed.body.acceptingOrders, true);
      approvedFanni.status = 'قيد المراجعة';
      approvedFanni.technicianGuidelinesAcceptedAt = null;
      approvedFanni.technicianGuidelinesVersion = '';
      await approvedFanni.save();
    });

    await test('wallet top-up requests remain pending and never credit balance before admin review', async () => {
      const Fanni = require('../models/Fanni');
      const TopupRequest = require('../models/TopupRequest');
      const jwt = require('jsonwebtoken');
      const fanni = await Fanni.findOne({ phone: '01012345681', role: 'fanni' });
      assert.ok(fanni, 'technician registration fixture must exist');
      const token = jwt.sign({
        id: String(fanni._id), role: 'fanni', tokenVersion: Number(fanni.tokenVersion || 0)
      }, process.env.JWT_SECRET, { expiresIn: '30d' });

      const pending = await request(app).post('/api/fanni/wallet/topup')
        .set('Authorization', 'Bearer ' + token)
        .send({ fromPhone: '01012345682', amount: 100, method: 'vodafone_cash' });
      assert.equal(pending.status, 403, 'pending technicians must not use the wallet');

      fanni.status = 'معتمد';
      await fanni.save();
      const beforeBalance = Number(fanni.walletBalance || 0);
      const invalidSender = await request(app).post('/api/fanni/wallet/topup')
        .set('Authorization', 'Bearer ' + token)
        .send({ fromPhone: 'not-a-phone', amount: 100, method: 'vodafone_cash' });
      assert.equal(invalidSender.status, 400);

      const submitted = await request(app).post('/api/fanni/wallet/topup')
        .set('Authorization', 'Bearer ' + token)
        .send({ fromPhone: '01012345682', amount: 100, method: 'vodafone_cash', reference: 'PHASE2-TEST', idempotencyKey: 'fanni-topup-test-key-001' });
      assert.equal(submitted.status, 201);
      assert.equal(submitted.body.request.status, 'قيد المراجعة');
      assert.equal(submitted.body.request.isCredited, undefined);
      assert.equal(submitted.body.walletBalance, beforeBalance);
      const duplicateTopup = await request(app).post('/api/fanni/wallet/topup')
        .set('Authorization', 'Bearer ' + token)
        .send({ fromPhone: '01012345682', amount: 100, method: 'vodafone_cash', reference: 'PHASE2-TEST', idempotencyKey: 'fanni-topup-test-key-001' });
      assert.equal(duplicateTopup.status, 200, JSON.stringify(duplicateTopup.body));
      assert.equal(duplicateTopup.body.duplicate, true);
      assert.equal(duplicateTopup.body.request.id, submitted.body.request.id, 'retries must reuse the original technician top-up request');


      const storedRequest = await TopupRequest.findById(submitted.body.request.id).lean();
      assert.ok(storedRequest);
      assert.equal(storedRequest.status, 'قيد المراجعة');
      assert.equal(storedRequest.isCredited, false);
      const afterFanni = await Fanni.findById(fanni._id).lean();
      assert.equal(afterFanni.walletBalance, beforeBalance, 'creating a top-up request must not change the wallet balance');

      const history = await request(app).get('/api/fanni/wallet/history')
        .set('Authorization', 'Bearer ' + token);
      assert.equal(history.status, 200);
      assert.ok(history.body.requests.some(item => item.id === String(storedRequest._id)));
    });

    await test('client wallet top-up requests remain pending until verified by admin', async () => {
      const Client = require('../models/Client');
      const ClientTopupRequest = require('../models/ClientTopupRequest');
      const client = await Client.findById(clientId);
      assert.ok(client);
      const beforeBalance = Number(client.walletBalance || 0);

      const wallet = await request(app).get('/api/client/wallet')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(wallet.status, 200);
      assert.equal(wallet.body.balance, beforeBalance);
      assert.deepEqual(wallet.body.transactions, []);

      const invalid = await request(app).post('/api/client/wallet/topup')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ fromPhone: 'not-a-phone', amount: 100, method: 'vodafone_cash' });
      assert.equal(invalid.status, 400);

      const submitted = await request(app).post('/api/client/wallet/topup')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ fromPhone: '01012345682', amount: 125, method: 'vodafone_cash', reference: 'CLIENT-WALLET-TEST', idempotencyKey: 'client-wallet-test-key-001' });
      assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
      assert.equal(submitted.body.request.status, 'قيد المراجعة');
      const duplicateSubmit = await request(app).post('/api/client/wallet/topup')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ fromPhone: '01012345682', amount: 125, method: 'vodafone_cash', reference: 'CLIENT-WALLET-TEST', idempotencyKey: 'client-wallet-test-key-001' });
      assert.equal(duplicateSubmit.status, 200);
      assert.equal(duplicateSubmit.body.request.id, submitted.body.request.id, 'retries with the same idempotency key must reuse the original request');
      const stored = await ClientTopupRequest.findById(submitted.body.request.id).lean();
      assert.ok(stored);
      assert.equal(stored.isCredited, false);
      assert.equal(stored.status, 'قيد المراجعة');
      const after = await Client.findById(clientId).lean();
      assert.equal(Number(after.walletBalance || 0), beforeBalance, 'a pending top-up must never change the client balance');

      const history = await request(app).get('/api/client/wallet')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(history.status, 200);
      assert.ok(history.body.topupRequests.some(item => item.id === String(stored._id)));
    });

    await test('client notifications support unread counts, single-read, read-all, and role isolation', async () => {
      const Notification = require('../models/Notification');
      const own = await Notification.create({
        recipientRole: 'client', recipientId: clientId, type: 'test', title: 'إشعار اختبار',
        message: 'رسالة اختبار', link: '/?tab=orders', readAt: null
      });
      await Notification.create({
        recipientRole: 'fanni', recipientId: clientId, type: 'test', title: 'إشعار فني',
        message: 'يجب ألا يظهر للعميل', link: '/fanni', readAt: null
      });
      const initial = await request(app).get('/api/notifications/client')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(initial.status, 200);
      assert.equal(initial.body.unreadCount, 1);
      assert.ok(initial.body.notifications.some(item => item.id === String(own._id)));
      assert.equal(initial.body.notifications.some(item => item.title === 'إشعار فني'), false);

      const readOne = await request(app).patch('/api/notifications/client/' + own._id + '/read')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(readOne.status, 200);
      const afterSingle = await request(app).get('/api/notifications/client')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(afterSingle.body.unreadCount, 0);

      await Notification.create([
        { recipientRole: 'client', recipientId: clientId, type: 'test', title: 'إشعار 2', message: 'رسالة 2' },
        { recipientRole: 'client', recipientId: clientId, type: 'test', title: 'إشعار 3', message: 'رسالة 3' }
      ]);
      const readAll = await request(app).patch('/api/notifications/client/read-all')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(readAll.status, 200);
      assert.equal(readAll.body.modified, 2);
      const afterAll = await request(app).get('/api/notifications/client')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(afterAll.body.unreadCount, 0);
    });

    await test('second client receives a distinct account', async () => {
      const r = await request(app).post('/api/client/register').send({
        name: 'عميل اختبار ثان', phone: '01012345679',
        password: 'TestPass456', confirmPassword: 'TestPass456'
      });
      assert.equal(r.status, 201);
      assert.notEqual(r.body.client.id, clientId);
      secondClientToken = r.body.token;
    });

    await test('client can change their own password only with the current password', async () => {
      const denied = await request(app).post('/api/password-recovery/change/client')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ currentPassword: 'WrongPass123', newPassword: 'NewPass12345', confirmPassword: 'NewPass12345' });
      assert.equal(denied.status, 400);
      const changed = await request(app).post('/api/password-recovery/change/client')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ currentPassword: 'TestPass123', newPassword: 'NewPass12345', confirmPassword: 'NewPass12345' });
      assert.equal(changed.status, 200);
      assert.ok(changed.body.token);
      const oldSession = await request(app).get('/api/client/me').set('Authorization', 'Bearer ' + clientToken);
      assert.equal(oldSession.status, 401, 'changing a password must revoke the previous client session');
      const returnedSession = await request(app).get('/api/client/me').set('Authorization', 'Bearer ' + changed.body.token);
      assert.equal(returnedSession.status, 200, 'the active device receives a replacement session');
      const login = await request(app).post('/api/client/login').send({ phone: '01012345678', password: 'NewPass12345' });
      assert.equal(login.status, 200);
      clientToken = login.body.token;
    });

    await test('support-managed recovery issues a one-time code and resets the client password', async () => {
      const bcrypt = require('bcryptjs');
      const jwt = require('jsonwebtoken');
      const Fanni = require('../models/Fanni');
      const admin = await Fanni.create({
        name: 'مدير الاختبار', phone: '01012345678', passwordHash: await bcrypt.hash('AdminTestPass123', 12),
        specialties: ['إدارة'], areas: ['الإدارة'], status: 'معتمد', role: 'admin'
      });
      adminToken = jwt.sign({ id: String(admin._id), role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      await test('admin imports store products from CSV in one validated batch and skips duplicates', async () => {
        const StoreProduct = require('../models/StoreProduct');
        const rows = [
          { rowNumber: 2, product: { name: 'CSV import unique product A', category: 'CSV import category', price: 125 } },
          { rowNumber: 3, product: { name: 'CSV import unique product B', category: 'CSV import category', price: 0 } },
          { rowNumber: 4, product: { name: 'CSV import unique product A', category: 'CSV import category', price: 125 } },
          { rowNumber: 5, product: { name: 'CSV row missing price', category: 'CSV import category' } }
        ];
        const denied = await request(app).post('/api/admin/store/products/import').send({ products: rows });
        assert.equal(denied.status, 401, 'bulk import must require an administrator session');

        const imported = await request(app).post('/api/admin/store/products/import')
          .set('Authorization', 'Bearer ' + adminToken).send({ products: rows });
        assert.equal(imported.status, 201, JSON.stringify(imported.body));
        assert.equal(imported.body.importedCount, 2);
        assert.equal(imported.body.duplicateCount, 1);
        assert.equal(imported.body.errorCount, 1);
        assert.equal(await StoreProduct.countDocuments({ category: 'CSV import category' }), 2);

        const repeated = await request(app).post('/api/admin/store/products/import')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ products: [{ rowNumber: 2, product: { name: 'CSV import unique product A', category: 'CSV import category', price: 125 } }] });
        assert.equal(repeated.status, 200, JSON.stringify(repeated.body));
        assert.equal(repeated.body.importedCount, 0);
        assert.equal(repeated.body.duplicateCount, 1);
      });

      await test('store product images are uploaded to MongoDB GridFS and served through the API', async () => {
        const StoreProduct = require('../models/StoreProduct');
        const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
        const denied = await request(app).post('/api/admin/store/media')
          .set('Content-Type', 'image/png').send(pngSignature);
        assert.equal(denied.status, 401, 'media upload must require an administrator session');

        const uploaded = await request(app).post('/api/admin/store/media')
          .set('Authorization', 'Bearer ' + adminToken)
          .set('Content-Type', 'image/png').send(pngSignature);
        assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
        assert.match(uploaded.body.imageFileId, /^[a-f0-9]{24}$/i);
        assert.equal(uploaded.body.imageUrl, '/api/store/media/' + uploaded.body.imageFileId);

        const mismatched = await request(app).post('/api/admin/store/products')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ name: 'منتج صورة غير صالحة', price: 1, imageUrl: uploaded.body.imageUrl, imageFileId: '000000000000000000000000' });
        assert.equal(mismatched.status, 400, 'product records must not point at an unrelated GridFS file');

        const product = await request(app).post('/api/admin/store/products')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ name: 'منتج اختبار صورة MongoDB', category: 'أجهزة الاستقبال', price: 1, imageUrl: uploaded.body.imageUrl, imageFileId: uploaded.body.imageFileId });
        assert.equal(product.status, 201, JSON.stringify(product.body));
        assert.equal(product.body.product.category, 'أجهزة الاستقبال', 'admin product creation must persist its selected store category');
        const publicCatalog = await request(app).get('/api/store/products');
        assert.equal(publicCatalog.status, 200, JSON.stringify(publicCatalog.body));
        const publicProduct = publicCatalog.body.products.find(item => String(item._id) === String(product.body.product._id));
        assert.equal(publicProduct?.category, 'أجهزة الاستقبال', 'the public catalog must expose product categories to browser and mobile clients');
        const fallbackCategory = publicCatalog.body.categories.find(item => item.name === 'أجهزة الاستقبال');
        assert.equal(fallbackCategory?.imageUrl, uploaded.body.imageUrl, 'without a custom category image, the category card must use a product image');
        assert.equal(fallbackCategory?.hasCustomImage, false);

        const deniedCategoryEdit = await request(app).put('/api/admin/store/categories/' + encodeURIComponent('أجهزة الاستقبال')).send({ name: 'قسم غير مصرح', imageUrl: '', imageFileId: null });
        assert.equal(deniedCategoryEdit.status, 401, 'category edits must require administrator authentication');
        // Legacy product rows can contain irregular whitespace although the admin displays a normalized category name.
        const legacyWhitespaceProduct = await StoreProduct.create({ name: 'منتج قسم بمسافات قديمة', category: '  أجهزة   الاستقبال  ', price: 2 });
        const categoryImage = await request(app).post('/api/admin/store/media?purpose=category')
          .set('Authorization', 'Bearer ' + adminToken)
          .set('Content-Type', 'image/png').send(pngSignature);
        assert.equal(categoryImage.status, 201, JSON.stringify(categoryImage.body));
        const renamedCategory = await request(app).put('/api/admin/store/categories/' + encodeURIComponent('أجهزة الاستقبال'))
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ name: 'أجهزة الاستقبال الرقمية', imageUrl: categoryImage.body.imageUrl, imageFileId: categoryImage.body.imageFileId });
        assert.equal(renamedCategory.status, 200, JSON.stringify(renamedCategory.body));
        assert.equal((await StoreProduct.findById(product.body.product._id).lean()).category, 'أجهزة الاستقبال الرقمية', 'renaming a category must update the products without deleting them');
        assert.equal((await StoreProduct.findById(legacyWhitespaceProduct._id).lean()).category, 'أجهزة الاستقبال الرقمية', 'renaming must also find legacy category values with extra whitespace');
        const renamedCatalog = await request(app).get('/api/store/products');
        const renamedCategoryCard = renamedCatalog.body.categories.find(item => item.name === 'أجهزة الاستقبال الرقمية');
        assert.equal(renamedCategoryCard?.imageUrl, categoryImage.body.imageUrl, 'the custom category image must be exposed to both app and browser clients');
        assert.equal(renamedCategoryCard?.hasCustomImage, true);
        const servedCategoryImage = await request(app).get(categoryImage.body.imageUrl);
        assert.equal(servedCategoryImage.status, 200, 'custom category images must be served even though they are not product images');
        const adminCatalog = await request(app).get('/api/admin/store/products').set('Authorization', 'Bearer ' + adminToken);
        assert.equal(adminCatalog.status, 200);
        assert.ok(adminCatalog.body.categories.some(item => item.name === 'أجهزة الاستقبال الرقمية'));

        const deletedCategory = await request(app).delete('/api/admin/store/categories/' + encodeURIComponent('أجهزة الاستقبال الرقمية'))
          .set('Authorization', 'Bearer ' + adminToken);
        assert.equal(deletedCategory.status, 200, JSON.stringify(deletedCategory.body));
        assert.equal(deletedCategory.body.movedProducts, 2, 'deleting a populated category must safely move all normalized products to the default category');
        assert.equal((await StoreProduct.findById(product.body.product._id).lean()).category, 'عام');
        assert.equal((await StoreProduct.findById(legacyWhitespaceProduct._id).lean()).category, 'عام', 'all products in the renamed category must remain safe when the category is deleted');
        assert.equal((await request(app).get(categoryImage.body.imageUrl)).status, 404, 'deleted category artwork must no longer be publicly served');
        const image = await request(app).get(uploaded.body.imageUrl);
        assert.equal(image.status, 200);
        assert.equal(image.headers['content-type'], 'image/png');
        assert.equal(Number(image.headers['content-length']), pngSignature.length);
        const Fanni = require('../models/Fanni');
        const registeredFanni = await Fanni.findOne({ phone: '01012345681', role: 'fanni' });
        assert.ok(registeredFanni, 'technician registration fixture must exist before private image access is tested');
        const privateIdentity = await request(app).get('/api/fanni/admin/' + registeredFanni._id + '/identity/front').set('Authorization', 'Bearer ' + adminToken);
        assert.equal(privateIdentity.status, 200, 'administrator can review the uploaded front image');
        assert.equal(privateIdentity.headers['content-type'], 'image/png');
        const deniedIdentity = await request(app).get('/api/fanni/admin/' + registeredFanni._id + '/identity/back');
        assert.equal(deniedIdentity.status, 401, 'identity images require administrator authentication');

        const invalid = await request(app).post('/api/admin/store/media')
          .set('Authorization', 'Bearer ' + adminToken)
          .set('Content-Type', 'image/png').send(Buffer.from('not-an-image'));
        assert.equal(invalid.status, 400);
      });


      await test('admin approves a client top-up once and writes a client wallet ledger entry', async () => {
        const Client = require('../models/Client');
        const ClientTopupRequest = require('../models/ClientTopupRequest');
        const WalletTransaction = require('../models/WalletTransaction');
        const pending = await ClientTopupRequest.findOne({ client: clientId, status: 'قيد المراجعة', isCredited: false });
        assert.ok(pending, 'client top-up fixture must be pending');
        const before = await Client.findById(clientId).lean();
        const beforeBalance = Number(before.walletBalance || 0);

        const accounts = await request(app).get('/api/admin/client-wallet/accounts')
          .set('Authorization', 'Bearer ' + adminToken);
        assert.equal(accounts.status, 200, JSON.stringify(accounts.body));
        assert.ok(accounts.body.accounts.some(item => String(item._id) === String(clientId)));
        assert.ok(accounts.body.accounts.every(item => item.name && item.phone && item.walletBalance !== undefined));

        const queue = await request(app).get('/api/admin/client-wallet/topup-requests')
          .set('Authorization', 'Bearer ' + adminToken);
        assert.equal(queue.status, 200);
        assert.ok(queue.body.requests.some(item => String(item._id) === String(pending._id)));

        const approved = await request(app).post('/api/admin/client-wallet/topup-requests/' + pending._id + '/approve')
          .set('Authorization', 'Bearer ' + adminToken).send({});
        assert.equal(approved.status, 200, JSON.stringify(approved.body));
        assert.equal(approved.body.balance, beforeBalance + Number(pending.amount));

        const after = await Client.findById(clientId).lean();
        assert.equal(Number(after.walletBalance), beforeBalance + Number(pending.amount));
        const ledger = await WalletTransaction.findOne({ client: clientId, type: 'client_topup', idempotencyKey: 'client-topup:' + String(pending._id) }).lean();
        assert.ok(ledger);
        assert.equal(Number(ledger.amount), Number(pending.amount));
        assert.equal(Number(ledger.balanceAfter), Number(after.walletBalance));

        const duplicate = await request(app).post('/api/admin/client-wallet/topup-requests/' + pending._id + '/approve')
          .set('Authorization', 'Bearer ' + adminToken).send({});
        assert.equal(duplicate.status, 409, 'a second approval must not credit the same request twice');
        const finalClient = await Client.findById(clientId).lean();
        assert.equal(Number(finalClient.walletBalance), Number(after.walletBalance));
        assert.equal(await WalletTransaction.countDocuments({ client: clientId, idempotencyKey: 'client-topup:' + String(pending._id) }), 1);
      });



      await test('admin credit endpoint records the adjustment and rejects the same operation key twice', async () => {
        const Client = require('../models/Client');
        const WalletTransaction = require('../models/WalletTransaction');
        await Client.updateOne({ _id: clientId }, { $set: { walletBalance: 100 } });
        const payload = { amount: 50, reason: 'إضافة اختبار موثقة', idempotencyKey: 'wallet-credit-test-unique-key' };
        const credit = await request(app).post('/api/admin/clients/' + clientId + '/wallet/add-balance')
          .set('Authorization', 'Bearer ' + adminToken).send(payload);
        assert.equal(credit.status, 200, JSON.stringify(credit.body));
        assert.equal(Number(credit.body.balance), 150);
        assert.match(credit.body.transactionNumber, /^HZW-[0-9A-F]{24}$/);
        const creditLedger = await WalletTransaction.findOne({ client: clientId, idempotencyKey: 'client-admin-credit:' + String(clientId) + ':wallet-credit-test-unique-key' }).lean();
        assert.equal(creditLedger.transactionNumber, credit.body.transactionNumber);
        const repeated = await request(app).post('/api/admin/clients/' + clientId + '/wallet/add-balance')
          .set('Authorization', 'Bearer ' + adminToken).send(payload);
        assert.equal(repeated.status, 409);
        assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), 150);
        assert.equal(await WalletTransaction.countDocuments({ client: clientId, idempotencyKey: 'client-admin-credit:' + String(clientId) + ':wallet-credit-test-unique-key' }), 1);
      });

      await test('admin can deduct client wallet without allowing a negative balance and settle the exact final balance', async () => {
        const Client = require('../models/Client');
        const WalletTransaction = require('../models/WalletTransaction');
        await Client.updateOne({ _id: clientId }, { $set: { walletBalance: 500 } });
        const debit = await request(app).post('/api/admin/clients/' + clientId + '/wallet/deduct-balance')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ amount: 150, reason: 'خصم اختبار موثق', idempotencyKey: 'wallet-debit-test-unique-key' });
        assert.equal(debit.status, 200, JSON.stringify(debit.body));
        assert.equal(Number(debit.body.balance), 350);
        const debitLedger = await WalletTransaction.findOne({ client: clientId, type: 'client_admin_deduction' }).sort({ createdAt: -1 }).lean();
        assert.ok(debitLedger);
        assert.equal(Number(debitLedger.amount), -150);
        assert.equal(Number(debitLedger.balanceBefore), 500);
        assert.equal(Number(debitLedger.balanceAfter), 350);
        assert.match(debit.body.transactionNumber, /^HZW-[0-9A-F]{24}$/);
        assert.equal(debit.body.transactionNumber, debitLedger.transactionNumber);
        const repeatedDebit = await request(app).post('/api/admin/clients/' + clientId + '/wallet/deduct-balance')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ amount: 150, reason: 'خصم اختبار موثق', idempotencyKey: 'wallet-debit-test-unique-key' });
        assert.equal(repeatedDebit.status, 409, 'retrying the same operation key must not debit twice');
        assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), 350);


        const excessiveDebit = await request(app).post('/api/admin/clients/' + clientId + '/wallet/deduct-balance')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ amount: 351, reason: 'اختبار منع الرصيد السالب', idempotencyKey: 'wallet-debit-insufficient-test-key' });
        assert.equal(excessiveDebit.status, 409);
        assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), 350);

        const settlement = await request(app).post('/api/admin/clients/' + clientId + '/wallet/set-balance')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ balance: 200, reason: 'تسوية اختبار موثقة', idempotencyKey: 'wallet-settlement-test-unique-key' });
        assert.equal(settlement.status, 200, JSON.stringify(settlement.body));
        assert.equal(Number(settlement.body.balance), 200);
        assert.equal(Number(settlement.body.delta), -150);
        const settlementLedger = await WalletTransaction.findOne({ client: clientId, type: 'client_admin_settlement' }).sort({ createdAt: -1 }).lean();
        assert.ok(settlementLedger);
        assert.equal(Number(settlementLedger.amount), -150);
        assert.equal(Number(settlementLedger.balanceBefore), 350);
        assert.equal(Number(settlementLedger.balanceAfter), 200);
        assert.match(settlement.body.transactionNumber, /^HZW-[0-9A-F]{24}$/);
        assert.equal(settlement.body.transactionNumber, settlementLedger.transactionNumber);

        const invalidNegativeSettlement = await request(app).post('/api/admin/clients/' + clientId + '/wallet/set-balance')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ balance: -1, reason: 'اختبار رفض الرصيد السالب' });
        assert.equal(invalidNegativeSettlement.status, 400);
        assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), 200);
      });

      await test('admin refunds held service payment to client wallet exactly once', async () => {
        const Client = require('../models/Client');
        const Order = require('../models/Order');
        const WalletTransaction = require('../models/WalletTransaction');
        const client = await Client.findByIdAndUpdate(clientId, { $set: { walletBalance: 10 } }, { new: true });
        const order = await Order.create({
          sn: 'SN998877', clientAccount: clientId, service: 'اختبار استرداد', area: 'المعادي',
          clientName: client.name, clientPhone: client.phone, status: 'تم اختيار فني',
          assignedFanni: admin._id, assignedFanniName: admin.name, acceptedOfferPrice: 250,
          clientPaymentStatus: 'held', clientPaymentAmount: 250, clientPaymentAt: new Date()
        });
        const refund = await request(app).post('/api/admin/client-wallet/orders/' + order.sn + '/refund')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ reason: 'إلغاء الخدمة بناءً على مراجعة الإدارة' });
        assert.equal(refund.status, 200, JSON.stringify(refund.body));
        assert.equal(refund.body.amount, 250);
        assert.equal(refund.body.balance, 260);
        const refundedOrder = await Order.findById(order._id).lean();
        assert.equal(refundedOrder.status, 'ملغي');
        assert.equal(refundedOrder.clientPaymentStatus, 'refunded');
        const ledger = await WalletTransaction.findOne({ order: order._id, type: 'client_refund' }).lean();
        assert.ok(ledger);
        assert.equal(ledger.amount, 250);
        assert.equal(ledger.balanceAfter, 260);
        const duplicate = await request(app).post('/api/admin/client-wallet/orders/' + order.sn + '/refund')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ reason: 'محاولة استرداد مكرر' });
        assert.equal(duplicate.status, 409);
        assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), 260);
        assert.equal(await WalletTransaction.countDocuments({ order: order._id, type: 'client_refund' }), 1);
      });

      const adminPasswordChange = await request(app).post('/api/password-recovery/change/admin')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ currentPassword: 'AdminTestPass123', newPassword: 'AdminChangedPass123', confirmPassword: 'AdminChangedPass123' });
      assert.equal(adminPasswordChange.status, 200);
      assert.ok(adminPasswordChange.body.token);
      const oldAdminSession = await request(app).get('/api/admin/me').set('Authorization', 'Bearer ' + adminToken);
      assert.equal(oldAdminSession.status, 401);
      adminToken = adminPasswordChange.body.token;

      const browserLogin = await request(app).post('/api/admin/login')
        .send({ phone: '01012345678', password: 'AdminChangedPass123' });
      assert.equal(browserLogin.status, 200);
      const browserClaims = jwt.decode(browserLogin.body.token);
      assert.equal(browserClaims.client, undefined, 'browser token must not carry the CON client marker');
      assert.equal(browserClaims.exp - browserClaims.iat, 24 * 60 * 60, 'browser session remains at 24 hours');

      const conLogin = await request(app).post('/api/admin/con-login')
        .send({ phone: '01012345678', password: 'AdminChangedPass123' });
      assert.equal(conLogin.status, 200, 'CON login must accept the same active admin account');
      const conClaims = jwt.decode(conLogin.body.token);
      assert.equal(conClaims.client, 'sonaa-con');
      assert.equal(conClaims.aud, 'sonaa-con');
      assert.equal(conClaims.scope, 'admin');
      assert.equal(conClaims.exp - conClaims.iat, 30 * 24 * 60 * 60, 'CON session must last 30 days');

      const conMe = await request(app).get('/api/admin/me')
        .set('Authorization', 'Bearer ' + conLogin.body.token);
      assert.equal(conMe.status, 200, 'CON session must access admin APIs');
      const conPanel = await request(app).get('/api/admin/mobile-panel')
        .set('Authorization', 'Bearer ' + conLogin.body.token);
      assert.equal(conPanel.status, 200);
      assert.ok(conPanel.text.includes('window.__SONAA_CON_APP__ = true'));

      const conPushToken = await request(app).post('/api/notifications/admin/push-token')
        .set('Authorization', 'Bearer ' + conLogin.body.token)
        .send({ token: 'ExponentPushToken[sonaa-con-session-test]', platform: 'android' });
      assert.equal(conPushToken.status, 200, 'CON session must register native admin push tokens');

      const conCrossRole = await request(app).get('/api/fanni/me')
        .set('Authorization', 'Bearer ' + conLogin.body.token);
      assert.equal(conCrossRole.status, 401, 'CON token must not authenticate non-admin routes');

      const malformedConToken = jwt.sign({
        id: String(admin._id), role: 'admin', client: 'sonaa-con', scope: 'admin'
      }, process.env.JWT_SECRET, { expiresIn: '30d', audience: 'wrong-audience' });
      const rejectedConToken = await request(app).get('/api/admin/me')
        .set('Authorization', 'Bearer ' + malformedConToken);
      assert.equal(rejectedConToken.status, 401, 'CON marker with wrong audience must be rejected');

      const areaCountBeforeLegacyTechnician = await request(app).get('/api/areas');
      assert.equal(areaCountBeforeLegacyTechnician.status, 200);
      const previousMaadiCount = areaCountBeforeLegacyTechnician.body.technicianCountByArea?.['المعادي'] || 0;
      const fanni = await Fanni.create({
        name: 'فني اختبار', phone: '01012345680', passwordHash: await bcrypt.hash('FanniOldPass123', 12),
        specialties: ['خدمة تاريخية غير منشورة للاختبار'], areas: ['المعادي'], status: 'معتمد', role: 'fanni'
      });
      const legacyOnlyAreas = await request(app).get('/api/areas');
      assert.equal(legacyOnlyAreas.status, 200);
      assert.equal(legacyOnlyAreas.body.technicianCountByArea?.['المعادي'] || 0, previousMaadiCount,
        'approved technicians with only historical services must not increase the available technician count');
      await test('admin technician wallet deduction is atomic, audited, and visible in transaction history', async () => {
        const WalletTransaction = require('../models/WalletTransaction');
        await Fanni.updateOne({ _id: fanni._id }, { $set: { walletBalance: 300 } });
        const debitPayload = { amount: 75, reason: 'اختبار خصم إداري موثق', idempotencyKey: 'fanni-admin-debit-repeat-key-01' };
        const deduction = await request(app).post('/api/admin/fannis/' + fanni._id + '/deduct-balance')
          .set('Authorization', 'Bearer ' + adminToken).send(debitPayload);
        assert.equal(deduction.status, 200, JSON.stringify(deduction.body));
        assert.equal(deduction.body.balance, 225);
        const repeatedDeduction = await request(app).post('/api/admin/fannis/' + fanni._id + '/deduct-balance')
          .set('Authorization', 'Bearer ' + adminToken).send(debitPayload);
        assert.equal(repeatedDeduction.status, 200, JSON.stringify(repeatedDeduction.body));
        assert.equal(repeatedDeduction.body.duplicate, true);
        assert.equal((await Fanni.findById(fanni._id).lean()).walletBalance, 225, 'retrying the same technician debit must not debit twice');
        const persisted = await Fanni.findById(fanni._id).lean();
        assert.ok(persisted.decisions.some(item => item.action === 'خصم إداري' && String(item.reason || '').includes('اختبار خصم إداري موثق')));
        const ledger = await WalletTransaction.findOne({ fanni: fanni._id, idempotencyKey: 'admin-fanni-debit:' + String(fanni._id) + ':' + debitPayload.idempotencyKey }).lean();
        assert.ok(ledger);
        assert.equal(ledger.balanceBefore, 300);
        assert.equal(ledger.balanceAfter, 225);
        assert.match(deduction.body.transactionNumber, /^HZW-[0-9A-F]{24}$/);
        assert.equal(deduction.body.transactionNumber, ledger.transactionNumber);
        assert.equal(repeatedDeduction.body.transactionNumber, ledger.transactionNumber);

        const insufficient = await request(app).post('/api/admin/fannis/' + fanni._id + '/deduct-balance')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({ amount: 226, reason: 'اختبار منع الرصيد غير الكافي', idempotencyKey: 'fanni-admin-insufficient-key-01' });
        assert.equal(insufficient.status, 409);
        assert.equal((await Fanni.findById(fanni._id).lean()).walletBalance, 225, 'insufficient balance must not change the wallet');

        const creditPayload = { amount: 40, reason: 'اختبار إضافة إدارية موثقة', idempotencyKey: 'fanni-admin-credit-repeat-key-01' };
        const credit = await request(app).post('/api/admin/fannis/' + fanni._id + '/add-balance')
          .set('Authorization', 'Bearer ' + adminToken).send(creditPayload);
        assert.equal(credit.status, 200, JSON.stringify(credit.body));
        assert.equal(credit.body.balance, 265);
        const creditLedger = await WalletTransaction.findOne({ fanni: fanni._id, idempotencyKey: 'admin-fanni-credit:' + String(fanni._id) + ':' + creditPayload.idempotencyKey }).lean();
        assert.ok(creditLedger);
        assert.equal(credit.body.transactionNumber, creditLedger.transactionNumber);
        const repeatedCredit = await request(app).post('/api/admin/fannis/' + fanni._id + '/add-balance')
          .set('Authorization', 'Bearer ' + adminToken).send(creditPayload);
        assert.equal(repeatedCredit.status, 200, JSON.stringify(repeatedCredit.body));
        assert.equal(repeatedCredit.body.duplicate, true);
        assert.equal((await Fanni.findById(fanni._id).lean()).walletBalance, 265, 'retrying the same technician credit must not credit twice');

        const settlementPayload = { amount: 200, reason: 'اختبار تسوية إدارية موثقة', idempotencyKey: 'fanni-admin-set-repeat-key-01' };
        const settlement = await request(app).post('/api/admin/fannis/' + fanni._id + '/set-balance')
          .set('Authorization', 'Bearer ' + adminToken).send(settlementPayload);
        assert.equal(settlement.status, 200, JSON.stringify(settlement.body));
        assert.equal(settlement.body.balance, 200);
        const settlementLedger = await WalletTransaction.findOne({ fanni: fanni._id, idempotencyKey: 'admin-fanni-set:' + String(fanni._id) + ':' + settlementPayload.idempotencyKey }).lean();
        assert.ok(settlementLedger);
        assert.equal(settlement.body.transactionNumber, settlementLedger.transactionNumber);
        const repeatedSettlement = await request(app).post('/api/admin/fannis/' + fanni._id + '/set-balance')
          .set('Authorization', 'Bearer ' + adminToken).send(settlementPayload);
        assert.equal(repeatedSettlement.status, 200, JSON.stringify(repeatedSettlement.body));
        assert.equal(repeatedSettlement.body.duplicate, true);
        assert.equal((await Fanni.findById(fanni._id).lean()).walletBalance, 200, 'retrying the same technician settlement must not repeat it');

        const history = await request(app).get('/api/admin/wallet/transactions/' + fanni._id)
          .set('Authorization', 'Bearer ' + adminToken);
        assert.equal(history.status, 200, JSON.stringify(history.body));
        assert.ok(history.body.transactions.some(item => String(item._id) === String(ledger._id)), 'technician ledger endpoint must return the new deduction');
      });

      const oldFanniToken = jwt.sign({ id: String(fanni._id), role: 'fanni' }, process.env.JWT_SECRET, { expiresIn: '30d' });
      const fanniPasswordReset = await request(app).patch('/api/admin/fannis/' + fanni._id + '/password')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ newPassword: 'FanniNewPass123', confirmPassword: 'FanniNewPass123' });
      assert.equal(fanniPasswordReset.status, 200);
      const revokedFanniSession = await request(app).get('/api/fanni/me').set('Authorization', 'Bearer ' + oldFanniToken);
      assert.equal(revokedFanniSession.status, 401);
      const fanniNewLogin = await request(app).post('/api/fanni/login').send({ phone: '01012345680', password: 'FanniNewPass123' });
      assert.equal(fanniNewLogin.status, 200);
      assert.deepEqual(fanniNewLogin.body.user.specialties, [], 'login payload must not expose retired specialties');
      const activeFanniSession = await request(app).get('/api/fanni/me').set('Authorization', 'Bearer ' + fanniNewLogin.body.token);
      assert.equal(activeFanniSession.status, 200);
      assert.deepEqual(activeFanniSession.body.specialties, [], 'historical specialties stay in storage but are hidden from the technician self-service payload');
      const adminFanniProfile = await request(app).get('/api/admin/fannis/' + fanni._id + '/profile').set('Authorization', 'Bearer ' + adminToken);
      assert.equal(adminFanniProfile.status, 200);
      assert.deepEqual(adminFanniProfile.body.fanni.specialties, [], 'admin profile editor must receive only active services');
      assert.deepEqual((await Fanni.findById(fanni._id).lean()).specialties, ['خدمة تاريخية غير منشورة للاختبار'], 'historical specialties must remain preserved in the database');

      await test('admin technician trust and visibility controls save their decision history', async () => {
        const response = await request(app).patch('/api/admin/fannis/' + fanni._id + '/profile-controls')
          .set('Authorization', 'Bearer ' + adminToken)
          .send({
            trustScore: 77,
            isVerified: true,
            isFeatured: true,
            featuredUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
        assert.equal(response.status, 200, JSON.stringify(response.body));
        const Fanni = require('../models/Fanni');
        const persisted = await Fanni.findById(fanni._id).lean();
        assert.equal(persisted.trustScore, 77);
        assert.equal(persisted.isVerified, true);
        assert.equal(persisted.isFeatured, true);
        assert.ok(persisted.decisions.some(item => item.action === 'تعديل الثقة والظهور'));
      });

      await test('technician profile edit request persists and appears in the admin review queue', async () => {
        const edit = await request(app).patch('/api/fanni/me')
          .set('Authorization', 'Bearer ' + fanniNewLogin.body.token)
          .send({ phone: '01012345680', specialties: ['صيانة دش'], areas: ['مدينة نصر'] });
        assert.equal(edit.status, 200, JSON.stringify(edit.body));
        assert.ok(edit.body.pendingProfileChange?.requestedAt);
        const Fanni = require('../models/Fanni');
        const persisted = await Fanni.findById(fanni._id).lean();
        assert.equal(persisted.pendingProfileChange.phone, '01012345680');
        assert.deepEqual(persisted.pendingProfileChange.areas, ['مدينة نصر']);
        assert.deepEqual(persisted.pendingProfileChange.specialties, ['خدمة تاريخية غير منشورة للاختبار', 'صيانة دش'], 'legacy specialties must remain stored while the new service is requested');
        const queue = await request(app).get('/api/admin/fanni-profile-edits')
          .set('Authorization', 'Bearer ' + adminToken);
        assert.equal(queue.status, 200, JSON.stringify(queue.body));
        assert.ok(queue.body.requests.some(item => String(item._id) === String(fanni._id)));
      });

      const issuedFanniSupport = await request(app).post('/api/password-recovery/admin/support-passwords')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ role: 'fanni', accountId: String(fanni._id) });
      assert.equal(issuedFanniSupport.status, 201);
      assert.ok(issuedFanniSupport.body.supportPassword);
      const fanniSupportLogin = await request(app).post('/api/fanni/login')
        .send({ phone: '01012345680', password: issuedFanniSupport.body.supportPassword });
      assert.equal(fanniSupportLogin.status, 200);
      assert.equal(fanniSupportLogin.body.mustChangePassword, true);
      const blockedFanniSession = await request(app).get('/api/fanni/me')
        .set('Authorization', 'Bearer ' + fanniSupportLogin.body.token);
      assert.equal(blockedFanniSession.status, 403);
      const changedFanniSupportPassword = await request(app).post('/api/password-recovery/change/fanni')
        .set('Authorization', 'Bearer ' + fanniSupportLogin.body.token)
        .send({ newPassword: 'FanniAfterSupport123', confirmPassword: 'FanniAfterSupport123' });
      assert.equal(changedFanniSupportPassword.status, 200);
      const reusedFanniSupport = await request(app).post('/api/fanni/login')
        .send({ phone: '01012345680', password: issuedFanniSupport.body.supportPassword });
      assert.equal(reusedFanniSupport.status, 401);
      const activeFanniAfterSupport = await request(app).get('/api/fanni/me')
        .set('Authorization', 'Bearer ' + changedFanniSupportPassword.body.token);
      assert.equal(activeFanniAfterSupport.status, 200);

      const oldClientSessionBeforeAdminReset = clientToken;
      const clientAdminReset = await request(app).patch('/api/admin/clients/01012345678/password')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ newPassword: 'AdminResetPass123', confirmPassword: 'AdminResetPass123' });
      assert.equal(clientAdminReset.status, 200);
      const clientSessionAfterAdminReset = await request(app).get('/api/client/me').set('Authorization', 'Bearer ' + oldClientSessionBeforeAdminReset);
      assert.equal(clientSessionAfterAdminReset.status, 401);
      const clientLoginAfterAdminReset = await request(app).post('/api/client/login').send({ phone: '01012345678', password: 'AdminResetPass123' });
      assert.equal(clientLoginAfterAdminReset.status, 200);
      clientToken = clientLoginAfterAdminReset.body.token;

      const issuedClientSupport = await request(app).post('/api/password-recovery/admin/support-passwords')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ role: 'client', accountId: String(clientId) });
      assert.equal(issuedClientSupport.status, 201);
      assert.ok(issuedClientSupport.body.supportPassword);
      const issuedAdminAsFanni = await request(app).post('/api/password-recovery/admin/support-passwords')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ role: 'fanni', accountId: String(admin._id) });
      assert.equal(issuedAdminAsFanni.status, 404, 'admin accounts must never receive technician support passwords');
      const reissuedClientSupport = await request(app).post('/api/password-recovery/admin/support-passwords')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ role: 'client', accountId: String(clientId) });
      assert.equal(reissuedClientSupport.status, 201);
      const staleSupportLogin = await request(app).post('/api/client/login')
        .send({ phone: '01012345678', password: issuedClientSupport.body.supportPassword });
      assert.equal(staleSupportLogin.status, 401, 'issuing a replacement must revoke the previous unused password');
      const revealedClientSupport = await request(app).get('/api/password-recovery/admin/support-passwords?role=client&accountId=' + clientId)
        .set('Authorization', 'Bearer ' + adminToken);
      assert.equal(revealedClientSupport.status, 200);
      const revealedSecret = await request(app).get('/api/password-recovery/admin/support-passwords/' + revealedClientSupport.body.id + '/reveal')
        .set('Authorization', 'Bearer ' + adminToken);
      assert.equal(revealedSecret.status, 200);
      assert.equal(revealedSecret.body.supportPassword, reissuedClientSupport.body.supportPassword);
      const clientSupportLogin = await request(app).post('/api/client/login')
        .send({ phone: '01012345678', password: reissuedClientSupport.body.supportPassword });
      assert.equal(clientSupportLogin.status, 200);
      assert.equal(clientSupportLogin.body.mustChangePassword, true);
      const blockedClientSession = await request(app).get('/api/client/me')
        .set('Authorization', 'Bearer ' + clientSupportLogin.body.token);
      assert.equal(blockedClientSession.status, 403);
      const changedClientSupportPassword = await request(app).post('/api/password-recovery/change/client')
        .set('Authorization', 'Bearer ' + clientSupportLogin.body.token)
        .send({ newPassword: 'ClientAfterSupport123', confirmPassword: 'ClientAfterSupport123' });
      assert.equal(changedClientSupportPassword.status, 200);
      const reusedClientSupport = await request(app).post('/api/client/login')
        .send({ phone: '01012345678', password: issuedClientSupport.body.supportPassword });
      assert.equal(reusedClientSupport.status, 401);
      const activeClientAfterSupport = await request(app).get('/api/client/me')
        .set('Authorization', 'Bearer ' + changedClientSupportPassword.body.token);
      assert.equal(activeClientAfterSupport.status, 200);
      clientToken = changedClientSupportPassword.body.token;

      const opened = await request(app).post('/api/password-recovery/request')
        .send({ role: 'client', phone: '01012345678' });
      assert.equal(opened.status, 201);
      assert.ok(opened.body.recoveryToken);
      assert.ok(opened.body.requestId);

      const duplicateRequest = await request(app).post('/api/password-recovery/request')
        .send({ role: 'client', phone: '01012345678' });
      assert.equal(duplicateRequest.status, 409);
      assert.equal(duplicateRequest.body.recoveryToken, undefined, 'a phone-number-only retry must never reveal the existing ticket bearer token');

      const queue = await request(app).get('/api/password-recovery/admin/requests')
        .set('Authorization', 'Bearer ' + adminToken);
      assert.equal(queue.status, 200);
      const item = queue.body.recoveries.find(x => x.id === opened.body.requestId);
      assert.ok(item);

      const adminQuestion = await request(app).post('/api/password-recovery/admin/requests/' + opened.body.requestId + '/reply')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ text: 'من فضلك اذكر تفاصيل تساعدنا على التحقق من ملكية الحساب.' });
      assert.equal(adminQuestion.status, 200);
      assert.equal(adminQuestion.body.recovery.status, 'بانتظار رد المستخدم');
      assert.ok(adminQuestion.body.recovery.messages.some(m => m.text === 'من فضلك اذكر تفاصيل تساعدنا على التحقق من ملكية الحساب.'));

      const userReply = await request(app).post('/api/password-recovery/request/' + opened.body.requestId + '/messages')
        .set('X-Recovery-Token', opened.body.recoveryToken)
        .send({ text: 'هذه بيانات إضافية للتحقق من ملكية الحساب.' });
      assert.equal(userReply.status, 200);
      assert.equal(userReply.body.recovery.status, 'قيد التحقق');
      assert.ok(userReply.body.recovery.messages.some(m => m.text === 'هذه بيانات إضافية للتحقق من ملكية الحساب.'));

      const issued = await request(app).post('/api/password-recovery/admin/requests/' + opened.body.requestId + '/issue-code')
        .set('Authorization', 'Bearer ' + adminToken).send({});
      assert.equal(issued.status, 200);
      assert.match(issued.body.code, /^\d{6}$/);

      const sent = await request(app).post('/api/password-recovery/admin/requests/' + opened.body.requestId + '/reply')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ text: 'رمز استعادة كلمة المرور: ' + issued.body.code });
      assert.equal(sent.status, 200);
      assert.equal(sent.body.recovery.status, 'تم التحقق');
      assert.ok(sent.body.recovery.messages.some(m => String(m.text).includes(issued.body.code)), 'the user-facing support transcript should show the issued code');
      const PasswordRecovery = require('../models/PasswordRecovery');
      const storedRecovery = await PasswordRecovery.findById(opened.body.requestId).lean();
      const storedCodeMessage = storedRecovery.messages.find(m => String(m.text).startsWith('__SONAA_RECOVERY_SECRET_V1__:'));
      assert.ok(storedCodeMessage, 'the code message must be encrypted at rest');
      assert.equal(storedCodeMessage.text.includes(issued.body.code), false);

      const verified = await request(app).post('/api/password-recovery/request/' + opened.body.requestId + '/verify-code')
        .set('X-Recovery-Token', opened.body.recoveryToken).send({ code: issued.body.code });
      assert.equal(verified.status, 200);

      const reset = await request(app).post('/api/password-recovery/request/' + opened.body.requestId + '/reset-password')
        .set('X-Recovery-Token', opened.body.recoveryToken)
        .send({ newPassword: 'RecoveredPass123', confirmPassword: 'RecoveredPass123' });
      assert.equal(reset.status, 200);
      const staleSessionAfterRecovery = await request(app).get('/api/client/me').set('Authorization', 'Bearer ' + clientToken);
      assert.equal(staleSessionAfterRecovery.status, 401, 'support recovery must revoke every previous client session');

      const oldLogin = await request(app).post('/api/client/login').send({ phone: '01012345678', password: 'AdminResetPass123' });
      assert.equal(oldLogin.status, 401);
      const newLogin = await request(app).post('/api/client/login').send({ phone: '01012345678', password: 'RecoveredPass123' });
      assert.equal(newLogin.status, 200);
      clientToken = newLogin.body.token;
    });

    await test('support endpoints reject unauthenticated users', async () => {
      const r = await request(app).get('/api/support/client');
      assert.equal(r.status, 401);
    });

    await test('client can create a support case and persist its first message', async () => {
      const r = await request(app).post('/api/support/client')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ subject: 'اختبار الدعم', text: 'أحتاج مساعدة في طلب الخدمة' });
      assert.equal(r.status, 201);
      assert.ok(r.body.supportCase._id);
      assert.equal(r.body.supportCase.messages.length, 1);
      assert.equal(r.body.supportCase.messages[0].text, 'أحتاج مساعدة في طلب الخدمة');
      supportCaseId = r.body.supportCase._id;
    });

    await test('client can retrieve their own support case', async () => {
      const r = await request(app).get('/api/support/client/' + supportCaseId)
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(r.status, 200);
      assert.equal(String(r.body.supportCase._id), String(supportCaseId));
    });

    await test('another client cannot read a support case they do not own', async () => {
      const r = await request(app).get('/api/support/client/' + supportCaseId)
        .set('Authorization', 'Bearer ' + secondClientToken);
      assert.equal(r.status, 404);
    });

    await test('empty support message is rejected', async () => {
      const r = await request(app).post('/api/support/client/' + supportCaseId + '/messages')
        .set('Authorization', 'Bearer ' + clientToken).send({ text: '   ' });
      assert.equal(r.status, 400);
    });

    await test('support follow-up message is saved in the same conversation', async () => {
      const r = await request(app).post('/api/support/client/' + supportCaseId + '/messages')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ text: 'هذه رسالة متابعة للاختبار' });
      assert.equal(r.status, 200);
      assert.ok(r.body.supportCase.messages.some(m => m.text === 'هذه رسالة متابعة للاختبار'));
      assert.equal(r.body.supportCase.needsHuman, true, 'owner follow-up should return the case to the human-support queue');
    });

    await test('support admin replies return the case to the user and duplicate opens reuse the same case', async () => {
      const reply = await request(app).post('/api/support/admin/' + supportCaseId + '/reply')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ text: 'تم استلام طلبك وجارٍ متابعة المشكلة.' });
      assert.equal(reply.status, 200);
      assert.equal(reply.body.supportCase.status, 'بانتظار رد المستخدم');
      assert.equal(reply.body.supportCase.needsHuman, false);

      const ownerView = await request(app).get('/api/support/client/' + supportCaseId)
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(ownerView.status, 200);
      assert.ok(ownerView.body.supportCase.messages.some(item => item.text === 'تم استلام طلبك وجارٍ متابعة المشكلة.'));

      const duplicate = await request(app).post('/api/support/client')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ subject: 'طلب دعم مكرر', text: 'رسالة جديدة على المحادثة المفتوحة' });
      assert.equal(duplicate.status, 200);
      assert.equal(duplicate.body.existing, true);
      assert.equal(String(duplicate.body.supportCase._id), String(supportCaseId));
    });

    await test('admin button layout is shared, persisted, and safely sanitized', async () => {
      const unauthorized = await request(app).get('/api/admin/ui-layout/admin');
      assert.equal(unauthorized.status, 401);

      const saved = await request(app).put('/api/admin/ui-layout/admin')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ layout: {
          sectionOrder: [
            'platform-admin', 'dashboard', 'clients', 'technicians',
            'finance', 'commerce', 'service-management', 'customer-operations',
            'unknown-section', 'dashboard'
          ],
          tabOrder: { dashboard: ['stats', 'orders', 'dashboard', 'not-a-tab'] },
          tabGroups: {
            orders: 'dashboard',
            clientWallet: 'finance',
            wallets: 'finance',
            topups: 'finance',
            dashboard: 'invalid-section'
          },
          sizes: { orders: 'large', dashboard: 'tiny', stats: 'small', unknown: 'large' },
          elements: {
            'auto-div-1_button-': {
              width: '29%', buttonWidth: 29, translateX: 12, translateY: -4,
              anchor: 'center', fontSize: 16, color: '#142b43', radius: 10,
              text: 'اختبار العرض', hidden: false, threeD: true, scale: 1
            }
          }
        } });
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.body.layout.sectionOrder, [
        'platform-admin', 'dashboard', 'clients', 'technicians',
        'finance', 'commerce', 'service-management', 'customer-operations'
      ], 'all eight configured admin sections must survive sanitization');
      assert.deepEqual(saved.body.layout.tabOrder.dashboard, ['stats', 'orders', 'dashboard']);
      assert.equal(saved.body.layout.tabGroups.orders, 'dashboard');
      assert.equal(saved.body.layout.tabGroups.clientWallet, 'finance');
      assert.equal(saved.body.layout.tabGroups.wallets, 'finance');
      assert.equal(saved.body.layout.tabGroups.topups, 'finance');
      assert.equal(saved.body.layout.tabGroups.dashboard, undefined);
      assert.equal(saved.body.layout.sizes.orders, 'large');
      assert.equal(saved.body.layout.sizes.dashboard, undefined);
      assert.equal(saved.body.layout.sizes.stats, 'small');
      assert.equal(saved.body.layout.elements['auto-div-1_button-'].width, '29%');
      assert.equal(saved.body.layout.elements['auto-div-1_button-'].buttonWidth, 29);
      assert.equal(saved.body.layout.elements['auto-div-1_button-'].translateX, 12);
      const loaded = await request(app).get('/api/admin/ui-layout/admin')
        .set('Authorization', 'Bearer ' + adminToken);
      assert.equal(loaded.status, 200);
      assert.deepEqual(loaded.body.layout, saved.body.layout);
      assert.equal(loaded.body.layout.elements['auto-div-1_button-'].width, '29%');
    });

    await test('all five visual-editor layouts preserve version and survive MongoDB save/read round-trips', async () => {
      const AdminConfig = require('../models/AdminConfig');
      for (const page of ['admin', 'client', 'fanni', 'password', 'support']) {
        assert.ok(AdminConfig.schema.paths[page + 'UiLayout'], 'missing MongoDB schema field for ' + page);
        const payload = {
          version: 3, sectionOrder: [], tabOrder: {}, tabGroups: {}, sizes: {},
          elements: {
            ['roundtrip-' + page]: {
              x: 12, y: -8, width: '73%', fontSize: 18,
              color: '#123456', text: 'حفظ واختبار ' + page,
              mobile: { x: 4, y: 6, width: 88, text: 'موبايل' }
            }
          }
        };
        const saved = await request(app).put('/api/admin/ui-layout/' + page)
          .set('Authorization', 'Bearer ' + adminToken).send({ layout: payload });
        assert.equal(saved.status, 200, page + ' save failed: ' + JSON.stringify(saved.body));
        assert.equal(saved.body.layout.version, 3, page + ' version was dropped by sanitizer');
        const loaded = await request(app).get('/api/admin/ui-layout/' + page)
          .set('Authorization', 'Bearer ' + adminToken);
        assert.equal(loaded.status, 200);
        assert.deepEqual(loaded.body.layout, saved.body.layout, page + ' PUT/GET round-trip mismatch');
        const persisted = await AdminConfig.findOne({ key: 'main' }).lean();
        assert.equal(persisted[page + 'UiLayout'].elements['roundtrip-' + page].mobile.width, 88);
      }
    });

    await test('admin API rejects requests without a token', async () => {
      const r = await request(app).get('/api/admin/settings');
      assert.equal(r.status, 401);
    });

    await test('invalid JWT is rejected', async () => {
      const r = await request(app).get('/api/support/client')
        .set('Authorization', 'Bearer definitely-not-a-jwt');
      assert.equal(r.status, 401);
    });

    await test('client token cannot authenticate as a technician', async () => {
      const r = await request(app).get('/api/orders/available')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(r.status, 401);
    });

    await test('legacy site name is presented as Hamzawy Sat without mutating stored settings', async () => {
      const AdminConfig = require('../models/AdminConfig');
      let config = await AdminConfig.findOne({ key: 'main' });
      if (!config) config = await AdminConfig.create({ key: 'main' });
      const previousSiteName = config.settings.siteName;
      try {
        config.settings.siteName = 'صُنّاع';
        await config.save();
        const response = await request(app).get('/api/admin/settings').set('Authorization', 'Bearer ' + adminToken);
        assert.equal(response.status, 200);
        assert.equal(response.body.settings.siteName, 'حمزاوي سات');
        const persisted = await AdminConfig.findOne({ key: 'main' }).lean();
        assert.equal(persisted.settings.siteName, 'صُنّاع', 'GET must not rewrite persisted settings');
      } finally {
        config.settings.siteName = previousSiteName || 'حمزاوي سات';
        await config.save();
      }
    });

    await test('client account screens use Hamzawy Sat branding', async () => {
      const clientAccount = fs.readFileSync(path.join(__dirname, '../../frontend/js/client-account.js'), 'utf8');
      assert.ok(clientAccount.includes('حمزاوي سات'));
      assert.equal(clientAccount.includes('صُنّاع'), false);
    });

    await test('owner service catalog shows hidden and custom services while public catalog exposes active services only', async () => {
      const { ALL_SERVICES } = require('../config/professions');
      const Service = require('../models/Service');
      assert.equal(ALL_SERVICES.length, 8);
      const hiddenBuiltIn = await Service.create({ name: ALL_SERVICES[0], category: 'دش وكاميرات وشاشات', isActive: false });
      const customActive = await Service.create({ name: 'كهرباء', category: 'خدمات منزلية', isActive: true, isPublic: true });
      const customHidden = await Service.create({ name: 'سباكة', category: 'خدمات منزلية', isActive: false, isPublic: false });
      const legacyUnpublished = await Service.create({ name: 'سباك منازل', category: 'السباكة', isActive: true, createdAt: new Date('2026-10-21T00:00:00.000Z') });
      try {
        const publicCatalog = await request(app).get('/api/services');
        assert.equal(publicCatalog.status, 200);
        assert.ok(publicCatalog.body.services.includes('كهرباء'), 'new active services must appear without code changes');
        assert.ok(!publicCatalog.body.services.includes('سباكة'), 'hidden services must stay unavailable publicly');
        assert.ok(!publicCatalog.body.services.includes('سباك منازل'), 'old Sonaa services must not become public by default');
        assert.ok(!publicCatalog.body.services.includes(ALL_SERVICES[0]), 'a hidden built-in service must stay hidden publicly');
        const adminCatalog = await request(app).get('/api/admin/services').set('Authorization', 'Bearer ' + adminToken);
        assert.equal(adminCatalog.status, 200);
        const adminServices = adminCatalog.body.services;
        assert.ok(adminServices.some(service => service.name === 'كهرباء' && service.isActive === true));
        assert.ok(adminServices.some(service => service.name === 'سباكة' && service.isActive === false));
        assert.ok(adminServices.some(service => service.name === 'سباك منازل' && service.isActive === false), 'old Sonaa services must appear as hidden in the owner console');
        assert.ok(adminServices.some(service => service.name === ALL_SERVICES[0] && service.isActive === false), 'hidden built-in services must remain visible to the owner');
      } finally {
        await Service.deleteMany({ _id: { $in: [hiddenBuiltIn._id, customActive._id, customHidden._id, legacyUnpublished._id] } });
      }
    });

    await test('order creation rejects an unknown service', async () => {
      const r = await request(app).post('/api/orders')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({
          service: 'خدمة غير موجودة للاختبار', area: 'المعادي',
          address: 'شارع التحرير 10', description: 'أحتاج فني لصيانة الخدمة في المنزل'
        });
      assert.equal(r.status, 400);
    });

    await test('order creation blocks phone numbers embedded in description', async () => {
      const { ALL_SERVICES } = require('../config/professions');
      const r = await request(app).post('/api/orders')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({
          service: ALL_SERVICES[0], area: 'المعادي', address: 'شارع التحرير 10',
          description: 'اتصل بي على 01012345678 من فضلك'
        });
      assert.equal(r.status, 400);
    });

    await test('legacy orders remain stored but cannot be published to technicians', async () => {
      const Order = require('../models/Order');
      const legacyOrder = await Order.create({ sn: 'SN999991', service: 'صيانة تكييف', area: 'المعادي', clientPhone: '01012345678', status: 'قيد المراجعة' });
      const response = await request(app).post('/api/orders/admin/' + legacyOrder.sn + '/publish').set('Authorization', 'Bearer ' + adminToken);
      assert.equal(response.status, 409, JSON.stringify(response.body));
      const persisted = await Order.findById(legacyOrder._id).lean();
      assert.equal(persisted.status, 'قيد المراجعة');
      assert.equal(persisted.service, 'صيانة تكييف');
    });

    await test('admin order correction rejects historical services', async () => {
      const response = await request(app).patch('/api/admin/orders/SN999991/correct')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ clientPhone: '01012345678', service: 'صيانة تكييف', area: 'المعادي' });
      assert.equal(response.status, 400, JSON.stringify(response.body));
    });

    await test('order creation rejects historical services', async () => {
      const r = await request(app).post('/api/orders')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({
          service: 'صيانة تكييف', area: 'المعادي', address: 'شارع التحرير 10',
          description: 'أحتاج فني لصيانة الخدمة في المنزل'
        });
      assert.equal(r.status, 400, 'historical services must not be accepted for new orders');
    });

    await test('valid order returns tracking code and omits customer phone from public payload', async () => {
      const { ALL_SERVICES } = require('../config/professions');
      const r = await request(app).post('/api/orders')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({
          service: ALL_SERVICES[0], area: 'المعادي', address: 'شارع التحرير 10',
          description: 'أحتاج فني لصيانة الخدمة في المنزل'
        });
      assert.equal(r.status, 201);
      assert.match(r.body.sn, /^SN\d{6}$/);
      assert.ok(r.body.clientToken);
      assert.equal(r.body.order.clientPhone, undefined);
      assert.equal(r.body.order.phone, undefined);
      assert.equal(r.body.order.status, 'قيد المراجعة');
      orderSN = r.body.sn;
      orderClientToken = r.body.clientToken;
    });

    await test('order creation reuses the original order for repeated idempotency keys', async () => {
      const { ALL_SERVICES } = require('../config/professions');
      const Order = require('../models/Order');
      const idempotencyKey = 'order-create-retry-test-0001';
      const payload = {
        service: ALL_SERVICES[0], area: 'المعادي', address: 'شارع اختبار التكرار 15',
        description: 'اختبار منع إنشاء طلبين عند إعادة إرسال نفس الطلب', idempotencyKey
      };
      const before = await Order.countDocuments({ clientAccount: clientId });
      const first = await request(app).post('/api/orders')
        .set('Authorization', 'Bearer ' + clientToken).send(payload);
      assert.equal(first.status, 201, JSON.stringify(first.body));
      const second = await request(app).post('/api/orders')
        .set('Authorization', 'Bearer ' + clientToken).send(payload);
      assert.equal(second.status, 200, JSON.stringify(second.body));
      assert.equal(second.body.duplicate, true);
      assert.equal(second.body.sn, first.body.sn);
      assert.ok(second.body.clientToken);
      assert.equal(await Order.countDocuments({ clientAccount: clientId }), before + 1);
      const stored = await Order.findOne({ clientAccount: clientId, requestKey: idempotencyKey }).lean();
      assert.ok(stored);
      assert.equal(stored.sn, first.body.sn);
    });

    await test('published order offer, client acceptance, wallet commission ledger, and accepted chat work end to end', async () => {
      const { ALL_SERVICES } = require('../config/professions');
      const Fanni = require('../models/Fanni');
      const Order = require('../models/Order');
      const WalletTransaction = require('../models/WalletTransaction');
      const jwt = require('jsonwebtoken');
      const service = ALL_SERVICES[0];
      const fanni = await Fanni.findOne({ phone: '01012345680', role: 'fanni' });
      assert.ok(fanni, 'approved technician fixture must exist');
      fanni.status = 'معتمد';
      fanni.specialties = [service];
      fanni.areas = ['المعادي'];
      fanni.walletBalance = 1000;
      fanni.technicianGuidelinesAcceptedAt = new Date();
      fanni.technicianGuidelinesVersion = '2026-10-20-v1';
      await fanni.save();
      const fanniToken = jwt.sign({
        id: String(fanni._id),
        role: 'fanni',
        tokenVersion: Number(fanni.tokenVersion || 0)
      }, process.env.JWT_SECRET, { expiresIn: '30d' });

      const created = await request(app).post('/api/orders')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({
          service, area: 'المعادي', address: 'شارع الاختبار 12',
          description: 'طلب مستقل لاختبار العرض والقبول والمحادثة'
        });
      assert.equal(created.status, 201);
      const order = await Order.findOne({ sn: created.body.sn });
      assert.ok(order);
      order.status = 'تم النشر';
      order.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await order.save();

      const offer = await request(app).post('/api/fanni/orders/' + order.sn + '/offer')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ price: 500, message: 'أستطيع تنفيذ الخدمة في الموعد المناسب.' });
      assert.equal(offer.status, 201);
      assert.equal(offer.body.orderSn, order.sn);
      assert.equal(offer.body.walletBalance, 1000, 'submitting an offer must not deduct commission');
      const savedOrder = await Order.findOne({ sn: order.sn });
      assert.equal(savedOrder.status, 'وصلتك عروض');
      assert.equal(savedOrder.offers.length, 1);
      const offerId = String(savedOrder.offers[0]._id);
      assert.equal(offer.body.offers[0].fanniPhone, undefined, 'technician offer responses must omit the phone field');
      const clientOrders = await request(app).get('/api/client/orders')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(clientOrders.status, 200);
      const clientView = clientOrders.body.orders.find(item => item.sn === order.sn);
      assert.ok(clientView);
      assert.equal(clientView.offers[0].fanniPhone, undefined, 'client dashboards must not receive technician phone numbers before acceptance');

      const accepted = await request(app).post('/api/orders/' + order.sn + '/accept')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ offerId });
      assert.equal(accepted.status, 200);
      assert.equal(accepted.body.order.status, 'تم اختيار فني');
      assert.equal(accepted.body.order.commissionAmount, undefined, 'commission internals must not leak in the client response');

      const updatedFanni = await Fanni.findById(fanni._id).lean();
      assert.equal(updatedFanni.walletBalance, 950, 'acceptance must atomically deduct the 10% commission');
      const transaction = await WalletTransaction.findOne({ order: order._id, type: 'commission' }).lean();
      assert.ok(transaction);
      assert.equal(transaction.amount, -50);
      assert.equal(transaction.balanceBefore, 1000);
      assert.equal(transaction.balanceAfter, 950);

      const clientChat = await request(app).get('/api/orders/' + order.sn + '/chat')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(clientChat.status, 200);
      const fanniChat = await request(app).get('/api/orders/' + order.sn + '/chat')
        .set('Authorization', 'Bearer ' + fanniToken);
      assert.equal(fanniChat.status, 200);

      const sentByFanni = await request(app).post('/api/orders/' + order.sn + '/chat')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ text: 'تم تحديد موعد الزيارة.' });
      assert.equal(sentByFanni.status, 201);
      const sentByClient = await request(app).post('/api/orders/' + order.sn + '/chat')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ text: 'شكرًا، في انتظارك.' });
      assert.equal(sentByClient.status, 201);
      const finalChat = await request(app).get('/api/orders/' + order.sn + '/chat')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.ok(finalChat.body.messages.some(message => message.text === 'تم تحديد موعد الزيارة.'));
      assert.ok(finalChat.body.messages.some(message => message.text === 'شكرًا، في انتظارك.'));

      const rejectedPriceChange = await request(app).post('/api/orders/' + order.sn + '/price-change')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ newPrice: 600, reason: 'تم اكتشاف قطع إضافية مطلوبة أثناء الفحص' });
      assert.equal(rejectedPriceChange.status, 201, JSON.stringify(rejectedPriceChange.body));
      const rejectedRequestId = String(rejectedPriceChange.body.request._id);
      assert.equal(rejectedPriceChange.body.request.status, 'قيد الموافقة');
      const rejectedDecision = await request(app).post('/api/orders/' + order.sn + '/price-change/' + rejectedRequestId + '/decision')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ approved: false });
      assert.equal(rejectedDecision.status, 200, JSON.stringify(rejectedDecision.body));
      assert.equal(rejectedDecision.body.acceptedOfferPrice, 500);
      assert.equal((await Fanni.findById(fanni._id).lean()).walletBalance, 950, 'rejecting a price increase must not alter technician wallet');

      const approvedPriceChange = await request(app).post('/api/orders/' + order.sn + '/price-change')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ newPrice: 650, reason: 'تم اكتشاف قطع إضافية مطلوبة أثناء الفحص' });
      assert.equal(approvedPriceChange.status, 201, JSON.stringify(approvedPriceChange.body));
      const approvedRequestId = String(approvedPriceChange.body.request._id);
      const approvedDecision = await request(app).post('/api/orders/' + order.sn + '/price-change/' + approvedRequestId + '/decision')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ approved: true });
      assert.equal(approvedDecision.status, 200, JSON.stringify(approvedDecision.body));
      assert.equal(approvedDecision.body.acceptedOfferPrice, 650);
      const adjustedFanni = await Fanni.findById(fanni._id).lean();
      assert.equal(adjustedFanni.walletBalance, 935, 'the 10% commission adjustment on the extra 150 EGP must be 15 EGP');
      const adjustmentLedger = await WalletTransaction.findOne({
        order: order._id,
        type: 'commission',
        idempotencyKey: 'commission-adjustment:' + String(order._id) + ':' + approvedRequestId
      }).lean();
      assert.ok(adjustmentLedger);
      assert.equal(adjustmentLedger.amount, -15);
      const duplicateDecision = await request(app).post('/api/orders/' + order.sn + '/price-change/' + approvedRequestId + '/decision')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ approved: true });
      assert.equal(duplicateDecision.status, 409, 'a price change decision must be applied only once');

      const Client = require('../models/Client');
      await Client.updateOne({ _id: clientId }, { $set: { walletBalance: 1000 } });
      const servicePayment = await request(app).post('/api/client/orders/' + order.sn + '/pay')
        .set('Authorization', 'Bearer ' + clientToken).send({});
      assert.equal(servicePayment.status, 200, JSON.stringify(servicePayment.body));
      assert.equal(servicePayment.body.balance, 350);
      assert.equal(servicePayment.body.paymentStatus, 'held');
      const heldOrder = await Order.findById(order._id).lean();
      assert.equal(heldOrder.clientPaymentStatus, 'held');
      assert.equal(heldOrder.clientPaymentAmount, 650);
      const holdLedger = await WalletTransaction.findOne({ order: order._id, type: 'client_escrow_hold' }).lean();
      assert.ok(holdLedger);
      assert.equal(holdLedger.amount, -650);
      assert.equal((await Order.findById(order._id).lean()).clientPaymentTransactionNumber, holdLedger.transactionNumber, 'service order must retain the exact escrow transaction reference');
      assert.match(holdLedger.transactionNumber, /^HZW-[0-9A-F]{24}$/);
      const clientWalletHistory = await request(app).get('/api/client/wallet')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(clientWalletHistory.status, 200, JSON.stringify(clientWalletHistory.body));
      const clientLedgerEntry = clientWalletHistory.body.transactions.find(item => item.id === String(holdLedger._id));
      assert.equal(clientLedgerEntry.transactionNumber, holdLedger.transactionNumber, 'client wallet must display the exact stored transaction reference');
      const adminClientLedger = await request(app).get('/api/admin/client-wallet/transactions/' + String(clientId))
        .set('Authorization', 'Bearer ' + adminToken);
      assert.equal(adminClientLedger.status, 200, JSON.stringify(adminClientLedger.body));
      const adminClientLedgerEntry = adminClientLedger.body.transactions.find(item => String(item._id) === String(holdLedger._id));
      assert.equal(adminClientLedgerEntry.transactionNumber, holdLedger.transactionNumber, 'admin client ledger must show the same transaction reference');

      const completed = await request(app).post('/api/orders/' + order.sn + '/complete')
        .set('Authorization', 'Bearer ' + fanniToken).send({});
      assert.equal(completed.status, 200, JSON.stringify(completed.body));
      assert.equal(completed.body.settlement, undefined, 'technician completion must never release held customer funds');
      assert.match(completed.body.message, /تظل محجوزة حتى يؤكد العميل/);
      const pendingConfirmationOrder = await Order.findById(order._id).lean();
      assert.equal(pendingConfirmationOrder.status, 'تم الانتهاء');
      assert.equal(pendingConfirmationOrder.clientPaymentStatus, 'held', 'customer funds must remain held after technician completion');
      assert.equal(pendingConfirmationOrder.technicianSettledAt, null);
      assert.ok(pendingConfirmationOrder.completionDeclaredAt, 'technician completion must be timestamped for the customer confirmation flow');
      assert.equal((await Fanni.findById(fanni._id).lean()).walletBalance, 935, 'technician wallet must not be credited before customer confirmation');
      assert.equal(await WalletTransaction.countDocuments({ order: order._id, type: 'technician_settlement' }), 0, 'no settlement ledger entry may exist before customer confirmation');
      const deniedConfirmation = await request(app).post('/api/orders/' + order.sn + '/confirm-completion')
        .set('Authorization', 'Bearer ' + secondClientToken).send({});
      assert.equal(deniedConfirmation.status, 403, 'another client must not confirm this order');
      const confirmedAtResponse = await request(app).post('/api/orders/' + order.sn + '/confirm-completion')
        .set('Authorization', 'Bearer ' + clientToken).send({});
      assert.equal(confirmedAtResponse.status, 200, JSON.stringify(confirmedAtResponse.body));
      assert.equal(confirmedAtResponse.body.settlement.amount, 650);
      assert.match(confirmedAtResponse.body.settlement.transactionNumber, /^HZW-[0-9A-F]{24}$/);
      const confirmedOrder = await Order.findById(order._id).lean();
      assert.ok(confirmedOrder.clientConfirmedAt);
      assert.equal(confirmedOrder.clientPaymentStatus, 'settled');
      assert.ok(confirmedOrder.technicianSettledAt);
      assert.equal(confirmedOrder.warrantyStatus, 'active');
      assert.equal(confirmedOrder.warrantyStartsAt.getTime(), confirmedOrder.clientConfirmedAt.getTime());
      assert.equal(confirmedOrder.warrantyExpiresAt.getTime() - confirmedOrder.warrantyStartsAt.getTime(), 14 * 24 * 60 * 60 * 1000);
      const originalWarrantyExpiry = confirmedOrder.warrantyExpiresAt.getTime();
      const repeatedConfirmation = await request(app).post('/api/orders/' + order.sn + '/confirm-completion')
        .set('Authorization', 'Bearer ' + clientToken).send({});
      assert.equal(repeatedConfirmation.status, 200);
      assert.equal(new Date(repeatedConfirmation.body.order.warrantyExpiresAt).getTime(), originalWarrantyExpiry, 'repeated confirmation must not extend the warranty');
      assert.equal((await Fanni.findById(fanni._id).lean()).walletBalance, 1585, 'customer confirmation must release the held amount exactly once');
      const settlementLedger = await WalletTransaction.findOne({ order: order._id, type: 'technician_settlement' }).lean();
      assert.ok(settlementLedger);
      assert.equal(settlementLedger.amount, 650);
      assert.match(settlementLedger.transactionNumber, /^HZW-[0-9A-F]{24}$/);
      assert.equal(confirmedOrder.technicianSettlementTransactionNumber, settlementLedger.transactionNumber);
      const fanniWalletHistory = await request(app).get('/api/fanni/wallet/history')
        .set('Authorization', 'Bearer ' + fanniToken);
      assert.equal(fanniWalletHistory.status, 200, JSON.stringify(fanniWalletHistory.body));
      const fanniLedgerEntry = fanniWalletHistory.body.transactions.find(item => item.id === String(settlementLedger._id));
      assert.equal(fanniLedgerEntry.transactionNumber, settlementLedger.transactionNumber, 'technician wallet must display the exact stored transaction reference');
      const adminFanniLedger = await request(app).get('/api/admin/wallet/transactions/' + String(fanni._id))
        .set('Authorization', 'Bearer ' + adminToken);
      assert.equal(adminFanniLedger.status, 200, JSON.stringify(adminFanniLedger.body));
      const adminFanniLedgerEntry = adminFanniLedger.body.transactions.find(item => String(item._id) === String(settlementLedger._id));
      assert.equal(adminFanniLedgerEntry.transactionNumber, settlementLedger.transactionNumber, 'admin technician ledger must show the same transaction reference');
      const duplicateCompletion = await request(app).post('/api/orders/' + order.sn + '/complete')
        .set('Authorization', 'Bearer ' + fanniToken).send({});
      assert.equal(duplicateCompletion.status, 409, 'completed orders must not be completed twice');
      assert.equal((await Fanni.findById(fanni._id).lean()).walletBalance, 1585);

      const CommerceItem = require('../models/CommerceItem');
      const ClientSubscription = require('../models/ClientSubscription');
      const plan = await CommerceItem.create({
        kind: 'subscription', name: 'باقة اختبار العميل', price: 50,
        durationDays: 30, active: true, features: ['تجربة الدفع']
      });
      const purchaseKey = 'test-client-subscription-purchase-0001';
      const balanceBeforeRequest = Number((await Client.findById(clientId).lean()).walletBalance);
      const insufficientKey = 'test-client-subscription-insufficient-0001';
      await Client.updateOne({ _id: clientId }, { $set: { walletBalance: 0 } });
      const insufficientPurchase = await request(app).post('/api/client/commerce/subscriptions/purchase')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ itemId: String(plan._id), idempotencyKey: insufficientKey });
      assert.equal(insufficientPurchase.status, 409);
      assert.match(insufficientPurchase.body.message, /رصيد محفظتك غير كافٍ/);
      assert.equal(await ClientSubscription.countDocuments({ client: clientId, requestKey: insufficientKey }), 0, 'insufficient balance must not create a pending subscription');
      assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), 0, 'insufficient balance check must not alter wallet');
      await Client.updateOne({ _id: clientId }, { $set: { walletBalance: balanceBeforeRequest } });
      const purchase = await request(app).post('/api/client/commerce/subscriptions/purchase')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ itemId: String(plan._id), idempotencyKey: purchaseKey });
      assert.equal(purchase.status, 201, JSON.stringify(purchase.body));
      assert.equal(purchase.body.balance, balanceBeforeRequest, 'requesting a subscription must not debit the wallet');
      assert.equal(purchase.body.subscription.status, 'pending');
      assert.equal(purchase.body.subscription.paymentStatus, 'pending');
      assert.equal(purchase.body.subscription.durationDays, 30);
      const subscriptionId = String(purchase.body.subscription._id);
      assert.equal(await WalletTransaction.countDocuments({ client: clientId, idempotencyKey: purchaseKey }), 0);

      const duplicatePurchase = await request(app).post('/api/client/commerce/subscriptions/purchase')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ itemId: String(plan._id), idempotencyKey: purchaseKey });
      assert.equal(duplicatePurchase.status, 200);
      assert.equal(duplicatePurchase.body.duplicate, true);
      assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), balanceBeforeRequest);

      const approval = await request(app).patch('/api/admin/commerce/subscriptions/' + subscriptionId + '/status')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ status: 'active', reason: 'موافقة اختبار' });
      assert.equal(approval.status, 200, JSON.stringify(approval.body));
      assert.equal(approval.body.subscription.status, 'active');
      assert.equal(approval.body.subscription.paymentStatus, 'paid');
      const afterApproval = Number((await Client.findById(clientId).lean()).walletBalance);
      assert.equal(afterApproval, balanceBeforeRequest - 50, 'approval must debit exactly once');
      const approvalLedger = await WalletTransaction.findOne({ client: clientId, idempotencyKey: 'client-subscription-approval:' + subscriptionId }).lean();
      assert.ok(approvalLedger);
      assert.equal(approvalLedger.amount, -50);
      assert.match(approvalLedger.transactionNumber, /^HZW-[0-9A-F]{24}$/);
      assert.equal(approval.body.subscription.transactionNumber, approvalLedger.transactionNumber);
      assert.equal(approval.body.subscription.history.at(-1).transactionNumber, approvalLedger.transactionNumber);

      const renewalKey = 'test-client-subscription-renew-0001';
      const renewal = await request(app).post('/api/client/commerce/subscriptions/' + subscriptionId + '/renew')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ idempotencyKey: renewalKey });
      assert.equal(renewal.status, 200, JSON.stringify(renewal.body));
      assert.equal(renewal.body.balance, afterApproval - 50);
      const renewed = await ClientSubscription.findById(subscriptionId).lean();
      assert.equal(renewed.history.length, 2);
      const renewalLedger = await WalletTransaction.findOne({ client: clientId, idempotencyKey: renewalKey }).lean();
      assert.ok(renewalLedger);
      assert.equal(renewal.body.transactionNumber, renewalLedger.transactionNumber);
      assert.equal(renewed.transactionNumber, renewalLedger.transactionNumber);
      assert.equal(renewed.history.at(-1).transactionNumber, renewalLedger.transactionNumber);
      const duplicateRenewal = await request(app).post('/api/client/commerce/subscriptions/' + subscriptionId + '/renew')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ idempotencyKey: renewalKey });
      assert.equal(duplicateRenewal.status, 200);
      assert.equal(duplicateRenewal.body.duplicate, true);
      assert.equal((await ClientSubscription.findById(subscriptionId).lean()).history.length, 2);
      assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), afterApproval - 50);

      const adminRenewal = await request(app).post('/api/admin/commerce/subscriptions/' + subscriptionId + '/renew')
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ paymentStatus: 'paid', note: 'تجديد إداري للاختبار' });
      assert.equal(adminRenewal.status, 200, JSON.stringify(adminRenewal.body));
      assert.match(adminRenewal.body.transactionNumber, /^HZW-[0-9A-F]{24}$/);
      const adminRenewed = await ClientSubscription.findById(subscriptionId).lean();
      assert.equal(adminRenewed.history.length, 3);
      assert.equal(adminRenewed.history.at(-1).transactionNumber, adminRenewal.body.transactionNumber);
      assert.equal(adminRenewed.transactionNumber, adminRenewal.body.transactionNumber);
      const adminRenewalLedger = await WalletTransaction.findOne({ client: clientId, transactionNumber: adminRenewal.body.transactionNumber }).lean();
      assert.ok(adminRenewalLedger, 'admin renewal reference must resolve to a real wallet ledger transaction');
      assert.equal(adminRenewalLedger.type, 'client_subscription_payment');
      assert.equal(adminRenewalLedger.amount, -50);
      assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), afterApproval - 100);

      const StoreProduct = require('../models/StoreProduct');
      const StoreOrder = require('../models/StoreOrder');
      const storeProduct = await StoreProduct.create({
        name: 'منتج اختبار الفني', description: 'اختبار طلب شراء من متجر الفني',
        price: 75, type: 'product', isActive: true, stock: 5
      });
      const fanniBalanceBeforeStore = Number((await Fanni.findById(fanni._id).lean()).walletBalance);
      const storeKey = 'fanni-store-product-purchase-0001';
      const storePurchase = await request(app).post('/api/store/fanni/orders')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ productId: String(storeProduct._id), quantity: 2, paymentMethod: 'wallet', idempotencyKey: storeKey });
      assert.equal(storePurchase.status, 201, JSON.stringify(storePurchase.body));
      assert.equal(storePurchase.body.balance, fanniBalanceBeforeStore - 150);
      assert.equal(storePurchase.body.order.paymentStatus, 'مدفوع');
      assert.equal((await StoreProduct.findById(storeProduct._id).lean()).stock, 3);
      const storedOrder = await StoreOrder.findById(storePurchase.body.order.id).lean();
      assert.equal(storedOrder.buyerRole, 'fanni');
      assert.equal(storedOrder.total, 150);
      assert.match(storedOrder.transactionNumber, /^HZW-[0-9A-F]{24}$/);
      assert.equal(storePurchase.body.order.transactionNumber, storedOrder.transactionNumber);
      const storeLedger = await WalletTransaction.findOne({ fanni: fanni._id, type: 'fanni_store_payment', idempotencyKey: 'store-order:' + String(storedOrder._id) }).lean();
      assert.ok(storeLedger);
      assert.equal(storeLedger.amount, -150);
      assert.equal(storeLedger.balanceBefore, fanniBalanceBeforeStore);
      assert.equal(storeLedger.balanceAfter, fanniBalanceBeforeStore - 150);
      assert.equal(storeLedger.transactionNumber, storedOrder.transactionNumber);

      const staleSinglePrice = await request(app).post('/api/store/fanni/orders')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ productId: String(storeProduct._id), quantity: 1, paymentMethod: 'wallet', expectedPrice: 70, idempotencyKey: 'fanni-store-stale-price-test-0001' });
      assert.equal(staleSinglePrice.status, 409);
      assert.equal(staleSinglePrice.body.priceChanged, true);
      assert.equal((await StoreProduct.findById(storeProduct._id).lean()).stock, 3, 'stale-price rejection must not reserve stock');
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), fanniBalanceBeforeStore - 150, 'stale-price rejection must not charge the wallet');

      const duplicateStorePurchase = await request(app).post('/api/store/fanni/orders')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ productId: String(storeProduct._id), quantity: 2, paymentMethod: 'wallet', idempotencyKey: storeKey });
      assert.equal(duplicateStorePurchase.status, 200);
      assert.equal(duplicateStorePurchase.body.duplicate, true);
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), fanniBalanceBeforeStore - 150);
      assert.equal((await StoreProduct.findById(storeProduct._id).lean()).stock, 3);

      const codProduct = await StoreProduct.create({ name: 'منتج دفع عند الاستلام للفني', price: 40, type: 'product', isActive: true, stock: 4 });
      const originalFanniStatus = fanni.status;
      await Fanni.updateOne({ _id: fanni._id }, { $set: { status: 'قيد المراجعة' } });
      const pendingFanniPurchase = await request(app).post('/api/store/fanni/orders')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ productId: String(codProduct._id), quantity: 1, paymentMethod: 'cash_on_delivery', expectedPrice: 40, idempotencyKey: 'pending-fanni-store-cod-test-0001' });
      assert.equal(pendingFanniPurchase.status, 403, 'unapproved technicians must not place store orders with cash on delivery');
      assert.equal((await StoreProduct.findById(codProduct._id).lean()).stock, 4, 'unapproved technician rejection must not reserve stock');
      await Fanni.updateOne({ _id: fanni._id }, { $set: { status: originalFanniStatus } });
      const balanceBeforeCod = Number((await Fanni.findById(fanni._id).lean()).walletBalance);
      const codPurchase = await request(app).post('/api/store/fanni/orders')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ productId: String(codProduct._id), quantity: 2, paymentMethod: 'cash_on_delivery', expectedPrice: 40, idempotencyKey: 'fanni-store-cod-order-test-0001' });
      assert.equal(codPurchase.status, 201, JSON.stringify(codPurchase.body));
      assert.equal(codPurchase.body.order.paymentStatus, 'غير مدفوع');
      assert.equal(codPurchase.body.order.paymentMethod, 'عند الاستلام');
      assert.equal((await StoreProduct.findById(codProduct._id).lean()).stock, 2);
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), balanceBeforeCod, 'cash-on-delivery must not debit the wallet');
      const duplicateCodPurchase = await request(app).post('/api/store/fanni/orders')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ productId: String(codProduct._id), quantity: 2, paymentMethod: 'cash_on_delivery', expectedPrice: 40, idempotencyKey: 'fanni-store-cod-order-test-0001' });
      assert.equal(duplicateCodPurchase.status, 200);
      assert.equal(duplicateCodPurchase.body.duplicate, true);
      assert.equal((await StoreProduct.findById(codProduct._id).lean()).stock, 2, 'duplicate COD request must not reserve stock twice');

      const clientStoreProduct = await StoreProduct.create({ name: 'منتج اختبار شراء العميل', price: 35, type: 'product', isActive: true, stock: 3 });
      const clientBalanceBeforeStore = Number((await Client.findById(clientId).lean()).walletBalance);
      const clientStorePurchase = await request(app).post('/api/store/client/orders')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ productId: String(clientStoreProduct._id), quantity: 1, paymentMethod: 'cash_on_delivery', expectedPrice: 35, idempotencyKey: 'client-store-cod-order-test-0001' });
      assert.equal(clientStorePurchase.status, 201, JSON.stringify(clientStorePurchase.body));
      assert.equal(clientStorePurchase.body.order.paymentStatus, 'غير مدفوع');
      assert.equal((await StoreProduct.findById(clientStoreProduct._id).lean()).stock, 2);
      assert.equal(Number((await Client.findById(clientId).lean()).walletBalance), clientBalanceBeforeStore, 'client COD order must not debit the wallet');

      const staleClientProduct = await StoreProduct.create({ name: 'منتج سعره اتغير للعميل', price: 50, type: 'product', isActive: true, stock: 3 });
      const staleClientPrice = await request(app).post('/api/store/client/orders')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ productId: String(staleClientProduct._id), quantity: 1, paymentMethod: 'cash_on_delivery', expectedPrice: 45, idempotencyKey: 'client-store-stale-price-test-0001' });
      assert.equal(staleClientPrice.status, 409);
      assert.equal(staleClientPrice.body.priceChanged, true);
      assert.equal((await StoreProduct.findById(staleClientProduct._id).lean()).stock, 3, 'client stale-price rejection must leave stock untouched');

      const paymentMethodPreservation = await request(app).patch('/api/admin/store/orders/' + storedOrder._id)
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ status: 'تم التواصل', adminNote: 'اختبار الحفاظ على طريقة الدفع عند عدم إرسالها' });
      assert.equal(paymentMethodPreservation.status, 200, JSON.stringify(paymentMethodPreservation.body));
      assert.equal(paymentMethodPreservation.body.order.paymentMethod, 'محفظة الفني', 'omitting paymentMethod must not erase the original wallet payment method');
      const singleCancelAfterMethodChange = await request(app).patch('/api/admin/store/orders/' + storedOrder._id)
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ status: 'ملغي', paymentMethod: 'تحويل', adminNote: 'اختبار الاسترداد بعد تعديل طريقة الدفع' });
      assert.equal(singleCancelAfterMethodChange.status, 200, JSON.stringify(singleCancelAfterMethodChange.body));
      assert.equal(singleCancelAfterMethodChange.body.refundedAmount, 150, 'changing the displayed payment method must not remove wallet refund eligibility');
      assert.equal(singleCancelAfterMethodChange.body.order.paymentStatus, 'مسترد');
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), fanniBalanceBeforeStore);
      assert.equal((await StoreProduct.findById(storeProduct._id).lean()).stock, 5, 'cancelling a single wallet order must restore reserved stock');
      const fanniBalanceBeforeCodCancel = Number((await Fanni.findById(fanni._id).lean()).walletBalance);
      const codCancel = await request(app).patch('/api/admin/store/orders/' + codPurchase.body.order.id)
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ status: 'ملغي', paymentMethod: 'محفظة الفني', adminNote: 'اختبار منع استرداد طلب عند الاستلام بعد تغيير طريقة الدفع إداريًا' });
      assert.equal(codCancel.status, 200, JSON.stringify(codCancel.body));
      assert.equal(codCancel.body.refundedAmount, 0, 'changing a COD order payment label to wallet must not create a wallet refund');
      assert.equal(codCancel.body.order.paymentStatus, 'غير مدفوع');
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), fanniBalanceBeforeCodCancel, 'COD cancellation must not credit the wallet even if its payment label is changed');
      assert.equal((await StoreProduct.findById(codProduct._id).lean()).stock, 4, 'cancelling a single COD order must restore stock');

      const bulkProductA = await StoreProduct.create({ name: 'منتج سلة متعدد أ', price: 20, type: 'product', isActive: true, stock: 5 });
      const bulkProductB = await StoreProduct.create({ name: 'منتج سلة متعدد ب', price: 30, type: 'product', isActive: true, stock: 10 });
      const limitedBulkProduct = await StoreProduct.create({ name: 'منتج مخزون محدود لاختبار السلة', price: 40, type: 'product', isActive: true, stock: 1 });
      const balanceBeforeInsufficientBulk = Number((await Fanni.findById(fanni._id).lean()).walletBalance);
      const insufficientBulk = await request(app).post('/api/store/fanni/orders/bulk')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ items: [
          { productId: String(bulkProductA._id), quantity: 2, expectedPrice: 20 },
          { productId: String(limitedBulkProduct._id), quantity: 2, expectedPrice: 40 }
        ], paymentMethod: 'wallet', idempotencyKey: 'fanni-store-bulk-insufficient-stock-0001' });
      assert.equal(insufficientBulk.status, 409);
      assert.equal((await StoreProduct.findById(bulkProductA._id).lean()).stock, 5, 'failed bulk reservation must roll back stock reserved for earlier items');
      assert.equal((await StoreProduct.findById(limitedBulkProduct._id).lean()).stock, 1);
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), balanceBeforeInsufficientBulk, 'insufficient bulk stock must not debit the wallet');

      const conflictingBulkPrices = await request(app).post('/api/store/fanni/orders/bulk')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ items: [
          { productId: String(bulkProductA._id), quantity: 1, expectedPrice: 20 },
          { productId: String(bulkProductA._id), quantity: 1, expectedPrice: 21 }
        ], paymentMethod: 'wallet', idempotencyKey: 'fanni-store-bulk-conflicting-prices-0001' });
      assert.equal(conflictingBulkPrices.status, 400);
      assert.equal((await StoreProduct.findById(bulkProductA._id).lean()).stock, 5, 'conflicting expected prices must not reserve stock');

      const staleBulkPrice = await request(app).post('/api/store/fanni/orders/bulk')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ items: [{ productId: String(bulkProductA._id), quantity: 1, expectedPrice: 19 }], paymentMethod: 'wallet', idempotencyKey: 'fanni-store-bulk-stale-price-0001' });
      assert.equal(staleBulkPrice.status, 409);
      assert.equal(staleBulkPrice.body.priceChanged, true);
      assert.equal((await StoreProduct.findById(bulkProductA._id).lean()).stock, 5, 'stale bulk price must not reserve stock');
      const balanceBeforeBulk = Number((await Fanni.findById(fanni._id).lean()).walletBalance);
      const bulkKey = 'fanni-store-bulk-order-test-0001';
      const bulkPurchase = await request(app).post('/api/store/fanni/orders/bulk')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ items: [
          { productId: String(bulkProductA._id), quantity: 1, expectedPrice: 20 },
          { productId: String(bulkProductA._id), quantity: 1, expectedPrice: 20 },
          { productId: String(bulkProductB._id), quantity: 3, expectedPrice: 30 }
        ], paymentMethod: 'wallet', idempotencyKey: bulkKey });
      assert.equal(bulkPurchase.status, 201, JSON.stringify(bulkPurchase.body));
      assert.equal(bulkPurchase.body.order.items.length, 2);
      assert.equal(bulkPurchase.body.order.total, 130);
      assert.equal(bulkPurchase.body.order.quantity, 5);
      assert.equal(bulkPurchase.body.balance, balanceBeforeBulk - 130);
      assert.equal((await StoreProduct.findById(bulkProductA._id).lean()).stock, 3);
      assert.equal((await StoreProduct.findById(bulkProductB._id).lean()).stock, 7);
      const bulkStoredOrder = await StoreOrder.findById(bulkPurchase.body.order.id).lean();
      assert.equal(bulkStoredOrder.items.length, 2);
      assert.equal(bulkStoredOrder.total, 130);
      assert.match(bulkStoredOrder.transactionNumber, /^HZW-[0-9A-F]{24}$/);
      assert.equal(bulkPurchase.body.order.transactionNumber, bulkStoredOrder.transactionNumber);
      const bulkLedger = await WalletTransaction.findOne({ fanni: fanni._id, type: 'fanni_store_payment', idempotencyKey: 'store-order:' + String(bulkStoredOrder._id) }).lean();
      assert.ok(bulkLedger);
      assert.equal(bulkLedger.amount, -130);
      assert.equal(bulkLedger.transactionNumber, bulkStoredOrder.transactionNumber);
      const duplicateBulk = await request(app).post('/api/store/fanni/orders/bulk')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ items: [
          { productId: String(bulkProductA._id), quantity: 2 },
          { productId: String(bulkProductB._id), quantity: 3 }
        ], paymentMethod: 'wallet', idempotencyKey: bulkKey });
      assert.equal(duplicateBulk.status, 200);
      assert.equal(duplicateBulk.body.duplicate, true);
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), balanceBeforeBulk - 130);
      assert.equal((await StoreProduct.findById(bulkProductA._id).lean()).stock, 3);
      assert.equal((await StoreProduct.findById(bulkProductB._id).lean()).stock, 7);
      const cancelBulk = await request(app).patch('/api/admin/store/orders/' + bulkStoredOrder._id)
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ status: 'ملغي', paymentMethod: 'تحويل', adminNote: 'اختبار إلغاء الطلب المجمع' });
      assert.equal(cancelBulk.status, 200, JSON.stringify(cancelBulk.body));
      assert.equal(cancelBulk.body.refundedAmount, 130);
      assert.equal(cancelBulk.body.order.paymentStatus, 'مسترد');
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), balanceBeforeBulk);
      const bulkRefundLedger = await WalletTransaction.findOne({ fanni: fanni._id, type: 'refund', idempotencyKey: 'store-order-refund:' + String(bulkStoredOrder._id) }).lean();
      assert.ok(bulkRefundLedger);
      assert.equal(bulkRefundLedger.amount, 130);
      assert.match(bulkRefundLedger.transactionNumber, /^HZW-[0-9A-F]{24}$/);
      assert.equal((await StoreOrder.findById(bulkStoredOrder._id).lean()).refundTransactionNumber, bulkRefundLedger.transactionNumber);
      const duplicateCancelBulk = await request(app).patch('/api/admin/store/orders/' + bulkStoredOrder._id)
        .set('Authorization', 'Bearer ' + adminToken)
        .send({ status: 'ملغي', paymentMethod: 'تحويل', adminNote: 'تكرار الإلغاء لا يكرر الاسترداد' });
      assert.equal(duplicateCancelBulk.status, 200, JSON.stringify(duplicateCancelBulk.body));
      assert.equal(duplicateCancelBulk.body.refundedAmount, 0);
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), balanceBeforeBulk);
      assert.equal(await WalletTransaction.countDocuments({ fanni: fanni._id, type: 'refund', idempotencyKey: 'store-order-refund:' + String(bulkStoredOrder._id) }), 1);
      assert.equal((await StoreProduct.findById(bulkProductA._id).lean()).stock, 5);
      assert.equal((await StoreProduct.findById(bulkProductB._id).lean()).stock, 10);

      const storeSubscription = await StoreProduct.create({
        name: 'اشتراك اختبار الفني', price: 120, type: 'subscription',
        subscriptionDuration: '30 يوم', isActive: true
      });
      const subscriptionRequest = await request(app).post('/api/store/fanni/orders')
        .set('Authorization', 'Bearer ' + fanniToken)
        .send({ productId: String(storeSubscription._id), quantity: 1, idempotencyKey: 'fanni-store-subscription-request-0001' });
      assert.equal(subscriptionRequest.status, 201, JSON.stringify(subscriptionRequest.body));
      assert.equal(subscriptionRequest.body.order.paymentStatus, 'غير مدفوع');
      assert.equal(subscriptionRequest.body.order.paymentMethod, 'غير محدد');
      assert.equal(Number((await Fanni.findById(fanni._id).lean()).walletBalance), fanniBalanceBeforeStore, 'an unpaid subscription request must not debit the technician wallet');
    });

    await test('order chat rejects revoked technician sessions after password changes', async () => {
      const Fanni = require('../models/Fanni');
      const Order = require('../models/Order');
      const jwt = require('jsonwebtoken');
      const fanni = await Fanni.findOne({ phone: '01012345680', role: 'fanni' });
      assert.ok(fanni, 'technician fixture must exist');
      fanni.technicianGuidelinesAcceptedAt = new Date();
      fanni.technicianGuidelinesVersion = 'test-v1';
      await fanni.save();

      const order = await Order.findOne({ sn: orderSN });
      assert.ok(order);
      const originalStatus = order.status;
      const originalAssignedFanni = order.assignedFanni;
      const originalOffers = order.offers.map(item => item.toObject());
      const originalMessages = order.chatMessages.map(item => item.toObject());
      try {
        order.status = 'وصلتك عروض';
        order.offers.push({ fanni: fanni._id, fanniName: fanni.name, price: '500', priceNum: 500 });
        await order.save();
        const offerId = String(order.offers[order.offers.length - 1]._id);
        const oldTokenVersion = Number(fanni.tokenVersion || 0);
        const oldToken = jwt.sign({ id: String(fanni._id), role: 'fanni', tokenVersion: oldTokenVersion }, process.env.JWT_SECRET, { expiresIn: '30d' });

        const beforeRevocation = await request(app).get('/api/orders/' + orderSN + '/chat')
          .set('Authorization', 'Bearer ' + oldToken);
        assert.equal(beforeRevocation.status, 200);
        const sentBeforeRevocation = await request(app).post('/api/orders/' + orderSN + '/chat')
          .set('Authorization', 'Bearer ' + oldToken).send({ offerId, text: 'نعم' });
        assert.equal(sentBeforeRevocation.status, 201);

        fanni.tokenVersion = oldTokenVersion + 1;
        await fanni.save();
        const staleRead = await request(app).get('/api/orders/' + orderSN + '/chat')
          .set('Authorization', 'Bearer ' + oldToken);
        assert.equal(staleRead.status, 403, 'revoked technician token must not read chat history');
        const staleWrite = await request(app).post('/api/orders/' + orderSN + '/chat')
          .set('Authorization', 'Bearer ' + oldToken).send({ offerId, text: 'نعم' });
        assert.equal(staleWrite.status, 403, 'revoked technician token must not send chat messages');

        const currentToken = jwt.sign({ id: String(fanni._id), role: 'fanni', tokenVersion: Number(fanni.tokenVersion || 0) }, process.env.JWT_SECRET, { expiresIn: '30d' });
        const currentRead = await request(app).get('/api/orders/' + orderSN + '/chat')
          .set('Authorization', 'Bearer ' + currentToken);
        assert.equal(currentRead.status, 200, 'a current technician session must retain chat access');

        order.status = 'تم الانتهاء';
        order.assignedFanni = fanni._id;
        await order.save();
        const revokedRating = await request(app).post('/api/orders/' + orderSN + '/rating')
          .set('Authorization', 'Bearer ' + oldToken)
          .send({ stars: 1, comment: 'تقييم بجلسة ملغاة' });
        assert.equal(revokedRating.status, 401, 'revoked technician sessions must not submit ratings');

        const currentRating = await request(app).post('/api/orders/' + orderSN + '/rating')
          .set('Authorization', 'Bearer ' + currentToken)
          .send({ stars: 5, comment: 'تقييم بجلسة سارية' });
        assert.equal(currentRating.status, 201, 'the assigned technician with a current session can still rate');
      } finally {
        const orderToRestore = await Order.findOne({ sn: orderSN });
        if (orderToRestore) {
          orderToRestore.status = originalStatus;
          orderToRestore.assignedFanni = originalAssignedFanni;
          orderToRestore.offers = originalOffers;
          orderToRestore.chatMessages = originalMessages;
          await orderToRestore.save();
        }
      }
    });

    await test('client order responses collapse historical duplicate offers from the same technician', async () => {
      const { ALL_SERVICES } = require('../config/professions');
      const created = await request(app).post('/api/orders')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({
          service: ALL_SERVICES[0], area: 'المعادي', address: 'شارع التحرير 10',
          description: 'أحتاج فني لاختبار منع تكرار العروض'
        });
      assert.equal(created.status, 201);
      const Order = require('../models/Order');
      const order = await Order.findOne({ sn: created.body.sn });
      assert.ok(order);
      const technicianId = new mongoose.Types.ObjectId();
      const duplicateOffer = {
        fanni: technicianId,
        fanniId: String(technicianId),
        fanniName: 'فني اختبار',
        price: '250',
        priceNum: 250,
        message: 'عرض تجريبي'
      };
      order.offers.push({ ...duplicateOffer }, { ...duplicateOffer });
      await order.save();

      const response = await request(app).get('/api/client/orders')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(response.status, 200);
      const visibleOrder = response.body.orders.find(item => item.sn === created.body.sn);
      assert.ok(visibleOrder);
      assert.equal(visibleOrder.offers.length, 1);
      assert.equal(visibleOrder.offers[0].fanniName, 'فني اختبار');
    });

    await test('offer submission uses an atomic guard against concurrent duplicate offers', async () => {
      const source = fs.readFileSync(path.join(__dirname, '../routes/order/offers.js'), 'utf8');
      const offerStart = source.indexOf("router.post('/:sn/offer'");
      const offerEnd = source.indexOf("\n  return router;", offerStart);
      assert.notEqual(offerStart, -1);
      assert.notEqual(offerEnd, -1);
      const offerRoute = source.slice(offerStart, offerEnd);
      assert.match(offerRoute, /Order\.findOneAndUpdate\(/);
      assert.match(offerRoute, /'offers\.fanni': \{ \$ne: req\.userId \}/);
      assert.match(offerRoute, /\$push: \{ offers: offerPayload \}/);
      assert.match(offerRoute, /سبق أن أرسلت عرضًا لهذا الطلب/);
    });

    await test('account owner can retrieve linked orders without exposing platform commission', async () => {
      const r = await request(app).get('/api/orders/' + orderSN)
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(r.status, 200);
      const staleStandaloneToken = await request(app).get('/api/orders/' + orderSN)
        .query({ clientToken: orderClientToken });
      assert.equal(staleStandaloneToken.status, 200, 'a token issued for this account-bound order remains compatible with the client UI');
      assert.equal(r.body.order.sn, orderSN);
      assert.equal(Object.prototype.hasOwnProperty.call(r.body.order, 'commissionRate'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(r.body.order, 'commissionAmount'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(r.body.order, 'commissionCharged'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(r.body.order, 'commissionChargedAt'), false);
      const source = fs.readFileSync(path.join(__dirname, '../routes/order/lifecycle.js'), 'utf8');
      const acceptStart = source.indexOf("router.post('/:sn/accept'");
      const acceptEnd = source.indexOf("router.post('/:sn/cancel'", acceptStart);
      assert.notEqual(acceptStart, -1);
      assert.notEqual(acceptEnd, -1);
      const acceptRoute = source.slice(acceptStart, acceptEnd);
      assert.doesNotMatch(acceptRoute, /responsePayload\s*=\s*\{[\s\S]{0,250}commission\s*:/);
      assert.match(acceptRoute, /message: 'تم قبول العرض بنجاح'/);
      assert.match(acceptRoute, /notificationCommissionAmount = commissionAmount/);
      assert.match(acceptRoute, /notificationCommissionRate = commissionRate/);
      assert.doesNotMatch(acceptRoute, /responsePayload\.commission\?\./);
      const chatSource = fs.readFileSync(path.join(__dirname, '../routes/order/chat.js'), 'utf8');
      assert.match(chatSource, /تمت الموافقة على السعر الجديد\./);
      assert.match(chatSource, /typeof req\.body\?\.approved !== 'boolean'/);
      assert.match(chatSource, /const chatMessageLimiter = rateLimit/);
      assert.match(chatSource, /router\.post\('\/:sn\/chat', chatMessageLimiter,/);
    });

    await test('suspended clients lose access through old JWTs and order-bound tokens', async () => {
      const Client = require('../models/Client');
      const client = await Client.findById(clientId);
      assert.ok(client);
      client.status = 'معلق';
      await client.save();

      const trackedWithOldSession = await request(app).get('/api/orders/' + orderSN)
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(trackedWithOldSession.status, 403);

      const chatWithOldSession = await request(app).get('/api/orders/' + orderSN + '/chat')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(chatWithOldSession.status, 403);

      const claimedOrderToken = await request(app).get('/api/orders/' + orderSN)
        .query({ clientToken: orderClientToken });
      assert.equal(claimedOrderToken.status, 403, 'a standalone tracking token must stop working after the order is linked to an account');

      client.status = 'نشط';
      await client.save();
    });

    await test('claiming a legacy order revokes its standalone tracking token', async () => {
      const Order = require('../models/Order');
      const jwt = require('jsonwebtoken');
      const legacy = await Order.create({
        sn: 'SN999998',
        service: 'صيانة تكييف',
        area: 'مدينة نصر',
        clientName: 'عميل اختبار قديم',
        clientPhone: '01012345678',
        description: 'طلب قديم لاختبار ربطه بحساب العميل',
        status: 'قيد المراجعة'
      });
      const legacyToken = jwt.sign({
        purpose: 'client-order',
        orderId: String(legacy._id),
        sn: legacy.sn
      }, process.env.JWT_SECRET, { expiresIn: '30d' });

      const beforeClaim = await request(app).get('/api/orders/' + legacy.sn)
        .query({ clientToken: legacyToken });
      assert.equal(beforeClaim.status, 200, 'legacy standalone token remains usable before account claim');

      const claimed = await request(app).post('/api/client/orders/claim')
        .set('Authorization', 'Bearer ' + clientToken)
        .send({ sn: legacy.sn, clientToken: legacyToken });
      assert.equal(claimed.status, 200);

      const oldTokenAccess = await request(app).get('/api/orders/' + legacy.sn)
        .query({ clientToken: legacyToken });
      assert.equal(oldTokenAccess.status, 403);

      const accountAccess = await request(app).get('/api/orders/' + legacy.sn)
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(accountAccess.status, 200);
    });

    await test('only the order owner can cancel a pending order', async () => {
      const denied = await request(app).post('/api/orders/' + orderSN + '/cancel')
        .set('Authorization', 'Bearer ' + secondClientToken);
      assert.equal(denied.status, 403);

      const cancelled = await request(app).post('/api/orders/' + orderSN + '/cancel')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(cancelled.status, 200);
      assert.equal(cancelled.body.order.status, 'ملغي');

      const repeated = await request(app).post('/api/orders/' + orderSN + '/cancel')
        .set('Authorization', 'Bearer ' + clientToken);
      assert.equal(repeated.status, 409);

      const lifecycleSource = fs.readFileSync(path.join(__dirname, '../routes/order/lifecycle.js'), 'utf8');
      const cancelStart = lifecycleSource.indexOf("router.post('/:sn/cancel'");
      const cancelEnd = lifecycleSource.indexOf("router.post('/:sn/complete'", cancelStart);
      assert.notEqual(cancelStart, -1);
      assert.notEqual(cancelEnd, -1);
      const cancelRoute = lifecycleSource.slice(cancelStart, cancelEnd);
      assert.match(cancelRoute, /Order\.findOneAndUpdate\(/, 'cancellation must use an atomic conditional update');
      assert.match(cancelRoute, /assignedFanni:\s*null/, 'cancellation must lose the race if a technician was assigned');
      assert.doesNotMatch(cancelRoute, /order\.save\(\)/, 'a stale document save must not overwrite an accepted offer');
    });

    await test('tracking code alone does not expose order details', async () => {
      const r = await request(app).get('/api/orders/' + orderSN);
      assert.equal(r.status, 403);
    });

    await test('CORS preflight permits the recovery-ticket header for configured frontend origins', async () => {
      const r = await request(app).options('/api/password-recovery/request/test/messages')
        .set('Origin', 'https://www.hamzawy-sat.dynv6.net')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,x-recovery-token');
      assert.equal(r.status, 204);
      assert.match(String(r.headers['access-control-allow-headers'] || ''), /x-recovery-token/i);
    });

    await test('referral rewards honor completion thresholds, exclude cancellations and credit both parties once', async () => {
      const Referral = require('../models/Referral');
      const Client = require('../models/Client');
      const Fanni = require('../models/Fanni');
      const Order = require('../models/Order');
      const WalletTransaction = require('../models/WalletTransaction');
      const { refreshReferralProgress } = require('../services/referralRewards');
      const { makeReferralCode, readReferralCode } = require('../utils/referralCodes');

      const clients = await Client.create([
        { name: 'داعي اختبار', phone: '01000000001', passwordHash: 'test-hash' },
        { name: 'مدعو اختبار', phone: '01000000002', passwordHash: 'test-hash' }
      ]);
      const clientCode = makeReferralCode('client', String(clients[0]._id));
      assert.equal(readReferralCode(clientCode)?.inviterId, String(clients[0]._id));
      await Referral.create({
        number: 'RFTESTCLIENT01', code: 'RFTESTCLIENT01', inviteCodeUsed: clientCode,
        kind: 'client', inviter: clients[0]._id, invitee: clients[1]._id, requiredCount: 1
      });
      await Order.create([
        { sn: 'SN990000', service: 'خدمة اختبار', area: 'القاهرة', clientName: 'مدعو اختبار', clientPhone: clients[1].phone, clientAccount: clients[1]._id, status: 'ملغي' },
        { sn: 'SN990001', service: 'خدمة اختبار', area: 'القاهرة', clientName: 'مدعو اختبار', clientPhone: clients[1].phone, clientAccount: clients[1]._id, status: 'تم الانتهاء', completionDeclaredAt: new Date() }
      ]);
      const AdminConfig = require('../models/AdminConfig');
      await AdminConfig.findOneAndUpdate({ key: 'main' }, { $set: { 'settings.referralsEnabled': false } }, { upsert: true, setDefaultsOnInsert: true });
      const clientOutcome = await refreshReferralProgress({ kind: 'client', inviteeId: clients[1]._id, mongoose });
      assert.equal(clientOutcome.status, 'completed');
      const clientBalances = await Client.find({ _id: { $in: clients.map(x => x._id) } }).sort({ phone: 1 }).lean();
      assert.deepEqual(clientBalances.map(x => x.walletBalance), [50, 50]);
      const clientTransactions = await WalletTransaction.find({ referralNumber: 'RFTESTCLIENT01', type: 'referral_reward' }).lean();
      assert.equal(clientTransactions.length, 2);
      assert.ok(clientTransactions.every(x => String(x.referral) === String(clientOutcome.referralId)));
      assert.equal(await refreshReferralProgress({ kind: 'client', inviteeId: clients[1]._id, mongoose }), null);
      const clientBalancesAfterRetry = await Client.find({ _id: { $in: clients.map(x => x._id) } }).sort({ phone: 1 }).lean();
      assert.deepEqual(clientBalancesAfterRetry.map(x => x.walletBalance), [50, 50]);

      const technicians = await Fanni.create([
        { name: 'فني داعي اختبار', phone: '01000000003', passwordHash: 'test-hash', specialties: ['تجربة'], areas: ['القاهرة'], status: 'معتمد', role: 'fanni' },
        { name: 'فني مدعو اختبار', phone: '01000000004', passwordHash: 'test-hash', specialties: ['تجربة'], areas: ['القاهرة'], status: 'معتمد', role: 'fanni' }
      ]);
      const technicianCode = makeReferralCode('fanni', String(technicians[0]._id));
      assert.equal(readReferralCode(technicianCode)?.kind, 'fanni');
      await Referral.create({
        number: 'RFTESTFANNI001', code: 'RFTESTFANNI001', inviteCodeUsed: technicianCode,
        kind: 'fanni', inviter: technicians[0]._id, invitee: technicians[1]._id, requiredCount: 3
      });
      await Order.create([
        { sn: 'SN990002', service: 'خدمة اختبار', area: 'القاهرة', clientName: 'عميل اختبار', clientPhone: '01000000005', assignedFanni: technicians[1]._id, status: 'تم الانتهاء', completionDeclaredAt: new Date(Date.now() + 1) },
        { sn: 'SN990003', service: 'خدمة اختبار', area: 'القاهرة', clientName: 'عميل اختبار', clientPhone: '01000000005', assignedFanni: technicians[1]._id, status: 'تم الانتهاء', completionDeclaredAt: new Date(Date.now() + 2) },
        { sn: 'SN990004', service: 'خدمة اختبار', area: 'القاهرة', clientName: 'عميل اختبار', clientPhone: '01000000005', assignedFanni: technicians[1]._id, status: 'ملغي' }
      ]);
      const beforeThird = await refreshReferralProgress({ kind: 'fanni', inviteeId: technicians[1]._id, mongoose });
      assert.equal(beforeThird.status, 'in_progress');
      const beforeThirdBalances = await Fanni.find({ _id: { $in: technicians.map(x => x._id) } }).sort({ phone: 1 }).lean();
      assert.deepEqual(beforeThirdBalances.map(x => x.walletBalance), [0, 0]);
      await Order.create({
        sn: 'SN990005', service: 'خدمة اختبار', area: 'القاهرة', clientName: 'عميل اختبار',
        clientPhone: '01000000005', assignedFanni: technicians[1]._id, status: 'تم الانتهاء',
        completionDeclaredAt: new Date(Date.now() + 3)
      });
      const technicianOutcome = await refreshReferralProgress({ kind: 'fanni', inviteeId: technicians[1]._id, mongoose });
      assert.equal(technicianOutcome.status, 'completed');
      const technicianBalances = await Fanni.find({ _id: { $in: technicians.map(x => x._id) } }).sort({ phone: 1 }).lean();
      assert.deepEqual(technicianBalances.map(x => x.walletBalance), [150, 150]);
      const technicianTransactions = await WalletTransaction.find({ referralNumber: 'RFTESTFANNI001', type: 'referral_reward' }).lean();
      assert.equal(technicianTransactions.length, 2);
      assert.ok(technicianTransactions.every(x => x.amount === 150));
      assert.equal(await refreshReferralProgress({ kind: 'fanni', inviteeId: technicians[1]._id, mongoose }), null);
      const referralRows = await Referral.find({ number: { $in: ['RFTESTCLIENT01', 'RFTESTFANNI001'] } }).lean();
      assert.ok(referralRows.every(x => x.status === 'completed' && x.achievementLog.length === x.requiredCount));
      await AdminConfig.findOneAndUpdate({ key: 'main' }, { $set: { 'settings.referralsEnabled': true } }, { upsert: true, setDefaultsOnInsert: true });
    });

    await test('unknown API route returns JSON 404', async () => {
      const r = await request(app).get('/api/route-that-does-not-exist');
      assert.equal(r.status, 404);
      assert.equal(r.body.message, 'مسار API غير موجود');
    });

    await test('error handler hides internal server details', async () => {
      let statusCode = 200;
      let payload;
      const res = {
        headersSent: false,
        status(code) { statusCode = code; return this; },
        json(body) { payload = body; return this; }
      };
      errorHandler(
        new Error('mongodb://private-host/secret or JWT_SECRET leaked'),
        { method: 'GET', originalUrl: '/api/test' }, res, () => {}
      );
      assert.equal(statusCode, 500);
      assert.equal(payload.message, 'حدث خطأ داخلي. حاول مرة أخرى لاحقًا.');
      assert.equal(JSON.stringify(payload).includes('private-host'), false);
      assert.equal(JSON.stringify(payload).includes('JWT_SECRET'), false);
    });
  } finally {
    if (mongoose) {
      try { await mongoose.disconnect(); } catch (_) {}
    }
    if (mongo) {
      try { await mongo.stop(); } catch (_) {}
    }
  }

  console.log('\nIntegration/security tests: ' + passed + ' passed, ' + failures.length + ' failed.');
  if (failures.length) {
    for (const failure of failures) {
      console.error('\nFAILED: ' + failure.name);
      console.error(failure.error?.stack || failure.error);
    }
  }

  // All tests and MongoDB cleanup have completed. Do not let unrelated
  // background handles keep the CI process alive.
  const exitCode = failures.length ? 1 : 0;
  process.exitCode = exitCode;
  await new Promise(resolve => process.stdout.write('', resolve));
  process.exit(exitCode);
}

run().catch(error => {
  console.error('Test runner failed before completing:', error);
  process.stdout.write('', () => process.exit(1));
});
