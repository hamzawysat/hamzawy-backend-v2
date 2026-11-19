'use strict';

const express = require('express');
const FanniCardLedger = require('../../models/FanniCardLedger');
const { decryptNationalId } = require('../../services/fanniCardOcr');
const { normalizePhone } = require('../../utils/phone');

function createAdminFanniCardLedgerRouter({ auth, writeAdminAudit, adminName }) {
  const router = express.Router();

  router.get('/fanni-card-ledger', auth('admin'), async (req, res, next) => {
    try {
      const query = {};
      if (req.query.status === 'duplicates') query['duplicateAttempts.0'] = { $exists: true };
      if (req.query.status === 'review') query['duplicateAttempts.status'] = 'قيد مراجعة الأدمن';
      const search = String(req.query.search || '').trim().slice(0, 80);
      if (search) query.$or = [
        { fanniName: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { extractedName: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      ];
      const canSeeFullNationalId = (req.user?.role === 'admin' && normalizePhone(req.user?.phone) === normalizePhone(process.env.ADMIN_PHONE || '')) || ['مدير', 'مشرف أول'].includes(String(req.user?.adminRole || ''));
      const rows = await FanniCardLedger.find(query).select('+nationalIdEncrypted')
        .sort({ firstRegisteredAt: -1 }).limit(500).lean();
      return res.set('Cache-Control', 'no-store').json({
        cards: rows.map(row => ({
          id: String(row._id),
          nationalId: (() => { const value = decryptNationalId(row.nationalIdEncrypted); return canSeeFullNationalId ? value : value.replace(/^(\d{3})\d{7}(\d{4})$/, '$1*******$2'); })(),
          fanniName: row.fanniName,
          extractedName: row.extractedName || '',
          fanniId: row.fanniId ? String(row.fanniId) : null,
          linkedTechnicians: (row.linkedTechnicians || []).map(item => ({
            fanniId: String(item.fanniId || ''),
            name: item.name || '',
            phone: item.phone || '',
            linkedAt: item.linkedAt
          })),
          firstRegisteredAt: row.firstRegisteredAt,
          status: row.status,
          duplicateAttempts: (row.duplicateAttempts || []).map(item => ({
            id: String(item._id),
            applicantName: item.applicantName,
            applicantPhone: item.applicantPhone,
            createdAt: item.createdAt,
            status: item.status,
            reviewedAt: item.reviewedAt,
            reviewedBy: item.reviewedBy,
            reviewNote: item.reviewNote
          }))
        }))
      });
    } catch (error) { next(error); }
  });

  router.patch('/fanni-card-ledger/:id/attempts/:attemptId', auth('admin'), async (req, res, next) => {
    try {
      const { id, attemptId } = req.params;
      if (!/^[a-f0-9]{24}$/i.test(id) || !/^[a-f0-9]{24}$/i.test(attemptId)) {
        return res.status(400).json({ message: 'معرّف سجل البطاقة غير صالح.' });
      }
      const status = String(req.body?.status || '');
      if (!['تكرار مؤكد', 'تم السماح بعد المراجعة'].includes(status)) {
        return res.status(400).json({ message: 'اختار قرار مراجعة صحيح.' });
      }
      const note = String(req.body?.note || '').trim().slice(0, 500);
      const ledger = await FanniCardLedger.findOneAndUpdate(
        { _id: id, 'duplicateAttempts._id': attemptId },
        { $set: {
          'duplicateAttempts.$.status': status,
          'duplicateAttempts.$.reviewedAt': new Date(),
          'duplicateAttempts.$.reviewedBy': adminName(req),
          'duplicateAttempts.$.reviewNote': note,
          lastReviewedAt: new Date(),
          lastReviewedBy: adminName(req),
          lastReviewNote: note
        } },
        { new: true }
      );
      if (!ledger) return res.status(404).json({ message: 'محاولة التكرار غير موجودة.' });
      const pending = ledger.duplicateAttempts.some(item => item.status === 'قيد مراجعة الأدمن');
      if (!pending) {
        ledger.status = 'مسجلة';
        await ledger.save();
      }
      await writeAdminAudit(req, 'مراجعة تكرار بطاقة فني', 'fanni-card-ledger', String(ledger._id), JSON.stringify({ attemptId, status, note }));
      return res.json({ message: status === 'تكرار مؤكد' ? 'تم تأكيد تكرار البطاقة.' : 'تم السماح الاستثنائي بمحاولة التسجيل. يجب إعادة المحاولة بنفس رقم الهاتف.', status });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = createAdminFanniCardLedgerRouter;
