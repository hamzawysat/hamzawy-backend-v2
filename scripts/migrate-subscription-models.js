'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const UnifiedSubscription = require('../src/models/UnifiedSubscription');
require('../src/models/MaintenanceSubscription');
require('../src/models/LocalSubscription');
require('../src/models/EntertainmentSubscription');

async function migrate() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required to run this migration.');
  await mongoose.connect(process.env.MONGODB_URI);
  const collection = UnifiedSubscription.collection;
  const mappings = [
    ['maintenance', 'maintenanceDetails', { dishSize: '$dishSize', receiverType: '$receiverType', visitsIncluded: '$visitsIncluded' }],
    ['air_network', 'localDetails', { networkName: '$networkName', activationCode: '$activationCode', deviceType: '$deviceType' }],
    ['iptv', 'entertainmentDetails', { deviceType: '$deviceType', portalUrl: '$portalUrl', usernameEncrypted: '$iptvUsernameEncrypted', passwordEncrypted: '$iptvPasswordEncrypted', allowedDevices: '$allowedDevices' }]
  ];
  for (const [type, detailField, details] of mappings) {
    const pipeline = [{ $set: { subscriptionModel: type, [detailField]: details } }];
    await collection.updateMany({ type, subscriptionModel: { $exists: false } }, pipeline);
  }
  console.log('Subscription model migration completed.');
}
migrate().then(() => mongoose.disconnect()).catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
