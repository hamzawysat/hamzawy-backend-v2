async function sha256Hex(s){const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s||'')));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
'use strict';

function getCat(service){return CATEGORIES.find(c=>c.services.includes(service))||null;}
function captureScrollPosition(){
  const list=document.getElementById('serviceList');
  return {pageY:window.scrollY||window.pageYOffset||0,listTop:list?list.scrollTop:0};
}
function restoreScrollPosition(position){
  if(!position)return;
  const list=document.getElementById('serviceList');
  if(list)list.scrollTop=position.listTop;
  window.scrollTo({top:position.pageY,left:0,behavior:'instant'});
}
function ratingSkipKey(role,sn){return 'sonaa_rating_skipped_'+role+'_'+String(sn||'').toUpperCase();}
function isRatingSkipped(role,sn){try{return localStorage.getItem(ratingSkipKey(role,sn))==='1';}catch{return false;}}
function skipClientRating(sn){try{localStorage.setItem(ratingSkipKey('client',sn),'1');}catch{}render();showToast('تم تخطي التقييم لهذا الطلب.','success');}
function focusClientPostAction(){if(!state.tracked)return;const sn=String(state.tracked.sn||'').toUpperCase();if(state.tracked.status==='تم الانتهاء'&&state.tracked.canRate&&!isRatingSkipped('client',sn)){document.getElementById('client-rating-'+sn)?.scrollIntoView({behavior:'smooth',block:'center'});return;}if(state.tracked.status==='تم اختيار فني'){document.getElementById('client-accepted-chat-'+sn)?.scrollIntoView({behavior:'smooth',block:'center'});}}
function showToast(message,type='error'){
  const el=document.getElementById('toast');
  if(!el)return;
  const color=type==='success'?'bg-[#2E7CF6]':'bg-[#2E7CF6]';
  el.innerHTML=`<div class="pointer-events-auto mx-auto max-w-[480px] rounded-[14px] ${color} text-white text-[13px] font-bold px-4 py-3 shadow-2xl flex justify-between items-center gap-3" style="background:#2E7CF6 !important;color:#FFFFFF !important">
    <span class="leading-6">${escHtml(message)}</span>
    <button onclick="this.parentElement.remove()" class="shrink-0 h-7 px-3 rounded-full bg-white/20">إغلاق</button>
  </div>`;
  setTimeout(()=>{if(el)el.innerHTML='';},4500);
}
function goBack(fromPopState=false){if(typeof CLIENT_TAB_HISTORY==='undefined'||!CLIENT_TAB_HISTORY.length){window.location.href='/';return true;}if(!fromPopState){window.history.back();return true;}const previous=CLIENT_TAB_HISTORY.pop();setTab(previous,true);return true;}
function showLogoutConfirmation(){if(document.getElementById('logoutConfirmOverlay'))return;const overlay=document.createElement('div');overlay.id='logoutConfirmOverlay';overlay.className='logout-confirm-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','logoutConfirmTitle');overlay.innerHTML='<div class="logout-confirm-card"><div class="logout-confirm-icon" aria-hidden="true">↪</div><h2 id="logoutConfirmTitle" class="text-xl font-black text-slate-900">تأكيد تسجيل الخروج</h2><p class="mt-3 text-sm leading-6 font-bold text-slate-600">متأكد إنك عايز تسجّل خروج من حسابك؟</p><div class="mt-6 grid grid-cols-2 gap-3"><button type="button" class="logout-confirm-btn logout-confirm-cancel" data-logout-action="cancel">لا، خليك معايا</button><button type="button" class="logout-confirm-btn logout-confirm-yes" data-logout-action="confirm">أيوه، خروج</button></div></div>';document.body.appendChild(overlay);overlay.addEventListener('click',function(e){if(e.target===overlay||e.target.closest('[data-logout-action="cancel"]')){overlay.remove();return;}if(e.target.closest('[data-logout-action="confirm"]')){overlay.remove();performClientLogout();}});overlay.querySelector('[data-logout-action="cancel"]').focus();}
async function performClientLogout(){const token=state.accountToken||(()=>{try{return localStorage.getItem('sonaa_client_account_token')||'';}catch(e){return '';}})();try{if(token){const response=await fetch('/api/client/logout',{method:'POST',headers:{Authorization:'Bearer '+token},keepalive:true,cache:'no-store'});if(!response.ok)console.warn('تعذر تأكيد تسجيل خروج العميل على الخادم:',response.status);}}catch(error){console.warn('تعذر إرسال إشعار تسجيل خروج العميل:',error?.message||error);}finally{try{localStorage.removeItem('sonaa_client_account_token');}catch(e){}state.accountToken='';state.account=null;state.notifications=[];state.notificationsUnread=0;state.notificationsOpen=false;state.myOrders=[];state.tracked=null;state.tab='new';state.accountError='';render();}}
function logoutClient(){showLogoutConfirmation();}
let clientReferralInfo = null;
let clientReferralPageOpen = false;
function openClientReferralPage(){if(!clientReferralInfo?.enabled)return;clientReferralPageOpen=true;render();}
function closeClientReferralPage(){clientReferralPageOpen=false;render();}
function clientReferralCodeFromUrl(){try{return new URLSearchParams(location.search).get('ref')||'';}catch(_){return '';}}
function clientDownloadUrl(){const url=new URL('/download',location.origin);const code=clientReferralCodeFromUrl().trim().toUpperCase();if(/^C-[A-F0-9]{24}-(?:[A-F0-9]{12}|[A-Z0-9_-]{22})$/.test(code))url.searchParams.set('ref',code);return url.pathname+url.search;}
async function loadClientReferralInfo(){if(!state.accountToken)return;try{clientReferralInfo=await API.request('/api/referrals/me/client',{method:'GET',headers:{Authorization:'Bearer '+state.accountToken}});if(!clientReferralInfo?.enabled)clientReferralPageOpen=false;if(state.tab==='home'||clientReferralPageOpen)render();}catch(error){console.warn('تعذر تحميل دعوات العميل:',error.message);}}
async function copyClientReferralLink(){const value=clientReferralInfo?.url||'';if(!value)return;try{await navigator.clipboard.writeText(value);showToast('تم نسخ رابط الدعوة','success');}catch(_){showToast('تعذر النسخ تلقائيًا؛ انسخ الرابط يدويًا','error');}}
async function shareClientReferralLink(){
 const info=clientReferralInfo||{};
 let referralUrl;
 try{referralUrl=new URL(String(info.url||''),location.origin);}catch(_){showToast('رابط الدعوة غير صالح','error');return;}
 const code=String(info.code||referralUrl.searchParams.get('ref')||'').trim().toUpperCase();
 if(!/^C-[A-F0-9]{24}-(?:[A-F0-9]{12}|[A-Z0-9_-]{22})$/.test(code)){showToast('كود الدعوة غير صالح. حدّث بيانات الدعوة وحاول مرة أخرى.','error');return;}
 referralUrl.pathname='/client';referralUrl.search='';referralUrl.searchParams.set('ref',code);
 const downloadUrl=new URL('/download',referralUrl.origin);downloadUrl.searchParams.set('ref',code);
 const text=[
  'سجّل حسابك الجديد في ساتڤيو واستمتع بخدماتنا ومتجرنا وأسعاره المميزة 🛍️',
  '',
  '🎁 50 جنيه مكافأة بعد إتمام أول طلب ليك، و50 جنيه إضافية عن كل شخص تدعوه ويسجل ويكمل أول طلب له!',
  '',
  '📝 تسجيل عميل جديد:',
  referralUrl.toString(),
  '',
  '📲 تحميل التطبيق:',
  downloadUrl.toString()
 ].join('\n');
 try{if(navigator.share)await navigator.share({title:'دعوة ساتڤيو',text});else{await navigator.clipboard.writeText(text);showToast('تم نسخ رسالة الدعوة','success');}}
 catch(error){if(error?.name!=='AbortError')showToast('تعذرت مشاركة الرابط','error');}
}
function scrollToClientReferralCard(){const card=document.getElementById('clientReferralCard');if(card)card.scrollIntoView({behavior:'smooth',block:'center'});}
function renderClientReferralCard(){
 if(!clientReferralInfo?.enabled)return '';
 const info=clientReferralInfo;
 if(info.enabled&&info.url&&window.QRCode)requestAnimationFrame(()=>{const el=document.getElementById('clientReferralQr');if(el){el.innerHTML='';new QRCode(el,{text:info.url,width:150,height:150,colorDark:'#111827',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}});
 const history=Array.isArray(info.referrals)?info.referrals:[];
 const sharing=info.enabled?'<div class="mt-3 rounded-xl border border-dashed border-amber-300 bg-white p-3"><p class="text-[10px] font-bold text-slate-500">كود دعوتك</p><p class="mt-1 text-center text-lg font-black tracking-wider" dir="ltr">'+escHtml(info.code||'')+'</p><p class="mt-2 break-all text-center text-[10px] text-slate-500" dir="ltr">'+escHtml(info.url||'')+'</p></div><div class="mt-3 flex justify-center rounded-xl border border-slate-200 bg-white p-2"><div id="clientReferralQr" aria-label="باركود QR لرابط الدعوة"></div></div><div class="mt-3 grid grid-cols-2 gap-2"><button type="button" onclick="copyClientReferralLink()" class="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-extrabold text-white">نسخ الرابط</button><button type="button" onclick="shareClientReferralLink()" class="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2.5 text-xs font-extrabold text-amber-900">مشاركة الدعوة</button></div>':'<p class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold text-amber-900">إنشاء دعوات جديدة متوقف حاليًا. دعواتك المسجلة سابقًا مستمرة في احتساب الإنجازات وصرف المكافآت عند استحقاقها.</p>';
 const rows=history.length?'<div class="mt-3 space-y-2">'+history.map(x=>'<div class="rounded-xl border border-slate-200 bg-white p-3 text-[12px]"><b>'+escHtml(x.number||'دعوة')+'</b><span class="float-left">'+escHtml(({pending:'معلقة',in_progress:'قيد التقدم',eligible:'مستحقة',completed:'مكتملة',rejected:'مرفوضة',cancelled:'ملغاة'})[x.status]||x.status||'—')+'</span><p class="mt-2 text-slate-600">الإنجاز: '+Number(x.completedCount||0)+' / '+Number(x.requiredCount||1)+' • مكافأتك: '+(x.inviterReward?.paidAt?'تم الصرف':'لم تصرف')+' • مكافأة المدعو: '+(x.inviteeReward?.paidAt?'تم الصرف':'لم تصرف')+'</p></div>').join('')+'</div>':'<p class="mt-3 text-[10px] text-slate-500">لا توجد دعوات مسجلة حتى الآن.</p>';
 return '<section id="clientReferralCard" class="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-4"><div class="flex items-center gap-3"><span class="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-2xl">🎁</span><div><h3 class="text-sm font-black text-slate-900">ادعُ صديقك واكسب 50 جنيهًا</h3><p class="mt-1 text-[13px] font-semibold leading-6 text-slate-700">عن كل صديق جديد يسجل من رابط دعوتك ويكمل أول طلب، تحصل أنت وهو على 50 جنيهًا مكافأة.</p></div></div>'+sharing+'<div class="mt-3 text-[12px] font-bold text-slate-700">دعواتك: '+Number(info.totals?.count||history.length)+' • المكتملة: '+Number(info.totals?.completed||0)+'</div>'+rows+'</section>';
}
function renderAccountGate(){
var reg=state.accountAuthMode==='register';
document.title=reg?'تسجيل عميل جديد | ساتڤيو':'تسجيل دخول العميل | ساتڤيو';
var h='<main class="account-gate" style="background:#EEF2FF;';
h+='min-height:100svh;min-height:100dvh;';
h+='padding-top:max(1rem,env(safe-area-inset-top));';
h+='padding-bottom:max(1rem,env(safe-area-inset-bottom));';
h+='width:100%;box-sizing:border-box;display:flex;';
h+='flex-direction:column;align-items:center;';
h+='justify-content:flex-start">';
h+='<div class="w-full max-w-[440px] mx-auto px-4" ';
h+='style="margin-top:auto;margin-bottom:auto;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center">';
var Q=String.fromCharCode(39);
h+='<div class="flex w-full justify-between mb-4">';
h+='<button type="button" onclick="window.location.href=' + Q + '/' + Q + '" ';
h+='class="h-10 px-4 rounded-xl border border-slate-200 bg-white ';
h+='text-[15px] font-extrabold" style="background:#FFFFFF!important;';
h+='color:#2E7CF6!important">‹ الصفحة الرئيسية</button>';
h+='<button type="button" onclick="goBack()" ';
h+='class="h-10 px-4 rounded-xl border border-slate-200 bg-white ';
h+='text-[15px] font-extrabold" style="background:#FFFFFF!important;';
h+='color:#2E7CF6!important">رجوع ›</button></div>';
h+='<div class="text-center mb-3"><div class="mx-auto w-[68px] h-[68px] ';
h+='rounded-[28px] bg-white border border-slate-200 flex ';
h+='items-center justify-center shadow-sm p-3">';
h+='<img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" ';
h+='alt="شعار ساتڤيو" style="width:100%;height:100%;object-fit:contain"></div>';
h+='<h1 class="mt-2 text-[24px] font-black" style="color:#2E7CF6">ساتڤيو</h1>';
h+='<p class="mt-1 text-[15px] font-bold text-slate-500">';
h+='خدماتك وشغلك... في مكان واحد</p>';
h+='<div class="mt-4"><span class="inline-block px-4 py-1.5 rounded-full ';
h+='bg-[#E8EDFF] text-[#2E7CF6] text-[14px] font-extrabold">حساب عميل</span></div>';
h+='<h2 class="mt-2 text-[18px] font-black leading-7" ';
h+='style="color:#2E7CF6">'+(reg?'تسجيل عميل جديد':'أهلاً بيك في ساتڤيو')+'</h2>';
h+='<p class="mt-1 text-[14px] text-slate-500">'+(reg?'أنشئ حساب عميل جديد '+
'علشان تطلب الخدمات وتتابع طلباتك.':'سجّل دخولك علشان تطلب خدمة '+
'وتتابع طلباتك من حسابك.')+'</p></div>';
h+='<section class="account-panel mt-2 panel p-4" ';
h+='style="border-radius:28px;width:100%;box-sizing:border-box">';
h+='<div class="account-tabs flex justify-center" ';
h+='style="padding:0!important;margin:0 0 20px!important;';
h+='background:transparent!important;border:0!important;';
h+='display:'+(reg?'flex':'none')+'!important">';
h+='<button type="button" onclick="setAccountAuthMode(this.dataset.next)" ';
h+='data-next="'+(reg?'login':'register')+'" ';
h+='class="h-9 px-4 rounded-full bg-[#F4F6FF] border border-dashed ';
h+='border-[#D5DDFE] text-[#2E7CF6] text-[12px] font-black ';
h+='inline-flex items-center justify-center gap-1.5">';
h+='<span>'+(reg?'لتسجيل الدخول':'لتسجيل عميل جديد')+'</span>';
h+='<small class="underline decoration-dashed">اضغط هنا</small></button></div>';
h+='<form class="space-y-4" onsubmit="submitClientAccount(event)">';
if(reg&&clientReferralCodeFromUrl()){h+='<div class="rounded-xl border ';
h+='border-emerald-200 bg-emerald-50 p-3 text-[11px] font-bold ';
h+='text-emerald-800">تم فتح التسجيل من خلال دعوة صديق. ';
h+='أكمل التسجيل لتفعيل الدعوة.</div>';}
if(reg){h+='<div><label style="color:#2E7CF6;text-align:left;';
h+='display:block;font-weight:800;font-size:15px">الاسم بالكامل</label>';
h+='<input id="accountName" required minlength="2" maxlength="50" ';
h+='autocomplete="name" class="field" style="height:52px!important;font-size:15px!important;font-weight:700!important;padding:0 16px!important;text-align:right!important;box-sizing:border-box!important" placeholder="اكتب اسمك"></div>';}
h+='<div><label style="color:#2E7CF6;text-align:left;';
h+='display:block;font-weight:800;font-size:15px">رقم الهاتف</label>';
h+='<input id="accountPhone" required type="tel" inputmode="tel" ';
h+='autocomplete="tel" maxlength="20" class="field" style="height:52px!important;font-size:15px!important;font-weight:700!important;padding:0 16px!important;text-align:right!important;box-sizing:border-box!important" ';
h+='placeholder="01xxxxxxxxx" value="'+escAttr(reg?'':(state.accountLoginPhone||''))+'" dir="ltr"></div>';
h+='<div><label style="color:#2E7CF6;text-align:left;';
h+='display:block;font-weight:800;font-size:15px">كلمة السر</label>';
h+='<input id="accountPassword" required type="password" ';
h+='minlength="'+(reg?8:1)+'" maxlength="128" ';
h+='autocomplete="'+(reg?'new-password':'current-password')+'" class="field" style="height:52px!important;font-size:15px!important;font-weight:700!important;padding:0 16px!important;text-align:right!important;box-sizing:border-box!important" ';
h+='placeholder="'+(reg?'8 أحرف على الأقل':'اكتب كلمة السر')+'" ';
h+='value="'+escAttr(reg?'':(state.accountLoginPassword||''))+'"></div>';
if(reg){h+='<div><label style="color:#2E7CF6;text-align:left;';
h+='display:block;font-weight:800;font-size:15px">تأكيد كلمة السر</label>';
h+='<input id="accountConfirmPassword" required type="password" ';
h+='minlength="8" maxlength="128" autocomplete="new-password" ';
h+='class="field" style="height:52px!important;font-size:15px!important;font-weight:700!important;padding:0 16px!important;text-align:right!important;box-sizing:border-box!important" placeholder="أعد كتابة كلمة السر"></div>';}
if(state.accountError){h+='<p class="rounded-xl bg-red-50 border ';
h+='border-red-200 p-3 text-[11px] leading-5 font-bold text-red-700">';
h+=escHtml(state.accountError)+'</p>';}
if(!reg){h+='<div style="text-align:left"><a href="password.html?role=client&mode=recovery" ';
h+='style="color:#2E7CF6;font-weight:800;font-size:15px;text-decoration:underline">';
h+='نسيت كلمة السر؟ استعادة</a></div>';}
h+='<button type="submit" '+(state.accountLoading?'disabled':'')+' ';
h+='class="w-full h-[56px] rounded-2xl text-[18px] font-black" ';
h+='style="background:#2E7CF6!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">';
h+=(state.accountLoading?'جاري التنفيذ...':reg?'إنشاء حساب العميل':'تسجيل الدخول');
h+='</button></form>';
if(!reg){h+='<button type="button" onclick="setAccountAuthMode(' + Q + 'register' + Q + ')" ';
h+='class="w-full h-[56px] mt-4 rounded-2xl text-[18px] font-black" ';
h+='style="background:#EEF2FF!important;color:#2E7CF6!important;-webkit-text-fill-color:#2E7CF6!important;';
h+='border:1px solid #D5DDFE!important">إنشاء حساب عميل جديد</button>';}
h+='<p class="mt-3 text-center text-[13px] text-slate-500">بياناتك وحسابك في أمان</p>';
h+='<div class="mt-3 flex gap-2" ';
h+='style="padding-bottom:max(0.5rem,env(safe-area-inset-bottom))">';
h+='<a href="'+escAttr(clientDownloadUrl())+'" class="flex-1 h-[52px] rounded-2xl ';
h+='inline-flex items-center justify-center gap-1.5 text-[15px] font-black" ';
h+='style="background:#2E7CF6!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">⬇ تحميل التطبيق</a>';
h+='<a href="/links" target="_blank" rel="noopener noreferrer" ';
h+='class="flex-1 h-[52px] rounded-2xl inline-flex items-center ';
h+='justify-center gap-1.5 text-[15px] font-black border border-slate-200" ';
h+='style="background:#EEF2FF!important;color:#2E7CF6!important;-webkit-text-fill-color:#2E7CF6!important">🔗 منصات التواصل</a></div>';
h+='</section></div></main>';
document.getElementById('app').innerHTML=h+renderPublicContent();
}

function renderPublicContent(){
  const c=state.publicContent||{announcement:'',faqs:[]};
  const faqs=Array.isArray(c.faqs)?c.faqs:[];
  if(!c.maintenance&&!String(c.announcement||'').trim()&&!faqs.length)return '';
  return '<section class="mx-auto mt-3 w-full max-w-[640px] px-3 sm:px-4 space-y-2">'+
    (c.maintenance?'<div class="panel border-amber-300 bg-amber-50 p-3 text-[12px] font-extrabold leading-6 text-amber-900">النظام في وضع الصيانة: '+escHtml(c.maintenanceMessage||'الخدمة متوقفة مؤقتًا. حاول لاحقًا.')+'</div>':'')+
    (String(c.announcement||'').trim()?'<div class="panel border-blue-200 bg-blue-50 p-3 text-[12px] font-bold leading-6">'+escHtml(c.announcement)+'</div>':'')+
    (faqs.length?'<details class="panel p-3"><summary class="cursor-pointer text-[12px] font-extrabold">الأسئلة الشائعة</summary><div class="mt-3 space-y-3">'+faqs.map(f=>'<div class="border-t pt-2"><p class="text-[11px] font-extrabold">'+escHtml(f.question)+'</p><p class="mt-1 text-[11px] leading-5 text-slate-600">'+escHtml(f.answer)+'</p></div>').join('')+'</div></details>':'')+
    '</section>';
}
async function loadPublicContent(){
  try{const data=await API.request('/api/content?role=client',{method:'GET'});state.publicContent={siteName:String(data.siteName||'ساتڤيو'),maintenance:!!data.maintenance,maintenanceMessage:String(data.maintenanceMessage||''),announcement:String(data.announcement||''),faqs:Array.isArray(data.faqs)?data.faqs:[]};document.title=state.account?'ساتڤيو - طلباتي':(state.accountAuthMode==='register'?'تسجيل عميل جديد | ساتڤيو':'تسجيل دخول العميل | ساتڤيو');render();}catch(error){log('تعذر تحميل محتوى الواجهة:',error);}
}
function setAccountAuthMode(mode){state.accountAuthMode=mode==='register'?'register':'login';state.accountError='';render();}
async function submitClientAccount(e){
  e.preventDefault();if(state.accountLoading)return;
  var reg=state.accountAuthMode==='register',name=String(document.getElementById('accountName')?.value||'').trim();
  var rawPhone=String(document.getElementById('accountPhone')?.value||''),phone=normalizeDigits(rawPhone).replace(/\D/g,'');
  var password=String(document.getElementById('accountPassword')?.value||''),confirmPassword=String(document.getElementById('accountConfirmPassword')?.value||'');
  if(!reg){state.accountLoginPhone=rawPhone;state.accountLoginPassword=password;}
  if(!VALIDATORS.phone(phone)){state.accountError='رقم الموبايل غير صحيح؛ اكتب 11 رقمًا يبدأ بـ 01.';render();return;}
  if(reg&&(!VALIDATORS.name(name)||containsPhoneNumber(name))){state.accountError='اكتب اسمك بشكل صحيح من غير أرقام موبايلات.';render();return;}
  if(reg&&password.length<8){state.accountError='كلمة السر لازم تكون 8 أحرف على الأقل.';render();return;}
  if(reg&&password!==confirmPassword){state.accountError='كلمة السر وتأكيدها مش متطابقين.';render();return;}
  state.accountLoading=true;state.accountError='';render();
  try{
    if(window.IS_EDITOR_PREVIEW===true && !reg && phone==='01152822263' && (await sha256Hex(password))==='e14da87ab1af7c81f6b9d07ac8cba5ca5f1c55a06af177a502219f84c83307b7'){ state.accountLoginPhone=''; state.accountLoginPassword=''; state.accountToken='preview'; state.account={id:'preview-client', name:'عميل تجريبي', phone:phone, status:'نشط'}; state.clientName='عميل تجريبي'; state.phone=phone; state.tab='home'; state.accountError=''; state.accountLoading=false; showToast('وضع معاينة - من غير قاعدة بيانات','success'); render(); return; }
  var d=reg?await API.registerClient({name:name,phone:phone,password:password,confirmPassword:confirmPassword,referralCode:clientReferralCodeFromUrl()}):await API.loginClient({phone:phone,password:password});
    if(!d.token||!d.client)throw new Error('تعذر إتمام تسجيل الدخول. تحقق من بياناتك وحاول مرة أخرى.');
    state.accountLoginPhone='';state.accountLoginPassword='';state.accountToken=window.IS_EDITOR_PREVIEW?'':d.token;state.account=window.IS_EDITOR_PREVIEW?null:d.client;if(!window.IS_EDITOR_PREVIEW){try{localStorage.setItem('sonaa_client_account_token',d.token);}catch(e){}}
    if(d.mustChangePassword&&!window.IS_EDITOR_PREVIEW){location.href='password.html?role=client&mode=change&support=1';return;}
    state.clientName=d.client.name||name;state.phone=d.client.phone||phone;state.tab='home';state.accountError='';showToast(d.message||'تم تسجيل الدخول بنجاح','success');await loadMyOrders(false);await loadNotifications();await loadClientReferralInfo();await loadClientWallet();
  }catch(error){state.accountError=error.message||'تعذر إتمام العملية.';}
  finally{state.accountLoading=false;render();}
}
async function initializeClientAccount(){
  if(!state.accountToken){render();return;}
  state.accountInitializing=true;
  render();
  try{
    var d=await API.getClientMe(state.accountToken);
    state.account=d.client||null;
    if(state.account){
      state.clientName=state.account.name||'';
      state.phone=state.account.phone||'';
      state.tab='home';
      await Promise.allSettled([loadMyOrders(false),loadNotifications(),loadClientReferralInfo(),loadClientWallet()]);
    }else{
      state.accountToken='';
      try{localStorage.removeItem('sonaa_client_account_token');}catch(e){}
    }
  }catch(error){
    state.accountToken='';
    state.account=null;
    try{localStorage.removeItem('sonaa_client_account_token');}catch(e){}
  }finally{
    state.accountInitializing=false;
    render();
  }
}
async function loadMyOrders(showLoading=true){
  if(!state.accountToken||!state.account)return;
  if(showLoading){state.accountOrdersLoading=true;render();}
  try{var d=await API.getMyOrders();state.myOrders=Array.isArray(d.orders)?d.orders:[];}
  catch(error){showToast(error.message||'تعذر تحميل طلباتك.');}
  finally{state.accountOrdersLoading=false;if(showLoading)render();}
}
async function openAccountOrder(sn,jumpToChat=false){
  state.trackInput=sn;state.trackLoading=true;state.trackError='';state.tracked=null;if(typeof rememberClientTab==='function')rememberClientTab('track');state.tab='track';render();
  try{state.tracked=await API.getOrder(sn);}catch(error){state.trackError=error.message||'تعذر تحميل تفاصيل الطلب.';}
  finally{state.trackLoading=false;render();if(jumpToChat){const chat=document.getElementById('client-accepted-chat-'+String(sn).replace(/[^a-zA-Z0-9_-]/g,''));if(chat)chat.scrollIntoView({behavior:'smooth',block:'center'});else showToast('المحادثة تظهر بعد قبول العرض.');}}
}
function renderOrders(){
  var h='<div class="client-orders-content mt-4 space-y-3"><div class="client-orders-summary panel p-4 flex items-center justify-between gap-3"><div><h3 class="font-extrabold text-[15px]">طلباتي</h3><p class="mt-1 text-[11px] text-slate-500">تابع كل طلباتك من هنا.</p></div></div>';
  const closedStatuses=new Set(['تم الانتهاء','منتهي','مكتمل','مكتملة','ملغي','مؤرشف','منتهي - اعتذار','completed','complete','finished']);
  const isPreviousOrder=o=>closedStatuses.has(String(o?.status||o?.orderStatus||'').trim().toLowerCase());
  const currentOrders=state.myOrders.filter(o=>!isPreviousOrder(o));
  const previousOrders=state.myOrders.filter(isPreviousOrder);
  const visibleOrders=state.accountOrdersTab==='previous'?previousOrders:currentOrders;
  h+='<div class="client-orders-status-tabs grid grid-cols-2 gap-2 p-1 rounded-xl"><button type="button" onclick="state.accountOrdersTab=\'current\';setTab(\'orders\')" class="client-orders-status-tab '+(state.accountOrdersTab==='current'?'is-active':'')+'">طلبات جارية ('+currentOrders.length+')</button><button type="button" onclick="state.accountOrdersTab=\'previous\';render()" class="client-orders-status-tab '+(state.accountOrdersTab==='previous'?'is-active':'')+'">طلبات سابقة ('+previousOrders.length+')</button></div>';
  if(state.accountOrdersLoading)return h+'<div class="panel p-8 text-center text-sm font-bold text-slate-500">جاري تحميل طلباتك...</div></div>';
  if(!visibleOrders.length)return h+'<div class="panel p-8 text-center"><div class="text-3xl">📝</div><p class="mt-3 font-extrabold text-sm">'+(state.accountOrdersTab==='previous'?'لا توجد طلبات سابقة.':'لا توجد طلبات جارية.')+'</p><button type="button" onclick="setTab(\'new\')" class="mt-4 h-11 px-5 rounded-xl blue-btn text-xs font-extrabold">إنشاء طلب جديد</button></div></div>';
  h+='<div class="space-y-3">';
  visibleOrders.forEach(function(o){
    h+='<div class="panel p-4"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-[10px] text-slate-500">رقم الطلب</p><h4 class="mt-1 font-extrabold text-sm">'+escHtml(o.sn||'طلب')+'</h4><p class="mt-2 text-sm font-extrabold">'+escHtml(o.service||'')+'</p><p class="mt-1 text-[11px] text-slate-500">'+escHtml(o.area||'')+'</p></div><span class="shrink-0 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-[10px] font-extrabold text-blue-800">'+escHtml(o.status||'قيد المراجعة')+'</span></div><p class="mt-3 text-xs leading-6 text-slate-600">'+escHtml(maskPhoneNumbers(o.description||''))+'</p>';
    const pendingPriceRequests=(o.priceChangeRequests||[]).filter(r=>r.status==='قيد الموافقة');
    if(o.status==='تم اختيار فني'&&pendingPriceRequests.length){h+=pendingPriceRequests.map(r=>'<div class="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3"><p class="text-xs font-extrabold text-amber-900">طلب زيادة السعر إلى '+escHtml(String(r.newPrice))+' جنيه</p><p class="mt-1 text-[11px] leading-5 text-amber-900">'+escHtml(r.reason||'')+'</p><div class="mt-2 flex gap-2"><button type="button" onclick="decideClientPrice(\''+escAttr(o.sn)+'\',\''+escAttr(r._id)+'\',true)" class="flex-1 rounded-lg bg-emerald-600 p-2 text-white text-xs font-bold">موافقة</button><button type="button" onclick="decideClientPrice(\''+escAttr(o.sn)+'\',\''+escAttr(r._id)+'\',false)" class="flex-1 rounded-lg bg-red-600 p-2 text-white text-xs font-bold">رفض</button></div></div>').join('');}
    if(Array.isArray(o.offers)&&o.offers.length){h+='<p class="mt-3 text-xs font-extrabold">عروض الفنيين ('+o.offers.length+')</p>';o.offers.forEach(function(v){h+='<div class="mt-2 rounded-xl bg-slate-50 border border-slate-100 p-3"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2 min-w-0">'+(v.fanniPhotoUrl?'<img src="'+escAttr(v.fanniPhotoUrl)+'" alt="صورة الفني" class="h-11 w-11 rounded-full object-cover shrink-0">':'')+'<span class="text-xs font-extrabold">'+escHtml(v.fanniName||'فني')+'</span></div><span class="text-sm font-black text-blue-700">'+escHtml(v.price==null?'':String(v.price))+' جنيه</span></div><div class="mt-2 flex flex-wrap gap-2 text-[10px] font-extrabold"><span class="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">★ '+Number(v.fanniRatingAverage||0).toFixed(1)+' ('+Number(v.fanniRatingCount||0)+' تقييم)</span><span class="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">✓ '+Number(v.fanniCompletedJobs||0)+' عمل مكتمل</span></div><p class="mt-1 text-[11px] leading-5 text-slate-600">'+escHtml(maskPhoneNumbers(v.message||''))+'</p>';if(o.status==='تم اختيار فني')h+='<p class="mt-2 text-[11px] font-extrabold text-emerald-700">تم اختيار فني</p>';else if(o.status==='بانتظار تأكيد العميل')h+='<p class="mt-2 text-[11px] font-extrabold text-amber-700">الفني أعلن إنهاء الخدمة — في انتظار تأكيدك</p>';else if(!['تم الانتهاء','منتهي','اعتذار','منتهي - اعتذار','ملغي','مؤرشف'].includes(o.status))h+='<button type="button" onclick="acceptAccountOffer(\''+escAttr(o.sn)+'\',\''+escAttr(String(v._id||''))+'\')" class="mt-2 w-full h-10 rounded-lg blue-btn text-xs font-extrabold" style="background:#DCEEFF !important;color:#0B4DB3 !important;border:1px solid #BFD9FF !important">قبول العرض</button>';h+='</div>';});}
    else h+='<p class="mt-3 text-[11px] text-slate-500">لا توجد عروض حتى الآن.</p>';
    if(o.status==='بانتظار تأكيد العميل'&&o.completionDeclaredAt&&!o.clientConfirmedAt)h+='<button type="button" onclick="confirmClientCompletion(\''+escAttr(o.sn)+'\')" class="mt-3 w-full h-11 rounded-xl bg-emerald-700 text-white text-xs font-extrabold">تأكيد استلام الخدمة وبدء الضمان</button>';
    h+='<button type="button" onclick="openAccountOrder(\''+escAttr(o.sn)+'\')" class="mt-3 w-full h-10 rounded-xl bg-slate-100 text-slate-800 text-xs font-extrabold">تفاصيل العرض ومحادثة الفني</button>';
    if(['تم اختيار فني','بانتظار تأكيد العميل'].includes(o.status))h+='<button type="button" onclick="openAccountOrder(\''+escAttr(o.sn)+'\',true)" class="mt-2 w-full h-10 rounded-xl blue-btn text-xs font-extrabold">الدخول إلى المحادثة</button>';
    if(!['تم اختيار فني','بانتظار تأكيد العميل','تم الانتهاء','ملغي','مؤرشف','منتهي','منتهي - اعتذار'].includes(String(o.status||'')))h+='<button type="button" onclick="cancelAccountOrder(\''+escAttr(o.sn)+'\')" class="mt-2 w-full h-10 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-extrabold">إلغاء الطلب</button>';
    h+='</div>';
  });
  return h+'</div></div>';
}
async function acceptAccountOffer(sn,id){if(!confirm('تأكيد قبول هذا العرض؟'))return;try{await API.acceptOffer(sn,id);showToast('تم قبول العرض بنجاح','success');await loadMyOrders(false);render();}catch(error){showToast(error.message||'تعذر قبول العرض.');}}
async function cancelAccountOrder(sn){
  const cleanSN=String(sn||'').trim().toUpperCase();
  if(!VALIDATORS.sn(cleanSN)){showToast('كود الطلب غير صحيح.');return;}
  if(!confirm('هل تريد إلغاء الطلب '+cleanSN+'؟ لن يمكن التراجع عن الإلغاء.'))return;
  try{
    const result=await API.cancelOrder(cleanSN);
    showToast(result.message||'تم إلغاء الطلب بنجاح.','success');
    await loadMyOrders(false);
    if(state.trackInput===cleanSN){state.tracked=null;state.trackError='';}
    render();
  }catch(error){showToast(error.message||'تعذر إلغاء الطلب.');}
}
async function loadNotifications(){
 if(!state.accountToken||!state.account)return;
 try{const data=await API.getNotifications();state.notifications=Array.isArray(data.notifications)?data.notifications:[];state.notificationsUnread=Math.max(0,Number(data.unreadCount||0));var badge=document.getElementById('notificationBadge');var bell=document.querySelector('#app .app-header button[onclick="toggleNotifications()"]');if(state.notificationsUnread>0){var badgeMarkup=notificationBadge();if(badge)badge.outerHTML=badgeMarkup;else if(bell)bell.insertAdjacentHTML('beforeend',badgeMarkup);}else if(badge)badge.remove();if(state.notificationsOpen)render();}
 catch(error){log('تعذر تحميل الإشعارات:',error.message);}
}
async function toggleNotifications(){state.notificationsOpen=!state.notificationsOpen;if(state.notificationsOpen)await loadNotifications();render();}
async function openNotification(id){
 var previous=state.notifications.find(function(n){return n.id===id;});
 try{if(previous&&!previous.read)await API.readNotification(id);}
 catch(error){log('تعذر تعليم الإشعار كمقروء:',error.message);showToast('تعذر تحديث حالة الإشعار. حاول مرة أخرى.');return;}
 state.notifications=state.notifications.map(function(n){return n.id===id?Object.assign({},n,{read:true}):n;});
 if(previous&&!previous.read)state.notificationsUnread=Math.max(0,state.notificationsUnread-1);
 state.notificationsOpen=false;
 var tab='';
 try{var target=new URL(String(previous&&previous.link||''),window.location.origin);if(target.origin===window.location.origin)tab=String(target.searchParams.get('tab')||'');}catch(_){}
 if(!tab&&previous){
  var type=String(previous.type||'');
  if(type.startsWith('client_wallet_')||type==='client_service_refunded')tab='wallet';
  else if(type==='subscription_activated'||type==='subscription_renewed')tab='subscriptions';
  else if(type==='store_order_update')tab='store';
  else if(['order_created','new_offer','offer_accepted','order_cancelled','order_completed','order_rated'].includes(type))tab='orders';
 }
 if(['orders','complaint','wallet','subscriptions','store'].includes(tab)){
  if(typeof rememberClientTab==='function')rememberClientTab(tab);
  state.tab=tab;
  if(tab==='orders'){
   if(state.accountOrdersTab==='current'){
    try{await API.markClientOffersViewed();}catch(error){console.warn('تعذر تسجيل مشاهدة عروض الطلبات:',error?.message||error);}
   }
   await loadMyOrders(false);
  }
  else if(tab==='wallet')await loadClientWallet();
  else if(tab==='subscriptions')await loadClientCommerce();
  else if(tab==='store')await loadStoreForRole('client');
 }
 render();
}
async function markAllNotificationsRead(){try{await API.readAllNotifications();state.notifications=state.notifications.map(function(n){return Object.assign({},n,{read:true});});state.notificationsUnread=0;render();}catch(error){showToast(error.message||'تعذر تحديث الإشعارات.');}}
function notificationBadge(){if(!state.notificationsUnread)return '';return '<span id="notificationBadge" class="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-red-600 px-1 text-[9px] font-black text-white">'+(state.notificationsUnread>99?'99+':state.notificationsUnread)+'</span>'; }
function notificationPanel(){
 if(!state.notificationsOpen)return '';
 var html='<div class="fixed inset-0 z-[99]" onclick="state.notificationsOpen=false;render()"></div><div class="client-notifications-panel fixed left-3 right-3 top-[70px] z-[100] mx-auto max-w-[420px] overflow-hidden rounded-2xl border bg-white text-slate-800 shadow-2xl"><div class="client-notifications-header flex items-center justify-between gap-2 border-b p-3"><b class="text-[15px] font-extrabold">الإشعارات</b><div class="flex items-center gap-3"><button onclick="markAllNotificationsRead()" class="client-notifications-mark-all text-[12px] font-extrabold">تعليم الكل كمقروء</button><button type="button" aria-label="إغلاق الإشعارات" title="إغلاق" onclick="state.notificationsOpen=false;render()" class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold leading-none text-slate-700 hover:bg-slate-200">×</button></div></div><div class="max-h-[60vh] overflow-y-auto">';
 if(!state.notifications.length)html+='<p class="p-6 text-center text-[12px] text-slate-500">مفيش إشعارات لحد دلوقتي.</p>';
 state.notifications.forEach(function(n){html+='<button type="button" data-notification-id="'+escAttr(n.id)+'" class="client-notification-item notification-item block w-full border-b p-3 text-right '+(n.read?'is-read':'is-unread')+'"><b class="block text-[16px] font-bold text-slate-900">'+escHtml(n.title)+'</b><span class="mt-1 block text-[15px] font-semibold leading-7 text-slate-800">'+escHtml(n.message)+'</span><small class="mt-2 block text-[11px] font-medium text-slate-500">'+(n.createdAt?new Date(n.createdAt).toLocaleString('ar-EG'):'')+'</small></button>';});
 return html+'</div></div>';
}
document.addEventListener('click',function(event){var item=event.target.closest('[data-notification-id]');if(item)openNotification(item.getAttribute('data-notification-id'));});
if(!window.__sonaaClientNotificationRefresh){
 window.__sonaaClientNotificationRefresh=true;
 window.setInterval(function(){if(document.visibilityState!=='hidden'&&state.accountToken&&state.account)void loadNotifications();},20000);
 document.addEventListener('visibilitychange',function(){if(!document.hidden&&state.accountToken&&state.account)void loadNotifications();});
 window.addEventListener('focus',function(){if(state.accountToken&&state.account)void loadNotifications();});
}
document.addEventListener('focusout',function(){if(!clientLiveRenderPending||!state.account||!['orders','track'].includes(state.tab))return;setTimeout(function(){if(clientLiveRenderPending&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){clientLiveRenderPending=false;const scrollY=window.scrollY||window.pageYOffset||0;render();window.scrollTo({top:scrollY,left:0,behavior:'instant'});focusClientPostAction();}},0);});
