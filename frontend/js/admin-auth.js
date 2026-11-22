'use strict';

function renderLogin(){
  const app=document.getElementById('app');
  app.innerHTML=`<div class="min-h-screen flex items-center justify-center p-4" style="background:#f1f5fb"><div class="premium-card p-7 w-full max-w-[360px]"><h2 class="font-black text-[16px] text-center mb-4">🔐 دخول الإدارة</h2><input id="login-phone" placeholder="الإيميل أو الهاتف" class="field mb-3" dir="ltr"><input id="login-pass" type="password" placeholder="كلمة المرور" class="field mb-2" dir="ltr"><p class="mb-4 text-left"><a class="text-xs font-bold text-blue-700" href="password.html?role=admin&mode=recovery">نسيت كلمة المرور؟</a></p><button onclick="doLogin()" id="login-btn" class="w-full h-12 rounded-full bg-slate-900 text-white font-black">دخول</button><p id="login-error" class="text-[11px] font-bold text-red-600 mt-3 text-center hidden"></p><button onclick="localStorage.clear(); location.reload()" class="w-full mt-3 h-10 rounded-full bg-slate-100 text-[11px] font-black">مسح الجلسة</button></div></div>`;
}
async function doLogin(){
  const p=(document.getElementById('login-phone')?.value||'').trim();
  const pw=(document.getElementById('login-pass')?.value||'').trim();
  const err=document.getElementById('login-error');
  if(err) err.classList.add('hidden');
  if(!p||!pw){ if(err){err.textContent='اكتب البيانات'; err.classList.remove('hidden');} return; }
  const btn=document.getElementById('login-btn'); if(btn){btn.textContent='جاري...'; btn.disabled=true;}
  try{
    const payload={password:pw}; if(p.includes('@')) payload.email=p; else payload.phone=p;
    const res=await api('/api/admin/login',{method:'POST',body:JSON.stringify(payload)});
    if(res.ok && (res.data.token||res.data.data?.token)){ const adminToken=res.data.token||res.data.data.token; setToken(adminToken); localStorage.setItem('admin_token',adminToken); localStorage.setItem('token',adminToken); localStorage.setItem('auth_token',adminToken); console.log('Admin token saved'); render(); loadAll().then(()=>{if(state.pageMode==='section'&&state.tab==='store')return loadStoreProducts();if(state.pageMode==='section'&&state.tab==='storeOrders')return loadStoreOrders();}); if(typeof startStoreOrderCountPolling==='function')startStoreOrderCountPolling(); }
    else { if(err){err.textContent=res.data.message||'فشل الدخول'; err.classList.remove('hidden');} if(btn){btn.textContent='دخول'; btn.disabled=false;} }
  }catch(e){ if(err){err.textContent=e.message; err.classList.remove('hidden');} if(btn){btn.textContent='دخول'; btn.disabled=false;} }
}
function restoreAdminTabFromNotification(){
  let requested='';
  try{requested=decodeURIComponent(String(location.hash||'').replace(/^#/,'')).trim();}catch(_){}
  const knownTab=id=>ADMIN_SECTIONS.some(section=>section.tabs.some(tab=>tab.id===id));
  if(requested&&knownTab(requested)){
    state.tab=requested;
    state.pageMode='section';
    try{if(window.sessionStorage)window.sessionStorage.setItem('sonaaAdminLastView',JSON.stringify({tab:requested,pageMode:'section'}));}catch(_){}
    // Notification links open their target once; the selected section then survives refreshes.
    if(window.history&&window.history.replaceState)window.history.replaceState(window.history.state||{},'',location.pathname+location.search);
    return;
  }
  // A normal page reload always opens the admin home menu.
  // Only an explicit notification hash may deep-link into a section.
  state.pageMode='home';
  try{window.sessionStorage?.removeItem('sonaaAdminLastView');}catch(_){}
}
restoreAdminTabFromNotification();
if(getToken()){ loadAll().then(()=>{if(state.pageMode==='section'&&typeof refreshCurrentTab==='function'){if(!canReadTab(state.tab)){state.tab='dashboard';state.pageMode='home';try{window.sessionStorage?.removeItem('sonaaAdminLastView');}catch(_){}}else return refreshCurrentTab();}}); if(typeof startStoreOrderCountPolling==='function')startStoreOrderCountPolling(); } else { renderLogin(); }

