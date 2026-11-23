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
    if (type === 'clients') await loadClients(state.clientSearch || '');
    else await loadAll();
    if (state.tab === 'archive') await loadArchive(state.archiveType, state.archivePage);
  } catch (error) {
    showToast(error.message || 'تعذرت أرشفة الحساب', 'error');
  }
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
    if (type === 'clients') await loadClients(state.clientSearch || '');
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
          ${canClients ? '<button onclick="setArchiveType(\'clients\')" class="pill-btn '+(type==='clients'?'primary-pill':'soft-btn')+'">أرشيف العملاء</button>' : ''}
          ${canFannis ? '<button onclick="setArchiveType(\'fannis\')" class="pill-btn '+(type==='fannis'?'primary-pill':'soft-btn')+'">أرشيف الفنيين</button>' : ''}
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
          ${canWriteTab(type) ? '<button onclick="restoreArchivedAccount(\''+type+'\',\''+escHtml(id)+'\')" class="pill-btn primary-pill w-full">استعادة الحساب</button>' : ''}
        </article>`;
      }).join('') || (!state.archiveLoading ? '<div class="premium-panel p-8 text-center text-[12px] text-slate-500">لا توجد حسابات مؤرشفة في هذا القسم.</div>' : '')}
      <div class="premium-panel p-3 flex items-center justify-between gap-3 text-[11px]"><button class="pill-btn soft-btn" onclick="loadArchive(state.archiveType,Math.max(1,state.archivePage-1))" ${state.archivePage<=1?'disabled':''}>السابق</button><span>صفحة ${state.archivePage} من ${Math.max(1,state.archivePages)}</span><button class="pill-btn soft-btn" onclick="loadArchive(state.archiveType,state.archivePage+1)" ${state.archivePage>=state.archivePages?'disabled':''}>التالي</button></div>
    </section>`;
}
