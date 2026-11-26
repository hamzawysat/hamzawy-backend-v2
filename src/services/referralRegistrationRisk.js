'use strict';

const Referral = require('../models/Referral');
const Client = require('../models/Client');
const Fanni = require('../models/Fanni');
const AdminAuditLog = require('../models/AdminAuditLog');

async function createReferralWithRegistrationRisk({
  kind, inviterId, inviteeId, number, usedCode, requiredCount, session
}) {
  const Model = kind === 'client' ? Client : Fanni;
  const OtherModel = kind === 'client' ? Fanni : Client;
  const [inviter, invitee] = await Promise.all([
    Model.findById(inviterId).select('phone +registrationIpHash +registrationUserAgentHash +registrationDeviceIdHash').session(session).lean(),
    Model.findById(inviteeId).select('phone +registrationIpHash +registrationUserAgentHash +registrationDeviceIdHash').session(session).lean()
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

  // حالتك بالظبط: نفس التليفون، رقمين مختلفين
  const sameDeviceId = Boolean(inviter.registrationDeviceIdHash && invitee.registrationDeviceIdHash &&
    inviter.registrationDeviceIdHash === invitee.registrationDeviceIdHash);
  if (sameDeviceId) {
    riskFlags.push('same_device_id');
    riskFlags.push('same_device_different_phone');
  }

  // عميل + فني نفس الجهاز = تحايل Cross-Role
  if (invitee.registrationDeviceIdHash) {
    const crossRole = await OtherModel.findOne({
      registrationDeviceIdHash: invitee.registrationDeviceIdHash
    }).select('_id').session(session).lean();
    if (crossRole) {
      riskFlags.push('cross_role_same_device');
    }
  }

  // البصمة فاضية خالص = مينفعش نقول "لا يوجد اشتباه"
  const fingerprintMissing = !inviter.registrationIpHash && !inviter.registrationDeviceIdHash &&
    !invitee.registrationIpHash && !invitee.registrationDeviceIdHash;
  if (fingerprintMissing) {
    riskFlags.push('fingerprint_missing');
  }

  const uniqueFlags = [...new Set(riskFlags)];
  const hasRisk = uniqueFlags.length > 0;

  const [referral] = await Referral.create([{
    number,
    code: number,
    inviteCodeUsed: usedCode,
    kind,
    inviter: inviterId,
    invitee: inviteeId,
    requiredCount,
    // أهم إصلاح: لو فيه اشتباه، الحالة held_for_review مش eligible
    ...(hasRisk ? {
      status: 'held_for_review',
      riskFlags: uniqueFlags,
      riskDetectedAt: new Date()
    } : {})
  }], { session });

  if (hasRisk) {
    await AdminAuditLog.create([{
      action: 'تعليق مكافأة دعوة للاشتباه عند التسجيل',
      category: 'referrals',
      target: String(referral._id),
      details: 'number=' + number + '; flags=' + uniqueFlags.join(',') + '; detectedAtRegistration=true; payout held for manual review',
      adminName: 'النظام'
    }], { session });
  }

  return referral;
}

module.exports = { createReferralWithRegistrationRisk };
