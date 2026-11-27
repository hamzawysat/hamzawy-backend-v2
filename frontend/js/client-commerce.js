'use strict';
function chooseClientSubscriptionPayment(title,description){
 return new Promise(resolve=>{
  const overlay=document.createElement('div');
  overlay.className='fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/55 p-3';
  overlay.innerHTML='<section role="dialog" aria-modal="true" class="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl" dir="rtl"><h3 class="text-base font-black">'+escHtml(title||'اختيار طريقة الدفع')+'</h3><p class="mt-1 text-xs leading-6 text-slate-600">'+escHtml(description||'حدد طريقة الدفع المناسبة.')+'</p><div class="mt-4 grid grid-cols-1 gap-2"><button type="button" data-payment="wallet" aria-checked="false" class="flex items-center gap-3 rounded-xl border-2 border-slate-200 p-3 text-right"><span data-mark class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-400"></span><span><b class="block text-sm">محفظة التطبيق</b><small class="text-xs text-slate-500">الخصم بعد موافقة الإدارة</small></span></button><button type="button" data-payment="transfer" aria-checked="false" class="flex items-center gap-3 rounded-xl border-2 border-slate-200 p-3 text-right"><span data-mark class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-400"></span><span><b class="block text-sm">تحويل أموال</b><small class="text-xs text-slate-500">مراجعة التحويل قبل التفعيل</small></span></button></div><div class="mt-4 flex gap-2"><button type="button" data-cancel class="flex-1 rounded-xl border border-slate-200 p-2.5 text-sm font-bold">رجوع</button><button type="button" data-confirm disabled class="flex-1 rounded-xl bg-slate-900 p-2.5 text-sm font-bold text-white opacity-40">تأكيد الاختيار</button></div></section>';
  let selected='';
  const close=value=>{overlay.remove();resolve(value);};
  overlay.addEventListener('click',e=>{if(e.target===overlay)close(null);});
  overlay.querySelector('[data-cancel]').addEventListener('click',()=>close(null));
  overlay.querySelectorAll('[data-payment]').forEach(button=>button.addEventListener('click',()=>{
   selected=button.dataset.payment;
   overlay.querySelectorAll('[data-payment]').forEach(option=>{
    const active=option===button;option.setAttribute('aria-checked',String(active));
    option.classList.toggle('border-blue-600',active);option.classList.toggle('bg-blue-50',active);
    const mark=option.querySelector('[data-mark]');mark.textContent=active?'✓':'';mark.classList.toggle('border-blue-600',active);mark.classList.toggle('text-blue-700',active);
   });
   const confirm=overlay.querySelector('[data-confirm]');confirm.disabled=false;confirm.classList.remove('opacity-40');
  }));
  overlay.querySelector('[data-confirm]').addEventListener('click',()=>{if(selected)close(selected);});
  document.body.appendChild(overlay);
 });
}
async function loadClientCommerce(){
  if(!state.accountToken||!state.account||state.commerceLoading)return;
  state.commerceLoading=true;state.commerceError='';render();
  try{
    const [unifiedPlans,unifiedMine]=await Promise.all([API.getUnifiedSubscriptionPlans(),API.getUnifiedClientSubscriptions()]);
    state.unifiedSubscriptionPlans=Array.isArray(unifiedPlans.plans)?unifiedPlans.plans:[];
    state.unifiedSubscriptions=Array.isArray(unifiedMine.subscriptions)?unifiedMine.subscriptions:[];
    state.unifiedSubscriptionVisits=Array.isArray(unifiedMine.visits)?unifiedMine.visits:[];
  }catch(error){state.commerceError=error.message||'تعذر تحميل الاشتراكات.';}
  finally{state.commerceLoading=false;render();}
}

async function purchaseClientSubscription(itemId){
  if(state.commerceSubmitting)return;
  const item=(state.commerceItems||[]).find(x=>String(x._id)===String(itemId));
  if(!item)return showToast('الباقة غير متاحة حاليًا.');
  const price=Number(item.price||0);
  if(!Number.isFinite(price)||price<0)return showToast('سعر الباقة غير صحيح.');
  const paymentMethod=await chooseClientSubscriptionPayment('اختيار طريقة الدفع','قيمة الاشتراك '+price.toLocaleString('ar-EG')+' جنيه. حدد طريقة الدفع قبل إرسال الطلب.');if(!paymentMethod)return;
  if(!window.confirm('تأكيد طلب '+item.name+' بقيمة '+price+' جنيه بطريقة '+(paymentMethod==='wallet'?'محفظة التطبيق':'تحويل الأموال')+'؟'))return;
  state.commerceSubmitting=String(itemId);state.commerceError='';render();
  try{
    const result=await API.purchaseClientSubscription({itemId:String(itemId),paymentMethod,idempotencyKey:clientCommerceKey()});
    state.walletBalance=Number(result.balance??state.walletBalance);
    state.commerceSuccess=result.message||'تم إرسال طلب الاشتراك للمراجعة.';
    await Promise.all([loadClientCommerce(),loadClientWallet()]);
    showToast(result.message||'تم إرسال طلب الاشتراك للمراجعة.','success');
  }catch(error){state.commerceError=error.message||'تعذر شراء الاشتراك.';showToast(state.commerceError);}
  finally{state.commerceSubmitting='';render();}
}

async function renewClientSubscription(subscriptionId){
  if(state.commerceSubmitting)return;
  const sub=(state.commerceSubscriptions||[]).find(x=>String(x._id)===String(subscriptionId));
  if(!sub)return showToast('الاشتراك غير موجود.');
  const amount=Number(sub.amount||0);
  if(Number(state.walletBalance||0)<amount){showToast('رصيد محفظتك غير كافٍ. اشحن المحفظة أولًا.');setTab('wallet');return;}
  if(!window.confirm('تأكيد تجديد '+sub.itemName+' بمبلغ '+amount+' جنيه من محفظتك؟'))return;
  state.commerceSubmitting=String(subscriptionId);state.commerceError='';render();
  try{
    const result=await API.renewClientSubscription(subscriptionId,{idempotencyKey:clientCommerceKey()});
    state.walletBalance=Number(result.balance??state.walletBalance);
    await Promise.all([loadClientCommerce(),loadClientWallet()]);
    showToast(result.message||'تم تجديد الاشتراك.','success');
  }catch(error){state.commerceError=error.message||'تعذر تجديد الاشتراك.';showToast(state.commerceError);}
  finally{state.commerceSubmitting='';render();}
}

// Customer subscriptions use a single panel with two switchable inner views.
function setClientCommerceView(view){
  state.commerceView=view==='available'?'available':'current';
  render();
}

function unifiedClientTypeLabel(type){return ({maintenance:'صيانة سنوية',air_network:'اشتراك محلي',iptv:'اشتراك ترفيهي'})[type]||'اشتراك';}
async function requestUnifiedClientPlan(planId){
  if(state.unifiedCommerceSubmitting)return;
  const plan=(state.unifiedSubscriptionPlans||[]).find(x=>String(x._id)===String(planId));if(!plan)return;
  const paymentMethod=await chooseClientSubscriptionPayment('طريقة دفع الاشتراك','حدد طريقة الدفع التي تفضلها. لن يتم الخصم من المحفظة إلا بعد موافقة الإدارة.');if(!paymentMethod)return;
  if(!window.confirm('تأكيد طلب '+unifiedClientTypeLabel(plan.type)+' بطريقة '+(paymentMethod==='wallet'?'محفظة التطبيق':'تحويل الأموال')+'؟'))return;
  state.unifiedCommerceSubmitting=String(planId);render();
  try{const result=await API.requestUnifiedSubscription({planId:String(planId),paymentMethod});showToast(result.message||'تم إرسال الطلب للإدارة.','success');await loadClientCommerce();}
  catch(error){showToast(error.message||'تعذر إرسال الطلب.');}
  finally{state.unifiedCommerceSubmitting='';render();}
}
async function requestUnifiedClientRenewal(subscriptionId){
  if(state.unifiedCommerceSubmitting)return;
  const paymentMethod=await chooseClientSubscriptionPayment('طريقة دفع التجديد','حدد طريقة الدفع لطلب تجديد الاشتراك. لن يتم الخصم الآن.');if(!paymentMethod)return;
  if(!window.confirm('تأكيد إرسال طلب التجديد بطريقة '+(paymentMethod==='wallet'?'محفظة التطبيق':'تحويل الأموال')+'؟ لن يتم الخصم الآن.'))return;
  state.unifiedCommerceSubmitting=String(subscriptionId);render();
  try{const result=await API.requestUnifiedSubscriptionRenewal({subscriptionId:String(subscriptionId),paymentMethod});showToast(result.message||'تم إرسال طلب التجديد.','success');await loadClientCommerce();}
  catch(error){showToast(error.message||'تعذر إرسال طلب التجديد.');}
  finally{state.unifiedCommerceSubmitting='';render();}
}
async function requestUnifiedClientVisit(subscriptionId){
  if(state.unifiedCommerceSubmitting)return;
  if(!window.confirm('إرسال طلب زيارة صيانة للإدارة؟'))return;
  state.unifiedCommerceSubmitting=String(subscriptionId);render();
  try{const result=await API.requestUnifiedMaintenanceVisit({subscriptionId:String(subscriptionId)});showToast(result.message||'تم إرسال طلب الزيارة.','success');}
  catch(error){showToast(error.message||'تعذر إرسال طلب الزيارة.');}
  finally{state.unifiedCommerceSubmitting='';render();}
}
function confirmUnifiedClientVisit(visitId){
 if(state.unifiedCommerceSubmitting)return;
 if(!window.confirm('تأكيد استلام زيارة الصيانة وإغلاقها؟'))return;
 state.unifiedCommerceSubmitting=String(visitId);render();
 API.confirmUnifiedMaintenanceVisit(visitId).then(result=>{
   showToast(result.message||'تم تأكيد استلام الزيارة.','success');
   return loadClientCommerce();
 }).catch(error=>showToast(error.message||'تعذر تأكيد الزيارة.')).finally(()=>{
   state.unifiedCommerceSubmitting='';render();
 });
}
function renderUnifiedClientStorePlans(){
 const plans=(state.unifiedSubscriptionPlans||[]).filter(plan=>plan&&plan.active!==false);
 const types=[
  {id:'maintenance',label:'اشتراك الصيانة',icon:'🛠️',description:'صيانة دورية وزيارات فنية حسب الباقة'},
  {id:'iptv',label:'الاشتراك الترفيهي',icon:'📺',description:'خدمات الترفيه وبيانات التشغيل'},
  {id:'air_network',label:'الاشتراك المحلي',icon:'📡',description:'خدمات الشبكة المحلية والتفعيل'}
 ];
 const groups=types.map(type=>{
  const rows=plans.filter(plan=>plan.type===type.id);
  const cards=rows.map(plan=>'<article class="rounded-xl border border-slate-200 bg-white p-3"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">'+escHtml(plan.name||type.label)+'</b><strong class="text-[12px]">'+Number(plan.price||0).toLocaleString('ar-EG')+' جنيه</strong></div><p class="mt-1 text-[11px] text-slate-500">'+escHtml(plan.description||type.description)+'</p><p class="mt-1 text-[10px] text-slate-500">المدة: '+Number(plan.durationDays||0).toLocaleString('ar-EG')+' يوم'+(type.id==='maintenance'?' · الزيارات: '+Number(plan.visitCount||0).toLocaleString('ar-EG'):'')+'</p>'+(Array.isArray(plan.includedServices)&&plan.includedServices.length?'<p class="mt-2 text-[10px] text-slate-600">يشمل: '+plan.includedServices.map(escHtml).join(' · ')+'</p>':'')+'<button type="button" onclick="requestUnifiedClientPlan(&quot;'+escAttr(plan._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-xl bg-slate-900 p-2.5 text-[11px] font-bold text-white">'+(state.unifiedCommerceSubmitting===String(plan._id)?'جاري إرسال الطلب...':'طلب الاشتراك')+'</button></article>').join('');
  return '<section class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="flex items-center gap-2"><span class="text-xl">'+type.icon+'</span><div><h4 class="font-extrabold text-[12px]">'+type.label+'</h4><p class="text-[10px] text-slate-500">'+type.description+'</p></div></div><div class="mt-3 space-y-2">'+(cards||'<p class="rounded-lg bg-white p-3 text-center text-[10px] text-slate-500">لا توجد باقات متاحة حاليًا.</p>')+'</div></section>';
 }).join('');
 return '<section class="panel p-4 space-y-3"><div><h3 class="font-black text-[15px]">اشتراكات ساتڤيو</h3><p class="mt-1 text-[11px] text-slate-500">اختر الصيانة أو الترفيهي أو المحلي، ثم أرسل طلب الاشتراك للإدارة واختر طريقة الدفع.</p></div>'+groups+'</section>';
}
function renderUnifiedClientSubscriptions(){
 const plans=state.unifiedSubscriptionPlans||[],subs=state.unifiedSubscriptions||[],visits=state.unifiedSubscriptionVisits||[];
 const types=[
  {id:'maintenance',label:'الصيانة السنوية',icon:'🛠️',description:'صيانة دورية وزيارات فنية حسب تفاصيل الباقة'},
  {id:'iptv',label:'الاشتراك الترفيهي',icon:'📺',description:'خدمة الترفيه وبيانات التشغيل الخاصة باشتراكك'},
  {id:'air_network',label:'الاشتراك المحلي',icon:'📡',description:'خدمات الشبكة المحلية وبيانات التفعيل'}
 ];
 const statusLabels={active:'نشط',pending:'قيد المراجعة',paused:'موقوف مؤقتًا',expired:'منتهي',cancelled:'ملغي'};
 const planGroups=types.map(type=>{
   const group=plans.filter(plan=>plan.type===type.id);
   const cards=group.map(plan=>'<article class="rounded-xl border border-slate-200 bg-white p-3"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">'+escHtml(plan.name||type.label)+'</b><strong class="text-[12px]">'+escHtml(String(plan.price||0))+' جنيه</strong></div><p class="mt-1 text-[11px] text-slate-500">'+escHtml(plan.description||type.description)+'</p><p class="mt-1 text-[10px] text-slate-500">المدة: '+escHtml(String(plan.durationDays||0))+' يوم'+(type.id==='maintenance'?' · الزيارات: '+escHtml(String(plan.visitCount||0)):'')+'</p>'+(Array.isArray(plan.includedServices)&&plan.includedServices.length?'<p class="mt-2 text-[10px] text-slate-600">يشمل: '+plan.includedServices.map(escHtml).join(' · ')+'</p>':'')+'<button type="button" onclick="requestUnifiedClientPlan(&quot;'+escAttr(plan._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-xl bg-slate-900 p-2.5 text-[11px] font-bold text-white">'+(state.unifiedCommerceSubmitting===String(plan._id)?'جاري الإرسال...':'طلب الاشتراك')+'</button></article>').join('');
   return '<section class="rounded-xl border border-slate-200 p-3"><div class="flex items-center gap-2"><span class="text-xl">'+type.icon+'</span><div><h4 class="font-extrabold text-[12px]">'+type.label+'</h4><p class="text-[10px] text-slate-500">'+type.description+'</p></div></div><div class="mt-3 space-y-2">'+(cards||'<p class="rounded-lg bg-slate-50 p-3 text-center text-[10px] text-slate-500">لا توجد باقات متاحة لهذا النوع حاليًا.</p>')+'</div></section>';
 }).join('');
 const subscriptionCards=subs.map(sub=>{
   const type=types.find(item=>item.id===sub.type);
   const daysLeft=Math.max(0,Math.ceil((new Date(sub.endsAt).getTime()-Date.now())/86400000));
   const details=sub.type==='iptv'?'<div class="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] leading-6 break-all"><b>اسم المستخدم:</b> '+escHtml(sub.iptvUsername||'—')+'<br><b>كلمة المرور:</b> '+escHtml(sub.iptvPassword||'—')+'<br><b>رابط الخدمة:</b> '+escHtml(sub.portalUrl||'—')+'<br><b>عدد الأجهزة:</b> '+escHtml(String(sub.allowedDevices||1))+'</div>':sub.type==='air_network'?'<div class="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] leading-6 break-all"><b>اسم الباقة:</b> '+escHtml(sub.networkName||'—')+'<br><b>بيانات التفعيل:</b> '+escHtml(sub.activationCode||'—')+'</div>':(sub.dishSize||sub.receiverType)?'<div class="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] leading-6"><b>مقاس الطبق:</b> '+escHtml(sub.dishSize||'—')+'<br><b>نوع الرسيفر:</b> '+escHtml(sub.receiverType||'—')+'</div>':'';
   const payment=sub.paymentStatus==='pending'?'<p class="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900">طلب الاشتراك قيد المراجعة · طريقة الدفع: '+escHtml(sub.paymentMethod==='wallet'?'محفظة التطبيق':'تحويل أموال')+'</p>':sub.paymentStatus==='paid'?'<p class="mt-2 text-[10px] text-emerald-700">تم تأكيد السداد</p>':'';
   const renewal=sub.renewalRequest?.requestedAt?'<p class="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900">طلب التجديد: '+escHtml(sub.renewalRequest.paymentStatus==='pending'?'قيد المراجعة':sub.renewalRequest.paymentStatus||'')+' · '+escHtml(sub.renewalRequest.paymentMethod==='wallet'?'محفظة التطبيق':sub.renewalRequest.paymentMethod==='transfer'?'تحويل أموال':'')+'</p>':'';
   return '<article class="rounded-xl border border-slate-200 p-3"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">'+escHtml(type?.label||'اشتراك')+' · '+escHtml(sub.code||'')+'</b><span class="rounded-full bg-slate-100 px-2 py-1 text-[10px]">'+escHtml(statusLabels[sub.status]||sub.status||'')+'</span></div><p class="mt-2 text-[10px] text-slate-600">ينتهي '+escHtml(new Date(sub.endsAt).toLocaleDateString('ar-EG'))+' · متبقي '+daysLeft+' يوم · القيمة '+escHtml(String(sub.amount||0))+' جنيه</p>'+details+payment+(Array.isArray(sub.includedServices)&&sub.includedServices.length?'<p class="mt-2 text-[10px] text-slate-600">الخدمات المشمولة: '+sub.includedServices.map(escHtml).join(' · ')+'</p>':'')+renewal+(sub.status==='active'&&sub.type==='maintenance'?'<button type="button" onclick="requestUnifiedClientVisit(&quot;'+escAttr(sub._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-lg border border-slate-200 p-2 text-[11px] font-bold">طلب زيارة صيانة</button>':'')+(['active','expired','paused'].includes(sub.status)&&(!sub.renewalRequest?.requestedAt||sub.renewalRequest?.paymentStatus!=='pending')?'<button type="button" onclick="requestUnifiedClientRenewal(&quot;'+escAttr(sub._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-2 w-full rounded-lg border border-slate-200 p-2 text-[11px] font-bold">طلب تجديد الاشتراك</button>':'')+'</article>';
 }).join('');
 const visitRows=visits.map(visit=>{
   const pending=visit.status==='awaiting_client_confirmation';
   const status=visit.status==='completed'?'تم تأكيد الزيارة':pending?'في انتظار تأكيدك':visit.status==='in_progress'?'جاري تنفيذ الزيارة':visit.status==='cancelled'?'ملغاة':'زيارة مجدولة';
   return '<article class="rounded-lg border border-slate-200 p-3"><div class="flex items-center justify-between gap-2"><b class="text-[11px]">زيارة صيانة</b><span class="text-[10px]">'+status+'</span></div><p class="mt-1 text-[10px] text-slate-500">'+escHtml(new Date(visit.scheduledAt).toLocaleString('ar-EG'))+'</p>'+(visit.workDescription?'<p class="mt-2 text-[10px]">'+escHtml(visit.workDescription)+'</p>':'')+(pending?'<button type="button" onclick="confirmUnifiedClientVisit(&quot;'+escAttr(visit._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-lg bg-emerald-700 p-2.5 text-[11px] font-bold text-white">تأكيد استلام الزيارة وإنهاء الخدمة</button>':'')+'</article>';
 }).join('');
 return '<section class="panel mt-4 p-4 space-y-4"><div><h3 class="font-extrabold text-[14px]">اشتراكاتي</h3><p class="mt-1 text-[11px] text-slate-500">الصيانة السنوية والاشتراك الترفيهي والاشتراك المحلي في نفس القسم.</p></div><div class="space-y-3"><h4 class="font-bold text-[12px]">اشتراكاتي الحالية ('+subs.length+')</h4>'+(subscriptionCards||'<p class="rounded-lg bg-slate-50 p-3 text-center text-[11px] text-slate-500">لا توجد اشتراكات مفعلة على حسابك حاليًا.</p>')+'</div>'+(visits.length?'<div class="space-y-2 border-t pt-3"><h4 class="font-bold text-[12px]">زيارات الصيانة</h4>'+visitRows+'</div>':'')+'<div class="space-y-3 border-t pt-3"><h4 class="font-bold text-[12px]">الاشتراكات الثلاثة المتاحة</h4>'+planGroups+'</div>'+(state.commerceLoading?'<p class="text-center text-[11px] text-slate-500">جاري تحديث الاشتراكات...</p>':'')+(state.commerceError?'<p class="rounded-lg bg-red-50 p-3 text-[11px] text-red-700">'+escHtml(state.commerceError)+'</p>':'')+'<button type="button" onclick="loadClientCommerce()" class="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] font-bold">تحديث بيانات الاشتراكات</button></section>';
}

function renderClientSubscriptions(){return renderUnifiedClientSubscriptions();}

async function payForClientOrder(sn){
  if(!state.accountToken)return showToast('سجّل الدخول بحساب العميل للدفع من المحفظة.');
  if(!window.confirm('تأكيد حجز قيمة الخدمة من محفظتك؟ سيتم تحويل المبلغ للفني بعد إتمام المهمة.'))return;
  try{
    const result=await API.payForClientOrder(sn);
    if(state.tracked&&String(state.tracked.sn)===String(sn)){
      state.tracked.clientPaymentStatus=result.paymentStatus||'held';
      state.tracked.clientPaymentAmount=Number(result.totalHeldAmount??(Number(state.tracked.clientPaymentAmount||0)+Number(result.amount||0)));
    }
    if(result.balance!==undefined)state.walletBalance=Number(result.balance);
    await loadClientWallet();
    render();
    showToast(result.message||'تم حجز قيمة الخدمة بنجاح.','success');
  }catch(error){showToast(error.message||'تعذر تنفيذ الدفع.');}
}
