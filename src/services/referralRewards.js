'use strict';

const Referral = require('../models/Referral');
const Client = require('../models/Client');
const Fanni = require('../models/Fanni');
const Order = require('../models/Order');
const WalletTransaction = require('../models/WalletTransaction');
const FanniCardLedger = require('../models/FanniCardLedger');
const AdminAuditLog = require('../models/AdminAuditLog');

async function refreshReferralProgress({ kind, inviteeId, mongoose, session: suppliedSession = null }) {
  if (!inviteeId || !['client', 'fanni'].includes(kind)) return null;
  const completedQuery = Order.find(kind === 'client'
    ? { clientAccount: inviteeId, status: 'تم الانتهاء' }
    : { assignedFanni: inviteeId, status: 'تم الانتهاء' })
    .select('_id sn completionDeclaredAt createdAt assignedFanni clientAccount clientPhone')
    .sort({ completionDeclaredAt: 1, createdAt: 1 })
    .lean();
  if (suppliedSession) completedQuery.session(suppliedSession);
  const completedOrders = await completedQuery;
  const completedCount = completedOrders.length;
  const requiredCount = kind === 'client' ? 1 : 3;
  if (!completedCount) return null;

  const session = suppliedSession || await mongoose.startSession();
  let result = null;
  const settle = async () => {
      const referral = await Referral.findOne({
        kind, invitee: inviteeId, status: { $in: ['pending', 'in_progress', 'eligible', 'held_for_review'] }
      }).session(session);
      if (!referral) return;
      if (referral.status === 'held_for_review' && Array.isArray(referral.riskFlags) && referral.riskFlags.length) {
        result = { status: 'held_for_review', completedCount: count, requiredCount, reviewRequired: true, riskFlags: referral.riskFlags };
        return;
      }

      const count = Math.min(completedCount, requiredCount);
      referral.completedCount = count;
      referral.achievementLog = completedOrders.slice(0, requiredCount).map(order => ({ order: order._id, orderSN: order.sn, completedAt: order.completionDeclaredAt || order.createdAt || new Date() }));
      if (count < requiredCount) {
        referral.status = 'in_progress';
        await referral.save({ session });
        result = { status: referral.status, completedCount: count, requiredCount };
        return;
      }

      const Model = kind === 'client' ? Client : Fanni;
      const inviter = await Model.findById(referral.inviter).select('+registrationIpHash +registrationUserAgentHash +registrationDeviceIdHash').session(session);
      const invitee = await Model.findById(referral.invitee).select('+registrationIpHash +registrationUserAgentHash +registrationDeviceIdHash').session(session);
      if (!inviter || !invitee) throw new Error('REFERRAL_PARTY_NOT_FOUND');

      // Identity collisions are financial-risk holds, not automatic bans/rejections.
      const riskFlags = [];
      const inviterPhone = String(inviter.phone || '').trim();
      const inviteePhone = String(invitee.phone || '').trim();
      if (inviterPhone && inviteePhone && inviterPhone === inviteePhone) {
        riskFlags.push('same_phone_identity');
      }
      if (inviter.registrationDeviceIdHash && invitee.registrationDeviceIdHash && inviter.registrationDeviceIdHash === invitee.registrationDeviceIdHash) {
        riskFlags.push('same_device_id');
        riskFlags.push('same_device_different_phone');
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

      // A self-generated job between a referred account and its counterparty is
      // another reward-abuse path. Shared networks are only a review signal.
      const counterpartyIds = [...new Set(completedOrders
        .map(order => kind === 'client' ? order.assignedFanni : order.clientAccount)
        .filter(Boolean).map(String))];
      if (counterpartyIds.length) {
        const CounterpartyModel = kind === 'client' ? Fanni : Client;
        const counterparties = await CounterpartyModel.find({ _id: { $in: counterpartyIds } })
          .select('phone +registrationIpHash +registrationUserAgentHash +registrationDeviceIdHash')
          .session(session).lean();
        const byId = new Map(counterparties.map(account => [String(account._id), account]));
        for (const order of completedOrders) {
          const counterpartyId = kind === 'client' ? order.assignedFanni : order.clientAccount;
          const counterparty = counterpartyId ? byId.get(String(counterpartyId)) : null;
          if (!counterparty) continue;
          if (inviteePhone && String(counterparty.phone || '').trim() === inviteePhone) {
            riskFlags.push('same_order_party_phone');
          }
          if (invitee.registrationDeviceIdHash && counterparty.registrationDeviceIdHash && invitee.registrationDeviceIdHash === counterparty.registrationDeviceIdHash) {
            riskFlags.push('same_order_counterparty_device');
          }
          if (invitee.registrationIpHash && counterparty.registrationIpHash &&
              invitee.registrationIpHash === counterparty.registrationIpHash) {
            riskFlags.push('same_order_counterparty_ip');
            if (invitee.registrationUserAgentHash && counterparty.registrationUserAgentHash &&
                invitee.registrationUserAgentHash === counterparty.registrationUserAgentHash) {
              riskFlags.push('same_order_counterparty_device_signature');
            }
          }
        }
      }

      if (kind === 'fanni') {
        const sharedIdentity = await FanniCardLedger.findOne({
          $and: [
            { $or: [{ fanniId: inviter._id }, { 'linkedTechnicians.fanniId': inviter._id }] },
            { $or: [{ fanniId: invitee._id }, { 'linkedTechnicians.fanniId': invitee._id }] }
          ]
        }).session(session).select('_id').lean();
        if (sharedIdentity) riskFlags.push('shared_technician_national_id');
      }
      // Existing holds remain effective. After an administrator reviews a signal,
      // only newly discovered signal types can create another hold.
      if (Array.isArray(referral.riskFlags) && referral.riskFlags.length) {
        result = { status: 'held_for_review', completedCount: count, requiredCount, reviewRequired: true, riskFlags: referral.riskFlags };
        return;
      }
      const reviewedFlags = new Set(referral.riskReviewedFlags || []);
      const unreviewedRiskFlags = riskFlags.filter(flag => !reviewedFlags.has(flag));
      if (unreviewedRiskFlags.length) {
        referral.riskFlags = [...new Set([...(referral.riskFlags || []), ...unreviewedRiskFlags])];
        referral.riskDetectedAt = referral.riskDetectedAt || new Date();
        referral.status = 'held_for_review';
        await referral.save({ session });
        await AdminAuditLog.create([{
          action: 'تعليق مكافأة دعوة للاشتباه',
          category: 'referrals',
          target: String(referral._id),
          details: 'number=' + referral.number + '; flags=' + unreviewedRiskFlags.join(',') + '; payout held for manual review',
          adminName: 'النظام'
        }], { session });
        result = { status: 'held_for_review', completedCount: count, requiredCount, reviewRequired: true, riskFlags: unreviewedRiskFlags };
        return;
      }

      const partyFields = [
        { key: 'inviterReward', account: inviter, owner: kind === 'client' ? 'client' : 'fanni', side: 'inviter' },
        { key: 'inviteeReward', account: invitee, owner: kind === 'client' ? 'client' : 'fanni', side: 'invitee' }
      ];

      for (const party of partyFields) {
        const reward = referral[party.key];
        if (reward?.paidAt) continue;
        const amount = kind === 'fanni' ? 150 : 50;
        const before = Number(party.account.walletBalance || 0);
        const updated = await Model.findOneAndUpdate(
          { _id: party.account._id },
          { $inc: { walletBalance: amount } },
          { new: true, session, runValidators: true }
        );
        if (!updated) throw new Error('REFERRAL_WALLET_CREDIT_FAILED');
        const transaction = await new WalletTransaction({
          [party.owner]: updated._id,
          referral: referral._id,
          referralNumber: referral.number,
          type: 'referral_reward',
          amount,
          balanceBefore: before,
          balanceAfter: Number(updated.walletBalance),
          description: 'مكافأة دعوة رقم ' + referral.number + ' (' + party.side + ')',
          idempotencyKey: 'referral:' + String(referral._id) + ':' + party.side
        }).save({ session });
        reward.amount = amount;
        reward.paidAt = new Date();
        reward.walletTransaction = transaction._id;
      }

      referral.completedCount = count;
      referral.status = 'completed';
      await referral.save({ session });
      result = { status: 'completed', completedCount: count, requiredCount, referralId: String(referral._id) };
  };
  try {
    if (suppliedSession) await settle();
    else await session.withTransaction(settle);
    return result;
  } finally {
    if (!suppliedSession) await session.endSession();
  }
}

module.exports = { refreshReferralProgress };
