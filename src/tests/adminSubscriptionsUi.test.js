'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-commerce.js'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '../../frontend/js/admin-shell.js'), 'utf8');
const state = {
  tab: 'commercePlans',
  commerceLoading: false,
  unifiedSubscriptionError: '',
  unifiedSubscriptionPlans: [{ _id: 'plan-1', name: 'باقة اختبار', type: 'maintenance', price: 100, durationDays: 365, visitCount: 2, allowedDevices: 1, active: true }],
  unifiedSubscriptions: [],
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
  Number,
  String,
  Array,
  Object,
  Math,
  JSON,
  encodeURIComponent,
  getToken: () => 'test-token',
  escHtml: value => String(value ?? ''),
  escAttr: value => String(value ?? ''),
  extractList: value => Array.isArray(value) ? value : [],
  showToast: () => {},
  render: () => { renders += 1; },
  requestedPaths: [],
  tryApi: async paths => { context.requestedPaths.push(paths[0]); throw new Error('فشل اتصال اختباري'); }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'admin-commerce.js' });

assert.match(context.renderCommerce(), /إدارة باقات الاشتراك/, 'the plans tab must render without a missing-function error');
assert.match(context.renderCommerce(), /باقة اختبار/, 'the plans tab must render available plans');

state.tab = 'commerceSubscriptions';
state.unifiedSubscriptionError = 'فشل تحميل تجريبي';
assert.match(context.renderCommerce(), /اشتراكات العملاء وطلبات الدفع/, 'the subscriptions tab must render its panel');
assert.match(context.renderCommerce(), /إعادة المحاولة/, 'the subscriptions panel must expose retry after an API error');

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
