'use strict';

async function loadNotifications(){if(!getToken())return false;try{const data=await API.notifications();state.notifications=Array.isArray(data.notifications)?data.notifications:[];state.notificationsUnread=Number(data.unreadCount||0);var badge=document.getElementById('notificationBadge');if(badge)badge.textContent=state.notificationsUnread?(state.notificationsUnread>99?'99+':String(state.notificationsUnread)):'';if(state.notificationsOpen)render();return true;}catch(e){log('تعذر تحميل الإشعارات',e.message);return false;}}
async function toggleNotifications(){state.notificationsOpen=!state.notificationsOpen;if(state.notificationsOpen){await loadNotifications();const pending=state.notifications.find(n=>n.replyEnabled&&!n.reply);state.activeReplyNotificationId=pending?.id||'';}else{state.activeReplyNotificationId='';}render();}
async function openNotification(id){
 const selected=state.notifications.find(n=>n.id===id);
 try{if(selected&&!selected.read)await API.readNotification(id);}
 catch(e){log('تعذر تعليم الإشعار كمقروء',e.message);toast('تعذر تحديث حالة الإشعار','error');return;}
 state.notifications=state.notifications.map(n=>n.id===id?Object.assign({},n,{read:true}):n);
 if(selected&&!selected.read)state.notificationsUnread=Math.max(0,state.notificationsUnread-1);
 if(selected?.replyEnabled){state.activeReplyNotificationId=id;state.notificationsOpen=true;render();return;}
 state.notificationsOpen=false;
 let tab='';
 try{const target=new URL(String(selected&&selected.link||''),window.location.origin);if(target.origin===window.location.origin)tab=String(target.searchParams.get('tab')||'');}catch(_){}
 if(!tab&&selected){
  if(['topup_approved','topup_rejected','wallet_credit','fanni_wallet_settlement','technician_settlement','wallet_debit','commission_deducted'].includes(selected.type))tab='wallet';
  else if(selected.type==='new_opportunity')tab='available';
  else if(selected.type==='store_order_update')tab='store';
  else if(['offer_accepted','order_cancelled','order_completed','order_message','price_change_requested','client_service_refunded'].includes(selected.type))tab='myOrders';
 }
 if(['wallet','myOrders','available','store'].includes(tab)){
  state.tab=tab;
  if(tab==='myOrders')state.myOrdersView='active';
 }
 render();
 if(state.tab==='wallet')loadWalletHistory();
 else if(state.tab==='myOrders')loadMyOffers();
 else if(state.tab==='available')loadOrders();
 else if(state.tab==='store')loadStoreForRole('fanni');
}
async function markAllNotificationsRead(){try{await API.readAllNotifications();state.notifications=state.notifications.map(n=>Object.assign({},n,{read:true}));state.notificationsUnread=0;render();}catch(e){toast(e.message||'تعذر تحديث الإشعارات','error');}}
function notificationBadge(){if(!Number(state.notificationsUnread||0))return '';return '<span id="notificationBadge" style="background:#E53935!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important" class="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-red-600 px-1 text-[9px] font-black !text-white">'+(state.notificationsUnread?(state.notificationsUnread>99?'99+':String(state.notificationsUnread)):'')+'</span>';}
function notificationPanel(){if(!state.notificationsOpen)return '';var html='<div class="fixed inset-0 z-[99]" onclick="state.notificationsOpen=false;render()"></div><div class="fanni-notifications-panel fixed left-3 right-3 top-[70px] z-[100] mx-auto max-w-[420px] overflow-hidden rounded-2xl border border-amber-200 bg-white text-slate-800 shadow-2xl"><div class="flex items-center justify-between gap-2 border-b p-3"><b class="text-[15px] font-extrabold">الإشعارات</b><div class="flex items-center gap-3"><button onclick="markAllNotificationsRead()" class="text-[12px] font-extrabold text-blue-700">تعليم الكل كمقروء</button><button type="button" aria-label="إغلاق الإشعارات" title="إغلاق" onclick="state.notificationsOpen=false;render()" class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold leading-none text-slate-700 hover:bg-slate-200">×</button></div></div><div class="max-h-[60vh] overflow-y-auto">';if(!state.notifications.length)html+='<p class="p-6 text-center text-[12px] text-slate-500">مفيش إشعارات لحد دلوقتي.</p>';state.notifications.forEach(n=>{html+='<button type="button" data-fanni-notification-id="'+esc(n.id)+'" class="fanni-notification-item '+(n.read?'is-read':'is-unread')+' block w-full border-b p-3 text-right"><b class="block text-[16px] font-bold text-slate-900">'+esc(n.title)+'</b><span class="mt-1 block text-[15px] font-semibold leading-7 text-slate-800">'+esc(n.message)+'</span>'+(n.replyEnabled&&!n.reply?'<small class="mt-1 inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-extrabold text-violet-800">مسموح بالرد</small>':'')+'<small class="mt-2 block text-[11px] font-medium text-slate-500">'+(n.createdAt?new Date(n.createdAt).toLocaleString('ar-EG'):'')+'</small></button>';});const active=state.notifications.find(n=>n.id===state.activeReplyNotificationId);if(active){html+='<div class="border-t bg-blue-50 p-3"><div class="flex items-center justify-between"><b class="block text-[12px]">'+(active.reply?'تم إرسال ردك':'مسموح بالرد')+'</b><button type="button" onclick="state.activeReplyNotificationId=\'\';render()" class="rounded-lg px-3 py-1 text-xs font-bold text-slate-600">إخفاء</button></div>'+(active.reply?'<p class="mt-2 rounded-lg bg-white p-3 text-sm">'+esc(active.reply.message)+'</p><small class="mt-2 block text-[10px] text-slate-500">تم إرسال ردك بالفعل.</small>':'<textarea id="fanni-notification-reply" maxlength="1000" rows="3" placeholder="اكتب ردك للإدارة..." class="field mt-2 w-full"></textarea><button type="button" onclick="sendFanniNotificationReply()" class="mt-2 w-full rounded-xl bg-blue-600 p-3 text-sm font-extrabold text-white">إرسال الرد</button>')+'</div>'; }return html+'</div></div>';}
async function sendFanniNotificationReply(){const id=state.activeReplyNotificationId;const item=state.notifications.find(n=>n.id===id);const input=document.getElementById('fanni-notification-reply');const message=String(input?.value||'').trim();if(!item||!item.replyEnabled||item.reply)return toast('لا يمكن إرسال رد آخر.','error');if(!message)return toast('اكتب الرد أولًا.','error');const button=input?.parentElement?.querySelector('button');if(button)button.disabled=true;try{const result=await API.replyNotification(id,message);state.notifications=state.notifications.map(n=>n.id===id?Object.assign({},n,{reply:{message,sentAt:result.reply?.sentAt||new Date().toISOString()}}):n);render();}catch(error){toast(error.message||'تعذر إرسال الرد.','error');if(button)button.disabled=false;}}
document.addEventListener('click',e=>{const item=e.target.closest('[data-fanni-notification-id]');if(item)openNotification(item.getAttribute('data-fanni-notification-id'));});
if(!window.__sonaaFanniNotificationRefresh){
 window.__sonaaFanniNotificationRefresh=true;
 window.setInterval(function(){if(document.visibilityState!=='hidden'&&getToken())void loadNotifications();},20000);
 document.addEventListener('visibilitychange',function(){if(!document.hidden&&getToken())void loadNotifications();});
 window.addEventListener('focus',function(){if(getToken())void loadNotifications();});
}
document.addEventListener('click',function(e){const button=e.target.closest('[data-fanni-tab]');if(!button)return;const tab=button.getAttribute('data-fanni-tab');if(tab==='profile'){e.preventDefault();setTab('profile');}});
