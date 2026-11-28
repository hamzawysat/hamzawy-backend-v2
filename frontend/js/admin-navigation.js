function safeAdminRender(context='render'){
 try{render();return true;}
 catch(error){
  console.error('[admin-ui] render failed:',context,error);
  try{showToast('تعذر تحديث عرض القسم. تم تسجيل الخطأ ويمكن متابعة تحميل البيانات.','error');}catch(_){}
  return false;
 }
}
'use strict';

const ADMIN_TAB_HISTORY=[];
const ADMIN_LAST_VIEW_KEY='sonaaAdminLastView';
const ADMIN_HISTORY_STATE_KEY='sonaaAdminView';
function currentAdminView(){
 return {tab:String(state.tab||'dashboard'),pageMode:state.pageMode==='section'?'section':'home'};
}
function saveAdminLastView(tab,pageMode='section'){
 try{if(window.sessionStorage)window.sessionStorage.setItem(ADMIN_LAST_VIEW_KEY,JSON.stringify({tab,pageMode}));}catch(_){}
}
function writeAdminHistoryState(push=false){
 if(!window.history)return;
 const next={...(window.history.state||{}),[ADMIN_HISTORY_STATE_KEY]:currentAdminView()};
 try{
  if(push&&window.history.pushState)window.history.pushState(next,'',window.location.pathname+window.location.search+window.location.hash);
  else if(window.history.replaceState)window.history.replaceState(next,'',window.location.href);
 }catch(_){}
}
function rememberAdminView(){
 const view=currentAdminView();
 const previous=ADMIN_TAB_HISTORY[ADMIN_TAB_HISTORY.length-1];
 if(!previous||previous.tab!==view.tab||previous.pageMode!==view.pageMode){
  ADMIN_TAB_HISTORY.push(view);
  if(ADMIN_TAB_HISTORY.length>50)ADMIN_TAB_HISTORY.shift();
 }
 writeAdminHistoryState(true);
}
function restoreAdminView(view){
 if(!view||typeof view!=='object')return false;
 const tab=String(view.tab||'dashboard');
 const pageMode=view.pageMode==='section'?'section':'home';
 if(!canReadTab(tab))return false;
 const last=ADMIN_TAB_HISTORY[ADMIN_TAB_HISTORY.length-1];
 if(last&&last.tab===tab&&last.pageMode===pageMode)ADMIN_TAB_HISTORY.pop();
 state.tab=tab;
 state.pageMode=pageMode;
 state.dropdowns={};
 state.pendingActions={};
 saveAdminLastView(tab,pageMode);
 render();
 if(pageMode==='section')void refreshCurrentTab();
 return true;
}
// Preserve the current URL and any unrelated history metadata; never create a
// synthetic root entry that can trap Back or send the user to the public home.
if(window.history&&window.history.replaceState){
 const existing=window.history.state||{};
 if(!existing[ADMIN_HISTORY_STATE_KEY])writeAdminHistoryState(false);
}
function setTab(t,scrollTarget='content',fromBack=false){
 if(!canReadTab(t)){showToast('هذا القسم غير متاح ضمن صلاحيات حسابك','error');return;}
 if(state.tab!==t||state.pageMode!=='section'){
  if(!fromBack)rememberAdminView();
  state.filter='الكل';
 }
 state.tab=t;state.pageMode='section';saveAdminLastView(t,'section');state.dropdowns={};state.pendingActions={};safeAdminRender('setTab:'+t);
 if(t==='referrals')loadReferralManagement();else if(t==='profileEdits')loadFanniProfileEdits();else if(t==='fanniCardLedger')loadFanniCardLedger();else if(t==='orders')loadOrders();else if(t==='roles')loadAdminUsers();else if(t==='complaints')loadComplaints();else if(t==='services')loadServices();else if(t==='regions')loadRegions();else if(t==='pricing')loadPricing();else if(t==='settings')loadSettings();else if(t==='security')loadAuditLogs();else if(t==='pageVisits')loadPageVisits();else if(t==='notifications')loadNotificationHistory();else if(t==='support')loadSupportViolations();else if(t==='content')loadContent();else if(t==='topups'){applyTopupFilter();if(canReadTab('clientWallet'))loadClientTopups();}else if(t==='clients')loadClients();else if(t==='archive')loadArchive();else if(t==='clientWallet')loadClientTopups();else if(t==='commercePlans')loadCommerceCatalog();else if(t==='commerceSubscriptions')loadClientSubscriptions();else if(t==='store')loadStoreProducts();else if(t==='storeOrders')loadStoreOrders();else if(t==='wallets')render();else applyFilter();
 writeAdminHistoryState(false);
}
function goAdminHome(){
 if(state.pageMode!=='home')rememberAdminView();
 state.pageMode='home';
 saveAdminLastView(state.tab||'dashboard','home');
 render();
 writeAdminHistoryState(false);
 return true;
}
function goBack(fromPopState=false,targetState=null){
 if(fromPopState){
  const target=targetState&&targetState[ADMIN_HISTORY_STATE_KEY];
  if(target&&restoreAdminView(target))return true;
  // Compatibility with history entries created by earlier dashboard versions.
  if(ADMIN_TAB_HISTORY.length){
   const previous=ADMIN_TAB_HISTORY.pop();
   return restoreAdminView(previous);
  }
  return false;
 }
 if(ADMIN_TAB_HISTORY.length){window.history.back();return true;}
 if(state.pageMode==='section')return goAdminHome();
 return false;
}
function onSearch(v){state.search=v; if(state.tab==='orders')applyOrderFilter(); else if(state.tab==='complaints')applyComplaintFilter(); else if(state.tab==='services')applyServicesFilter(); else if(state.tab==='topups'){if(state.topupOwnerTab==='clients'&&canReadTab('clientWallet'))applyClientTopupFilter();else applyTopupFilter();} else if(state.tab==='clients')applyClientFilter();else if(state.tab==='clientWallet')applyClientTopupFilter();else applyFilter();}
function onFilter(v){state.filter=v;applyFilter()} function onFanniAvailabilityFilter(v){state.fanniAvailabilityFilter=v||'all';applyFilter()} function onFilterTopup(v){state.filterTopup=v;applyTopupFilter()} function onFilterOrder(v){state.filterOrder=v;applyOrderFilter()} function onFilterComplaint(v){state.filterComplaint=v;applyComplaintFilter()}
const bulkSelectionKeys={fannis:'selectedBulkFanniIds',topups:'selectedBulkTopupIds',complaints:'selectedBulkComplaintIds',offers:'selectedBulkOfferKeys'};
function toggleBulkSelection(kind,id,checked){const key=bulkSelectionKeys[kind];if(!key)return;const set=new Set(state[key]||[]);if(checked)set.add(String(id));else set.delete(String(id));state[key]=Array.from(set);}
function toggleAllBulkSelection(kind,ids,checked){const key=bulkSelectionKeys[kind];if(!key)return;state[key]=checked?Array.from(new Set(ids.map(String))):[];render();}
async function runBulkAction(kind,action){if(kind==='fannis'&&['freeze','unfreeze'].includes(action)){const reason=prompt(action==='freeze'?'سبب تجميد المحافظ المحددة:':'سبب إلغاء تجميد المحافظ المحددة:','مراجعة إدارية جماعية');if(reason===null)return;if(reason.trim().length<2)return showToast('اكتب سببًا واضحًا للإجراء','error');state.bulkWalletReason=reason.trim();}const key=bulkSelectionKeys[kind];const ids=Array.from(new Set((state[key]||[]).map(String))).slice(0,100);if(!ids.length)return showToast('حدد عنصرًا واحدًا على الأقل','error');if(!confirmAdminAction('تأكيد تنفيذ الإجراء على '+ids.length+' عناصر؟ العناصر غير المؤهلة ستظهر ضمن الإخفاقات.'))return;let ok=0,failed=0;for(const id of ids){try{if(kind==='fannis'&&['approve','reject','disable','enable'].includes(action)){const route={approve:'approve',reject:'reject',disable:'disable',enable:'enable'}[action];if(!route)throw new Error('إجراء غير معروف');await tryApi(['/api/admin/fannis/'+encodeURIComponent(id)+'/'+route],{method:'POST',body:JSON.stringify({})});}else if(kind==='topups'){const route=action==='approve'?'approve':action==='reject'?'reject':'';if(!route)throw new Error('إجراء غير معروف');await tryApi(['/api/admin/topup-requests/'+encodeURIComponent(id)+'/'+route],{method:'POST',body:JSON.stringify({})});}else if(kind==='complaints'){const status=action==='resolve'?'تم الحل':action==='reject'?'مرفوضة':action==='review'?'قيد المراجعة':'';if(!status)throw new Error('إجراء غير معروف');await tryApi(['/api/admin/complaints/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({status})});}else if(kind==='offers'&&action==='reject'){const parts=id.split('|');const sn=parts[0],idx=parts[1];if(!/^SN\d{6}$/.test(sn)||!/^\d+$/.test(idx))throw new Error('معرّف عرض غير صالح');await tryApi(['/api/admin/offers/'+encodeURIComponent(sn)+'/'+idx+'/reject'],{method:'POST',body:JSON.stringify({reason:'مراجعة جماعية من الإدارة'})});}else if(kind==='fannis'&&['freeze','unfreeze'].includes(action)){const reason=state.bulkWalletReason||'إجراء جماعي موثق من الإدارة';await tryApi(['/api/admin/wallet/freeze/'+encodeURIComponent(id)],{method:'POST',body:JSON.stringify({action:action==='freeze'?'freeze':'unfreeze',reason})});}else throw new Error('إجراء غير متاح');ok++;}catch(_){failed++;}}state[key]=[];state.bulkWalletReason='';showToast('نجح '+ok+' — تعذر '+failed,failed?'error':'success');if(kind==='clients')await loadClients(state.clientSearch||'');else await loadAll();}
function applyFilter(){let list=[...state.fannis];if(state.tab==='pending'){list=list.filter(f=>!f.isApproved&&!f.isDisabled&&!['rejected','مرفوض'].includes(String(f.status||'')));}else if(state.tab==='disabled'){list=list.filter(f=>f.isDisabled||f.actualStatus==='معلق');}/* The main technicians tab intentionally starts with every account status so the status selector can show approved, rejected, pending, and suspended accounts. */if(state.filter!=='الكل'){list=list.filter(f=>{const st=f.isDisabled?'disabled':f.isApproved?'approved':f.status||'pending';return String(st).toLowerCase()===state.filter.toLowerCase();});}const availability=state.fanniAvailabilityFilter||'all';if(availability==='accepting')list=list.filter(f=>f.acceptingOrders!==false);else if(availability==='paused')list=list.filter(f=>f.acceptingOrders===false);if(state.search){const q=state.search.trim().toLocaleLowerCase('ar');list=list.filter(f=>[f.name,f.phone,f.email,f._id,Array.isArray(f.specialties)?f.specialties.join(' '):''].some(value=>String(value||'').toLocaleLowerCase('ar').includes(q)));}state.filtered=list;if(!state.silentRefresh&&['fannis','pending','disabled','levels'].includes(state.tab))render();}
function applyTopupFilter(){let list=[...state.topups]; if(state.filterTopup!=='الكل'){list=list.filter(t=>String(t.status||'pending').toLowerCase()===state.filterTopup.toLowerCase());} if(state.search){const s=state.search.toLowerCase(); list=list.filter(t=>String(t.fromPhone||t.phone||'').toLowerCase().includes(s)||String(t.amount||'').includes(s));} state.filteredTopups=list; if(!state.silentRefresh&&state.tab==='topups')render();}
function applyOrderFilter(){let list=[...state.orders]; if(state.filterOrder==='__new'){list=list.filter(o=>['قيد المراجعة','pending','مراجعة','بانتظار المراجعة'].includes(String(o.status||'')));}else if(state.filterOrder!=='الكل'){list=list.filter(o=>String(o.status||'قيد المراجعة')===state.filterOrder);} if(state.search)list=list.filter(o=>orderSearchMatch(o,state.search)); state.filteredOrders=list; if(!state.silentRefresh&&state.tab==='orders')render();}
function applyComplaintFilter(){let list=[...state.complaints]; if(state.filterComplaint!=='الكل')list=list.filter(c=>String(c.status||'جديدة')===state.filterComplaint); if(state.search){const q=state.search.toLowerCase(); list=list.filter(c=>[c.sn,c.clientName,c.text,c.status,c.adminNote,c.adminResponse].some(v=>String(v||'').toLowerCase().includes(q)));} state.filteredComplaints=list; if(!state.silentRefresh&&state.tab==='complaints')render();}
function applyClientFilter(){let list=[...(state.clients||[])];const q=String(state.search||'').trim().toLocaleLowerCase('ar');if(q)list=list.filter(client=>[client.name,client.phone,client.email,client.id,client._id].some(value=>String(value||'').toLocaleLowerCase('ar').includes(q)));state.filteredClients=list;if(!state.silentRefresh&&state.tab==='clients')render();}
function applyServicesFilter(){const q=String(state.search||'').trim().toLowerCase(); if(!q){state.filteredServices=state.services.map(cat=>({label:cat.label,name:cat.name,emoji:cat.emoji,services:cat.services,_detailed:cat._detailed,_displayServices:Array.isArray(cat.services)?cat.services:[],_isCategoryMatch:true}));}else{const result=[]; state.services.forEach(cat=>{const label=String(cat.label||cat.name||'').toLowerCase(); const allServices=Array.isArray(cat.services)?cat.services:[]; const labelMatch=label.includes(q); const matchedServices=allServices.filter(s=>String(s||'').toLowerCase().includes(q)); if(labelMatch){result.push({label:cat.label,name:cat.name,emoji:cat.emoji,services:cat.services,_detailed:cat._detailed,_displayServices:allServices,_isCategoryMatch:true});}else if(matchedServices.length>0){result.push({label:cat.label,name:cat.name,emoji:cat.emoji,services:cat.services,_detailed:cat._detailed,_displayServices:matchedServices,_isCategoryMatch:false});}}); state.filteredServices=result; state.filteredServices.forEach((_,i)=>{state.openServices[i]=true;});} if(!state.silentRefresh&&state.tab==='services')render();}
function toggleServiceCat(idx){idx=Number(idx); if(state.openServices[idx]===undefined)state.openServices[idx]=true; state.openServices[idx]=!state.openServices[idx]; render();}
async function loadServices(){if(!getToken())return; state.servicesLoading=true; state.servicesError=''; state.errors.services=''; if(state.tab==='services')render(); try{const res=await api('/api/admin/services',{method:'GET'}); if(!res.ok)throw new Error(res.data?.message||'تعذر تحميل الخدمات'); const data=res.data; const categories=data.categories||data.data?.categories||[]; if(!Array.isArray(categories))throw new Error('بنية الخدمات غير متوقعة'); state.services=categories; state.openServices={}; categories.forEach((_,i)=>{state.openServices[i]=true;}); applyServicesFilter();}catch(e){state.services=[]; state.filteredServices=[]; state.servicesError=e.message||'تعذر تحميل الخدمات'; state.errors.services=state.servicesError; console.error(e);}finally{state.servicesLoading=false; if(state.tab==='services')render();}}

function buildClientListUrl(){const params=new URLSearchParams({page:String(state.clientPage||1),limit:String(state.clientLimit||25)});if(state.clientSearch)params.set('search',state.clientSearch);if(state.clientStatusFilter==='active')params.set('status','نشط');if(state.clientStatusFilter==='suspended')params.set('status','معلق');return '/api/admin/clients?'+params.toString();}
async function loadAll({silent=false}={}){if(!getToken()){state.loading=false; if(typeof renderLogin==='function'){renderLogin();} else {render();} return;} state.loading=!silent; state.silentRefresh=!!silent; state.errors.fannis=''; state.errors.topups=''; state.errors.orders=''; state.errors.complaints=''; if(!silent)render(); try{const results=await Promise.allSettled([tryApi(['/api/admin/me'],{method:'GET'}),tryApi(['/api/admin/fannis'],{method:'GET'}),tryApi(['/api/admin/fanni-profile-edits'],{method:'GET'}),tryApi(['/api/admin/topup-requests'],{method:'GET'}),tryApi(['/api/admin/orders'],{method:'GET'}),tryApi(['/api/admin/complaints'],{method:'GET'}),tryApi([buildClientListUrl()],{method:'GET'}),tryApi(['/api/admin/support/violations'],{method:'GET'}),tryApi(['/api/password-recovery/admin/requests'],{method:'GET'}),tryApi(['/api/admin/counts'],{method:'GET'}),tryApi(['/api/support/admin'],{method:'GET'})]); if(results[0].status==='fulfilled'){state.currentAdminIsRoot=results[0].value.isRootAdmin===true||results[0].value.user?.isRootAdmin===true;state.currentAdminRoleLabel=String(results[0].value.adminRoleLabel||(state.currentAdminIsRoot?'أدمن رئيسي':''));state.currentAdminPermissions=getEffectiveAdminPermissions(results[0].value);} if(results[1].status==='fulfilled'){state.fannis=extractList(results[1].value,['fannis','items']); state.errors.fannis='';}else{state.errors.fannis=results[1].reason?.message||'تعذر تحميل الفنيين';} if(results[2].status==='fulfilled'){state.pendingProfileEdits=extractList(results[2].value,['requests','items']);}else{console.warn('تعذر تحديث طلبات تعديل البيانات:',results[2].reason?.message||'');} if(results[3].status==='fulfilled'){state.topups=extractList(results[3].value,['requests','topups','items']);}else{state.errors.topups=results[3].reason?.message||'تعذر تحميل الشحن';} if(results[4].status==='fulfilled'){state.orders=extractList(results[4].value,['orders','items','requests']);}else{state.errors.orders=results[4].reason?.message||'تعذر تحميل الطلبات';} if(results[5].status==='fulfilled'){state.complaints=extractList(results[5].value,['complaints','items']);}else{state.errors.complaints=results[5].reason?.message||'تعذر تحميل الشكاوى';} if(results[6].status==='fulfilled'){state.clients=extractList(results[6].value,['clients','items']);state.clientTotal=Number(results[6].value.total||0);state.clientPages=Number(results[6].value.pages||0);state.clientPage=Number(results[6].value.page||state.clientPage||1);applyClientFilter();}else{console.warn('تعذر تحديث قائمة العملاء:',results[6].reason?.message||'');} if(results[7].status==='fulfilled'){state.supportViolations=extractList(results[7].value,['violations','items']);}else{console.warn('تعذر تحديث طلبات الدعم:',results[7].reason?.message||'');} if(results[8].status==='fulfilled'){state.recoveryRequests=extractList(results[8].value,['recoveries','items']);}else{console.warn('تعذر تحديث طلبات استعادة كلمة المرور:',results[8].reason?.message||'');} if(results[10].status==='fulfilled'){state.adminSupportCases=extractList(results[10].value,['supportCases','items']);}else{state.adminSupportCases=[];console.warn('تعذر تحميل محادثات الدعم:',results[10].reason?.message||'');} const acceptedFanniCount=state.fannis.filter(f=>['معتمد','معلق'].includes(String(f.actualStatus||''))||['approved','disabled'].includes(String(f.status||''))).length;const approvedFanniCount=state.fannis.filter(f=>String(f.actualStatus||'')==='معتمد'||String(f.status||'')==='approved').length;if(results[9].status==='fulfilled'){const counts=results[9].value.counts||{};state.accountCounts={technicians:Math.max(0,Number(counts.technicians)||0,acceptedFanniCount),verifiedTechnicians:Math.max(0,Number(counts.verifiedTechnicians)||0,approvedFanniCount),clients:Math.max(0,Number(counts.clients)||0,state.clientTotal||state.clients.length)};}else{state.accountCounts={technicians:acceptedFanniCount,verifiedTechnicians:approvedFanniCount,clients:state.clientTotal||state.clients.length};} try{const registrations=await tryApi(['/api/admin/fanni-registration-requests'],{method:'GET'});state.pendingFanniRegistrations=extractList(registrations,['requests','data','items']);}catch(registrationError){state.pendingFanniRegistrations=[];console.warn('تعذر تحميل طلبات مراجعة هوية الفنيين:',registrationError?.message||'');} applyFilter(); applyTopupFilter(); applyOrderFilter(); applyComplaintFilter(); applyClientFilter(); applyServicesFilter();}catch(e){console.error(e);}finally{state.loading=false;state.silentRefresh=false; try{render();}catch(e){console.error(e);}}}
async function loadOrders(){if(!getToken())return; state.loadingOrders=true; state.errors.orders=''; render(); try{const data=await tryApi(['/api/admin/orders'],{method:'GET'}); state.orders=extractList(data,['orders','items','requests']); state.errors.orders=''; applyOrderFilter();}catch(e){state.orders=[]; state.filteredOrders=[]; state.errors.orders=e.message||'تعذر تحميل الطلبات'; render();}finally{state.loadingOrders=false; if(state.tab==='orders')render();}}
async function refreshCurrentTab(){if(state.tab==='profileEdits')await loadFanniProfileEdits();else if(state.tab==='fanniCardLedger')await loadFanniCardLedger();else if(state.tab==='topups'){applyTopupFilter();if(state.topupOwnerTab==='clients'&&canReadTab('clientWallet'))await loadClientTopups();}else if(state.tab==='orders')await loadOrders();else if(state.tab==='complaints')await loadComplaints();else if(state.tab==='services')await loadServices();else if(state.tab==='regions')await loadRegions();else if(state.tab==='pricing')await loadPricing();else if(state.tab==='settings')await loadSettings();else if(state.tab==='security')await loadAuditLogs();else if(state.tab==='support'){await loadSupportViolations();await loadAdminSupportCases({silent:true});await loadAdminRecoveryRequests({silent:true});}else if(state.tab==='content')await loadContent();else if(state.tab==='clients')await loadClients(state.clientSearch||'');else if(state.tab==='archive')await loadArchive(state.archiveType,state.archivePage);else if(state.tab==='roles')await loadAdminUsers();else if(state.tab==='wallets')await loadWalletTransactions();else if(state.tab==='clientWallet')await loadClientTopups();else if(state.tab==='commercePlans')await loadCommerceCatalog();else if(state.tab==='commerceSubscriptions')await loadClientSubscriptions();else if(state.tab==='store')await loadStoreProducts();else if(state.tab==='storeOrders')await loadStoreOrders();else if(state.tab==='notifications')await loadNotificationHistory();else await loadAll();}
const ADMIN_BASE_REFRESH_TABS=new Set(['dashboard','stats','fannis','pending','disabled','levels','profileEdits','orders','offers','clientWallet','complaints','support','clients']);
let adminRefreshPromise=null;
let adminLastRefreshAt=0;
let adminRefreshDeferred=false;
async function refreshAllAdminData(force=false){
 if(!getToken()||document.visibilityState==='hidden')return;
 if(adminRefreshPromise)return adminRefreshPromise;
 const focused=document.activeElement;
 if(focused&&/^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName||'')){adminRefreshDeferred=true;return;}
 if(!force&&Date.now()-adminLastRefreshAt<45000)return;
 adminLastRefreshAt=Date.now();
 adminRefreshPromise=(async()=>{
  await loadAll({silent:true});
  if(!ADMIN_BASE_REFRESH_TABS.has(state.tab))await refreshCurrentTab();
 })();
 try{return await adminRefreshPromise;}finally{adminRefreshPromise=null;}
}
window.refreshAdminData=function(){return refreshAllAdminData(true);};
if(!window.__sonaaAdminRefreshLoop){
 window.__sonaaAdminRefreshLoop=true;
 window.setInterval(()=>{void refreshAllAdminData(false);},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshAllAdminData(false);});
 window.addEventListener('focus',()=>{void refreshAllAdminData(false);});
 document.addEventListener('focusout',()=>{
  window.setTimeout(()=>{
   const active=document.activeElement;
   if(!adminRefreshDeferred||document.hidden||(active&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName||'')))return;
   adminRefreshDeferred=false;
   void refreshAllAdminData(true);
  },0);
 });
}
function handleGlobalRefresh(){const button=document.getElementById('global-refresh');if(button?.disabled)return;if(button){button.disabled=true;button.classList.add('is-refreshing');}window.location.reload();}
document.getElementById('global-refresh')?.addEventListener('click', handleGlobalRefresh);

// Use delegated native listeners for the main section navigation. This avoids
// relying on inline onclick attributes and keeps navigation working after rerenders.
if(!window.__adminSectionNavigationBound){
 window.__adminSectionNavigationBound=true;
 document.addEventListener('click',event=>{
  const target=event.target&&event.target.closest?event.target.closest('[data-admin-tab]'):null;
  if(!target)return;
  const tab=String(target.getAttribute('data-admin-tab')||'').trim();
  if(!tab)return;
  event.preventDefault();
  try{setTab(tab);}catch(error){
   console.error('[admin-ui] section navigation failed:',tab,error);
   try{showToast('تعذر فتح القسم. راجع سجل أخطاء لوحة الإدارة.','error');}catch(_){}
  }
 },true);
}
