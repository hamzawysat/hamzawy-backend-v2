'use strict';

async function loadArchive(type = state.archiveType, page = state.archivePage) {
  const kind = type === 'fannis' ? 'fannis' : 'clients';
  if (!canReadTab(kind)) return showToast('هذا الأرشيف خارج صلاحيات حسابك', 'error');
  state.archiveType = kind;
  state.archivePage = Math.max(1, Number(page) || 1);
  state.archiveLoading = true;
  if (state.tab === 'archive') render();
  try {
    const params = new URLSearchParams({
      page: String(state.archivePage),
      limit: String(state.archiveLimit || 25)
    });
    if (state.archiveSearch) params.set('search', state.archiveSearch);
    const data = await tryApi(['/api/admin/' + kind + '/archive?' + params.toString()], { method: 'GET' });
    state.archiveRows = Array.isArray(data.items) ? data.items : [];
    state.archiveTotal = Number(data.total || 0);
    state.archivePages = Number(data.pages || 0);
    state.archivePage = Number(data.page || state.archivePage);
  } catch (error) {
    state.archiveRows = [];
    state.archiveTotal = 0;
    state.archivePages = 0;
    showToast(error.message || 'تعذر تحميل الأرشيف', 'error');
  } finally {
    state.archiveLoading = false;
    if (state.tab === 'archive') render();
  }
}

function setArchiveType(type) {
  const kind = type === 'fannis' ? 'fannis' : 'clients';
  if (!canReadTab(kind)) return showToast('ليس لديك صلاحية عرض هذا الأرشيف', 'error');
  state.archiveSearch = '';
  state.archivePage = 1;
  loadArchive(kind, 1);
}

async function searchArchive() {
  state.archiveSearch = String(document.getElementById('archive-search')?.value || '').trim();
  state.archivePage = 1;
  await loadArchive(state.archiveType, 1);
}

async function archiveAccount(kind, id, label = '') {
  const type = kind === 'fanni' ? 'fannis' : 'clients';
  if (!id) return showToast('معرّف الحساب غير متاح', 'error');
  if (!canWriteTab(type === 'fannis' ? 'fannis' : 'clients')) return showToast('ليس لديك صلاحية أرشفة هذا الحساب', 'error');
  const reason = prompt('سبب أرشفة ' + (type === 'fannis' ? 'الفني ' : 'العميل ') + label + ' (إجباري):');
  if (reason === null) return;
  if (reason.trim().length < 2) return showToast('سبب الأرشفة مطلوب، ويجب ألا يقل عن حرفين', 'error');
  if (!confirm('تأكيد أرشفة الحساب؟ سيُمنع من الدخول والعمليات الجديدة، مع الاحتفاظ بكل سجلاته وصوره.')) return;
  try {
    const data = await tryApi(['/api/admin/' + type + '/' + encodeURIComponent(id) + '/archive'], {
      method: 'POST', body: JSON.stringify({ reason: reason.trim() })
    });
    showToast(data.message || 'تمت الأرشفة');
    document.getElementById('unified-client-profile')?.remove();
    document.getElementById('unified-fanni-profile')?.remove();
    if (type === 'clients') { state.clientPage = 1; await loadClients(state.clientSearch || '', 1); }
    else await loadAll();
    if (state.tab === 'archive') await loadArchive(state.archiveType, state.archivePage);
  } catch (error) {
    showToast(error.message || 'تعذرت أرشفة الحساب', 'error');
  }
}

function choosePermanentDeleteMode(kind, id, label = '') {
  const type = kind === 'fannis' ? 'fannis' : 'clients';
  if (!id) return showToast('معرّف الحساب غير متاح', 'error');
  if (!canWriteTab(type)) return showToast('ليس لديك صلاحية حذف هذا الحساب', 'error');
  document.getElementById('archive-permanent-delete-choice')?.remove();
  const modal = document.createElement('div');
  modal.id = 'archive-permanent-delete-choice';
  modal.className = 'fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/60 p-4';
  modal.innerHTML = '<div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4" dir="rtl">' +
    '<div class="flex items-start justify-between gap-3"><div><h3 class="text-base font-black text-slate-900">حذف نهائي</h3><p class="mt-1 text-xs text-slate-500">' + escHtml(label || (type === 'fannis' ? 'الفني' : 'العميل')) + '</p></div><button type="button" data-close class="rounded-lg px-3 py-1 text-slate-500">✕</button></div>' +
    '<p class="text-xs leading-6 text-slate-600">اختر طريقة الحذف. لن يمكن التراجع عن حذف الحساب.</p>' +
    '<button type="button" data-delete-mode="all" class="w-full rounded-xl border border-red-200 bg-red-50 p-3 text-right"><span class="block text-sm font-black text-red-800">حذف الحساب وجميع السجلات المرتبطة</span><span class="mt-1 block text-[11px] leading-5 text-red-700">حذف الحساب والطلبات والسجلات والمعاملات التابعة له حسب نوع الحساب.</span></button>' +
    '<button type="button" data-delete-mode="keep" class="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-right"><span class="block text-sm font-black text-amber-900">حذف الحساب مع الاحتفاظ بالسجلات والمعاملات</span><span class="mt-1 block text-[11px] leading-5 text-amber-800">حذف الحساب فقط، مع إبقاء السجلات والطلبات والمعاملات التاريخية.</span></button>' +
    '<button type="button" data-close class="w-full rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">إلغاء</button></div>';
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => modal.remove()));
  modal.querySelectorAll('[data-delete-mode]').forEach(button => button.addEventListener('click', () => {
    const mode = button.getAttribute('data-delete-mode');
    modal.remove();
    permanentlyDeleteArchivedAccount(kind, id, mode, label);
  }));
}

async function permanentlyDeleteArchivedAccount(kind, id, mode, label = '') {
  const type = kind === 'fannis' ? 'fannis' : 'clients';
  if (!id) return showToast('معرّف الحساب غير متاح', 'error');
  if (!canWriteTab(type)) return showToast('ليس لديك صلاحية حذف هذا الحساب', 'error');
  const accountLabel = label || (type === 'fannis' ? 'الفني' : 'العميل');
  const confirmation = mode === 'all'
    ? 'تأكيد الحذف الشامل لـ ' + accountLabel + '؟ سيتم حذف السجلات والمعاملات المرتبطة وفق نوع الحساب، ولن يمكن التراجع.'
    : 'تأكيد حذف حساب ' + accountLabel + ' فقط؟ ستظل السجلات والمعاملات التاريخية محفوظة.';
  if (!confirm(confirmation)) return;
  try {
    const data = await tryApi(['/api/admin/' + type + '/' + encodeURIComponent(id) + '/permanent-delete'], {
      method: 'DELETE', body: JSON.stringify({ mode })
    });
    showToast(data.message || 'تم الحذف النهائي');
    document.getElementById('unified-client-profile')?.remove();
    document.getElementById('unified-fanni-profile')?.remove();
    await loadArchive(type, state.archivePage);
    if (type === 'clients') { state.clientPage = 1; await loadClients(state.clientSearch || '', 1); }
    else await loadAll();
  } catch (error) { showToast(error.message || 'تعذر الحذف النهائي', 'error'); }
}
async function restoreArchivedAccount(kind, id) {
  const type = kind === 'fannis' ? 'fannis' : 'clients';
  if (!id) return showToast('معرّف الحساب غير متاح', 'error');
  if (!canWriteTab(type === 'fannis' ? 'fannis' : 'clients')) return showToast('ليس لديك صلاحية استعادة هذا الحساب', 'error');
  if (!confirm('استعادة الحساب بنفس المعرف؟ سيظل الحظر العادي كما هو، ولن يُعاد تنشيط حساب كان موقوفًا قبل الأرشفة.')) return;
  try {
    const data = await tryApi(['/api/admin/' + type + '/' + encodeURIComponent(id) + '/restore'], {
      method: 'POST', body: JSON.stringify({})
    });
    showToast(data.message || 'تمت استعادة الحساب');
    await loadArchive(type, state.archivePage);
    if (type === 'clients') { state.clientPage = 1; await loadClients(state.clientSearch || '', 1); }
    else await loadAll();
  } catch (error) {
    showToast(error.message || 'تعذرت استعادة الحساب', 'error');
  }
}

function renderArchive() {
  const type = state.archiveType === 'fannis' ? 'fannis' : 'clients';
  const rows = Array.isArray(state.archiveRows) ? state.archiveRows : [];
  const canClients = canReadTab('clients');
  const canFannis = canReadTab('fannis');
  const dateText = value => value ? escHtml(new Date(value).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })) : '—';
  return `
    <section class="mt-4 space-y-4">
      <div class="premium-panel p-4 space-y-3">
        <div><h2 class="text-[14px] font-black">الأرشيف المركزي</h2><p class="text-[11px] text-slate-500 mt-1">الحسابات المؤرشفة فقط. الاستعادة لا تمسح السجلات التاريخية.</p></div>
        <div class="grid grid-cols-2 gap-2">
          ${canClients ? '<button onclick="setArchiveType(\'clients\')" class="pill-btn '+(type==='clients'?'primary-pill':'soft-btn')+'">عملاء مؤرشفون</button>' : ''}
          ${canFannis ? '<button onclick="setArchiveType(\'fannis\')" class="pill-btn '+(type==='fannis'?'primary-pill':'soft-btn')+'">فنيين مؤرشفين</button>' : ''}
        </div>
        <div class="flex gap-2"><input id="archive-search" value="${escHtml(state.archiveSearch||'')}" class="field flex-1" placeholder="ابحث بالاسم أو رقم الهاتف" onkeydown="if(event.key==='Enter')searchArchive()"><button onclick="searchArchive()" class="pill-btn primary-pill">بحث</button></div>
        <div class="flex justify-between text-[10px] text-slate-500"><span>إجمالي النتائج: ${Number(state.archiveTotal||0).toLocaleString('ar-EG')}</span><button onclick="loadArchive(state.archiveType,state.archivePage)" class="font-black text-blue-700">تحديث</button></div>
      </div>
      ${state.archiveLoading ? '<div class="premium-panel p-6 text-center">جاري تحميل الأرشيف...</div>' : ''}
      ${rows.map(item => {
        const id = String(item._id || '');
        const kind = type === 'fannis' ? 'فني' : 'عميل';
        return `<article class="premium-card p-4 space-y-2">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="font-black">${escHtml(item.name||kind)}</h3><p dir="ltr" class="text-sm text-slate-600">${escHtml(item.phone||'')}</p>${type==='fannis' ? '<p class="text-[10px] text-slate-500 mt-1">'+escHtml((item.specialties||[]).join('، '))+'</p>' : ''}</div><span class="text-[10px] rounded-full border border-amber-200 bg-amber-50 text-amber-800 px-2 py-1 font-black">مؤرشف</span></div>
          <div class="rounded-xl bg-slate-50 p-3 text-[11px] leading-6"><p><strong>سبب الأرشفة:</strong> ${escHtml(item.archiveReason||'—')}</p><p><strong>بواسطة:</strong> ${escHtml(item.archivedByName||'—')}</p><p><strong>التاريخ:</strong> ${dateText(item.archivedAt)}</p></div>
          ${canWriteTab(type) ? '<div class="grid grid-cols-2 gap-2"><button onclick="restoreArchivedAccount(\''+type+'\',\''+escHtml(id)+'\')" class="pill-btn primary-pill w-full">استعادة</button><button onclick="choosePermanentDeleteMode(\''+type+'\',\''+escHtml(id)+'\',\''+escHtml(item.name||kind)+'\')" class="pill-btn w-full border border-red-200 bg-red-50 text-red-700">حذف نهائي</button></div>' : ''}
        </article>`;
      }).join('') || (!state.archiveLoading ? '<div class="premium-panel p-8 text-center text-[12px] text-slate-500">لا توجد حسابات مؤرشفة في هذا القسم.</div>' : '')}
      <div class="premium-panel p-3 flex items-center justify-between gap-3 text-[11px]"><button class="pill-btn soft-btn" onclick="loadArchive(state.archiveType,Math.max(1,state.archivePage-1))" ${state.archivePage<=1?'disabled':''}>السابق</button><span>صفحة ${state.archivePage} من ${Math.max(1,state.archivePages)}</span><button class="pill-btn soft-btn" onclick="loadArchive(state.archiveType,state.archivePage+1)" ${state.archivePage>=state.archivePages?'disabled':''}>التالي</button></div>
    </section>`;
}
