'use strict';

function renderAdminInbox(){
  const list=Array.isArray(state.adminInboxNotifications)?state.adminInboxNotifications:[];
  if(!list.length)return '<p class="p-4 text-center text-[11px] text-slate-500">لا توجد تنبيهات واردة حاليًا.</p>';
  return list.map(item=>{
    const id=escHtml(item.id);
    return '<article class="flex items-start gap-2 rounded-xl border p-3 '+(item.read?'border-slate-200 bg-white':'border-blue-200 bg-blue-50')+'"><button type="button" data-admin-inbox-id="'+id+'" onclick="openAdminInboxNotification(this.dataset.adminInboxId)" class="min-w-0 flex-1 text-right"><b class="block text-[11px] font-black">'+escHtml(item.title||'تنبيه إداري')+'</b><span class="mt-1 block text-[10px] leading-5 text-slate-700">'+escHtml(item.message||'')+'</span><small class="mt-1 block text-[9px] text-slate-500">'+escHtml(item.createdAt?new Date(item.createdAt).toLocaleString('ar-EG'):'')+'</small></button></article>';
  }).join('');
}
async function loadAdminInbox(){
  try{const data=await tryApi(['/api/notifications/admin'],{method:'GET'});state.adminInboxNotifications=extractList(data,['notifications']);state.adminInboxUnread=Math.max(0,Number(data.unreadCount||0));}
  catch(e){state.adminInboxNotifications=Array.isArray(state.adminInboxNotifications)?state.adminInboxNotifications:[];console.warn('تعذر تحميل الوارد الإداري:',e.message||e);}
  const root=document.getElementById('admin-inbox-list');if(root)root.innerHTML=renderAdminInbox();
}
async function markAllAdminInboxRead(){
  try{await tryApi(['/api/notifications/admin/read-all'],{method:'PATCH'});state.adminInboxNotifications=(state.adminInboxNotifications||[]).map(item=>({...item,read:true}));state.adminInboxUnread=0;const root=document.getElementById('admin-inbox-list');if(root)root.innerHTML=renderAdminInbox();}
  catch(e){showToast(e.message||'تعذر تعليم التنبيهات كمقروءة','error');}
}
async function dismissAdminInboxNotification(id){
  const item=(state.adminInboxNotifications||[]).find(entry=>String(entry.id)===String(id));
  if(!item)return;
  if(!item.read){
    try{await tryApi(['/api/notifications/admin/'+encodeURIComponent(id)+'/read'],{method:'PATCH'});}
    catch(error){showToast(error.message||'تعذر تسجيل قراءة الإشعار','error');return;}
    item.read=true;
    state.adminInboxUnread=Math.max(0,Number(state.adminInboxUnread||0)-1);
  }
  state.adminInboxNotifications=(state.adminInboxNotifications||[]).filter(entry=>String(entry.id)!==String(id));
  const root=document.getElementById('admin-inbox-list');
  if(root)root.outerHTML=renderAdminInbox();
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
    <div class="rounded-[18px] bg-gradient-to-r from-violet-600 to-purple-600 p-4 text-white"><p class="text-[12px] font-black">إرسال الإشعارات</p><p class="text-[10px] text-violet-100 mt-1">إرسال فردي أو جماعي للفنيين أو العملاء</p></div>
    <div class="premium-panel p-4 space-y-3">
      <label class="block text-[11px] font-black">طريقة الإرسال<select id="notification-mode" onchange="updateNotificationMode()" class="field mt-2 w-full"><option value="single">إشعار لفرد محدد</option><option value="group">إشعار جماعي لفئة</option></select></label>
      <label class="block text-[11px] font-black">نوع الإشعار<select id="notification-reply-mode" class="field mt-2 w-full"><option value="normal">إشعار عادي</option><option value="one_reply">إشعار يسمح برد واحد</option></select></label>
      <label class="block text-[11px] font-black">نوع الحساب<select id="notification-recipient-role" onchange="updateNotificationAudience();clearNotificationRecipient()" class="field mt-2 w-full"><option value="fanni">الفنيون</option><option value="client">العملاء</option></select></label>
      <div id="notification-phone-wrap"><label class="block text-[11px] font-black">ابحث عن المستلم بالاسم أو بداية رقم الهاتف<input id="notification-recipient-search" type="search" autocomplete="off" maxlength="60" placeholder="اكتب اسم العميل أو الفني أو أول أرقام هاتفه" class="field mt-2 w-full" oninput="searchNotificationRecipients()" /></label><input id="notification-recipient-phone" type="hidden" /><input id="notification-recipient-id" type="hidden" /><div id="notification-recipient-results" class="mt-2 space-y-1"></div><p id="notification-recipient-selected" class="mt-2 text-[11px] font-bold text-blue-700"></p></div>
      <div id="notification-audience-wrap" class="hidden"><label class="block text-[11px] font-black">الفئة المستهدفة<select id="notification-audience" class="field mt-2 w-full"><option value="all">جميع الفنيين</option><option value="approved">الفنيون المعتمدون</option><option value="disabled">الفنيون المعطلون (معلقون)</option></select></label><p class="mt-1 text-[10px] text-slate-500">الإرسال الجماعي يرسل إشعارًا داخل التطبيق لكل حساب مطابق للاختيار.</p></div>
      <input id="notification-title" maxlength="100" placeholder="عنوان الإشعار..." class="field" />
      <textarea id="notification-message" rows="3" maxlength="300" placeholder="نص الرسالة (حتى 300 حرف)..." class="field"></textarea>
      <button id="send-notification-btn" onclick="sendNotification()" class="pill-btn primary-pill w-full">إرسال الإشعار 🔔</button>
      <div class="rounded-[12px] bg-slate-50 border p-3 text-[10px] font-bold text-slate-500">الإرسال داخل التطبيق فقط، وليس SMS. ستظهر رسالة تأكيد قبل الإرسال الجماعي.</div>
    </div>
    <div class="premium-panel p-3 space-y-3">
      <div class="flex items-center justify-between gap-3"><div><p class="text-[12px] font-black">سجل الإشعارات</p><p class="mt-1 text-[10px] text-slate-500">الوارد الإداري، وسجل الإرسال، وحالة وصول الإشعارات</p></div><button id="notification-log-toggle" type="button" onclick="toggleNotificationLog()" aria-expanded="false" aria-controls="notification-log-panel" class="pill-btn soft-btn shrink-0">عرض سجل الإشعارات</button></div>
      <div id="notification-log-panel" class="hidden space-y-4">
        <div class="premium-panel p-4 space-y-3"><div class="flex items-center justify-between gap-2"><div><p class="text-[12px] font-black">الوارد الإداري</p><p class="text-[10px] text-slate-500">الإشعارات والتنبيهات المرسلة إلى الإدارة — غير المقروء: ${Number(state.adminInboxUnread||0)}</p></div><div class="flex gap-2"><button type="button" onclick="loadAdminInbox()" class="pill-btn soft-btn">تحديث</button><button type="button" onclick="markAllAdminInboxRead()" class="pill-btn soft-btn">قراءة الكل</button></div></div><div id="admin-inbox-list" class="space-y-2">${renderAdminInbox()}</div></div>
        <div class="premium-panel p-4 space-y-3"><div class="flex items-center justify-between gap-2"><div><p class="text-[12px] font-black">تتبع تسليم الإشعارات</p><p class="text-[10px] text-slate-500">نتائج مزودي الإرسال لكل قناة، دون تخزين رموز الأجهزة</p></div><button type="button" onclick="loadNotificationDeliveryAudit()" class="pill-btn soft-btn">تحديث</button></div><div id="admin-delivery-log-list" class="space-y-2">${renderDeliveryAudit()}</div></div>
        <div class="premium-panel p-4 space-y-3"><div class="flex items-center justify-between gap-3"><div><p class="text-[12px] font-black">سجل الإشعارات المرسلة</p><p class="mt-1 text-[10px] text-slate-500">الحذف هنا يزيل الإشعار من جميع الحسابات التي أُرسل إليها.</p></div><button type="button" onclick="loadNotificationHistory()" class="pill-btn soft-btn shrink-0">تحديث</button></div><div id="notification-history-list" class="space-y-2">${renderNotificationHistory()}</div></div>
      </div>
    </div>
  </section>`;
}

function toggleNotificationLog(){
  const panel=document.getElementById('notification-log-panel');
  const button=document.getElementById('notification-log-toggle');
  if(!panel)return;
  const opening=panel.classList.contains('hidden');
  panel.classList.toggle('hidden',!opening);
  if(button){button.textContent=opening?'إخفاء سجل الإشعارات':'عرض سجل الإشعارات';button.setAttribute('aria-expanded',opening?'true':'false');}
  if(opening)loadNotificationHistory();
}


let notificationRecipientSearchSequence=0;
function clearNotificationRecipient(){const phone=document.getElementById('notification-recipient-phone');const recipientId=document.getElementById('notification-recipient-id');const selected=document.getElementById('notification-recipient-selected');const search=document.getElementById('notification-recipient-search');const results=document.getElementById('notification-recipient-results');if(phone)phone.value='';if(recipientId)recipientId.value='';if(selected)selected.textContent='';if(search)search.value='';if(results)results.innerHTML='';}
async function searchNotificationRecipients(){const input=document.getElementById('notification-recipient-search');const results=document.getElementById('notification-recipient-results');const role=document.getElementById('notification-recipient-role')?.value||'fanni';const q=String(input?.value||'').trim();const seq=++notificationRecipientSearchSequence;if(!results)return;const selectedId=document.getElementById('notification-recipient-id');const selectedPhone=document.getElementById('notification-recipient-phone');const selectedLabel=document.getElementById('notification-recipient-selected');if(selectedId)selectedId.value='';if(selectedPhone)selectedPhone.value='';if(selectedLabel)selectedLabel.textContent='';if(q.length<1){results.innerHTML='';return;}results.innerHTML='<p class="p-2 text-[10px] text-slate-500">جاري البحث...</p>';try{const data=await tryApi(['/api/admin/notifications/recipients?role='+encodeURIComponent(role)+'&q='+encodeURIComponent(q)],{method:'GET'});if(seq!==notificationRecipientSearchSequence)return;const items=extractList(data,['recipients']);results.innerHTML=items.length?items.map(item=>'<button type="button" class="block w-full rounded-lg border bg-white p-2 text-right text-[11px]" data-recipient-phone="'+escHtml(item.phone)+'" data-recipient-id="'+escHtml(item.id)+'" data-recipient-name="'+escHtml(item.name)+'" onclick="selectNotificationRecipient(this)"><b>'+escHtml(item.name||'بدون اسم')+'</b><small class="block text-slate-500">'+escHtml(item.phone)+'</small></button>').join(''):'<p class="p-2 text-[10px] text-slate-500">لا توجد نتائج لهذا النوع من الحسابات.</p>';}catch(error){if(seq===notificationRecipientSearchSequence)results.innerHTML='<p class="p-2 text-[10px] text-red-600">'+escHtml(error.message||'تعذر البحث')+'</p>';}}
function selectNotificationRecipient(button){const phone=document.getElementById('notification-recipient-phone');const recipientId=document.getElementById('notification-recipient-id');const selected=document.getElementById('notification-recipient-selected');const search=document.getElementById('notification-recipient-search');const results=document.getElementById('notification-recipient-results');if(phone)phone.value=button.dataset.recipientPhone||'';if(recipientId)recipientId.value=button.dataset.recipientId||'';if(selected)selected.textContent='المستلم المحدد: '+(button.dataset.recipientName||'')+' — '+(button.dataset.recipientPhone||'');if(search)search.value=(button.dataset.recipientName||'')+' — '+(button.dataset.recipientPhone||'');if(results)results.innerHTML='';}

function updateNotificationMode(){const mode=document.getElementById('notification-mode')?.value||'single';const phoneWrap=document.getElementById('notification-phone-wrap');const audienceWrap=document.getElementById('notification-audience-wrap');if(phoneWrap)phoneWrap.classList.toggle('hidden',mode!=='single');if(audienceWrap)audienceWrap.classList.toggle('hidden',mode!=='group');updateNotificationAudience();}


function updateNotificationAudience(){const role=document.getElementById('notification-recipient-role')?.value||'fanni';const select=document.getElementById('notification-audience');if(!select)return;const current=select.value;const options=role==='fanni'?[['all','جميع الفنيين'],['approved','الفنيون المعتمدون'],['disabled','الفنيون المعطلون (معلقون)']]:[['all','جميع العملاء'],['active','العملاء النشطون'],['disabled','العملاء المعطلون (معلقون)']];select.innerHTML=options.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');if(options.some(option=>option[0]===current))select.value=current;}




function renderNotificationHistory(){
  const campaignContent=state.notificationHistoryLoading
    ? '<p class="p-4 text-center text-[11px] text-slate-500">جاري تحميل سجل الإشعارات...</p>'
    : !state.notificationHistory.length
      ? '<p class="p-4 text-center text-[11px] text-slate-500">لا توجد إشعارات إدارية محفوظة.</p>'
      : state.notificationHistory.map(item => '<div class="rounded-xl border border-slate-200 p-3 space-y-2"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-[11px] font-black break-words">'+escHtml(item.title||'إشعار بدون عنوان')+'</p><p class="mt-1 text-[10px] leading-5 text-slate-600 break-words">'+escHtml(item.message||'')+'</p></div><button type="button" data-id="'+escHtml(item.id)+'" onclick="deleteNotificationCampaign(this.dataset.id)" class="shrink-0 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[10px] font-black text-red-700">حذف</button></div><div class="flex flex-wrap items-center gap-2 text-[9px] text-slate-500"><span class="rounded-full bg-slate-100 px-2 py-1">'+(item.recipientRole==='client'?'العملاء':'الفنيون')+'</span><span class="rounded-full bg-blue-50 px-2 py-1 text-blue-700">عدد المستلمين: '+Number(item.count||0)+'</span><span>'+escHtml(item.createdAt?new Date(item.createdAt).toLocaleString('ar-EG'):'')+'</span></div>'+(item.replies?.length?'<div class="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2"><b class="text-[10px]">ردود المستلمين</b>'+item.replies.map(reply=>'<p class="mt-1 text-[10px] leading-5">'+escHtml(reply.recipientName|| (reply.recipientRole==='client'?'عميل':'فني'))+' '+escHtml(reply.recipientPhone||'')+' — '+escHtml(reply.message)+' <small class="text-slate-500">'+escHtml(reply.sentAt?new Date(reply.sentAt).toLocaleString('ar-EG'):'')+'</small></p>').join('')+'</div>':'')+'</div>').join('');
  return campaignContent;
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
