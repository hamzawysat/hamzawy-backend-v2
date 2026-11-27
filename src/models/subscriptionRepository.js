'use strict';
const MaintenanceSubscription = require('./MaintenanceSubscription');
const LocalSubscription = require('./LocalSubscription');
const EntertainmentSubscription = require('./EntertainmentSubscription');

const models = [MaintenanceSubscription, LocalSubscription, EntertainmentSubscription];
function modelForType(type) {
  const model = models.find(candidate => candidate.schema.path('type').enumValues.includes(type));
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
        const av = a[field] == null ? 0 : new Date(a[field]).getTime?.() ?? a[field];
        const bv = b[field] == null ? 0 : new Date(b[field]).getTime?.() ?? b[field];
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
