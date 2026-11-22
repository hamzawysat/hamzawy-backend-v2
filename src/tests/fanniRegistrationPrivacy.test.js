'use strict';

const fs = require('node:fs');
const path = require('node:path');
const route = fs.readFileSync(path.join(__dirname, '../routes/fanni.js'), 'utf8');
const identity = fs.readFileSync(path.join(__dirname, '../services/fanniCardIdentity.js'), 'utf8');
const model = fs.readFileSync(path.join(__dirname, '../models/Fanni.js'), 'utf8');
const adminProfiles = fs.readFileSync(path.join(__dirname, '../routes/admin/fanniProfiles.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
if (!route.includes("nationalId: Joi.string().trim().required()")) throw new Error('Registration must accept the technician-entered national ID.');
if (!route.includes("profilePhotoFileId: Joi.string().hex().length(24).required()")) throw new Error('Registration must require a profile photo stored in GridFS.');
if (!route.includes('identityCardFrontFileId') || !route.includes('identityCardBackFileId')) throw new Error('Both card sides must remain required.');
if (!model.includes('identityReviewStatus') || !model.includes('needs_resubmission')) throw new Error('Identity review state and resubmission status must be persisted.');
if (!identity.includes("createHmac('sha256'") || !identity.includes('aes-256-gcm')) throw new Error('National ID must be fingerprinted and encrypted at rest.');
if (!adminProfiles.includes('fanni-registration-requests') || !adminProfiles.includes('decryptNationalId')) throw new Error('Administrators must have a private identity review endpoint.');
const dependencyNames = Object.keys(packageJson.dependencies || {});\nif (dependencyNames.some(name => name.toLowerCase().includes('tesser') || name.toLowerCase().includes('paddle'))) throw new Error('Unexpected image text-recognition dependency remains.');
console.log('Technician manual identity registration privacy checks: passed');
