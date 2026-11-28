'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-commerce.js'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-shell.js'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-navigation.js'), 'utf8');
const sourceAdminPage = fs.readFileSync(path.join(__dirname, '../../frontend/admin.html'), 'utf8');
const builtAdminPage = fs.readFileSync(path.join(__dirname, '../../frontend-dist/admin.html'), 'utf8');

const adminCore = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-core.js'), 'utf8');
const clientCore = fs.readFileSync(path.join(__dirname, '../../frontend/js/client-core.js'), 'utf8');
const clientCommerce = fs.readFileSync(path.join(__dirname, '../../frontend/js/client-commerce.js'), 'utf8');
const subscriptionsRoutes = fs.readFileSync(path.join(__dirname, '../routes/subscriptions.js'), 'utf8');
const state = {
  tab: 'commercePlans',
  commerceLoading: false,
  unifiedSubscriptionError: '',
  unifiedSubscriptionPlans: [{ _id: 'plan-1', name: 'باقة اختبار', type: 'maintenance', price: 100, durationDays: 365, visitCount: 2, allowedDevices: 1, active: true }],
  unifiedSubscriptions: [{ _id: 'sub-1', code: 'HS-TEST', type: 'iptv', status: 'active', clientName: 'عميل اختبار', clientPhone: '01000000000', endsAt: '2027-01-01T00:00:00.000Z', amount: 120, paymentMethod: 'wallet', paymentStatus: 'paid', iptvUsername: 'demo', iptvPassword: 'secret' }],
  unifiedSubscriptionVisits: [],
  unifiedSubscriptionFilters: {},
  unifiedPlansLoaded: false,
  unifiedSubscriptionsLoaded: false,
  unifiedVisitsLoaded: false,
  unifiedSubscriptionLoadId: 0
};
let renders = 0;
const context = {
  state,
  console,
  Date,
  Promise,
  setTimeout,
  clearTimeout,
  Number,
  String,
  Array,
  Object,
  Math,
  JSON,
  encodeURIComponent,
  getToken: () => 'test-token',
  escHtml: value => String(value ?? ''),
  extractList: value => Array.isArray(value) ? value : [],
  showToast: () => {},
  render: () => { renders += 1; },
  requestedPaths: [],
  tryApi: async paths => { context.requestedPaths.push(paths[0]); throw new Error('فشل اتصال اختباري'); }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'admin-commerce.js' });

assert.match(context.renderCommerce(), /إدارة باقات الاشتراك/, 'the plans tab must render without a missing-function error');
assert.equal(builtAdminPage.match(/admin-commerce\.js\?v=([^"']+)/)?.[1], sourceAdminPage.match(/admin-commerce\.js\?v=([^"']+)/)?.[1], 'built admin page must invalidate cached admin-commerce.js whenever its source version changes');
assert.ok(navigation.includes("else if(t==='commercePlans')loadCommerceCatalog()"), 'opening subscription plans must invoke the unified plans loader');
assert.ok(navigation.includes("else if(t==='commerceSubscriptions')loadClientSubscriptions()"), 'opening customer subscriptions must invoke the unified subscriptions loader');

assert.match(adminCore, /cache:opts\.cache\|\|'no-store'/, 'admin API reads must bypass browser conditional caching so 304 is never treated as an API failure');
assert.match(clientCore, /cache:requestOptions\.cache\|\|'no-store'/, 'client API reads must bypass browser conditional caching');
for (const route of ["/admin/plans", "/admin/list", "/admin/visits"]) {
  const routeStart = subscriptionsRoutes.indexOf("router.get('" + route + "'");
  assert.notEqual(routeStart, -1, 'missing subscription GET route ' + route);
  const routeEnd = subscriptionsRoutes.indexOf("\n});", routeStart);
  assert.match(subscriptionsRoutes.slice(routeStart, routeEnd), /Cache-Control','no-store'/, route + ' must disable HTTP caching');
}
assert.match(context.renderCommerce(), /باقة اختبار/, 'the plans tab must render available plans');
assert.ok(source.includes("const detailsAction=!['pending','cancelled'].includes(sub.status)?"), 'details completion must remain available after approval for all subscription types');
assert.ok(source.includes("type:'select',required:true,options:technicians.map"), 'technician assignment must use a technician picker rather than asking for an ID');
assert.ok(source.includes("type:'datetime-local'"), 'visit scheduling must use a date/time picker rather than an ISO text prompt');
assert.match(clientCommerce, /اشتراكاتي/);
assert.match(clientCommerce, /الاشتراكات المتاحة/);
assert.match(clientCommerce, /toggleUnifiedPlanDetails/);
assert.ok(clientCommerce.includes('state.unifiedPlanDetailsOpen'));

state.tab = 'commerceSubscriptions';
state.unifiedSubscriptionError = 'فشل تحميل تجريبي';
assert.match(context.renderCommerce(), /اشتراكات العملاء وطلبات الدفع/, 'the subscriptions tab must render its panel');
assert.match(context.renderCommerce(), /HS-TEST/, 'the subscriptions tab must render a real subscription card without injected helpers');
assert.match(context.renderCommerce(), /إعادة المحاولة/, 'the subscriptions panel must expose retry after an API error');
state.unifiedSubscriptions = [];

(async () => {
  state.unifiedSubscriptionError = '';
  const before = renders;
  await context.loadClientSubscriptions();
  assert.match(state.unifiedSubscriptionError, /فشل اتصال اختباري/, 'API failures must be shown to the admin');
  assert.ok(renders > before, 'the subscriptions panel must rerender after failed requests');
  assert.equal(context.requestedPaths.length, 3, 'the subscriptions view must request plans, customer subscriptions and visits independently');
  assert.equal(state.unifiedPlansLoaded, false, 'failed plan requests must not be marked as loaded');
  assert.equal(state.unifiedSubscriptionsLoaded, false, 'failed customer subscription requests must not be marked as loaded');
  assert.match(context.renderCommerce(), /تعذر تأكيد خلو القائمة/, 'failed customer requests must not be presented as a successful empty list');
  assert.match(context.renderCommerce(), /إعادة المحاولة/, 'the retry action must remain visible after failed requests');
  assert.match(shell, /section\.tabs\.filter\(item=>canReadTab\(item\.id\)\)\.map/, 'each navigation button must be filtered by its own permission');
  console.log('Admin subscription UI regressions: passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
