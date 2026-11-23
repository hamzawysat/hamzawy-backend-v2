'use strict';

function clientProfileValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return escHtml(JSON.stringify(value));
  return escHtml(String(value));
}

function clientProfileDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : escHtml(date.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }));
}

async function openClientProfile(clientId) {
  if (!clientId) return showToast('معرّف حساب العميل غير متاح', 'error');
  if (!canReadTab('clients')) return showToast('ليس لديك صلاحية عرض ملف العميل', 'error');
  let modal = document.getElementById('unified-client-profile');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'unified-client-profile';
  modal.className = 'fixed inset-0 z-[120] bg-slate-950/70 p-3 sm:p-6 overflow-y-auto';
  modal.innerHTML = '<div class="max-w-5xl mx-auto premium-panel p-5 mt-4"><div class="flex justify-between gap-3"><div><h2 class="font-black text-lg">ملف العميل الموحد</h2><p class="text-xs text-slate-500 mt-1">جاري تحميل بيانات الحساب وسجلاته...</p></div><button type="button" data-close class="pill-btn soft-btn">إغلاق</button></div><div class="py-10 text-center text-sm">جاري التحميل...</div></div>';
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('[data-close]').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  try {
    const data = await tryApi(['/api/admin/clients/' + encodeURIComponent(clientId) + '/profile'], { method: 'GET' });
    if (!modal.isConnected) return;
    const c = data.client || {};
    const section = (title, rows) => '<section class="rounded-xl border border-slate-200 p-3 space-y-2"><h3 class="font-black text-sm">' + title + '</h3>' + rows + '</section>';
    const row = (label, value) => '<div class="flex justify-between gap-3 text-xs border-b border-slate-100 pb-1"><span class="text-slate-500">' + label + '</span><strong class="text-left break-all">' + value + '</strong></div>';
    const entries = (items, renderItem, empty) => Array.isArray(items) && items.length ? items.map(renderItem).join('') : '<p class="text-xs text-slate-400">' + empty + '</p>';
    const wallet = entries(data.walletTransactions, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><div class="flex justify-between gap-2"><strong>' + clientProfileValue(x.type) + '</strong><strong>' + clientProfileValue(x.amount) + ' ج</strong></div><p>' + clientProfileValue(x.description) + '</p><p class="text-slate-500">' + clientProfileDate(x.createdAt) + ' • الرصيد بعد الحركة: ' + clientProfileValue(x.balanceAfter) + '</p></article>', 'لا توجد حركات محفظة');
    const orders = entries(data.orders, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><div class="flex justify-between gap-2"><strong>' + clientProfileValue(x.sn) + '</strong><strong>' + clientProfileValue(x.status) + '</strong></div><p>' + clientProfileValue(x.service) + ' • ' + clientProfileValue(x.area) + '</p><p class="text-slate-500">' + clientProfileDate(x.createdAt) + '</p></article>', 'لا توجد طلبات مرتبطة');
    const subscriptions = entries(data.subscriptions, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + clientProfileValue(x.itemName) + '</strong><p>' + clientProfileValue(x.status) + ' • ' + clientProfileValue(x.amount) + ' ج</p><p class="text-slate-500">' + clientProfileDate(x.startsAt) + ' إلى ' + clientProfileDate(x.endsAt) + '</p></article>', 'لا توجد اشتراكات');
    const topups = entries(data.topups, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + clientProfileValue(x.amount) + ' ج • ' + clientProfileValue(x.status) + '</strong><p>' + clientProfileValue(x.method) + ' • ' + clientProfileValue(x.senderNumber) + '</p><p class="text-slate-500">' + clientProfileDate(x.createdAt) + '</p></article>', 'لا توجد طلبات شحن');
    const storeOrders = entries(data.storeOrders, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + clientProfileValue(x.productName) + '</strong><p>' + clientProfileValue(x.status) + ' • ' + clientProfileValue(x.total) + ' ج</p><p class="text-slate-500">' + clientProfileDate(x.createdAt) + '</p></article>', 'لا توجد طلبات متجر');
    const complaints = entries(data.complaints, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + clientProfileValue(x.sn) + ' • ' + clientProfileValue(x.status) + '</strong><p>' + clientProfileValue(x.text) + '</p><p class="text-slate-500">' + clientProfileDate(x.createdAt) + '</p></article>', 'لا توجد شكاوى');
    const support = entries(data.supportCases, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + clientProfileValue(x.subject) + '</strong><p>' + clientProfileValue(x.status) + ' • ' + clientProfileValue((x.messages || []).length) + ' رسالة</p><p class="text-slate-500">' + clientProfileDate(x.lastMessageAt) + '</p></article>', 'لا توجد محادثات دعم');
    const notes = entries(c.adminNotesHistory, x => '<article class="rounded-lg bg-amber-50 p-2 text-xs"><p>' + clientProfileValue(x.note) + '</p><p class="text-slate-500 mt-1">' + clientProfileValue(x.by) + ' • ' + clientProfileDate(x.date) + '</p></article>', 'لا توجد ملاحظات داخلية');
    const audits = entries(data.auditLogs, x => '<article class="rounded-lg bg-slate-50 p-2 text-xs"><strong>' + clientProfileValue(x.action) + '</strong><p>' + clientProfileValue(x.details) + '</p><p class="text-slate-500">' + clientProfileValue(x.adminName) + ' • ' + clientProfileDate(x.createdAt) + '</p></article>', 'لا توجد سجلات تدقيق');
    modal.querySelector('.premium-panel').innerHTML = `
      <div class="flex items-start justify-between gap-3"><div><h2 class="font-black text-lg">${clientProfileValue(c.name)}</h2><p dir="ltr" class="text-sm text-slate-600 mt-1">${clientProfileValue(c.phone)}</p><p class="text-xs mt-2">${c.archivedAt ? 'مؤرشف' : c.status === 'معلق' ? 'موقوف' : 'نشط'} • الرصيد ${clientProfileValue(c.walletBalance)} ج</p></div><button type="button" data-close class="pill-btn soft-btn">إغلاق</button></div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 text-center">${[['الطلبات',data.totals?.orders],['الحركات',data.totals?.walletTransactions],['الاشتراكات',data.totals?.subscriptions],['الشكاوى',data.totals?.complaints]].map(([k,v])=>'<div class="rounded-xl bg-slate-50 p-2"><strong class="block text-lg">'+Number(v||0)+'</strong><span class="text-[10px] text-slate-500">'+k+'</span></div>').join('')}</div>
      <div class="flex flex-wrap gap-2 mb-4">
        <a href="/password.html?role=admin&amp;mode=admin-edit&amp;targetRole=client&amp;targetId=${encodeURIComponent(c._id)}" class="pill-btn soft-btn">تعديل البيانات</a>
        <button onclick="blockClient('${clientProfileValue(c.phone)}')" class="pill-btn soft-btn" ${c.status==='معلق'||c.archivedAt?'disabled':''}>تعليق</button>
        <button onclick="unblockClient('${clientProfileValue(c.phone)}')" class="pill-btn soft-btn" ${c.status!=='معلق'||c.archivedAt?'disabled':''}>إعادة تفعيل</button>
        <button onclick="noteClient('${clientProfileValue(c.phone)}').then(()=>openClientProfile('${clientProfileValue(c._id)}'))" class="pill-btn soft-btn">ملاحظة داخلية</button>
        <button onclick="changeAccountPassword('client','${clientProfileValue(c.phone)}')" class="pill-btn soft-btn">تغيير كلمة المرور</button>
        <button onclick="setForcedPasswordChange('client','${clientProfileValue(c.phone)}',true)" class="pill-btn soft-btn">إلزام تغيير كلمة المرور</button>
        <button onclick="setForcedPasswordChange('client','${clientProfileValue(c.phone)}',false)" class="pill-btn soft-btn">إلغاء الإلزام</button>
        <button onclick="issueSupportPassword('client','${clientProfileValue(c._id)}')" class="pill-btn soft-btn">إصدار كلمة دعم</button>
        <button onclick="revealSupportPassword('client','${clientProfileValue(c._id)}')" class="pill-btn soft-btn">عرض كلمة الدعم</button>
        <button onclick="createAdminClientSubscription('${clientProfileValue(c.phone)}')" class="pill-btn soft-btn">إدارة الاشتراك</button>
        <button onclick="addClientWalletBalance('${clientProfileValue(c._id)}')" class="pill-btn soft-btn">إضافة رصيد</button>
        <button onclick="deductClientWalletBalance('${clientProfileValue(c._id)}')" class="pill-btn soft-btn">خصم رصيد</button>
        <button onclick="settleClientWalletBalance('${clientProfileValue(c._id)}',${Number(c.walletBalance||0)})" class="pill-btn soft-btn">تسوية المحفظة</button>
        ${c.archivedAt ? '' : '<button onclick="archiveAccount(\'client\',\''+clientProfileValue(c._id)+'\',\''+clientProfileValue(c.name)+'\')" class="pill-btn danger-pill">أرشفة الحساب</button>'}
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        ${section('بيانات الحساب',row('الحالة',clientProfileValue(c.status))+row('تاريخ التسجيل',clientProfileDate(c.createdAt))+row('إلزام تغيير كلمة المرور',c.mustChangePassword?'نعم':'لا')+row('الملاحظة الحالية',clientProfileValue(c.adminNote)))}
        ${section('الملاحظات الداخلية',notes)}
        ${section('الطلبات',orders)}
        ${section('المحفظة وكشف الحركات',wallet)}
        ${section('الاشتراكات',subscriptions)}
        ${section('طلبات الشحن',topups)}
        ${section('طلبات المتجر',storeOrders)}
        ${section('الشكاوى',complaints)}
        ${section('الدعم',support)}
        ${section('سجل التدقيق',audits)}
      </div>`;
    modal.querySelector('[data-close]').addEventListener('click', close);
  } catch (error) {
    if (modal.isConnected) modal.querySelector('.premium-panel').innerHTML = '<div class="flex justify-between"><strong>تعذر تحميل ملف العميل</strong><button data-close class="pill-btn soft-btn">إغلاق</button></div><p class="text-sm mt-3">' + escHtml(error.message || 'حدث خطأ') + '</p>';
    modal.querySelector('[data-close]')?.addEventListener('click', close);
  }
}
