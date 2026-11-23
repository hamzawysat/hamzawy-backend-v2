
'use strict';

// Identify the admin console independently of its public or private URL.
window.__SONAA_PAGE_ROLE__ = 'admin';
const BASE_URL=location.origin;
const TOKEN_KEY='admin_token_v3';
function escHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function getToken(){try{return localStorage.getItem(TOKEN_KEY)||''}catch{return ''}}
function currentAdminRoleLabel(){return String(state.currentAdminRoleLabel||'').trim();}
function canReadVoiceReview(){return isRootAdminUI()||state.currentAdminPermissions?.voiceReview?.read===true;}
function canWriteVoiceReview(){return isRootAdminUI()||state.currentAdminPermissions?.voiceReview?.write===true;}
function canPublishOrders(){return isRootAdminUI()||state.currentAdminPermissions?.publishOrders?.write===true;}
function canAssignOrders(){return isRootAdminUI();}
function toggleOrderSelection(sn,checked){sn=String(sn||'').trim().toUpperCase();if(!/^SN\d{6}$/.test(sn))return;const selected=new Set(state.selectedOrderSNs||[]);if(checked)selected.add(sn);else selected.delete(sn);state.selectedOrderSNs=Array.from(selected);render();}
function toggleAllVisibleOrders(checked){const selected=new Set(state.selectedOrderSNs||[]);for(const order of (state.filteredOrders||[])){const sn=String(order.sn||'').trim().toUpperCase();if(!/^SN\d{6}$/.test(sn))continue;if(checked)selected.add(sn);else selected.delete(sn);}state.selectedOrderSNs=Array.from(selected);render();}
async function bulkPublishOrders(){if(!canPublishOrders())return showToast('نشر الطلبات متاح للمدير أو الأدمن الرئيسي فقط','error');const sns=Array.from(new Set((state.selectedOrderSNs||[]).map(x=>String(x||'').trim().toUpperCase()).filter(x=>/^SN\d{6}$/.test(x))));if(!sns.length)return showToast('حدد طلبات قيد المراجعة أولًا','error');if(sns.length>100)return showToast('حدد 100 طلب كحد أقصى','error');const eligible=sns.filter(sn=>state.orders.some(o=>String(o.sn||'').toUpperCase()===sn&&o.status==='قيد المراجعة'));if(!eligible.length)return showToast('لا توجد طلبات محددة قابلة للنشر','error');if(!confirm('تأكيد نشر '+eligible.length+' طلبًا للفنيين؟'))return;let ok=0,failed=0;for(const sn of eligible){try{await tryApi(['/api/orders/admin/'+encodeURIComponent(sn)+'/publish'],{method:'POST',body:JSON.stringify({})});ok++;}catch(_){failed++;}}state.selectedOrderSNs=[];showToast('تم نشر '+ok+' طلب — تعذر '+failed,failed?'error':'success');await loadOrders();}
async function bulkDeleteOrders(){const sns=Array.from(new Set((state.selectedOrderSNs||[]).map(x=>String(x||'').trim().toUpperCase()).filter(x=>/^SN\d{6}$/.test(x))));if(!sns.length)return showToast('حدد طلبًا واحدًا على الأقل','error');if(sns.length>100)return showToast('حدد 100 طلب كحد أقصى في المرة الواحدة','error');if(!confirm('تأكيد محاولة حذف '+sns.length+' طلبًا؟ الطلبات النشطة أو المرتبطة بعروض أو فنيين أو حركات مالية سيتم حمايتها تلقائيًا.'))return;try{const result=await tryApi(['/api/admin/orders/bulk-delete'],{method:'POST',body:JSON.stringify({sns})});const deleted=new Set(result.deletedSns||[]);state.selectedOrderSNs=state.selectedOrderSNs.filter(sn=>!deleted.has(sn));showToast(result.message||'انتهت العملية',deleted.size?'success':'warning');await loadOrders();}catch(e){showToast(e.message||'تعذر تنفيذ الحذف الجماعي','error');}}
function setToken(t){try{localStorage.setItem(TOKEN_KEY,t);localStorage.setItem('admin_token',t);localStorage.setItem('token',t);localStorage.setItem('auth_token',t)}catch{throw new Error('تعذر حفظ جلسة الدخول')}}
function clearToken(){try{for(const key of [TOKEN_KEY,'admin_token','token','auth_token'])localStorage.removeItem(key)}catch{}}
function buildUrl(p){const path=p.startsWith('/api')?p:'/api/'+p.replace(/^\/+/, ''); if(['localhost','127.0.0.1'].includes(location.hostname)||(location.hostname.includes('sonaa-backend-v2')&&location.hostname.endsWith('vercel.app'))){return path;} return BASE_URL+path;}
async function api(path,opts={}){const token=getToken(); const headers={...(opts.headers||{})}; if(opts.body&&!headers['Content-Type']){headers['Content-Type']='application/json';} if(token)headers['Authorization']='Bearer '+token; try{const r=await fetch(buildUrl(path),{...opts,headers,mode:'cors',credentials:'omit',signal:opts.signal||(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?AbortSignal.timeout(20000):undefined)}); const txt=await r.text(); if(txt.trim().startsWith('<!DOCTYPE')||txt.includes('Cannot ')){return {ok:false,status:404,data:{message:'المسار غير موجود: '+path}};} let data; try{data=txt?JSON.parse(txt):{}}catch{data={raw:txt.slice(0,500),message:txt.slice(0,200)||'استجابة غير مفهومة'};} if(!r.ok&&!data.message)data.message='فشل الطلب (HTTP '+r.status+')'; return {ok:r.ok,status:r.status,data};}catch(e){return {ok:false,status:0,data:{message:e.message||'تعذر الاتصال'}};}}
async function tryApi(paths,opts={}){const method=String(opts.method||'GET').toUpperCase();const firstPath=Array.isArray(paths)?paths[0]:paths;const isReadLikeReport=method==='POST'&&String(firstPath||'').split('?')[0].startsWith('/api/admin/reports');if(!['GET','HEAD','OPTIONS'].includes(method)&&!isReadLikeReport&&currentAdminRoleLabel()&&!isRootAdminUI()){const key=permissionKeyForApiPath(firstPath);if(key==='__root')throw new Error('الإجراء متاح للمدير العام فقط');if(key&&state.currentAdminPermissions?.[key]?.write!==true)throw new Error('لا تملك صلاحية التنفيذ في هذا القسم');}let last={status:404,data:{message:'فشل الاتصال'}}; for(const p of paths){const res=await api(p,opts); if(res.ok)return res.data; last=res; if([400,401,403].includes(res.status))break;} const error=new Error(last.data?.message||'حدث خطأ'); error.status=last.status; throw error;}
function extractList(data,keys=[]){if(Array.isArray(data))return data; for(const key of keys){if(Array.isArray(data?.[key]))return data[key];} if(Array.isArray(data?.data))return data.data; return [];}
function getWhatsAppNumber(value){
  const raw=String(value??'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  let digits=raw.replace(/\D/g,'');
  if(digits.startsWith('00'))digits=digits.slice(2);
  if(/^01[0-9]{9}$/.test(digits))digits='20'+digits.slice(1);
  else if(/^1[0-9]{9}$/.test(digits))digits='20'+digits;
  if(!/^[1-9][0-9]{9,14}$/.test(digits))return '';
  return digits;
}
function renderWhatsAppButton(phone){
  const number=getWhatsAppNumber(phone);
  if(!number)return '';
  const label=escHtml(String(phone||''));
  return '<a href="https://wa.me/'+number+'" target="_blank" rel="noopener noreferrer" aria-label="إرسال واتساب إلى '+label+'" title="إرسال واتساب" class="inline-flex items-center justify-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 no-underline whitespace-nowrap hover:bg-emerald-100">واتساب</a>';
}
function normalizePhoneInput(value){return String(value??'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[\s\-().]/g,'').replace(/^(\+?20)/,'0');}

const ADMIN_SECTIONS = [
 {id:'dashboard',label:'نظرة عامة',icon:'📊',tabs:[{id:'dashboard',label:'نظرة عامة'}]},
 {id:'clients',label:'الطلبات والعملاء',icon:'👥',tabs:[{id:'orders',label:'طلبات العملاء'},{id:'clients',label:'كل العملاء'},{id:'archive',label:'الأرشيف المركزي'}]},
 {id:'technicians',label:'الفنيون',icon:'👷',tabs:[{id:'fannis',label:'كل الفنيين'},{id:'pending',label:'انتظار الاعتماد'},{id:'profileEdits',label:'طلبات تعديل البيانات'},{id:'disabled',label:'الفنيون الموقوفون'},{id:'fanniCardLedger',label:'سجل البطاقات الفنيين'},{id:'levels',label:'المستويات والشارات'},{id:'offers',label:'عروض الفنيين'}]},
 {id:'finance',label:'المحافظ والمالية',icon:'💰',tabs:[{id:'clientWallet',label:'محافظ العملاء'},{id:'wallets',label:'محافظ الفنيين'},{id:'topups',label:'طلبات شحن المحافظ'}]},
 {id:'referrals',label:'الدعوات والمكافآت',icon:'🎁',tabs:[{id:'referrals',label:'إدارة الدعوات والمكافآت'}]},
 {id:'commerce',label:'المتجر والخدمات',icon:'🛍️',tabs:[{id:'commercePlans',label:'باقات الاشتراك'},{id:'commerceSubscriptions',label:'اشتراكات العملاء'},{id:'store',label:'إدارة المتجر'},{id:'storeOrders',label:'طلبات ومبيعات المتجر'},{id:'services',label:'الخدمات'},{id:'regions',label:'مناطق الخدمة'}]},
 {id:'customer-operations',label:'خدمة العملاء',icon:'💬',tabs:[{id:'complaints',label:'الشكاوى'},{id:'support',label:'الدعم والمخالفات'},{id:'notifications',label:'الإشعارات'},{id:'content',label:'الإعلانات والأسئلة الشائعة'}]},
 {id:'platform-admin',label:'إدارة النظام',icon:'⚙️',tabs:[{id:'pricing',label:'الأسعار والعمولات'},{id:'reports',label:'التقارير'},{id:'pageVisits',label:'سجل زيارات الموقع'},{id:'security',label:'سجل التدقيق والأمان'},{id:'settings',label:'إعدادات المنصة'},{id:'roles',label:'صلاحيات المشرفين'}]}
];
function getPendingTechnicianCount(){return state.fannis.filter(f=>!f.isApproved&&!f.isDisabled&&!['rejected','مرفوض'].includes(String(f.status||''))).length;}
function getPendingOrderCount(){return state.orders.filter(o=>['قيد المراجعة','pending','مراجعة','بانتظار المراجعة'].includes(String(o.status||''))).length;}
function getPendingTopupCount(){return state.topups.filter(t=>['pending','قيد المراجعة','جديد','جديدة'].includes(String(t.status||''))).length;}
function getPendingClientTopupCount(){return (state.clientTopups||[]).filter(t=>String(t.status||'')==='قيد المراجعة').length;}
function getPendingComplaintCount(){return state.complaints.filter(c=>['جديدة','pending','open','قيد المراجعة'].includes(String(c.status||''))).length;}
function getPendingRecoveryCount(){return (state.recoveryRequests||[]).filter(item=>['بانتظار الدعم','قيد التحقق','جديدة','pending'].includes(String(item.status||''))).length;}
function getAdminSectionCountById(id){if(id==='dashboard')return getPendingTechnicianCount()+state.pendingProfileEdits.length+getPendingOrderCount()+getPendingTopupCount()+getPendingClientTopupCount()+getPendingComplaintCount()+getPendingRecoveryCount();return 0;}
function renderSectionCount(){return '';}
function getAdminSectionCount(section){if(!section)return 0;if(section.id==='dashboard')return getAdminSectionCountById('dashboard');if(section.id==='clients')return getPendingOrderCount();if(section.id==='technicians')return getPendingTechnicianCount()+state.pendingProfileEdits.length;if(section.id==='finance')return getPendingTopupCount()+getPendingClientTopupCount();if(section.id==='customer-operations')return getPendingComplaintCount()+getPendingRecoveryCount();return 0;}
function isRootAdminUI(){return state.currentAdminIsRoot===true||['أدمن رئيسي','مدير عام'].includes(currentAdminRoleLabel());}
function permissionKeyForTab(tab){if(tab==='archive')return 'clients';if(['dashboard','stats','reports','pageVisits'].includes(tab))return 'dashboard';if(['fannis','pending','profileEdits','disabled','fanniCardLedger','levels'].includes(tab))return 'fannis';if(tab==='orders')return 'orders';if(tab==='offers')return 'offers';if(tab==='wallets')return 'wallet';if(tab==='topups')return 'topups';if(tab==='clientWallet')return 'wallet';if(['commercePlans','commerceSubscriptions'].includes(tab))return 'commerce';if(tab==='clients')return 'clients';if(tab==='pricing')return 'pricing';if(tab==='settings')return 'settings';if(tab==='services')return 'services';if(tab==='regions')return 'regions';if(tab==='complaints')return 'complaints';if(tab==='support')return 'support';if(tab==='notifications')return 'notifications';if(tab==='content')return 'content';if(['store','storeOrders'].includes(tab))return 'store';if(tab==='referrals')return 'referrals';return null;}
function canReadTab(tab){if(tab==='archive'){if(!currentAdminRoleLabel()||isRootAdminUI())return true;return state.currentAdminPermissions?.clients?.read===true||state.currentAdminPermissions?.fannis?.read===true;}if(!currentAdminRoleLabel())return true;if(isRootAdminUI())return true;if(tab==='roles'||tab==='security')return false;const key=permissionKeyForTab(tab);return key?state.currentAdminPermissions?.[key]?.read===true:false;}
function canWriteTab(tab){if(!currentAdminRoleLabel()||isRootAdminUI())return true;const key=permissionKeyForTab(tab);return key?state.currentAdminPermissions?.[key]?.write===true:false;}
function applyAdminPermissionGuards(){const root=document.getElementById('admin-tab-content');if(!root)return;const writeActions=['createStoreProduct','editStoreProduct','hideStoreProduct','showStoreProduct','updateStoreOrder','openCommercePlanEditor','toggleCommercePlan','createClientSubscription','renewClientSubscription','changeClientSubscriptionStatus','openFanniProfileEditor','confirmPending','approveClientTopup','rejectClientTopup','addClientWalletBalance','runBulkAction','bulkDeleteOrders','bulkPublishOrders','approveFanniRegistration','rejectFanniRegistration','approveFanni','rejectFanni','disableFanni','enableFanni','deleteFanni','approveTopup','rejectTopup','assignOrder','setBalance','addBalance','addWalletBalance','deductWalletBalance','adjustWallet','saveFanniNote','saveFanniLimit','saveFanniProfileControls','updateFanniLevel','toggleTrustBadge','freezeWallet','saveOrderCorrection','publishOrder','refundClientService','cancelOrder','archiveOrder','deleteOrder','removeOffer','rejectOffer','deleteClient','deleteRegisteredClient','blockClient','unblockClient','noteClient','saveComplaint','markSupportReview','addService','editService','deleteService','hideService','showService','moveService','toggleServiceCat','addRegion','editRegion','toggleRegion','deleteRegion','sendNotification','deleteNotificationCampaign','saveContent','addFaq','removeFaq','savePricing','saveSettings','createAdminUser','changeAdminRole','revokeAdminRole','saveAdminPermissions'];root.querySelectorAll('button[onclick]').forEach(button=>{const handler=button.getAttribute('onclick')||'';const mutating=writeActions.some(name=>handler.includes(name+'('));const pendingMatch=handler.match(/confirmPending\('([^']+)'\)/);const pending=pendingMatch?state.pendingActions[pendingMatch[1]]:null;const actionMatch=handler.match(/setPendingAction\('([^']+)','([^']+)'/);const requestedAction=actionMatch?actionMatch[2]:'';const publishConfirmationAllowed=state.tab==='orders'&&pending?.action==='publish'&&canPublishOrders();const publishOnly=handler.includes('bulkPublishOrders(')||requestedAction==='publish';const rootOnly=(handler.includes('assignOrder(')||requestedAction==='assign')&&!canAssignOrders();const clientWalletAction=/approveClientTopup|rejectClientTopup|addClientWalletBalance|deductClientWalletBalance|settleClientWalletBalance/.test(handler);const walletAdminAction=/addWalletBalance|deductWalletBalance|adjustWallet|setBalance|freezeWallet/.test(handler);const actionWriteAllowed=clientWalletAction?canWriteTab('clientWallet'):walletAdminAction?canWriteTab('wallets'):canWriteTab(state.tab);const pendingWriteBlocked=Boolean(requestedAction&&requestedAction!=='publish'&&requestedAction!=='assign'&&!canWriteTab(state.tab));if((mutating&&!actionWriteAllowed&&!publishConfirmationAllowed)||(publishOnly&&!canPublishOrders())||rootOnly||pendingWriteBlocked){button.disabled=true;button.setAttribute('aria-disabled','true');button.title='لا تملك صلاحية تنفيذ هذا الإجراء';button.classList.add('opacity-50','cursor-not-allowed');}});}
function permissionKeyForApiPath(path){const clean=String(path||'').split('?')[0];if(clean.startsWith('/api/orders/admin/')&&clean.endsWith('/publish'))return 'publishOrders';if(clean.startsWith('/api/support/admin/'))return 'support';if(clean.startsWith('/api/password-recovery/admin/requests')||clean.startsWith('/api/password-recovery/admin/support-passwords'))return 'passwordRecovery';if(clean.startsWith('/api/admin/admin-users')||clean.startsWith('/api/admin/audit-logs'))return '__root';if(clean.startsWith('/api/referrals/admin/'))return 'referrals';if(clean.startsWith('/api/admin/commerce/'))return 'commerce';if(clean.startsWith('/api/admin/clients/')&&/\/wallet\/(add-balance|deduct-balance|set-balance)$/.test(clean))return 'wallet';if(clean.startsWith('/api/admin/fannis/')&&/\/(add-balance|deduct-balance|set-balance)$/.test(clean))return 'wallet';if(clean.startsWith('/api/admin/wallet/')||clean.startsWith('/api/admin/client-wallet/'))return 'wallet';const prefix='/api/admin/';if(!clean.startsWith(prefix))return null;const segment=clean.slice(prefix.length).split('/')[0];const map={me:'dashboard',counts:'dashboard','fanni-card-ledger':'fannis',fannis:'fannis','fanni-profile-edits':'fannis','fanni-registration-requests':'fannis',orders:'orders',offers:'offers',complaints:'complaints','topup-requests':'topups',clients:'clients','client-accounts':'clientsData',pricing:'pricing',settings:'settings',content:'content',support:'support',regions:'regions',notifications:'notifications',services:'services',reports:'dashboard',store:'store'};return map[segment]||null;}
function getAdminSectionForTab(tab){return ADMIN_SECTIONS.find(section=>section.tabs.some(item=>item.id===tab&&canReadTab(tab)))?.id||ADMIN_SECTIONS.find(section=>section.tabs.some(item=>canReadTab(item.id)))?.id||'dashboard';}
function setSection(sectionId){const section=ADMIN_SECTIONS.find(item=>item.id===sectionId);if(!section)return;const item=section.tabs.find(tab=>canReadTab(tab.id));if(item)setTab(item.id,'subnav');}
function setClientStatusFilter(value){state.clientStatusFilter=['all','active','suspended'].includes(value)?value:'all';state.clientPage=1;loadClients(state.clientSearch||'',1);}

let state={
  tab:'dashboard',pageMode:'home',clientStatusFilter:'all',topupOwnerTab:'fannis',
  adminEmail:'',adminPass:'',currentAdminRoleLabel:'',currentAdminIsRoot:false,currentAdminPermissions:{},loading:false,loadingOrders:false,publishingOrders:[],deletingItems:[],
  dropdowns:{}, pendingActions:{},
  fannis:[],filtered:[],pendingProfileEdits:[],pendingFanniRegistrations:[],topups:[],filteredTopups:[],orders:[],filteredOrders:[],complaints:[],filteredComplaints:[],recoveryRequests:[],loadingComplaints:false,
  services:[],filteredServices:[],servicesLoading:false,servicesError:'',openServices:{},
  clients:[],filteredClients:[],clientsLoading:false,clientPage:1,clientLimit:25,clientTotal:0,clientPages:0,archiveType:'clients',archiveRows:[],archivePage:1,archiveLimit:25,archiveTotal:0,archivePages:0,archiveSearch:'',archiveLoading:false,clientTopups:[],filteredClientTopups:[],clientTopupsLoading:false,clientWalletFilter:'الكل',clientWalletAccounts:[],clientWalletAccountsLoading:false,clientWalletAccountId:'',clientWalletTransactions:[],clientWalletSelectedId:'',clientWalletLoading:false,commerceItems:[],clientSubscriptions:[],commerceLoading:false,accountCounts:{technicians:0,verifiedTechnicians:0,clients:0},
  adminUsers:[],adminUsersLoading:false,
  
  storeProducts:[],storeProductsLoading:false,storeProductsLoaded:false,storeProductsLoadError:'',storeCategories:[],storeAdRotationSeconds:null,storeAdSettingsLoading:false,storeAdSettingsLoaded:false,storeAdSettingsLoadError:'',storeOrders:[],storeOrdersLoading:false,auditLogs:[],auditDate:'',regions:[],regionsLoading:false,regionsError:'',regionSearch:'',notifications:[],adminInboxNotifications:[],adminInboxUnread:0,adminDeliveryLogs:[],walletTransactions:[],walletSelectedFanniId:'',walletLoading:false,settings:{siteName:'حمزاوي سات',maintenance:false},
  referrals:[],referralSummary:null,referralsLoading:false,referralsError:'',referralSearch:'',referralKind:'all',referralStatus:'all',referralPaid:'all',referralFrom:'',referralTo:'',referralDetail:null,
  reports:{},pricing:null,pricingHistory:[],offerFilter:'all',clientSearch:'',content:{announcement:'',faqs:[]},supportQuery:'',supportResults:{orders:[],complaints:[]},supportViolations:[],notificationHistory:[],notificationHistoryLoading:false,
  search:'',filter:'الكل',filterTopup:'الكل',filterOrder:'الكل',filterComplaint:'الكل',filterClient:'الكل',selectedOrderSNs:[],
  errors:{fannis:'',topups:'',orders:'',complaints:'',services:'',clients:''}, error:''
};

function showToast(msg,type='success'){
  const el=document.getElementById('toast'); if(!el)return;
  const bg=type==='success'?'background:linear-gradient(135deg,#2E7CF6,#2E7CF6)':type==='error'?'background:linear-gradient(135deg,#ef4444,#dc2626)':'background:linear-gradient(135deg,#f59e0b,#d97706)';
  el.innerHTML=`<div style="${bg}" class="pointer-events-auto mx-auto max-w-[640px] rounded-[16px] text-white text-[12px] font-bold px-4 py-3.5 shadow-2xl animate-fade flex items-center justify-between gap-3"><span>${escHtml(msg)}</span><button onclick="this.parentElement.remove()" class="shrink-0 h-8 px-3 bg-white/20 rounded-full text-[11px]">إغلاق</button></div>`;
  setTimeout(()=>{if(el.firstElementChild)el.innerHTML=''},4200);
}
function statusLabel(s){const m={'قيد المراجعة':'قيد المراجعة','تم النشر':'تم النشر','وصلتك عروض':'وصلت عروض','تم اختيار فني':'تم اختيار فني','تم الانتهاء':'تم الانتهاء',pending:'قيد المراجعة',approved:'مقبول',rejected:'مرفوض',disabled:'معطل'};return m[String(s||'')]||String(s||'غير محدد');}
function statusClass(s){const t=String(s||''); if(['تم الانتهاء','منتهي','تم اختيار فني','approved','مقبول'].includes(t))return 'bg-emerald-50 border-emerald-200 text-emerald-700'; if(['مرفوض','rejected','اعتذار','معطل','disabled'].includes(t))return 'bg-red-50 border-red-200 text-red-700'; if(['تم النشر','وصلتك عروض'].includes(t))return 'bg-blue-50 border-blue-200 text-blue-700'; return 'bg-amber-50 border-amber-200 text-amber-800';}
function orderSearchMatch(o,s){const haystack=[o.sn,o.clientName,o.clientPhone,o.service,o.area,o.city,o.description].map(v=>String(v||'').toLowerCase()).join(' '); return haystack.includes(s.toLowerCase());}

// --- Smart Dropdown System ---
function toggleMenu(key){
  const isOpen = !!state.dropdowns[key];
  state.dropdowns = {};
  if(!isOpen) state.dropdowns[key]=true;
  render();
}
function closeAllMenus(){ state.dropdowns={}; render(); }
function setPendingAction(key, action, label){
  state.pendingActions[key]={action,label};
  state.dropdowns={};
  render();
}
function clearPending(key){ delete state.pendingActions[key]; render(); }
function confirmPending(key){
  const p = state.pendingActions[key];
  if(!p) return;
  const [type,id] = key.split(':');
  // route to actual function
  if(type==='fanni'){
    if(p.action==='approve') approveFanni(id);
    else if(p.action==='reject') rejectFanni(id);
    else if(p.action==='disable') disableFanni(id);
    else if(p.action==='enable') enableFanni(id);
    else if(p.action==='delete') deleteFanni(id,'');
    else if(p.action==='level_up') updateFanniLevel(id,'خبير');
    else if(p.action==='badge_trust') toggleTrustBadge(id);
    else showToast('تم اختيار: '+p.label);
  } else if(type==='order'){
     if(p.action==='publish') publishOrder(id);
     else if(p.action==='refund') refundClientService(id);
     else if(p.action==='cancel') cancelOrder(id);
     else if(p.action==='archive') archiveOrder(id);
     else if(p.action==='delete') deleteOrder(id);
     else if(p.action==='assign') assignOrder(id);
     else showToast('هذا الإجراء غير مربوط بعد؛ لم يتم تغيير الطلب','error');
  } else if(type==='topup'){
    if(p.action==='approve') approveTopup(id);
    else if(p.action==='reject') rejectTopup(id);
  } else if(type==='complaint'){
    showToast('تم اختيار: '+p.label);
  }
  delete state.pendingActions[key];
  render();
}
