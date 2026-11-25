
'use strict';

const BASE_URL='https://www.hamzawy-sat.dynv6.net';
const TOKEN_KEY='fanni_token_v4';
const USER_KEY='fanni_user_v4';
const IS_DEV=['localhost','127.0.0.1'].includes(location.hostname);
const log=(...a)=>{if(IS_DEV)console.log(...a)};

// === تم التوحيد مع /api/services - المصدر الرسمي الوحيد ===
let CATEGORIES=[];
let ALL_SERVICES=[];
let AREA_OPTIONS=[];
let SERVICES_LOADING=true;
let SERVICES_ERROR='';

const V={
 phone:v=>/^01[0-25]\d{8}$/.test(String(v||'').replace(/\D/g,'')),
 text:(v,min,max)=>{const s=String(v??'').trim();return s.length>=min&&s.length<=max},
 sn:v=>/^SN\d{6}$/i.test(String(v||'').trim()),
 money:(v,min=10,max=10000)=>Number.isInteger(Number(v))&&Number(v)>=min&&Number(v)<=max
};

function esc(s){
 return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// أيقونات متنوعة ومخصصة حسب نوع الخدمة لتقليل تكرار الرموز.
function serviceIconFor(name){
  const s=String(name||'');
  const rules=[
    [/كاميرات|مراقبة/,'📹'],
    [/دش|رسيفر|استقبال|شاشة تلفزيون|شاشات/,'📡'],
    [/تنظيف سجاد|موكيت|كنب|انتريهات|مراتب/,'🧽'],
    [/مكافحة حشرات/,'🪲'],
    [/تنظيف خزانات|خزانات مياه/,'🛢️'],
    [/تنظيف زجاج|واجهات زجاج|زجاج/,'🪟'],
    [/تنظيف|تطهير/,'🧹'],
    [/كهربائي سيارات/,'🚗'],
    [/كهرباء|كهربائي|قواطع|مفاتيح|برايز|إضاءة|نجف|لوحة الكهرباء/,'⚡'],
    [/مراوح|مروحة/,'🌀'],
    [/تسريب|مياه|سباك|صرف صحي|سيفون|خلاطات|حوض|حمامات|مواسير|قاعدة حمام/,'🚿'],
    [/تكييف|فريون|تبريد/,'❄️'],
    [/ثلاجات|فريزر|مبرد مياه/,'🧊'],
    [/غسالات|أطباق/,'🧺'],
    [/بوتاجاز|أفران|ميكروويف|غاز/,'🔥'],
    [/سخانات/,'♨️'],
    [/نجار|أثاث|موبيليا|دواليب|أبواب|شبابيك|مفصلات/,'🪚'],
    [/أقفال|كالون|قفل/,'🔐'],
    [/نقاش|دهانات|طلاء/,'🖌️'],
    [/ديكور|ورق حائط|جبس بورد/,'🎨'],
    [/شروخ|ترميم|محارة|بياض/,'🧱'],
    [/ألوميتال/,'🪟'],
    [/سيراميك|رخام|بناء|أرضيات|عزل|حجر|وزر|تشطيب|طوب/,'🧱'],
    [/كمبيوتر|لابتوب|طابعات/,'💻'],
    [/راوتر|إنترنت|شبكات/,'📶'],
    [/موبايلات/,'📱'],
    [/نقل أثاث|نقل أجهزة|نقل/,'🚚'],
    [/ستائر/,'🪟'],
    [/تركيب رفوف|تركيب مرايات/,'🪛'],
    [/لحام|معدن/,'🛠️'],
    [/مضخات|مواتير/,'⚙️'],
    [/تركيب|فك|تثبيت|صيانة|إصلاح|تصليح/,'🔧']
  ];
  for(const [pattern,icon] of rules) if(pattern.test(s)) return icon;
  const variety=['🔩','🪜','🧲','🪠','🧯','🏠','📐','🧰','🪛','🧱','⚙️','🔨'];
  let hash=0;
  for(let i=0;i<s.length;i++) hash=(hash*31+s.charCodeAt(i))>>>0;
  return variety[hash%variety.length];
}


function clean(s,max=1000){
 return String(s??'').trim().slice(0,max).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
}

function getToken(){
 try{return localStorage.getItem(TOKEN_KEY)||''}catch{return ''}
}
async function playOrderVoice(sn,button){let audio=button?.parentElement?.querySelector('audio[data-order-voice]');if(!audio){audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.dataset.orderVoice='1';audio.className='mt-2 w-full';button?.parentElement?.appendChild(audio)}if(!audio.src){try{button.disabled=true;const response=await fetch('/api/orders/'+encodeURIComponent(sn)+'/voice',{headers:{Authorization:'Bearer '+getToken()}});if(!response.ok)throw Error('تعذر تحميل التسجيل الصوتي.');audio.src=URL.createObjectURL(await response.blob())}catch(e){toast(e.message,'error');return}finally{button.disabled=false}}try{await audio.play()}catch(e){audio.controls=true}}

function getUser(){
 try{return JSON.parse(localStorage.getItem(USER_KEY)||'null')}catch{return null}
}

function setAuth(token,user){
 try{
  if(token)localStorage.setItem(TOKEN_KEY,token);
  if(user)localStorage.setItem(USER_KEY,JSON.stringify(user));
 }catch(e){
  log('تعذر حفظ بيانات الجلسة',e);
 }
}

function clearAuth(){
 try{
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
 }catch(e){
  log('تعذر مسح بيانات الجلسة',e);
 }
}

function buildUrl(path){
 // Keep browser API requests on the exact origin serving the page.
 // This avoids sending technician login to a stale Vercel alias while
 // the client page already uses same-origin /api requests.
 return path;
}

function toast(message,type='success'){
 const el=document.getElementById('toast');
 const bg=type==='success'?'bg-[#2E7CF6]':type==='pending'?'bg-[#2E7CF6]':'bg-[#2E7CF6]';
 el.innerHTML=`<div class="pointer-events-auto mx-auto max-w-[640px] rounded-[14px] ${bg} text-white text-[13px] font-bold px-4 py-3 shadow-2xl flex justify-between gap-3"><span class="leading-6">${esc(message)}</span><button onclick="this.parentElement.remove()" class="shrink-0 h-7 px-3 rounded-full bg-white/20">إغلاق</button></div>`;
 setTimeout(()=>{if(el.firstElementChild)el.innerHTML=''},4000);
}

function onRegAreaSearch(value){
 const input=document.getElementById('regAreaSearchInput');
 if(!input)return;

 // The input is the source of truth for this input event.
 state.regAreaSearch=input.value;

 const picker=input.closest('.fanni-area-picker');
 const optionsContainer=picker?.querySelector('.fanni-area-options');
 if(!optionsContainer)return;

 const query=normalizeFanniAreaSearchText(state.regAreaSearch.trim());
 const options=[...new Set(AREA_OPTIONS)].filter(
  area=>!isReservedFanniArea(area)
 );
 const visible=options.filter(
  area=>!query||normalizeFanniAreaSearchText(area).includes(query)
 ).slice(0,80);

 optionsContainer.innerHTML=visible.map(area=>{
  const checked=state.regAreas.includes(area);
  return `<button
   type="button"
   data-area="${esc(area)}"
   onclick="toggleRegArea(this.dataset.area,this)"
   aria-pressed="${checked?'true':'false'}"
   class="fanni-area-option ${checked?'is-selected':''}"
  ><span>${esc(area)}</span><span class="fanni-check">${checked?'✓':''}</span></button>`;
 }).join('')||'<p class="fanni-picker-no-results">لا توجد مناطق مطابقة للبحث.</p>';
}
function toggleRegArea(area,trigger){
 const value=clean(area,60);
 if(!value||value==='جميع المناطق')return;

 const input=document.getElementById('regAreaSearchInput');
 const picker=input?.closest('.fanni-area-picker');
 if(!picker)return;

 const wasSelected=state.regAreas.includes(value);

 if(!wasSelected&&state.regAreas.length>=30){
  if(trigger?.classList?.contains('fanni-area-option')){
   const selected=state.regAreas.includes(value);

   trigger.setAttribute('aria-pressed',String(selected));
   trigger.classList.toggle('is-selected',selected);

   const check=trigger.querySelector('.fanni-check');
   if(check)check.textContent=selected?'✓':'';
  }

  toast('تقدر تختار لحد 30 منطقة فقط.','error');
  return;
 }

 state.regAreas=wasSelected
  ?state.regAreas.filter(item=>item!==value)
  :[...state.regAreas,value];

 state.error='';

 const errorElement=document.querySelector(
  '#app p.text-red-600.bg-red-50.border-red-100.rounded-xl'
 );
 if(errorElement){
  errorElement.remove();
 }

 const selectedList=picker.querySelector('.fanni-selected-areas');

 if(selectedList){
  const chosen=state.regAreas.filter(
   item=>!isReservedFanniArea(item)
  );

  selectedList.innerHTML=chosen.map(item=>`
   <button
    type="button"
    data-area="${esc(item)}"
    onclick="toggleRegArea(this.dataset.area,this)"
    class="fanni-area-tag"
   >${esc(item)} <span aria-hidden="true">×</span></button>
  `).join('')||'<span class="fanni-picker-empty">لم تختار مناطق حتى الآن</span>';
 }

 const optionButtons=picker.querySelectorAll(
  '.fanni-area-options .fanni-area-option[data-area]'
 );

 optionButtons.forEach(button=>{
  const selected=state.regAreas.includes(button.dataset.area);

  button.setAttribute('aria-pressed',String(selected));
  button.classList.toggle('is-selected',selected);

  const check=button.querySelector('.fanni-check');
  if(check)check.textContent=selected?'✓':'';
 });
}
function onEditAreaSearch(value){
 state.editAreaSearch=String(value||'').slice(0,60);
 const cursor=state.editAreaSearch.length;render();
 const input=document.getElementById('editAreaSearchInput');
 if(input){input.focus();try{input.setSelectionRange(cursor,cursor);}catch(_){}}
}
function toggleEditArea(area){
 const value=clean(area,60);if(!value||value==='جميع المناطق')return;
 if(state.editAreas.includes(value))state.editAreas=state.editAreas.filter(item=>item!==value);
 else if(state.editAreas.length>=30){state.error='تقدر تختار لحد 30 منطقة فقط.';render();return;}
 else state.editAreas=[...state.editAreas,value];
 state.error='';render();
}
function normalizeFanniAreaSearchText(value){
 return String(value||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,'').replace(/[أإآٱ]/g,'ا').toLocaleLowerCase('ar');
}
function isReservedFanniArea(value){
 return normalizeFanniAreaSearchText(value).replace(/\s+/g,'')==='جميعالمناطق';
}

function renderFanniAreaPicker(selected,search,inputId,searchHandler,toggleHandler){
 const chosen=Array.isArray(selected)?selected.filter(area=>!isReservedFanniArea(area)):[];
 const query=normalizeFanniAreaSearchText(String(search||'').trim());
 const options=[...new Set(AREA_OPTIONS)].filter(area=>!isReservedFanniArea(area));
 const visible=options.filter(area=>!query||normalizeFanniAreaSearchText(area).includes(query)).slice(0,80);
 return `<div class="fanni-area-picker">
  <div class="fanni-picker-search"><span aria-hidden="true">⌕</span><input id="${esc(inputId)}" value="${esc(search||'')}" oninput="${esc(searchHandler)}(this.value)" placeholder="اكتب اسم المنطقة للبحث..." autocomplete="off"></div>
  <div class="fanni-selected-areas">${chosen.map(area=>`<button type="button" data-area="${esc(area)}" onclick="${esc(toggleHandler)}(this.dataset.area,this)" class="fanni-area-tag">${esc(area)} <span aria-hidden="true">×</span></button>`).join('')||'<span class="fanni-picker-empty">لم تختار مناطق حتى الآن</span>'}</div>
  <div class="fanni-area-options">${visible.map(area=>{const checked=chosen.includes(area);return `<button type="button" data-area="${esc(area)}" onclick="${esc(toggleHandler)}(this.dataset.area,this)" aria-pressed="${checked?'true':'false'}" class="fanni-area-option ${checked?'is-selected':''}"><span>${esc(area)}</span><span class="fanni-check">${checked?'✓':''}</span></button>`}).join('')||'<p class="fanni-picker-no-results">لا توجد مناطق مطابقة للبحث.</p>'}</div>
  <p class="fanni-picker-hint">تقدر تختار أكتر من منطقة. الاختيارات المحددة ظاهرة فوق.</p>
 </div>`;
}
function addCustomRegArea(){
 state.error='المنطقة غير موجودة في القائمة المعتمدة. اطلب من الإدارة إضافتها أولًا ثم اختارها من القائمة.';
 render();
}
async function loadAreas(){
 let loaded=false;
 try{const data=await API.areas();AREA_OPTIONS=Array.isArray(data?.areas)?data.areas:[];loaded=Array.isArray(data?.areas);}
 catch(e){log('تعذر تحميل المناطق',e);AREA_OPTIONS=[];}
 render();
 return loaded;
}

function parseAreas(value){
 return [...new Set(String(value||'').split(/[,،;\n\r]+/).map(x=>clean(x,60)).filter(x=>x.length>=2))].slice(0,30);
}

async function api(path,options={}){
 const headers={'Content-Type':'application/json',...(options.headers||{})};
 const token=getToken();
 if(token)headers.Authorization='Bearer '+token;

 let response;
 let raw;
 const timeoutMs=Number(options.timeoutMs)||20000;
 const fetchOptions={...options};
 delete fetchOptions.timeoutMs;
 const controller=timeoutMs&&typeof AbortController!=='undefined'?new AbortController():null;
 let timeoutId=null;
 if(controller)timeoutId=setTimeout(()=>controller.abort(),timeoutMs);

 // Keep the timeout active until the complete response body is read.
 // fetch() may resolve when headers arrive while response.text() is still pending.
 try{
  response=await fetch(buildUrl(path),{...fetchOptions,...(controller?{signal:controller.signal}:{}),headers,credentials:'omit',mode:'cors'});
  raw=await response.text();
 }catch(e){
  if(controller&&controller.signal.aborted)throw new Error('استغرق الاتصال وقتًا أطول من المعتاد. حاول مرة أخرى بعد قليل.');
  throw new Error('تعذر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.');
 }finally{
  if(timeoutId!==null)clearTimeout(timeoutId);
 }
 let data={};

 try{data=raw?JSON.parse(raw):{}}catch{data={message:'تعذر قراءة البيانات. حاول مرة أخرى.'};}

 if(!response.ok){
  const isMaintenance=response.status===503&&data.code==='MAINTENANCE_MODE';
  const message=isMaintenance?(data.message||'الموقع تحت الصيانة مؤقتًا. سنعود للعمل قريبًا.'):(response.status===404||response.status>=500?'تعذر تنفيذ طلبك حاليًا. حاول مرة أخرى.':(data.message||data.error||(
   response.status===404?'الخدمة المطلوبة غير متاحة حاليًا.':
   response.status===401?'انتهت الجلسة أو بيانات الدخول غير صحيحة':
   response.status===403?'الحساب غير مصرح له بتنفيذ العملية':
   response.status===429?'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا':
   `حدثت مشكلة أثناء تنفيذ الطلب. حاول مرة أخرى.`
  )));

  const error=new Error(message);
  error.status=response.status;
  error.data=data;
  log('API error',path,response.status,data);
  throw error;
 }

 log('API success',path,response.status,data);
 return data;
}

const apiGet=path=>api(path,{method:'GET'});
const apiPost=(path,body)=>api(path,{method:'POST',body:JSON.stringify(body)});

const API={
 register:p=>apiPost('/api/fanni/register',p),
 uploadRegistrationIdentity:(side,file)=>api('/api/fanni/registration-media?side='+encodeURIComponent(side),{method:'POST',body:file,headers:{'Content-Type':file.type},timeoutMs:90000}),
  updateProfilePhoto:p=>api('/api/fanni/me/profile-photo',{method:'PATCH',body:JSON.stringify(p),timeoutMs:15000}),
  updateIdentityCard:p=>api('/api/fanni/me/identity-card',{method:'PATCH',body:JSON.stringify(p),timeoutMs:20000}),
 login:p=>api('/api/fanni/login',{method:'POST',body:JSON.stringify(p),timeoutMs:15000}),
 profile:()=>apiGet('/api/fanni/me'),
 availability:acceptingOrders=>api('/api/fanni/availability',{method:'PATCH',body:JSON.stringify({acceptingOrders})}),
 updateProfile:p=>api('/api/fanni/me',{method:'PATCH',body:JSON.stringify(p),timeoutMs:15000}),
 reviewResubmission:p=>api('/api/fanni/me/review-resubmission',{method:'PATCH',body:JSON.stringify(p),timeoutMs:30000}),
 available:(page=1)=>apiGet('/api/orders/available?page='+encodeURIComponent(page)),
 myOffers:()=>apiGet('/api/orders/my-offers'),
 complete:sn=>apiPost('/api/orders/'+encodeURIComponent(sn)+'/complete',{}),
 rateOrder:(sn,p)=>apiPost('/api/orders/'+encodeURIComponent(sn)+'/rating',p),
 acceptGuidelines:()=>apiPost('/api/fanni/guidelines/accept',{accepted:true,version:'2026-10-20-v1'}),
 chat:sn=>apiGet('/api/orders/'+encodeURIComponent(sn)+'/chat'),
 sendChat:(sn,text,offerId)=>apiPost('/api/orders/'+encodeURIComponent(sn)+'/chat',{text,...(offerId?{offerId}:{})}),
 requestPriceChange:(sn,newPrice,reason)=>apiPost('/api/orders/'+encodeURIComponent(sn)+'/price-change',{newPrice,reason}),
 offer:(sn,p)=>apiPost('/api/fanni/orders/'+encodeURIComponent(sn)+'/offer',p),
 topup:p=>apiPost('/api/fanni/wallet/topup',p),
 walletHistory:()=>apiGet('/api/fanni/wallet/history'),
 notifications:()=>apiGet('/api/notifications/fanni'),
 readNotification:id=>api('/api/notifications/fanni/'+encodeURIComponent(id)+'/read',{method:'PATCH'}),
 readAllNotifications:()=>api('/api/notifications/fanni/read-all',{method:'PATCH'}),
 areas:()=>apiGet('/api/areas'),
 walletSettings:()=>apiGet('/api/wallet-settings')
};

async function loadServices(){
 let loaded=false;
 SERVICES_LOADING=true;
 SERVICES_ERROR='';
 if(CATEGORIES.length||ALL_SERVICES.length||SERVICES_ERROR)render();
 try{
  const data=await apiGet('/api/services');
  const cats=Array.isArray(data.categories)?data.categories:[];
  const srvs=Array.isArray(data.services)?data.services:[];
  if(!cats.length||!srvs.length)throw new Error('قائمة الخدمات غير متاحة حاليًا. حاول مرة أخرى بعد قليل.');
  for(const c of cats){
    if(!c||typeof c.label!=='string'||!Array.isArray(c.services))throw new Error('بيانات الأقسام غير سليمة.');
  }
  CATEGORIES=cats;
  ALL_SERVICES=[...new Set(srvs)];
  SERVICES_LOADING=false;
  SERVICES_ERROR='';
  log('تم تحميل الخدمات للفني:',CATEGORIES.length+' قسم, '+ALL_SERVICES.length+' خدمة');
  loaded=true;
 }catch(e){
  SERVICES_LOADING=false;
  SERVICES_ERROR=e.message||'تعذر تحميل قائمة الخدمات';
  CATEGORIES=[];
  ALL_SERVICES=[];
  log('فشل تحميل الخدمات للفني',e);
  toast(SERVICES_ERROR,'error');
 }
 render();
 return loaded;
}

let dashboardSpecialtiesCollapsed=true;
function toggleDashboardSpecialties(){dashboardSpecialtiesCollapsed=!dashboardSpecialtiesCollapsed;render();}
let forceTechnicianRegistration=false;
let state={
 storeProducts:[],myStoreOrders:[],publicContent:{siteName:'ساتڤيو',announcement:'',faqs:[]},
 tab:forceTechnicianRegistration?'register':'login',myOrdersView:'active',
 loginPhone:'',loginPass:'',loginSubmitAllowed:false,
 regName:'',regPhone:'',regPass:'',regPassConfirm:'',regGuidelinesAccepted:false,
regIdFrontFileId:'',regIdBackFileId:'',regIdFrontPreview:'',regIdBackPreview:'',regIdFrontUploading:false,regIdBackUploading:false,
 regNationalId:'',regProfilePhotoFileId:'',regProfilePhotoPreview:'',regProfilePhotoUploading:false,regProfilePhotoUploadStatus:'',
 regSpecialties:[],regAreas:[],regAreaSearch:'',regAreaCustom:'',openSpecialtyCategory:'',
 editProfileMode:false,editPhone:'',editAreas:[],editAreaSearch:'',editSpecialties:[],editSaving:false,
 reviewResubmissionForId:'',reviewResubmissionFields:{},reviewResubmissionImages:{},reviewResubmissionUploading:{},reviewResubmissionSaving:false,
 loading:false,checkingSession:false,availabilitySaving:false,
 
 orders:[],filteredOrders:[],ordersPagination:{page:1,limit:20,total:0,pages:0},search:'',filterSkill:'الكل',
 myOffers:[],completedOffers:[],offerModal:null,offerPrice:'',offerMessage:'',
 offerError:'',offerSubmitting:false,
 walletFromPhone:'',walletAmount:'',walletRef:'',walletMethod:'vodafone_cash',
 walletPhone1:'',walletPhone2:'',
 walletLoading:false,walletHistory:[],walletTransactions:[],walletBalance:0,
 error:'',success:'',pendingMsg:''
};

let currentUser=getUser();

function isApproved(){
 return String(currentUser?.status||'').trim()==='معتمد';
}

function isPending(){
 const status=String(currentUser?.status||'').trim().toLowerCase();
 return ['قيد المراجعة','قيد المراجعه','pending','under_review','معلق'].includes(status);
}

function extractList(data,keys){
 if(Array.isArray(data))return data;
 for(const key of keys){
  if(Array.isArray(data?.[key]))return data[key];
 }
 if(Array.isArray(data?.data))return data.data;
 if(Array.isArray(data?.data?.[keys[0]]))return data.data[keys[0]];
 return [];
}

function extractUser(data){
 return data?.user||data?.fanni||data?.data?.user||data?.data?.fanni||null;
}

function extractToken(data){
 return data?.token||data?.accessToken||data?.data?.token||data?.data?.accessToken||'';
}

function goClient(){
 location.href=location.origin+'/';
}

function goBack(){
 if(currentUser||getToken()){showLogoutConfirmation('back');return;}
 if(window.history.length>1){window.history.back();return;}
 window.location.href='/';
}
function showLogoutConfirmation(action='logout'){
 if(document.getElementById('logoutConfirmOverlay'))return;
 const overlay=document.createElement('div');
 overlay.id='logoutConfirmOverlay';
 overlay.className='logout-confirm-overlay';
 overlay.setAttribute('role','dialog');
 overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-labelledby','logoutConfirmTitle');
 overlay.innerHTML='<div class="logout-confirm-card"><div class="logout-confirm-icon" aria-hidden="true">↪</div><h2 id="logoutConfirmTitle" class="text-xl font-black text-slate-900">تأكيد تسجيل الخروج</h2><p class="mt-3 text-sm leading-6 font-bold text-slate-600">متأكد إنك عايز تسجّل خروج من حسابك؟</p><div class="mt-6 grid grid-cols-2 gap-3"><button type="button" class="logout-confirm-btn logout-confirm-cancel" data-logout-action="cancel">لا، خليك معايا</button><button type="button" class="logout-confirm-btn logout-confirm-yes" data-logout-action="confirm">أيوه، خروج</button></div></div>';
 document.body.appendChild(overlay);
 overlay.addEventListener('click',function(e){
  if(e.target===overlay||e.target.closest('[data-logout-action="cancel"]')){overlay.remove();return;}
  if(e.target.closest('[data-logout-action="confirm"]')){
   overlay.remove();
   performFanniLogout();
   if(action==='back'){
    if(window.history.length>1)window.history.back();
    else window.location.href='/';
   }
  }
 });
 overlay.querySelector('[data-logout-action="cancel"]').focus();
}
function logout(){showLogoutConfirmation();}
function performFanniLogout(){
 const token=getToken();
 if(token){try{fetch('/api/fanni/logout',{method:'POST',headers:{Authorization:'Bearer '+token},keepalive:true}).catch(()=>{});}catch(e){}}
 stopFanniPolling();
 clearAuth();
 currentUser=null;
 Object.assign(state,{
  tab:'login',orders:[],filteredOrders:[],myOffers:[],
  walletHistory:[],walletTransactions:[],walletBalance:0,error:'',success:'',
  pendingMsg:'',offerModal:null,loading:false
 });
 render();
 toast('تم تسجيل الخروج');
}

function toggleSpecialtyCategory(label){
 const previousCategory=state.openSpecialtyCategory;
 const nextCategory=previousCategory===label?'':label;

 state.openSpecialtyCategory=nextCategory;

 if(previousCategory){
  const previousHeader=Array.from(
   document.querySelectorAll('.fanni-specialty-category-head')
  ).find(el=>el.dataset.category===previousCategory);

  if(previousHeader){
   previousHeader.setAttribute('aria-expanded','false');

   const previousIcon=previousHeader.querySelector(
    '.flex.shrink-0 > span:last-child'
   );

   if(previousIcon){
    previousIcon.textContent='+';
   }

   const previousOptions=document.getElementById(
    previousHeader.getAttribute('aria-controls')
   );

   if(previousOptions){
    previousOptions.remove();
   }
  }
 }

 if(!nextCategory)return;

 const category=CATEGORIES.find(
  cat=>cat.label===nextCategory
 );

 if(!category)return;

 const header=Array.from(
  document.querySelectorAll('.fanni-specialty-category-head')
 ).find(el=>el.dataset.category===nextCategory);

 if(!header)return;

 const categoryIndex=CATEGORIES.indexOf(category);
 const categoryId='specialty-category-'+categoryIndex;

 const existingOptions=document.getElementById(categoryId);
 if(existingOptions){
  existingOptions.remove();
 }

 const options=document.createElement('div');
 options.id=categoryId;
 options.className=
  'fanni-specialty-options grid grid-cols-3 gap-2 border-t p-3 max-[380px]:grid-cols-2';

 options.innerHTML=category.services.map(s=>`
  <label class="service-chip ${state.regSpecialties.includes(s)?'selected':''}">
   <input
    type="checkbox"
    data-specialty="${esc(s)}"
    ${state.regSpecialties.includes(s)?'checked':''}
    onchange="toggleSpecialty(this.dataset.specialty)"
   >
   <span class="service-icon" aria-hidden="true">${serviceIconFor(s)}</span>
   <span>${esc(s)}</span>
  </label>
 `).join('');

 header.after(options);

 header.setAttribute('aria-controls',categoryId);
 header.setAttribute('aria-expanded','true');

 const icon=header.querySelector(
  '.flex.shrink-0 > span:last-child'
 );

 if(icon){
  icon.textContent='−';
 }
}

function toggleSpecialty(s){
 const input=Array.from(
  document.querySelectorAll('.fanni-specialty-options input[data-specialty]')
 ).find(el=>el.dataset.specialty===s);

 const chip=input?.closest('.service-chip');
 const wasSelected=state.regSpecialties.includes(s);

 if(wasSelected){
  state.regSpecialties=state.regSpecialties.filter(item=>item!==s);
 }else if(state.regSpecialties.length<20){
  state.regSpecialties=[...state.regSpecialties,s];
 }else{
  if(input){
   input.checked=false;
   chip?.classList.remove('selected');
  }
  toast('يمكنك اختيار 20 تخصصًا كحد أقصى','error');
  return;
 }

 const selected=state.regSpecialties.includes(s);

 if(input){
  input.checked=selected;
  chip?.classList.toggle('selected',selected);
 }

 CATEGORIES.filter(category=>category.services.includes(s)).forEach(category=>{
  const header=Array.from(
   document.querySelectorAll('.fanni-specialty-category-head')
  ).find(el=>el.dataset.category===category.label);

  if(!header)return;

  const selectedCount=category.services.filter(
   service=>state.regSpecialties.includes(service)
  ).length;

  const countText=header.querySelector('.min-w-0 > span.mt-1');
  if(countText){
   countText.textContent=selectedCount
    ?'تم اختيار '+selectedCount+' خدمة'
    :'اضغط لعرض الخدمات';
  }

  const countBadge=header.querySelector('.flex.shrink-0 > span:first-child');
  if(countBadge){
   countBadge.textContent=String(selectedCount);
  }
 });
}

function fanniCanHandleServiceFrontend(specialties, serviceName) {
 if (!Array.isArray(specialties) || !serviceName) return false;

 const normalize = value => String(value || '')
  .trim()
  .replace(/\s+/g, ' ');

 const service = normalize(serviceName);
 const selected = specialties.map(normalize).filter(Boolean);

 // Historical category labels must not activate every service in the new catalog.
 return selected.includes(service);
}

function hasSubmittedOffer(sn){
 const target=String(sn||'').trim().toUpperCase();
 if(!target)return false;

 return [...state.myOffers,...state.completedOffers].some(offer=>{
  const offerSn=String(offer?.orderSn||offer?.sn||offer?.order?.sn||'').trim().toUpperCase();
  return offerSn===target;
 });
}

function applyFilter() {
 const specialties = Array.isArray(currentUser?.specialties)
  ? currentUser.specialties
  : [];

 const acceptedSn = new Set(
  state.myOffers
   .filter(o => o?.accepted === true)
   .map(o => String(o.orderSn || o.sn || o.order?.sn || '').trim().toUpperCase())
   .filter(Boolean)
 );

 let list = [...state.orders].filter(o => {
  const sn = String(o.sn || o.orderSn || o.order?.sn || '')
   .trim()
   .toUpperCase();

  return !sn || !acceptedSn.has(sn);
 });

 if (specialties.length) {
  list = list.filter(o => {
   const service = o.service || o.specialty || o.order?.service || '';
   return fanniCanHandleServiceFrontend(specialties, service);
  });
 } else {
  list = [];
 }

 if (state.filterSkill !== 'الكل') {
  list = list.filter(o =>
   String(o.service || o.specialty || o.order?.service || '') === state.filterSkill
  );
 }

 if (state.search) {
  const rawQuery = String(state.search || '').trim().toLocaleLowerCase('ar-EG');
  const normalizedQuery = normalizeAreaSearchText(rawQuery);
  list = list.filter(o =>
   [o.sn, o.area, o.service, o.specialty, o.order?.service].some(value => {
    const rawValue = String(value || '').trim().toLocaleLowerCase('ar-EG');
    return rawValue.includes(rawQuery) || matchesAreaSearch(value, normalizedQuery);
   })
  );
 }

 state.filteredOrders = list;
}
 
function onSearch(v){
 state.search=clean(v,50);
 applyFilter();
 render();
}

function onFilterSkill(v){
 state.filterSkill=v;
 applyFilter();
 render();
}

function isRatingSkipped(role,sn){try{return localStorage.getItem('sonaa_rating_skipped_'+role+'_'+String(sn||'').toUpperCase())==='1';}catch{return false;}}
const dismissedFanniRatings=new Set();
function dismissRatingPrompt(sn){const code=String(sn||'').toUpperCase();dismissedFanniRatings.add(code);try{localStorage.setItem('sonaa_rating_skipped_fanni_'+code,'1');}catch{}render();toast('تم تخطي تقييم العميل لهذا الطلب.','success');}
function focusRatingPrompt(sn){const target=document.getElementById('fanni-rating-'+String(sn||'').toUpperCase());if(target)target.scrollIntoView({behavior:'smooth',block:'center'});}
function renderAcceptedClient(o){
 if(o?.accepted!==true){
  return '<div class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">بيانات العميل مخفية لحين قبول العميل للعرض.</div>';
 }

 const client=o?.client;

 if(!client||typeof client!=='object'){
  return '<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-6 text-amber-800">تم قبول العرض، لكن تعذر عرض بيانات العميل حاليًا. حدّث العروض وحاول مرة أخرى.</div>';
 }

 return `<section class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
  <div class="flex items-center gap-2">
   <span class="text-xl">🔓</span>
   <div><h4 class="text-[13px] font-extrabold text-emerald-900">بيانات العميل — تم قبول عرضك</h4><p class="text-[10px] text-emerald-800 mt-1">استخدم البيانات للتواصل بشأن تنفيذ الخدمة.</p></div>
  </div>
  <div class="rounded-xl bg-white border border-emerald-100 p-3"><div class="text-[10px] text-slate-500 mb-1">اسم العميل</div><b class="text-[12px]">${esc(client.name||'غير متاح')}</b></div>
  <div class="rounded-xl bg-white border border-emerald-100 p-3"><div class="text-[10px] text-slate-500 mb-1">سجل العميل</div><div class="mt-1 flex flex-wrap gap-2"><span class="rounded-full bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] font-extrabold text-amber-800">★ ${Number(client.ratingAverage||0).toFixed(1)} (${Number(client.ratingCount||0)} تقييم)</span><span class="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-[10px] font-extrabold text-emerald-800">✓ ${Number(client.completedJobs||0)} عمل مكتمل</span></div></div>
  <div class="rounded-xl bg-white border border-emerald-100 p-3">
   <div class="text-[10px] text-slate-500 mb-1">رقم العميل</div>
   <b class="text-[13px]" dir="ltr">${esc(client.phone||'غير متاح')}</b>
   ${client.phone?`<a class="inline-block mr-2 mt-2 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-extrabold text-white" href="tel:${encodeURIComponent(String(client.phone))}">اتصال بالعميل</a>`:''}
  </div>
  <div class="rounded-xl bg-white border border-emerald-100 p-3"><div class="text-[10px] text-slate-500 mb-1">منطقة الخدمة</div><b class="text-[12px]">${esc(client.area||'غير متاحة')}</b></div>
  <div class="rounded-xl bg-white border border-emerald-100 p-3"><div class="text-[10px] text-slate-500 mb-1">العنوان التفصيلي</div><b class="text-[12px] leading-6 break-words">${esc(client.address||'غير متاح')}</b></div>
  ${client.description?`<div class="rounded-xl bg-white border border-emerald-100 p-3"><div class="text-[10px] text-slate-500 mb-1">وصف الطلب</div><p class="text-[12px] leading-6 break-words">${esc(client.description)}</p></div>`:''}
  ${o.hasVoiceRecording?`<div class="rounded-xl border border-teal-200 bg-white p-3"><div class="mb-2 text-[12px] font-extrabold text-teal-900">🎙️ تسجيل صوتي من العميل</div><p class="mb-3 text-[11px] leading-5 text-slate-600">استمع لشرح العميل للمشكلة قبل تنفيذ الخدمة.</p><button type="button" onclick="playOrderVoice('${esc(o.orderSn||'')}',this)" class="w-full rounded-xl bg-teal-700 px-4 py-3 text-[12px] font-extrabold text-white">▶️ تشغيل تسجيل العميل</button></div>`:''}
  ${String(client.budget??'').trim()?`<div class="rounded-xl bg-white border border-emerald-100 p-3"><div class="text-[10px] text-slate-500 mb-1">ميزانية العميل</div><b class="text-[12px]">${esc(client.budget)} جنيه</b></div>`:''}
 </section>`;
}

async function acceptTechnicianGuidelines(){try{const result=await API.acceptGuidelines();if(currentUser){currentUser.technicianGuidelinesAcceptedAt=result.acceptedAt||new Date().toISOString();currentUser.technicianGuidelinesVersion=result.version||'2026-10-20-v1';}toast(result.message||'تم تسجيل الموافقة.');render();}catch(e){toast(e.message||'تعذر تسجيل الموافقة.','error');}}
