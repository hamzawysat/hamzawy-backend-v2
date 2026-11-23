'use strict';

async function openFanniUnifiedProfile(id) {
  if (!id) return showToast('معرّف الفني غير متاح', 'error');
  if (!canReadTab('fannis')) return showToast('ليس لديك صلاحية عرض ملف الفني', 'error');
  let modal = document.getElementById('unified-fanni-profile');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'unified-fanni-profile';
  modal.className = 'fixed inset-0 z-[125] bg-slate-950/75 p-3 sm:p-6 overflow-y-auto';
  modal.innerHTML = '<div class="max-w-5xl mx-auto premium-panel p-5 mt-4"><div class="flex justify-between"><strong>ملف الفني الموحد</strong><button data-close class="pill-btn soft-btn">إغلاق</button></div><p class="py-10 text-center">جاري تحميل بيانات الفني وسجلاته...</p></div>';
  document.body.appendChild(modal);
  const profileImageUrls = [];
  const close = () => { profileImageUrls.forEach(url => URL.revokeObjectURL(url)); modal.remove(); };
  modal.querySelector('[data-close]').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  try {
    const data = await tryApi(['/api/admin/fannis/' + encodeURIComponent(id) + '/profile'], { method: 'GET' });
    if (!modal.isConnected) return;
    const f = data.fanni || {};
    const val = value => value === null || value === undefined || value === '' ? '—' : escHtml(typeof value === 'object' ? JSON.stringify(value) : String(value));
    const date = value => value ? escHtml(new Date(value).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })) : '—';
    const section = (title, body) => '<section class="rounded-xl border border-slate-200 p-3 space-y-2"><h3 class="font-black text-sm">' + title + '</h3>' + body + '</section>';
    const list = (items, renderItem, empty) => Array.isArray(items) && items.length ? items.map(renderItem).join('') : '<p class="text-xs text-slate-400">' + empty + '</p>';
    const orders = list(data.orders, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><div class="flex justify-between gap-2"><strong>' + val(x.sn) + '</strong><strong>' + val(x.status) + '</strong></div><p>' + val(x.service) + ' • ' + val(x.area) + '</p><p class="text-slate-500">' + date(x.createdAt) + '</p></article>', 'لا توجد طلبات مرتبطة');
    const offers = list(data.offers, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + val(x.orderSn) + ' • ' + val(x.service) + '</strong><p>' + val(x.price) + ' ج • ' + val(x.message) + '</p><p class="text-slate-500">' + val(x.status) + ' • ' + date(x.date) + '</p></article>', 'لا توجد عروض');
    const wallet = list(data.walletTransactions, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><div class="flex justify-between gap-2"><strong>' + val(x.type) + '</strong><strong>' + val(x.amount) + ' ج</strong></div><p>' + val(x.description) + '</p><p class="text-slate-500">' + date(x.createdAt) + ' • بعد الحركة: ' + val(x.balanceAfter) + ' ج</p></article>', 'لا توجد حركات محفظة');
    const topups = list(data.topups, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + val(x.amount) + ' ج • ' + val(x.status) + '</strong><p>' + val(x.method) + ' • ' + val(x.senderNumber) + '</p><p class="text-slate-500">' + date(x.createdAt) + '</p></article>', 'لا توجد طلبات شحن');
    const decisions = list(data.decisions, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + val(x.action) + '</strong><p>' + val(x.reason) + '</p><p class="text-slate-500">' + val(x.by) + ' • ' + date(x.date) + '</p></article>', 'لا يوجد سجل قرارات');
    const audits = list(data.auditLogs, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + val(x.action) + '</strong><p>' + val(x.details) + '</p><p class="text-slate-500">' + val(x.adminName) + ' • ' + date(x.createdAt) + '</p></article>', 'لا يوجد سجل تدقيق');
    const image = (key, title) => f.identityImages?.[key] ? '<div><p class="text-xs font-bold mb-1">' + title + '</p><div id="fanni-profile-image-' + key + '" class="w-full min-h-24 rounded-xl border bg-slate-50 flex items-center justify-center text-xs text-slate-400">تحميل الصورة...</div></div>' : '<div class="text-xs text-slate-400">' + title + ': غير متاحة</div>';
    const id = escHtml(String(f._id || id));
    modal.querySelector('.premium-panel').innerHTML = `
      <div class="flex items-start justify-between gap-3"><div><h2 class="font-black text-lg">${val(f.name)}</h2><p dir="ltr" class="text-sm text-slate-600 mt-1">${val(f.phone)}</p><p class="text-xs mt-2">${val(f.status)} • ${val(f.level)} • الرصيد ${val(f.walletBalance)} ج</p></div><button data-close class="pill-btn soft-btn">إغلاق</button></div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 my-4 text-center">${[['الطلبات',data.totals?.orders],['العروض',data.totals?.offers],['حركات المحفظة',data.totals?.walletTransactions],['الشحن',data.totals?.topups],['القرارات',data.totals?.decisions]].map(([k,v])=>'<div class="rounded-xl bg-slate-50 p-2"><strong class="block text-lg">'+Number(v||0)+'</strong><span class="text-[10px] text-slate-500">'+k+'</span></div>').join('')}</div>
      <div class="flex flex-wrap gap-2 mb-4">
        ${f.status === 'قيد المراجعة' || f.status === 'مرفوض' ? '<button onclick="approveFanni(\''+id+'\')" class="pill-btn primary-pill">اعتماد الفني</button><button onclick="rejectFanni(\''+id+'\')" class="pill-btn soft-btn">رفض الفني</button>' : ''}
        ${f.status === 'معلق' ? '<button onclick="enableFanni(\''+id+'\')" class="pill-btn primary-pill">إعادة تفعيل الفني</button>' : f.status === 'معتمد' ? '<button onclick="disableFanni(\''+id+'\')" class="pill-btn soft-btn">تعليق الفني</button>' : ''}
        <button onclick="openFanniProfileEditor('${id}')" class="pill-btn soft-btn">تعديل البيانات</button>
        <button onclick="viewFanniIdentityCard('${id}')" class="pill-btn soft-btn">عرض ومراجعة الصور</button>
        <button onclick="toggleTrustBadge('${id}')" class="pill-btn soft-btn">تبديل شارة موثوق</button>
        <button onclick="state.walletSelectedFanniId='${id}';addWalletBalance()" class="pill-btn soft-btn">إضافة للمحفظة</button>
        <button onclick="state.walletSelectedFanniId='${id}';deductWalletBalance()" class="pill-btn soft-btn">خصم من المحفظة</button>
        <button onclick="state.walletSelectedFanniId='${id}';adjustWallet()" class="pill-btn soft-btn">تسوية المحفظة</button>
        <button onclick="state.walletSelectedFanniId='${id}';loadWalletTransactions()" class="pill-btn soft-btn">كشف الحركات</button>
        <button onclick="state.walletSelectedFanniId='${id}';freezeWallet()" class="pill-btn soft-btn">تجميد / فك تجميد المحفظة</button>
        <button onclick="saveFanniLimit('${id}')" class="pill-btn soft-btn">حدود الاستقبال</button>
        <button onclick="saveFanniProfileControls('${id}')" class="pill-btn soft-btn">الثقة والظهور</button>
        <button onclick="changeAccountPassword('fanni','${id}')" class="pill-btn soft-btn">تغيير كلمة المرور</button>
        <button onclick="setForcedPasswordChange('fanni','${id}',true)" class="pill-btn soft-btn">إلزام تغيير كلمة المرور</button>
        <button onclick="setForcedPasswordChange('fanni','${id}',false)" class="pill-btn soft-btn">إلغاء الإلزام</button>
        <button onclick="issueSupportPassword('fanni','${id}')" class="pill-btn soft-btn">كلمة الدعم</button>
        <button onclick="changeFanniProfileLevel('${id}','${val(f.level)}')" class="pill-btn soft-btn">تغيير المستوى</button>
        <button onclick="saveFanniProfileNote('${id}')" class="pill-btn soft-btn">الملاحظات الداخلية</button>
        <button onclick="archiveAccount('fanni','${id}','${val(f.name)}')" class="pill-btn danger-pill">أرشفة الفني</button>
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        ${section('بيانات واعتماد الفني','<p class="text-xs">الحالة: '+val(f.status)+'</p><p class="text-xs">المستوى: '+val(f.level)+'</p><p class="text-xs">الخدمات: '+val((f.specialties||[]).join('، '))+'</p><p class="text-xs">مناطق العمل: '+val((f.areas||[]).join('، '))+'</p><p class="text-xs">التقييم: '+val(f.rating?.average)+' ('+val(f.rating?.count)+')</p><p class="text-xs">درجة الثقة: '+val(f.trustScore)+'</p><p class="text-xs">ملاحظة الإدارة: '+val(f.adminNote)+'</p>')}
        ${section('صور الفني والبطاقة والهوية','<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">'+image('profile','الصورة الشخصية')+image('front','البطاقة الأمامية')+image('back','البطاقة الخلفية')+'</div><p class="text-xs">الرقم القومي المسجل: <strong dir="ltr">'+val(f.nationalId)+'</strong></p><p class="text-xs">حالة سجل الهوية: '+val(data.cardLedger?.status)+'</p>')}
        ${section('الطلبات',orders)}
        ${section('العروض',offers)}
        ${section('المحفظة وكشف الحركات',wallet)}
        ${section('طلبات الشحن',topups)}
        ${section('سجل قرارات الإدارة',decisions)}
        ${section('سجل البطاقة والربط',list(data.cardLedger?.linkedTechnicians, x => '<p class="text-xs">'+val(x.name)+' • '+val(x.phone)+' • '+date(x.linkedAt)+'</p>', 'لا توجد روابط إضافية')+'<div class="border-t pt-2"><p class="text-xs font-black">محاولات التكرار</p>'+list(data.cardLedger?.duplicateAttempts, x => '<article class="rounded-lg bg-amber-50 p-2 text-xs"><strong>'+val(x.applicantName)+' • '+val(x.applicantPhone)+'</strong><p>'+val(x.status)+' • '+date(x.createdAt)+'</p><p>'+val(x.reviewedBy)+' • '+val(x.reviewNote)+'</p></article>', 'لا توجد محاولات تكرار')+'</div><p class="text-xs text-slate-500">آخر مراجعة: '+date(data.cardLedger?.lastReviewedAt)+' • '+val(data.cardLedger?.lastReviewedBy)+'</p><p class="text-xs">'+val(data.cardLedger?.lastReviewNote)+'</p>')}
        ${section('سجل التدقيق',audits)}
      </div>`;
    modal.querySelector('[data-close]').addEventListener('click', close);
    for (const [key, title] of [['profile', 'الصورة الشخصية'], ['front', 'البطاقة الأمامية'], ['back', 'البطاقة الخلفية']]) {
      const imagePath = f.identityImages?.[key];
      const target = modal.querySelector('#fanni-profile-image-' + key);
      if (!imagePath || !target) continue;
      try {
        const response = await fetch(BASE_URL + imagePath, {
          headers: { Authorization: 'Bearer ' + getToken() }, credentials: 'omit'
        });
        if (!response.ok) throw new Error('تعذر تحميل ' + title);
        const objectUrl = URL.createObjectURL(await response.blob());
        profileImageUrls.push(objectUrl);
        const img = document.createElement('img');
        img.src = objectUrl; img.alt = title;
        img.className = 'w-full max-h-64 rounded-xl object-contain';
        target.innerHTML = ''; target.appendChild(img);
      } catch (_) { target.textContent = 'تعذر تحميل الصورة'; }
    }
  } catch (error) {
    if (modal.isConnected) modal.querySelector('.premium-panel').innerHTML = '<div class="flex justify-between"><strong>تعذر تحميل ملف الفني</strong><button data-close class="pill-btn soft-btn">إغلاق</button></div><p class="text-sm mt-3">' + escHtml(error.message || 'حدث خطأ') + '</p>';
    modal.querySelector('[data-close]')?.addEventListener('click', close);
  }
}

async function changeFanniProfileLevel(id, currentLevel) {
  const levels = ['مبتدئ','ممارس','محترف','خبير مبتدئ','خبير','خبير أول','استشاري فني','نخبة','أسطوري'];
  const level = prompt('اكتب المستوى الجديد من القائمة التالية:\n' + levels.join('، '), currentLevel || 'مبتدئ');
  if (level === null) return;
  if (!levels.includes(level.trim())) return showToast('المستوى المختار غير صحيح', 'error');
  await updateFanniLevel(id, level.trim());
}
async function saveFanniProfileNote(id) {
  const note = prompt('اكتب الملاحظة الداخلية الجديدة على ملف الفني:');
  if (note === null) return;
  if (!note.trim()) return showToast('اكتب الملاحظة قبل الحفظ', 'error');
  try {
    const result = await tryApi(['/api/admin/fannis/' + encodeURIComponent(id) + '/note'], {
      method: 'PATCH', body: JSON.stringify({ note: note.trim() })
    });
    showToast(result.message || 'تم حفظ الملاحظة');
    await openFanniUnifiedProfile(id);
  } catch (error) { showToast(error.message || 'تعذر حفظ الملاحظة', 'error'); }
}
