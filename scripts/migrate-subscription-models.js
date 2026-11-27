'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const LegacySubscription = require('../src/models/UnifiedSubscription');
const { modelForType } = require('../src/models/subscriptionRepository');

const TYPES = ['maintenance', 'air_network', 'iptv'];
const BATCH_SIZE = 250;

function mapLegacyDocument(source) {
  const doc = { ...source };
  delete doc.subscriptionModel;
  if (source.type === 'maintenance') {
    doc.maintenanceDetails = {
      dishSize: source.dishSize || '',
      receiverType: source.receiverType || '',
      visitsIncluded: source.visitsIncluded || 0
    };
  } else if (source.type === 'air_network') {
    doc.localDetails = {
      networkName: source.networkName || '',
      activationCode: source.activationCode || '',
      deviceType: source.deviceType || ''
    };
  } else if (source.type === 'iptv') {
    doc.entertainmentDetails = {
      deviceType: source.deviceType || '',
      portalUrl: source.portalUrl || '',
      usernameEncrypted: source.iptvUsernameEncrypted || '',
      passwordEncrypted: source.iptvPasswordEncrypted || '',
      allowedDevices: source.allowedDevices || 1
    };
  }
  return doc;
}

async function migrateType(type) {
  const Target = modelForType(type);
  const sourceCollection = LegacySubscription.collection;
  const targetCollection = Target.collection;
  const sourceCount = await sourceCollection.countDocuments({ type });
  let cursor = sourceCollection.find({ type }).batchSize(BATCH_SIZE);
  let copied = 0;
  while (await cursor.hasNext()) {
    const batch = [];
    for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
      const source = await cursor.next();
      const doc = mapLegacyDocument(source);
      batch.push({ updateOne: { filter: { _id: doc._id }, update: { $setOnInsert: doc }, upsert: true } });
    }
    if (batch.length) {
      await targetCollection.bulkWrite(batch, { ordered: false });
      copied += batch.length;
    }
  }
  const sourceIds = sourceCollection.find({ type }, { projection: { _id: 1 } }).batchSize(BATCH_SIZE);
  let missing = 0;
  while (await sourceIds.hasNext()) {
    const docs = [];
    for (let i = 0; i < BATCH_SIZE && await sourceIds.hasNext(); i++) docs.push(await sourceIds.next());
    const ids = docs.map(doc => doc._id);
    const present = await targetCollection.countDocuments({ _id: { $in: ids } });
    missing += ids.length - present;
  }
  if (missing !== 0) throw new Error(type + ': migration verification failed; ' + missing + ' source records are missing from the target.');
  const targetCount = await targetCollection.countDocuments({ type });
  if (targetCount < sourceCount) throw new Error(type + ': target count is lower than source count.');
  return { type, sourceCount, targetCount, processed: copied, missing };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required. The migration does not read or print credentials.');
  await mongoose.connect(uri);
  const results = [];
  for (const type of TYPES) results.push(await migrateType(type));
  console.log('Subscription migration verified. Legacy collection was retained unchanged.');
  for (const result of results) console.log(JSON.stringify(result));
}

module.exports = { mapLegacyDocument, migrateType };

if (require.main === module) {
  main().then(() => mongoose.disconnect()).catch(async error => {
    console.error('Subscription migration stopped safely:', error.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exitCode = 1;
  });
}
