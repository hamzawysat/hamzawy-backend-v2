'use strict';

function renderAdminInbox(){
  const list=Array.isArray(state.adminInboxNotifications)?state.adminInboxNotifications:[];
  const unread=Number(state.adminInboxUnread||0);
  let html='<div class="flex items-center justify-between gap-2"><div><p class="text-[12px] font-black">الوارد الإداري</p><p class="text-[10px] text-slate-500">تنبيهات موجهة لحساب الإدارة الحالي — غير المقروء: '+unread+'</p></div><div class="flex gap-2"><button type="button" onclick="loadAdminInbox()" class="pill-btn soft-btn">تحديث</button><button type="button" onclick="markAllAdminInboxRead()" class="pill-btn soft-btn">قراءة الكل</button></div></div><div id="admin-inbox-list" class="space-y-2">';
  if(!list.length)html+='<p class="p-4 text-center text-[11px] text-slate-500">لا توجد تنبيهات واردة حاليًا.</p>';
  list.forEach(item=>{html+='<button type="button" data-admin-inbox-id="'+escHtml(item.id)+'" onclick="openAdminInboxNotification(this.dataset.adminInboxId)" class="block w-full rounded-xl border p-3 text-right '+(item.read?'border-slate-200 bg-white':'border-blue-200 bg-blue-50')+'"><b class="block text-[11px] font-black">'+escHtml(item.title||'تنبيه إداري')+'</b><span class="mt-1 block text-[10px] leading-5 text-slate-700">'+escHtml(item.message||'')+'</span><small class="mt-1 block text-[9px] text-slate-500">'+escHtml(item.createdAt?new Date(item.createdAt).toLocaleString('ar-EG'):'')+'</small></button>';});
  return html+'</div>';
}
async function loadAdminInbox(){
  try{const data=await tryApi(['/api/notifications/admin'],{method:'GET'});state.adminInboxNotifications=extractList(data,['notifications']);state.adminInboxUnread=Math.max(0,Number(data.unreadCount||0));}
  catch(e){state.adminInboxNotifications=Array.isArray(state.adminInboxNotifications)?state.adminInboxNotifications:[];console.warn('تعذر تحميل الوارد الإداري:',e.message||e);}
  const root=document.getElementById('admin-inbox-list');if(root)root.outerHTML=renderAdminInbox();
}
async function markAllAdminInboxRead(){
  try{await tryApi(['/api/notifications/admin/read-all'],{method:'PATCH'});state.adminInboxNotifications=(state.adminInboxNotifications||[]).map(item=>({...item,read:true}));state.adminInboxUnread=0;const root=document.getElementById('admin-inbox-list');if(root)root.outerHTML=renderAdminInbox();}
  catch(e){showToast(e.message||'تعذر تعليم التنبيهات كمقروءة','error');}
}
async function openAdminInboxNotification(id){
  const item=(state.adminInboxNotifications||[]).find(entry=>String(entry.id)===String(id));if(!item)return;
  if(!item.read){try{await tryApi(['/api/notifications/admin/'+encodeURIComponent(id)+'/read'],{method:'PATCH'});}catch(e){showToast(e.message||'تعذر تحديث حالة الإشعار','error');return;}item.read=true;state.adminInboxUnread=Math.max(0,Number(state.adminInboxUnread||0)-1);}
  const type=String(item.type||'');
  let tab='';
  try{
    const target=new URL(String(item.link||''),window.location.origin);
    if(target.origin===window.location.origin)tab=String(target.searchParams.get('tab')||'');
  }catch(_){}
  if(!tab)tab=type.includes('order')||type.includes('offer')?'orders':type.includes('client')?'clients':type.includes('technician')||type.includes('fanni')?'fannis':type.includes('topup')?'topups':type.includes('wallet')?'wallets':type.includes('complaint')?'complaints':type.includes('support')?'support':type.includes('password_recovery')?'passwordRecovery':'';
  if(tab&&typeof setTab==='function'&&canReadTab(tab))setTab(tab);
  else{const root=document.getElementById('admin-inbox-list');if(root)root.outerHTML=renderAdminInbox();}
}
function renderDeliveryAudit(){
  const entries=Array.isArray(state.adminDeliveryLogs)?state.adminDeliveryLogs:[];
  if(!entries.length)return '<p class="p-3 text-center text-[10px] text-slate-500">لا توجد سجلات إرسال بعد.</p>';
  const label=status=>({accepted:'قبله مزود الإرسال',partial:'قبول جزئي',failed:'فشل',error:'خطأ',no_devices:'لا توجد أجهزة مسجلة',not_configured:'القناة غير مهيأة'})[status]||String(status||'غير معروف');
  return entries.map(item=>{
    const channels=item.channels||{};
    const channel=(name,title)=>{const c=channels[name]||{};return '<div class="rounded-lg bg-slate-50 p-2"><b>'+title+': '+label(c.status)+'</b><div class="mt-1 text-[9px] text-slate-600">محاولات أجهزة: '+Number(c.attempted||0)+' • قبول: '+Number(c.accepted||0)+' • فشل: '+Number(c.failed||0)+'</div>'+(c.lastError?'<div class="mt-1 text-[9px] text-red-700 break-words">السبب: '+escHtml(c.lastError)+'</div>':'')+'</div>';};
    return '<div class="rounded-xl border border-slate-200 p-3 space-y-2"><div class="flex items-center justify-between gap-2"><b class="text-[10px]">'+escHtml(item.type||'إشعار')+'</b><span class="text-[9px] text-slate-500">'+escHtml(item.role||'')+'</span></div><div class="grid grid-cols-1 gap-2">'+channel('expo','Expo')+channel('fcm','FCM')+channel('webPush','Web Push')+'</div><small class="block text-[9px] text-slate-500">'+escHtml(item.createdAt?new Date(item.createdAt).toLocaleString('ar-EG'):'')+'</small></div>';
  }).join('');
}
async function loadNotificationDeliveryAudit(){
  try{const data=await tryApi(['/api/notifications/admin/delivery-log?limit=30'],{method:'GET'});state.adminDeliveryLogs=extractList(data,['deliveries']);}
  catch(e){state.adminDeliveryLogs=Array.isArray(state.adminDeliveryLogs)?state.adminDeliveryLogs:[];console.warn('تعذر تحميل سجل تتبع الإشعارات:',e.message||e);}
  const root=document.getElementById('admin-delivery-log-list');if(root)root.innerHTML=renderDeliveryAudit();
}
function renderNotifications(){
  return `
  <section class="mt-4 space-y-4">
    <div class="premium-panel p-4 space-y-3">${renderAdminInbox()}</div>
    <div class="premium-panel p-4 space-y-3"><div class="flex items-center justify-between gap-2"><div><p class="text-[12px] font-black">تتبع تسليم الإشعارات</p><p class="text-[10px] text-slate-500">نتائج مزودي الإرسال لكل قناة، دون تخزين رموز الأجهزة</p></div><button type="button" onclick="loadNotificationDeliveryAudit()" class="pill-btn soft-btn">تحديث</button></div><div id="admin-delivery-log-list" class="space-y-2">${renderDeliveryAudit()}</div></div>
    <div class="rounded-[18px] bg-gradient-to-r from-violet-600 to-purple-600 p-4 text-white"><p class="text-[12px] font-black">الإشعارات والرسائل</p><p class="text-[10px] text-violet-100 mt-1">إرسال فردي أو جماعي حسب نوع الحساب وحالته</p></div>
    <div class="premium-panel p-4 space-y-3">
      <label class="block text-[11px] font-black">طريقة الإرسال<select id="notification-mode" onchange="updateNotificationMode()" class="field mt-2 w-full"><option value="single">إشعار لفرد محدد</option><option value="group">إشعار جماعي لفئة</option></select></label>
      <label class="block text-[11px] font-black">نوع الحساب<select id="notification-recipient-role" onchange="updateNotificationAudience()" class="field mt-2 w-full"><option value="fanni">الفنيون</option><option value="client">العملاء</option></select></label>
      <div id="notification-phone-wrap"><label class="block text-[11px] font-black">رقم هاتف المستلم<input id="notification-recipient-phone" type="tel" inputmode="tel" autocomplete="off" maxlength="20" placeholder="رقم هاتف الفني أو العميل" class="field mt-2 w-full" /></label></div>
      <div id="notification-audience-wrap" class="hidden"><label class="block text-[11px] font-black">الفئة المستهدفة<select id="notification-audience" class="field mt-2 w-full"><option value="all">جميع الفنيين</option><option value="approved">الفنيون المعتمدون</option><option value="disabled">الفنيون المعطلون (معلقون)</option></select></label><p class="mt-1 text-[10px] text-slate-500">الإرسال الجماعي يرسل إشعارًا داخل التطبيق لكل حساب مطابق للاختيار.</p></div>
      <input id="notification-title" maxlength="100" placeholder="عنوان الإشعار..." class="field" />
      <textarea id="notification-message" rows="3" maxlength="300" placeholder="نص الرسالة (حتى 300 حرف)..." class="field"></textarea>
      <button id="send-notification-btn" onclick="sendNotification()" class="pill-btn primary-pill w-full">إرسال الإشعار 🔔</button>
      <div class="rounded-[12px] bg-slate-50 border p-3 text-[10px] font-bold text-slate-500">الإرسال داخل التطبيق فقط، وليس SMS. ستظهر رسالة تأكيد قبل الإرسال الجماعي.</div>
    </div>
    <div class="premium-panel p-4 space-y-3">
      <div class="flex items-center justify-between gap-3"><div><p class="text-[12px] font-black">سجل الإشعارات الإدارية</p><p class="mt-1 text-[10px] text-slate-500">الحذف هنا يزيل الإشعار من جميع الحسابات التي أُرسل إليها.</p></div><button type="button" onclick="loadNotificationHistory()" class="pill-btn soft-btn shrink-0">تحديث</button></div>
      <div id="notification-history-list" class="space-y-2">${renderNotificationHistory()}</div>
    </div>
  </section>`;
}


function updateNotificationMode(){const mode=document.getElementById('notification-mode')?.value||'single';const phoneWrap=document.getElementById('notification-phone-wrap');const audienceWrap=document.getElementById('notification-audience-wrap');if(phoneWrap)phoneWrap.classList.toggle('hidden',mode!=='single');if(audienceWrap)audienceWrap.classList.toggle('hidden',mode!=='group');updateNotificationAudience();}


function updateNotificationAudience(){const role=document.getElementById('notification-recipient-role')?.value||'fanni';const select=document.getElementById('notification-audience');if(!select)return;const current=select.value;const options=role==='fanni'?[['all','جميع الفنيين'],['approved','الفنيون المعتمدون'],['disabled','الفنيون المعطلون (معلقون)']]:[['all','جميع العملاء'],['active','العملاء النشطون'],['disabled','العملاء المعطلون (معلقون)']];select.innerHTML=options.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');if(options.some(option=>option[0]===current))select.value=current;}




function renderNotificationHistory(){
  const campaignContent=state.notificationHistoryLoading
    ? '<p class="p-4 text-center text-[11px] text-slate-500">جاري تحميل سجل الإشعارات...</p>'
    : !state.notificationHistory.length
      ? '<p class="p-4 text-center text-[11px] text-slate-500">لا توجد إشعارات إدارية محفوظة.</p>'
      : state.notificationHistory.map(item => '<div class="rounded-xl border border-slate-200 p-3 space-y-2"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-[11px] font-black break-words">'+escHtml(item.title||'إشعار بدون عنوان')+'</p><p class="mt-1 text-[10px] leading-5 text-slate-600 break-words">'+escHtml(item.message||'')+'</p></div><button type="button" data-id="'+escHtml(item.id)+'" onclick="deleteNotificationCampaign(this.dataset.id)" class="shrink-0 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[10px] font-black text-red-700">حذف</button></div><div class="flex flex-wrap items-center gap-2 text-[9px] text-slate-500"><span class="rounded-full bg-slate-100 px-2 py-1">'+(item.recipientRole==='client'?'العملاء':'الفنيون')+'</span><span class="rounded-full bg-blue-50 px-2 py-1 text-blue-700">عدد المستلمين: '+Number(item.count||0)+'</span><span>'+escHtml(item.createdAt?new Date(item.createdAt).toLocaleString('ar-EG'):'')+'</span></div></div>').join('');
  return '<div class="space-y-4">'+renderAdminInbox()+'<div class="premium-panel p-4 space-y-3"><div class="flex items-center justify-between gap-2"><div><p class="text-[12px] font-black">تتبع تسليم الإشعارات</p><p class="text-[10px] text-slate-500">حالة Expo وFCM وإشعارات المتصفح لكل قناة</p></div><button type="button" onclick="loadNotificationDeliveryAudit()" class="pill-btn soft-btn">تحديث</button></div><div id="admin-delivery-log-list" class="space-y-2">'+renderDeliveryAudit()+'</div></div><div id="notification-campaign-history" class="space-y-2">'+campaignContent+'</div></div>';
}


async function loadNotificationHistory(){
  const root=document.getElementById('notification-history-list');
  state.notificationHistoryLoading=true;
  if(root)root.innerHTML=renderNotificationHistory();
  try{await Promise.all([loadAdminInbox(),loadNotificationDeliveryAudit()]);const data=await tryApi(['/api/admin/notifications/direct'],{method:'GET'});state.notificationHistory=extractList(data,['notifications']);}
  catch(e){state.notificationHistory=[];showToast(e.message||'تعذر تحميل سجل الإشعارات','error');}
  finally{state.notificationHistoryLoading=false;const target=document.getElementById('notification-history-list');if(target)target.innerHTML=renderNotificationHistory();}
}


async function deleteNotificationCampaign(id){
  const item=state.notificationHistory.find(entry=>String(entry.id)===String(id));
  if(!item)return showToast('الإشعار غير موجود في القائمة؛ حدّث السجل','error');
  if(!confirm('تأكيد حذف الإشعار «'+String(item.title||'').slice(0,100)+'» من '+Number(item.count||0)+' حساب؟ لا يمكن التراجع عن الحذف.'))return;
  try{const data=await tryApi(['/api/admin/notifications/direct/'+encodeURIComponent(id)],{method:'DELETE'});showToast((data.message||'تم حذف الإشعار')+' — المحذوف: '+Number(data.deleted||0));await loadNotificationHistory();}
  catch(e){showToast(e.message||'تعذر حذف الإشعار','error');}
}
