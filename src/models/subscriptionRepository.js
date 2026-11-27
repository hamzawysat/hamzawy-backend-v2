'use strict';
const MaintenanceSubscription = require('./MaintenanceSubscription');
const LocalSubscription = require('./LocalSubscription');
const EntertainmentSubscription = require('./EntertainmentSubscription');

const MODEL_BY_TYPE = {
  maintenance: MaintenanceSubscription,
  air_network: LocalSubscription,
  iptv: EntertainmentSubscription
};
const models = Object.values(MODEL_BY_TYPE);
function modelForType(type) {
  const model = MODEL_BY_TYPE[type];
  if (!model) throw new Error('Unsupported subscription type: ' + String(type));
  return model;
}
async function findSubscriptions(filter = {}, options = {}) {
  const { select, sort = { createdAt: -1 }, limit, session, lean = true } = options;
  const rows = await Promise.all(models.map(async model => {
    let query = model.find(filter);
    if (select) query = query.select(select);
    if (session) query = query.session(session);
    if (sort) query = query.sort(sort);
    if (limit) query = query.limit(limit);
    if (lean) query = query.lean();
    return query.exec();
  }));
  const merged = rows.flat();
  if (sort) {
    const entries = Object.entries(sort);
    merged.sort((a, b) => {
      for (const [field, direction] of entries) {
        const av = a[field] instanceof Date ? a[field].getTime() : (typeof a[field] === 'string' ? Date.parse(a[field]) : (a[field] ?? 0));
        const bv = b[field] instanceof Date ? b[field].getTime() : (typeof b[field] === 'string' ? Date.parse(b[field]) : (b[field] ?? 0));
        if (av < bv) return -1 * direction;
        if (av > bv) return 1 * direction;
      }
      return 0;
    });
  }
  return limit ? merged.slice(0, limit) : merged;
}
async function findSubscriptionOne(filter = {}, options = {}) {
  for (const model of models) {
    let query = model.findOne(filter);
    if (options.select) query = query.select(options.select);
    if (options.session) query = query.session(options.session);
    if (options.lean) query = query.lean();
    const found = await query.exec();
    if (found) return found;
  }
  return null;
}
async function findSubscriptionById(id, options = {}) {
  for (const model of models) {
    let query = model.findById(id);
    if (options.session) query = query.session(options.session);
    if (options.lean) query = query.lean();
    const found = await query.exec();
    if (found) return found;
  }
  return null;
}
function createSubscription(data) { return modelForType(data.type).create(data); }

module.exports = { models, modelForType, findSubscriptions, findSubscriptionOne, findSubscriptionById, createSubscription };
