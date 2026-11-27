'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const LegacySubscription = require('../src/models/UnifiedSubscription');
const { modelForType } = require('../src/models/subscriptionRepository');

const TYPES = ['maintenance', 'air_network', 'iptv'];
const BATCH_SIZE = 250;

function sourceHash(source) { return crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex'); }

function mapLegacyDocument(source) {
  const doc = { ...source };
  doc.__legacyMigrationHash = sourceHash(source);
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
      try {
        await targetCollection.bulkWrite(batch, { ordered: false });
      } catch (error) {
        const writeErrors = error.writeErrors || error.result?.getWriteErrors?.() || [];
        if (!writeErrors.length || writeErrors.some(item => Number(item.code) !== 11000)) throw error;
        // Concurrent app instances may insert the same _id. The verification
        // below decides whether every source record now exists in the target.
      }
      copied += batch.length;
    }
  }
  const sourceDocs = sourceCollection.find({ type }).batchSize(BATCH_SIZE);
  let missing = 0;
  let mismatched = 0;
  while (await sourceDocs.hasNext()) {
    const docs = [];
    for (let i = 0; i < BATCH_SIZE && await sourceDocs.hasNext(); i++) docs.push(await sourceDocs.next());
    const ids = docs.map(doc => doc._id);
    const targetDocs = await targetCollection.find({ _id: { $in: ids } }, { projection: { _id: 1, __legacyMigrationHash: 1 } }).toArray();
    const byId = new Map(targetDocs.map(doc => [String(doc._id), doc]));
    for (const source of docs) {
      const target = byId.get(String(source._id));
      if (!target) missing++;
      else if (target.__legacyMigrationHash !== sourceHash(source)) mismatched++;
    }
  }
  if (missing !== 0 || mismatched !== 0) {
    throw new Error(type + ': migration verification failed; missing=' + missing + ', mismatched=' + mismatched + '. Legacy source remains untouched.');
  }
  const targetCount = await targetCollection.countDocuments({ type });
  if (targetCount < sourceCount) throw new Error(type + ': target count is lower than source count.');
  return { type, sourceCount, targetCount, processed: copied, missing, mismatched };
}

async function migrateAll() {
  const markerCollection = mongoose.connection.collection('subscription_migrations');
  const migrationId = 'unified-subscriptions-to-independent-collections-v1';
  const marker = await markerCollection.findOne({ _id: migrationId });
  if (marker?.status === 'completed') return { skipped: true, results: marker.results || [] };
  const results = [];
  for (const type of TYPES) results.push(await migrateType(type));
  await markerCollection.updateOne(
    { _id: migrationId },
    { $set: { status: 'completed', completedAt: new Date(), results } },
    { upsert: true }
  );
  return { skipped: false, results };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required. The migration does not read or print credentials.');
  await mongoose.connect(uri);
  const result = await migrateAll();
  console.log(result.skipped ? 'Subscription migration was already verified.' : 'Subscription migration verified.');
  console.log('Legacy collection was retained unchanged.');
  for (const item of result.results) console.log(JSON.stringify(item));
}

module.exports = { mapLegacyDocument, migrateType, migrateAll };

if (require.main === module) {
  main().then(() => mongoose.disconnect()).catch(async error => {
    console.error('Subscription migration stopped safely:', error.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exitCode = 1;
  });
}
