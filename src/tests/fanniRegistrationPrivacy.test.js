'use strict';

const fs = require('node:fs');
const path = require('node:path');
const route = fs.readFileSync(path.join(__dirname, '../routes/fanni.js'), 'utf8');
const identity = fs.readFileSync(path.join(__dirname, '../services/fanniCardIdentity.js'), 'utf8');
const model = fs.readFileSync(path.join(__dirname, '../models/Fanni.js'), 'utf8');
const adminProfiles = fs.readFileSync(path.join(__dirname, '../routes/admin/fanniProfiles.js'), 'utf8');
if (/fanniCardOcr|readFanniCard|CARD_OCR_UNCLEAR|tesseract|PaddleOCR/i.test(route + identity + model + adminProfiles)) throw new Error('Technician registration must not depend on OCR.');
if (!/nationalId:\\s*Joi\\.string\\(\\)\\.trim\\(\\)\\.required\\(\\)/.test(route)) throw new Error('Registration must accept the technician-entered national ID.');
if (!/profilePhotoFileId:\\s*Joi\\.string\\(\\)\\.hex\\(\\)\\.length\\(24\\)\\.required\\(\\)/.test(route)) throw new Error('Registration must require a profile photo uploaded to GridFS.');
if (!/identityCardFrontFileId/.test(route) || !/identityCardBackFileId/.test(route)) throw new Error('Both card sides must remain required.');
if (!/identityReviewStatus/.test(model) || !/needs_resubmission/.test(model)) throw new Error('Identity review state and resubmission status must be persisted.');
if (!/createHmac\\('sha256'/.test(identity) || !/aes-256-gcm/.test(identity)) throw new Error('National ID must be fingerprinted and encrypted at rest.');
if (!/fanni-registration-requests/.test(adminProfiles) || !/decryptNationalId/.test(adminProfiles)) throw new Error('Administrators must have a private pending registration review endpoint.');
console.log('Technician manual identity registration privacy checks: passed');
