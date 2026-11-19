'use strict';

function captureAdminInputFocus(){
  const app=document.getElementById('app');
  const active=document.activeElement;
  if(!app||!active||!app.contains(active)||!['INPUT','TEXTAREA'].includes(active.tagName))return null;
  const fields=Array.from(app.querySelectorAll('input,textarea'));
  return {
    id:active.id||'',
    name:active.name||'',
    placeholder:active.getAttribute('placeholder')||'',
    type:active.type||'',
    index:fields.indexOf(active),
    start:typeof active.selectionStart==='number'?active.selectionStart:null,
    end:typeof active.selectionEnd==='number'?active.selectionEnd:null,
    direction:active.selectionDirection||'none'
  };
}

function restoreAdminInputFocus(snapshot){
  if(!snapshot)return;
  const app=document.getElementById('app');
  if(!app)return;
  const fields=Array.from(app.querySelectorAll('input,textarea'));
  let target=snapshot.id?fields.find(el=>el.id===snapshot.id):null;
  if(!target&&snapshot.name)target=fields.find(el=>el.name===snapshot.name&&el.type===snapshot.type);
  if(!target&&snapshot.placeholder)target=fields.find(el=>el.getAttribute('placeholder')===snapshot.placeholder&&el.type===snapshot.type);
  if(!target&&snapshot.index>=0)target=fields[snapshot.index];
  if(!target)return;
  target.focus({preventScroll:true});
  if(snapshot.start!==null&&snapshot.end!==null&&typeof target.setSelectionRange==='function'){
    try{target.setSelectionRange(snapshot.start,snapshot.end,snapshot.direction);}catch(_){}
  }
}

function render(){
  const inputFocusSnapshot=captureAdminInputFocus();
  if(!getToken()){renderLogin();return;}
  if(!canReadTab(state.tab)){const first=ADMIN_SECTIONS.flatMap(section=>section.tabs).find(item=>canReadTab(item.id));state.tab=first?.id||'dashboard';}
  if(state.pageMode==='home'){try{window.sessionStorage?.setItem('sonaaAdminLastView',JSON.stringify({tab:state.tab||'dashboard',pageMode:'home'}));}catch(_){}}
  const visibleSections=ADMIN_SECTIONS.filter(section=>section.tabs.some(item=>canReadTab(item.id)));
  const isAuth=true;
  const pendingCount=state.fannis.filter(f=>!f.isApproved&&!f.isDisabled&&f.status!=='rejected').length;
  const disabledCount=state.fannis.filter(f=>f.isDisabled).length;

  document.getElementById('app').innerHTML=`
  <header class="admin-topbar sticky top-0 z-50" role="banner">
    <div class="admin-topbar-inner">
      <a href="#" onclick="event.preventDefault();state.pageMode='home';render()" class="admin-brand" aria-label="حمزاوي سات - لوحة الإدارة">
        <span class="admin-logo-frame"><img class="admin-header-logo" src="/images/LOGO_UPLOAD_HERE/logo.png" alt="شعار حمزاوي سات" width="48" height="48" decoding="async"></span>
        <span class="admin-brand-name">حمزاوي سات</span>
      </a>
      <label class="admin-header-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" value="${escHtml(state.search||'')}" oninput="onSearch(this.value)" placeholder="بحث..." aria-label="بحث في لوحة الإدارة">
      </label>
      <nav class="admin-header-actions" aria-label="حساب الإدارة">
        <button type="button" class="admin-icon-btn" onclick="setTab('notifications')" aria-label="الإشعارات" title="الإشعارات">🔔</button>
        <a class="admin-icon-btn" href="password.html?role=admin&amp;mode=account" aria-label="حسابي" title="حسابي">👤</a>
        <button type="button" class="admin-icon-btn admin-logout-btn" onclick="logout()" aria-label="خروج" title="خروج">⎋</button>
      </nav>
    </div>
  </header>
  
  <main class="mx-auto max-w-[800px] px-3 pb-28">

    ${isAuth?renderAdminKpis():''}
    ${isAuth?renderAdminQuickActions():''}
    
    ${!isAuth?`
      <section class="mt-8 max-w-[420px] mx-auto premium-panel p-6 sm:p-7 animate-fade">
        <div class="flex items-center gap-3.5">
          <div class="h-12 w-12 rounded-[14px] bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black">🔐</div>
          <div><h2 class="font-black text-[18px]">دخول الأدمن</h2><p class="text-[11px] text-slate-500 font-bold">إدارة مشروع حمزاوي سات</p></div>
        </div>
        <form onsubmit="event.preventDefault();doLogin();" class="mt-5 space-y-4">
          <label class="block"><span class="block text-[11px] font-black text-slate-700 mb-2">البريد الإلكتروني</span><input type="email" value="${escHtml(state.adminEmail)}" oninput="state.adminEmail=this.value" required placeholder="admin@sonaa.com" class="field"></label>
          <label class="block"><span class="block text-[11px] font-black text-slate-700 mb-2">كلمة المرور</span><input type="password" value="${escHtml(state.adminPass)}" oninput="state.adminPass=this.value" required placeholder="••••••••" class="field"></label>
          <button type="submit" ${state.loading?'disabled':''} class="w-full h-[48px] rounded-full bg-gradient-to-r from-[#171A22] to-[#A9822E] text-white text-[13px] font-black shadow-lg">${state.loading?'جاري...':'تسجيل الدخول ✨'}</button>
          ${state.error?`<p class="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-[14px] p-3.5 font-bold">${escHtml(state.error)}</p>`:''}
        </form>
      </section>
    `:`
      ${state.pageMode==='home'?`<section class="mt-4 premium-panel p-3 space-y-3">
        <div class="flex items-center justify-between px-1">
          <h2 class="text-[12px] font-black text-slate-700">مركز التحكم</h2>
          <span class="text-[10px] text-slate-500">7 أقسام رئيسية</span>
        </div>
        
        <div class="section-nav" aria-label="كل أدوات لوحة الإدارة">
          ${ADMIN_SECTIONS.filter(section=>section.tabs.some(item=>canReadTab(item.id))).map(section=>`
            <section class="section-nav-group">
              <h3 class="section-nav-heading"><span class="section-nav-icon">${section.icon}</span><span>${escHtml(section.label)}</span></h3>
              <div class="section-nav-items">
                ${section.tabs.map(item=>`
                  <div>
                    <button type="button" onclick="setTab('${item.id}')" class="section-nav-btn ${state.tab===item.id?'active':''}">
                      <span class="section-nav-label">${escHtml(item.label)}</span>${renderSectionCount(item)}
                    </button>
                    
                  </div>
                `).join('')}
                ${section.id==='customer-operations'?'<a href="password.html?role=admin&amp;mode=support" class="section-nav-btn inline-flex items-center justify-center gap-2 no-underline"><span aria-hidden="true">🔐</span><span class="section-nav-label">طلبات استعادة كلمة المرور</span><span id="sonaa-recovery-count" class="section-nav-count" aria-label="عدد طلبات استعادة كلمة المرور">!</span></a>':''}
              </div>
            </section>
          `).join('')}
        </div>
      </section>`:''}
      ${state.pageMode==='section'?`<div class="mt-3 premium-panel p-3 flex flex-col gap-2.5">
        ${state.tab==='orders'?`
          <select onchange="onFilterOrder(this.value)" class="field"><option value="الكل">كل الحالات</option><option value="__new">الطلبات الجديدة</option><option value="قيد المراجعة">قيد المراجعة</option><option value="تم النشر">تم النشر</option><option value="وصلتك عروض">وصلت عروض</option><option value="تم اختيار فني">تم اختيار فني</option><option value="تم الانتهاء">تم الانتهاء</option></select>
        `:state.tab==='fannis'||state.tab==='pending'||state.tab==='disabled'||state.tab==='levels'?`
          <select onchange="onFilter(this.value)" class="field"><option value="الكل">كل الحالات</option><option value="pending">قيد المراجعة</option><option value="approved">معتمد</option><option value="rejected">مرفوض</option><option value="disabled">معطل</option></select>
        `:''}
      </div>`:''}

      ${state.pageMode==='section'&&state.loading?`<div class="mt-4 premium-panel p-10 text-center"><div class="h-10 w-10 rounded-full border-[3px] border-slate-200 border-t-blue-600 animate-spin mx-auto"></div><p class="mt-3 text-[12px] font-black text-slate-500">جاري التحميل...</p></div>`:''}

      ${state.pageMode==='section'?`<div id="admin-tab-content" class="scroll-mt-24">
        ${renderCurrentTab()}
      </div>`:''}
    `}
  </main>
  <div onclick="closeAllMenus()" id="menu-backdrop" class="${Object.keys(state.dropdowns).length?'fixed inset-0 z-30 bg-black/5':''}"></div>
  `;
  restoreAdminInputFocus(inputFocusSnapshot);
}

function renderCurrentTab(){
  if(!canReadTab(state.tab))return '<div class="premium-panel mt-4 p-5 text-center text-[12px] font-bold text-slate-600">هذا القسم غير متاح ضمن صلاحيات حسابك.</div>';
  switch(state.tab){
    case 'dashboard': return renderDashboard();
    case 'profileEdits': return renderFanniProfileEdits();
    case 'fanniCardLedger': return renderFanniCardLedger();
    case 'fannis': case 'pending': case 'disabled': return renderFannis();
    case 'levels': return renderLevels();
    case 'roles': return renderRoles();
    case 'orders': return renderOrders();
    case 'offers': return renderOffers();
    case 'pricing': return renderPricing();
    case 'wallets': return renderWallets();
    case 'clientWallet': return renderClientWallet();
    case 'commercePlans': case 'commerceSubscriptions': return renderCommerce();
    case 'topups': return renderTopups();
    case 'complaints': return renderComplaints();
    case 'services': return renderServices();
    case 'regions': return renderRegions();
    case 'notifications': return renderNotifications();
    case 'settings': return renderSettings();
    case 'security': return renderSecurity();
    case 'reports': return renderReports();
    case 'pageVisits': return renderPageVisits();
    case 'support': return renderSupport();
    case 'content': return renderContent();
    case 'store': return renderStore();
    case 'storeOrders': return renderStoreOrders();
    case 'clients': return renderClients();
    case 'referrals': return renderReferralManagement();
    case 'stats': return renderStats();
    default: return renderFannis();
  }
}

function isAdminToday(value){
  if(!value)return false;
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return false;
  return date.toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'})===new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
}
function renderAdminKpis(){
  const items=[
    {label:'طلبات اليوم',value:(state.orders||[]).filter(item=>isAdminToday(item.createdAt||item.created_at)).length,icon:'📦'},
    {label:'عملاء جدد',value:(state.clients||[]).filter(item=>isAdminToday(item.createdAt||item.created_at||item.registeredAt)).length,icon:'👥'},
    {label:'شكاوى جديدة',value:getPendingComplaintCount(),icon:'💬'},
    {label:'فنيين بانتظار الاعتماد',value:getPendingTechnicianCount(),icon:'👷'}
  ];
  return '<section class="admin-kpi-grid" aria-label="المؤشرات الرئيسية">'+items.map(item=>'<article class="admin-kpi-card"><span class="admin-kpi-icon">'+item.icon+'</span><strong>'+Number(item.value).toLocaleString('ar-EG')+'</strong><span>'+item.label+'</span></article>').join('')+'</section>';
}
function renderAdminQuickActions(){
  return '<section class="admin-quick-actions" aria-label="إجراءات سريعة"><h2>إجراءات سريعة</h2><div class="admin-quick-grid">'+
    '<button type="button" onclick="adminQuickAction(\'order\')">＋ طلب جديد</button>'+
    '<button type="button" onclick="adminQuickAction(\'technician\')">＋ فني جديد</button>'+
    '<button type="button" onclick="adminQuickAction(\'product\')">＋ منتج جديد</button>'+
    '<button type="button" onclick="adminQuickAction(\'advertisement\')">＋ إعلان جديد</button>'+
  '</div></section>';
}
function adminQuickAction(action){
  if(action==='order'){setTab('orders');state.filterOrder='__new';applyOrderFilter();return;}
  if(action==='technician'){setTab('pending');return;}
  if(action==='advertisement'){setTab('content');return;}
  if(action==='product'){
    state.storeProductEditingId=null;
    state.storeProductFormOpen=true;
    state.storeNewProductAsAdvertisement=false;
    setTab('store');
    return;
  }
}
function renderDashboard(){
  return `
  <section class="mt-4 space-y-4">
    <div class="premium-panel p-4">
      <h2 class="text-sm font-black">نظرة عامة</h2>
      <p class="mt-1 text-[11px] font-bold text-slate-500">ملخص حركة الطلبات والعملاء والفنيين خلال الفترة الأخيرة</p>
    </div>
    <div class="premium-panel p-4">
      <h3 class="text-[12px] font-black">آخر العمليات</h3>
      <div class="mt-3 space-y-2">
        ${[...state.orders].slice(0,5).map(o=>`<div class="flex justify-between items-center gap-2 text-[11px] font-bold border-b border-slate-100 pb-2"><span>${escHtml(o.sn||'SN')} - ${escHtml(o.clientName||'عميل')}</span><span class="text-[10px] text-slate-400">${escHtml(statusLabel(o.status))}</span></div>`).join('')||'<p class="text-[11px] text-slate-400">لا توجد عمليات حديثة</p>'}
      </div>
    </div>
    ${renderStats()}
  </section>`;
}
