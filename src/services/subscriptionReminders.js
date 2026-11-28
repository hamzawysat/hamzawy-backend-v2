'use strict';
const { models, findSubscriptions, findSubscriptionById } = require('../models/subscriptionRepository');
const SubscriptionVisit = require('../models/SubscriptionVisit');
const { createNotification, notifyAdmins } = require('../utils/notifications');
const DAY = 86400000;
function dayKey(date) { return new Date(date).toISOString().slice(0,10); }
function calendarDaysBetween(date, startOfDay) {
  const value = new Date(date);
  return Math.round((Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) -
    Date.UTC(startOfDay.getFullYear(), startOfDay.getMonth(), startOfDay.getDate())) / DAY);
}
async function runSubscriptionReminders(now = new Date()) {
  const start = new Date(now);
  start.setHours(0,0,0,0);
  const end = new Date(start.getTime() + 8*DAY);

  // Capture due reminders before expiring records. An end date at midnight
  // must still produce its day-zero reminder when this job runs later that day.
  const subscriptions = await findSubscriptions(
    { status: 'active', endsAt: { $gte: start, $lt: end } },
    { select: 'code client clientName type endsAt', sort: null }
  );

  for (const s of subscriptions) {
    const remaining = calendarDaysBetween(s.endsAt, start);
    if (![7,2,1,0].includes(remaining)) continue;
    const key = dayKey(s.endsAt) + ':' + remaining;
    const title = remaining === 0 ? 'انتهى الاشتراك اليوم' : 'اقترب انتهاء الاشتراك';
    const message = remaining === 0
      ? 'انتهى اشتراكك ' + s.code + '. يمكنك التواصل مع الإدارة للتجديد.'
      : 'متبقي ' + remaining + ' يوم على انتهاء اشتراكك ' + s.code + '.';

    if ([2,0].includes(remaining)) {
      await createNotification({
        recipientRole:'client', recipientId:s.client, type:'subscription_expiry_reminder',
        title, message, link:'/client',
        dedupeKey:'subscription-client:' + String(s._id) + ':' + key
      });
    }
    await notifyAdmins({
      type:'admin_subscription_expiry', title:'متابعة انتهاء اشتراك',
      message:'الاشتراك ' + s.code + ' للعميل ' + s.clientName + ' - ' +
        (remaining === 0 ? 'ينتهي اليوم' : 'متبقي ' + remaining + ' يوم'),
      link:'/admin?tab=commerceSubscriptions',
      dedupeKey:'subscription-admin:' + String(s._id) + ':' + key
    });
  }

  // Only expire subscriptions after their due reminders have been queued.
  // If notification creation fails, the job can retry while the record is active.
  await Promise.all(models.map(model =>
    model.updateMany({ status: 'active', endsAt: { $lte: now } }, { $set: { status: 'expired' } })
  ));

  const visits = await SubscriptionVisit.find({
    status:'scheduled', scheduledAt: { $gte:start, $lt:end }
  }).select('technician scheduledAt subscription').lean();
  for (const v of visits) {
    const remaining = calendarDaysBetween(v.scheduledAt, start);
    if (remaining !== 1 || !v.technician) continue;
    const subscription = await findSubscriptionById(v.subscription, { lean: true });
    await createNotification({
      recipientRole:'fanni', recipientId:v.technician, type:'subscription_visit_reminder',
      title:'تذكير بزيارة صيانة غدًا',
      message:'لديك زيارة غدًا للاشتراك ' + (subscription?.code || ''),
      link:'/fanni',
      dedupeKey:'subscription-visit:' + String(v._id) + ':' + dayKey(v.scheduledAt)
    });
  }
}
module.exports = { runSubscriptionReminders };
