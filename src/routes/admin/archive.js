'use strict';

const express = require('express');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createAdminArchiveRouter({ auth, Joi, Client, Fanni, adminName, writeAdminAudit, validId, sendBadId }) {
  const router = express.Router();
  const archiveReasonSchema = Joi.object({
    reason: Joi.string().trim().min(2).max(1000).required()
  }).required();

  function pagination(query) {
    const page = Math.max(1, Math.min(1000000, Number.parseInt(query.page, 10) || 1));
    const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit, 10) || 25));
    return { page, limit, skip: (page - 1) * limit };
  }

  function searchFilter(search) {
    const term = String(search || '').trim();
    if (!term) return {};
    const regex = new RegExp(escapeRegex(term), 'i');
    return { $or: [{ name: regex }, { phone: regex }] };
  }

  router.get('/clients/archive', auth('admin'), async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = { archivedAt: { $ne: null }, ...searchFilter(req.query.search) };
      const [items, total] = await Promise.all([
        Client.find(filter)
          .select('name phone status archivedAt archivedBy archivedByName archiveReason createdAt')
          .sort({ archivedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        Client.countDocuments(filter)
      ]);
      return res.set('Cache-Control', 'no-store').json({
        items, page, limit, total, pages: Math.ceil(total / limit)
      });
    } catch (error) { return next(error); }
  });

  router.get('/fannis/archive', auth('admin'), async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = { role: 'fanni', archivedAt: { $ne: null }, ...searchFilter(req.query.search) };
      const [items, total] = await Promise.all([
        Fanni.find(filter)
          .select('name phone status specialties level archivedAt archivedBy archivedByName archiveReason createdAt')
          .sort({ archivedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        Fanni.countDocuments(filter)
      ]);
      return res.set('Cache-Control', 'no-store').json({
        items, page, limit, total, pages: Math.ceil(total / limit)
      });
    } catch (error) { return next(error); }
  });

  router.post('/clients/:id/archive', auth('admin'), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return sendBadId(res);
      const { error, value } = archiveReasonSchema.validate(req.body || {}, { abortEarly: false });
      if (error) return res.status(400).json({ message: 'سبب الأرشفة إجباري، من حرفين إلى 1000 حرف.' });

      const archivedAt = new Date();
      const client = await Client.findOneAndUpdate(
        { _id: req.params.id, archivedAt: null },
        { $set: {
          archivedAt,
          archivedBy: req.user?._id || null,
          archivedByName: adminName(req),
          archiveReason: value.reason
        }, $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true }
      ).select('name phone status archivedAt archivedBy archivedByName archiveReason');

      if (!client) {
        const exists = await Client.exists({ _id: req.params.id });
        if (!exists) return res.status(404).json({ message: 'حساب العميل غير موجود.' });
        return res.status(409).json({ message: 'حساب العميل مؤرشف بالفعل.' });
      }

      await writeAdminAudit(req, 'أرشفة حساب عميل', 'clients', String(client._id),
        JSON.stringify({ phone: client.phone, reason: value.reason, archivedAt: archivedAt.toISOString() }));
      return res.json({ message: 'تمت أرشفة حساب العميل مع الاحتفاظ بكل سجلاته.', client });
    } catch (error) { return next(error); }
  });

  router.post('/fannis/:id/archive', auth('admin'), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return sendBadId(res);
      const { error, value } = archiveReasonSchema.validate(req.body || {}, { abortEarly: false });
      if (error) return res.status(400).json({ message: 'سبب الأرشفة إجباري، من حرفين إلى 1000 حرف.' });

      const archivedAt = new Date();
      const fanni = await Fanni.findOneAndUpdate(
        { _id: req.params.id, role: 'fanni', archivedAt: null },
        { $set: {
          archivedAt,
          archivedBy: req.user?._id || null,
          archivedByName: adminName(req),
          archiveReason: value.reason
        }, $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true }
      ).select('name phone status archivedAt archivedBy archivedByName archiveReason');

      if (!fanni) {
        const exists = await Fanni.exists({ _id: req.params.id, role: 'fanni' });
        if (!exists) return res.status(404).json({ message: 'حساب الفني غير موجود.' });
        return res.status(409).json({ message: 'حساب الفني مؤرشف بالفعل.' });
      }

      await writeAdminAudit(req, 'أرشفة حساب فني', 'fannis', String(fanni._id),
        JSON.stringify({ phone: fanni.phone, reason: value.reason, archivedAt: archivedAt.toISOString() }));
      return res.json({ message: 'تمت أرشفة حساب الفني مع الاحتفاظ بالهوية والصور وكل السجلات المرتبطة.', fanni });
    } catch (error) { return next(error); }
  });

  router.post('/clients/:id/restore', auth('admin'), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return sendBadId(res);
      const client = await Client.findOneAndUpdate(
        { _id: req.params.id, archivedAt: { $ne: null } },
        { $set: { archivedAt: null, archivedBy: null, archivedByName: '', archiveReason: '' },
          $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true }
      ).select('name phone status archivedAt');
      if (!client) {
        const exists = await Client.exists({ _id: req.params.id });
        if (!exists) return res.status(404).json({ message: 'حساب العميل غير موجود.' });
        return res.status(409).json({ message: 'حساب العميل غير مؤرشف بالفعل.' });
      }
      await writeAdminAudit(req, 'استعادة حساب عميل من الأرشيف', 'clients', String(client._id),
        JSON.stringify({ phone: client.phone }));
      return res.json({ message: 'تمت استعادة حساب العميل بنفس المعرف.', client });
    } catch (error) { return next(error); }
  });

  router.post('/fannis/:id/restore', auth('admin'), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return sendBadId(res);
      const fanni = await Fanni.findOneAndUpdate(
        { _id: req.params.id, role: 'fanni', archivedAt: { $ne: null } },
        { $set: { archivedAt: null, archivedBy: null, archivedByName: '', archiveReason: '' },
          $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true }
      ).select('name phone status archivedAt');
      if (!fanni) {
        const exists = await Fanni.exists({ _id: req.params.id, role: 'fanni' });
        if (!exists) return res.status(404).json({ message: 'حساب الفني غير موجود.' });
        return res.status(409).json({ message: 'حساب الفني غير مؤرشف بالفعل.' });
      }
      await writeAdminAudit(req, 'استعادة حساب فني من الأرشيف', 'fannis', String(fanni._id),
        JSON.stringify({ phone: fanni.phone }));
      return res.json({ message: 'تمت استعادة حساب الفني بنفس المعرف، مع الاحتفاظ بصوره وسجل هويته.', fanni });
    } catch (error) { return next(error); }
  });

  return router;
}

module.exports = createAdminArchiveRouter;
