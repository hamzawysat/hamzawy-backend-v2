'use strict';

let fanniLoadingSafetyTimer=null;
let globalRefreshInProgress=false;
let technicianRefreshInProgress=false;
let fanniReferralInfo=null;
let fanniReferralExpanded=false;
let fanniReferralPageOpen=false;
function openFanniReferralPage(){fanniReferralPageOpen=true;renderContent();}
function closeFanniReferralPage(){fanniReferralPageOpen=false;renderContent();}
async function loadFanniReferralInfo(){if(!getToken())return;try{fanniReferralInfo=await apiGet('/api/referrals/me/fanni');if(state.tab==='home'||fanniReferralPageOpen)renderContent();}catch(error){console.warn('تعذر تحميل دعوات الفني:',error.message);}}
async function copyFanniReferralLink(){const value=fanniReferralInfo?.url||'';if(!value)return;try{await navigator.clipboard.writeText(value);toast('تم نسخ رابط الدعوة','success');}catch(_){toast('تعذر النسخ تلقائيًا؛ انسخ الرابط يدويًا','error');}}
async function shareFanniReferralLink(){const value=fanniReferralInfo?.url||'';if(!value)return;try{if(navigator.share)await navigator.share({title:'دعوة فني - حمزاوي سات',text:'ادعُ فنيًا إلى حمزاوي سات، وبعد أن يُكمل 3 طلبات يحصل كل منكما على 150 جنيهًا.',url:value});else await copyFanniReferralLink();}catch(error){if(error?.name!=='AbortError')toast('تعذرت مشاركة الرابط','error');}}
function scrollToFanniReferralCard(){const card=document.getElementById('fanniReferralCard');if(card)card.scrollIntoView({behavior:'smooth',block:'center'});}
function toggleFanniReferralCard(){fanniReferralExpanded=!fanniReferralExpanded;render();}
function renderFanniReferralCard(){
 if(!fanniReferralInfo)return '';
 const info=fanniReferralInfo;
 const referralExpanded=fanniReferralPageOpen||fanniReferralExpanded;
 if(referralExpanded&&info.enabled&&info.url&&window.QRCode)requestAnimationFrame(()=>{const el=document.getElementById('fanniReferralQr');if(el){el.innerHTML='';new QRCode(el,{text:info.url,width:150,height:150,colorDark:'#111827',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}});
 const history=Array.isArray(info.referrals)?info.referrals:[];
 const sharing=info.enabled?'<div class="mt-3 rounded-xl border border-dashed border-amber-300 bg-white p-3"><p class="text-[10px] font-bold text-slate-500">كود دعوتك</p><p class="mt-1 text-center text-lg font-black tracking-wider" dir="ltr">'+esc(fanniReferralInfo.code||'')+'</p><p class="mt-2 break-all text-center text-[10px] text-slate-500" dir="ltr">'+esc(info.url||'')+'</p></div><div class="mt-3 flex justify-center rounded-xl border border-slate-200 bg-white p-2"><div id="fanniReferralQr" aria-label="باركود QR لرابط الدعوة"></div></div><div class="mt-3 grid grid-cols-2 gap-2"><button type="button" onclick="copyFanniReferralLink()" class="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-extrabold text-white">نسخ الرابط</button><button type="button" onclick="shareFanniReferralLink()" class="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2.5 text-xs font-extrabold text-amber-900">مشاركة الدعوة</button></div>':'<p class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-bold text-amber-900">إنشاء دعوات فنيين جديدة متوقف حاليًا. دعواتك المسجلة سابقًا مستمرة في احتساب الشغلانات وصرف المكافآت عند استحقاقها.</p>';
 const rows=history.length?'<div class="mt-3 space-y-2">'+history.map(x=>'<div class="rounded-xl border border-slate-200 bg-white p-3 text-[12px]"><b>'+esc(x.number||'دعوة')+'</b><span class="float-left">'+esc(({pending:'معلقة',in_progress:'قيد التقدم',eligible:'مستحقة',completed:'مكتملة',rejected:'مرفوضة'})[x.status]||x.status||'—')+'</span><p class="mt-2 text-slate-600">الإنجاز: '+Number(x.completedCount||0)+' / '+Number(x.requiredCount||3)+' • مكافأتك: '+(x.inviterReward?.paidAt?'تم الصرف':'لم تصرف')+' • مكافأة الفني: '+(x.inviteeReward?.paidAt?'تم الصرف':'لم تصرف')+'</p></div>').join('')+'</div>':'<p class="mt-3 text-[12px] text-slate-600">لا توجد دعوات فنيين مسجلة حتى الآن.</p>';
 return '<section id="fanniReferralCard" class="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-3"><div class="flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl">🎁</span><div class="min-w-0 flex-1"><h3 class="text-sm font-black text-slate-900">ادعُ فنيًا واكسب 150 جنيهًا</h3><p class="mt-1 text-[13px] font-semibold leading-6 text-slate-700">عن كل فني جديد يسجل من رابط دعوتك ويكمل 3 طلبات، تحصل أنت وهو على 150 جنيهًا مكافأة.</p></div>'+(fanniReferralPageOpen?'':'<button type="button" onclick="toggleFanniReferralCard()" aria-expanded="'+(fanniReferralExpanded?'true':'false')+'" class="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[10px] font-extrabold text-amber-900">'+(fanniReferralExpanded?'إخفاء ▲':'التفاصيل ▼')+'</button>')+'</div><div class="mt-2 text-[12px] font-bold text-slate-700">دعواتك: '+Number(info.totals?.count||history.length)+' • المكتملة: '+Number(info.totals?.completed||0)+'</div>'+(referralExpanded?sharing+rows:'')+'</section>';
}
function showFanniLoading(message){let overlay=document.getElementById('fanniLoadingOverlay');if(!overlay){overlay=document.createElement('div');overlay.id='fanniLoadingOverlay';overlay.className='fanni-loading-overlay';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.innerHTML='<main class="account-gate min-h-screen px-4 py-8 flex items-center justify-center"><div class="w-full max-w-[440px] text-center"><div class="account-brand mx-auto mb-5 flex items-center justify-center"><img src="/images/LOGO_UPLOAD_HERE/logo.png" alt="صُنّاع" class="sonaa-logo-svg account-loading-logo"></div><h1 class="text-2xl font-black">صُنّاع</h1><p class="account-slogan mt-1 text-base font-extrabold">كل خدمة تبدأ بخطوة</p><div class="mt-7 inline-flex items-center gap-3 rounded-2xl border border-blue-200 bg-white/90 px-5 py-4 font-extrabold text-blue-900 shadow-xl"><span class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></span><span id="fanniLoadingMessage">جاري تحميل البيانات...</span></div></div></main>';document.body.appendChild(overlay);}const label=document.getElementById('fanniLoadingMessage');if(label)label.textContent=message||'جاري تحميل البيانات...';overlay.classList.remove('is-hidden');clearTimeout(fanniLoadingSafetyTimer);fanniLoadingSafetyTimer=setTimeout(hideFanniLoading,9000);}
function hideFanniLoading(){clearTimeout(fanniLoadingSafetyTimer);const overlay=document.getElementById('fanniLoadingOverlay');if(overlay)overlay.classList.add('is-hidden');}
async function refreshTechnicianPage(){
 if(technicianRefreshInProgress)return;
 technicianRefreshInProgress=true;
 showFanniLoading('جاري تحديث بيانات الفني...');
 try{
  const checks=[['الخدمات',loadServices],['مناطق العمل',loadAreas],['إعلانات وأسئلة شائعة',loadFanniPublicContent]];
  if(getToken()){
   checks.push(['الملف الشخصي',loadProfile],['الطلبات المتاحة',loadOrders],['العروض والمهام',loadMyOffers],['المحفظة',loadWalletHistory],['إشعارات الحساب',loadNotifications],['أرقام التحويل',loadWalletTransferNumbers],['الدعوات',loadFanniReferralInfo]);
  }
  const results=await Promise.all(checks.map(async ([label,loader])=>{
   try{return {label,status:await loader()};}
   catch(error){log('فشل تحديث '+label,error?.message||error);return {label,status:false};}
  }));
  const failed=results.filter(item=>item.status===false).map(item=>item.label);
  const skipped=results.filter(item=>item.status===null).map(item=>item.label);
  if(failed.length)toast('اكتمل التحديث جزئيًا. تعذر تحديث: '+failed.join('، '),'error');
  else if(skipped.length)toast('تم تحديث البيانات المتاحة. تم تجاوز عناصر قيد التحميل: '+skipped.join('، '),'pending');
  else toast('تم تحديث جميع بيانات الفني بنجاح','success');
 }finally{
  hideFanniLoading();
  technicianRefreshInProgress=false;
 }
}
async function start(){
 showFanniLoading('جاري تحميل البيانات...');
 try{
  render();
  await Promise.allSettled([loadServices(),loadAreas(),loadFanniPublicContent()]);
  render();
  if(!getToken())return;
  state.checkingSession=true;
  await loadProfile();
  if(!getToken())return;
  if(state.tab==='login'||state.tab==='register')state.tab='home';
  await Promise.allSettled([loadOrders(),loadMyOffers(),loadWalletHistory(),loadNotifications(),loadFanniReferralInfo()]);
 }catch(error){
  console.error('Technician page initialization failed:',error);
  const detail=String(error?.message||'خطأ غير معروف').slice(0,180);
  toast('حصل خطأ أثناء فتح صفحة الفني: '+detail,'error');
 }finally{
  state.checkingSession=false;
  hideFanniLoading();
  try{render();}catch(error){
   console.error('Technician page render failed:',error);
   const detail=String(error?.message||'خطأ غير معروف').slice(0,180);
   toast('تعذر عرض صفحة الفني: '+detail,'error');
  }
 }
}

start();
startFanniPolling();

async function loadFanniPublicContent(){try{const data=await apiGet('/api/content?role=fanni');state.publicContent={siteName:String(data.siteName||'حمزاوي سات'),announcement:String(data.announcement||''),faqs:Array.isArray(data.faqs)?data.faqs:[]};render();return true;}catch(error){log('تعذر تحميل إعلانات وأسئلة الفني:',error);return false;}}
