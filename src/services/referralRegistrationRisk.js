'use strict';

const Referral = require('../models/Referral');
const Client = require('../models/Client');
const Fanni = require('../models/Fanni');
const AdminAuditLog = require('../models/AdminAuditLog');

async function createReferralWithRegistrationRisk({
  kind, inviterId, inviteeId, number, usedCode, requiredCount, session
}) {
  const Model = kind === 'client' ? Client : Fanni;
  const [inviter, invitee] = await Promise.all([
    Model.findById(inviterId).select('phone +registrationIpHash +registrationUserAgentHash').session(session).lean(),
    Model.findById(inviteeId).select('phone +registrationIpHash +registrationUserAgentHash').session(session).lean()
  ]);
  if (!inviter || !invitee) throw new Error('REFERRAL_PARTY_NOT_FOUND');

  const riskFlags = [];
  const inviterPhone = String(inviter.phone || '').trim();
  const inviteePhone = String(invitee.phone || '').trim();
  if (inviterPhone && inviteePhone && inviterPhone === inviteePhone) {
    riskFlags.push('same_phone_identity');
  }

  const sameSignupIp = Boolean(inviter.registrationIpHash && invitee.registrationIpHash &&
    inviter.registrationIpHash === invitee.registrationIpHash);
  if (sameSignupIp) {
    riskFlags.push('same_registration_ip');
    if (inviter.registrationUserAgentHash && invitee.registrationUserAgentHash &&
        inviter.registrationUserAgentHash === invitee.registrationUserAgentHash) {
      riskFlags.push('same_registration_device_signature');
    }
  }

  const [referral] = await Referral.create([{
    number,
    code: number,
    inviteCodeUsed: usedCode,
    kind,
    inviter: inviterId,
    invitee: inviteeId,
    requiredCount,
    ...(riskFlags.length ? {
      status: 'eligible',
      riskFlags: [...new Set(riskFlags)],
      riskDetectedAt: new Date()
    } : {})
  }], { session });

  if (riskFlags.length) {
    await AdminAuditLog.create([{
      action: 'تعليق مكافأة دعوة للاشتباه عند التسجيل',
      category: 'referrals',
      target: String(referral._id),
      details: 'number=' + number + '; flags=' + [...new Set(riskFlags)].join(',') + '; detectedAtRegistration=true; payout held for manual review',
      adminName: 'النظام'
    }], { session });
  }

  return referral;
}

module.exports = { createReferralWithRegistrationRisk };
