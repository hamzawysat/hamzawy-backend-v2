'use strict';

const Referral = require('../models/Referral');
const Client = require('../models/Client');
const Fanni = require('../models/Fanni');
const Order = require('../models/Order');
const WalletTransaction = require('../models/WalletTransaction');

async function refreshReferralProgress({ kind, inviteeId, mongoose, session: suppliedSession = null }) {
  if (!inviteeId || !['client', 'fanni'].includes(kind)) return null;
  const completedQuery = Order.find(kind === 'client'
    ? { clientAccount: inviteeId, status: 'تم الانتهاء' }
    : { assignedFanni: inviteeId, status: 'تم الانتهاء' })
    .select('_id sn completionDeclaredAt createdAt')
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
        kind, invitee: inviteeId, status: { $in: ['pending', 'in_progress', 'eligible'] }
      }).session(session);
      if (!referral) return;

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
      const inviter = await Model.findById(referral.inviter).session(session);
      const invitee = await Model.findById(referral.invitee).session(session);
      if (!inviter || !invitee) throw new Error('REFERRAL_PARTY_NOT_FOUND');

      const partyFields = [
        { key: 'inviterReward', account: inviter, owner: kind === 'client' ? 'client' : 'fanni', side: 'inviter' },
        { key: 'inviteeReward', account: invitee, owner: kind === 'client' ? 'client' : 'fanni', side: 'invitee' }
      ];

      for (const party of partyFields) {
        const reward = referral[party.key];
        if (reward?.paidAt) continue;
        const amount = 50;
        const before = Number(party.account.walletBalance || 0);
        const updated = await Model.findOneAndUpdate(
          { _id: party.account._id },
          { $inc: { walletBalance: amount } },
          { new: true, session, runValidators: true }
        );
        if (!updated) throw new Error('REFERRAL_WALLET_CREDIT_FAILED');
        const transaction = await new WalletTransaction({
          [party.owner]: updated._id,
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
