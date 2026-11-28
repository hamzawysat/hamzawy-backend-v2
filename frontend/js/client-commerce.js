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

// Customer subscriptions use a single panel with two switchable inner views.
function setClientCommerceView(view){
  state.commerceView=view==='available'?'available':'current';
  render();
}

function unifiedClientTypeLabel(type){return ({maintenance:'صيانة سنوية',air_network:'اشتراك محلي',iptv:'اشتراك ترفيهي'})[type]||'اشتراك';}
async function requestUnifiedClientPlan(planId){
  if(state.unifiedCommerceSubmitting)return;
  const plan=(state.unifiedSubscriptionPlans||[]).find(x=>String(x._id)===String(planId));if(!plan)return;
  const paymentMethod=state.unifiedPaymentMethods?.[String(planId)]||await chooseClientSubscriptionPayment('طريقة دفع الاشتراك','حدد طريقة الدفع التي تفضلها. لن يتم الخصم من المحفظة إلا بعد موافقة الإدارة.');if(!paymentMethod)return;
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
  try{const result=await API.requestUnifiedMaintenanceVisit({subscriptionId:String(subscriptionId)});showToast(result.message||'تم إرسال طلب الزيارة.','success');await loadClientCommerce();}
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
  const cards=rows.map(plan=>'<article class="rounded-xl border border-slate-200 bg-white p-3"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">'+escHtml(plan.name||type.label)+'</b><strong class="text-[12px]">'+Number(plan.price||0).toLocaleString('ar-EG')+' جنيه</strong></div><p class="mt-1 text-[11px] text-slate-500">'+escHtml(plan.description||type.description)+'</p><p class="mt-1 text-[10px] text-slate-500">المدة: '+Number(plan.durationDays||0).toLocaleString('ar-EG')+' يوم'+(type.id==='maintenance'?' · الزيارات: '+Number(plan.visitCount||0).toLocaleString('ar-EG'):'')+'</p>'+(Array.isArray(plan.includedServices)&&plan.includedServices.length?'<p class="mt-2 text-[10px] text-slate-600">يشمل: '+plan.includedServices.map(escHtml).join(' · ')+'</p>':'')+(Array.isArray(plan.excludedSupplies)&&plan.excludedSupplies.length?'<p class="mt-2 text-[10px] text-slate-600">غير مشمول في السعر: '+plan.excludedSupplies.map(escHtml).join(' · ')+'</p>':'')+(type.id!=='maintenance'?'<p class="mt-1 text-[10px] text-slate-600">عدد الأجهزة المسموح بها: '+escHtml(String(plan.allowedDevices||1))+'</p>':'')+'<button type="button" onclick="requestUnifiedClientPlan(&quot;'+escAttr(plan._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-xl bg-slate-900 p-2.5 text-[11px] font-bold text-white">'+(state.unifiedCommerceSubmitting===String(plan._id)?'جاري إرسال الطلب...':'طلب الاشتراك')+'</button></article>').join('');
  return '<section class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="flex items-center gap-2"><span class="text-xl">'+type.icon+'</span><div><h4 class="font-extrabold text-[12px]">'+type.label+'</h4><p class="text-[10px] text-slate-500">'+type.description+'</p></div></div><div class="mt-3 space-y-2">'+(cards||'<p class="rounded-lg bg-white p-3 text-center text-[10px] text-slate-500">لا توجد باقات متاحة حاليًا.</p>')+'</div></section>';
 }).join('');
 return '<section class="panel p-4 space-y-3"><div><h3 class="font-black text-[15px]">اشتراكات ساتڤيو</h3><p class="mt-1 text-[11px] text-slate-500">اختر الصيانة أو الترفيهي أو المحلي، ثم أرسل طلب الاشتراك للإدارة واختر طريقة الدفع.</p></div>'+groups+'</section>';
}
function renderUnifiedClientSubscriptions(){
 const plans=(state.unifiedSubscriptionPlans||[]).filter(plan=>plan&&plan.active!==false),subs=state.unifiedSubscriptions||[],visits=state.unifiedSubscriptionVisits||[];
 const view=state.commerceView==='available'?'available':'current';
 const types={maintenance:'الصيانة السنوية',iptv:'الاشتراك الترفيهي',air_network:'الاشتراك المحلي'};
 const statusLabels={active:'نشط',pending:'قيد المراجعة',paused:'موقوف مؤقتًا',expired:'منتهي',cancelled:'ملغي'};
 const subscriptionCards=subs.map(sub=>{
  const details=sub.type==='iptv'?'<div class="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] leading-6 break-all"><b>نوع الجهاز:</b> '+escHtml(sub.deviceType||'—')+'<br><b>اسم المستخدم:</b> '+escHtml(sub.iptvUsername||'—')+'<br><b>كلمة المرور:</b> '+escHtml(sub.iptvPassword||'—')+'<br><b>رابط الخدمة:</b> '+escHtml(sub.portalUrl||'—')+'<br><b>عدد الأجهزة:</b> '+escHtml(String(sub.allowedDevices||1))+'</div>':sub.type==='air_network'?'<div class="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] leading-6 break-all"><b>اسم الباقة:</b> '+escHtml(sub.networkName||'—')+'<br><b>بيانات التفعيل:</b> '+escHtml(sub.activationCode||'—')+'<br><b>نوع الجهاز:</b> '+escHtml(sub.deviceType||'—')+'</div>':'<div class="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] leading-6"><b>مقاس الطبق:</b> '+escHtml(sub.dishSize||'—')+'<br><b>نوع الرسيفر:</b> '+escHtml(sub.receiverType||'—')+'<br><b>زيارات الصيانة المشمولة:</b> '+escHtml(String(sub.visitsIncluded??0))+'</div>';
  const payment=sub.paymentStatus==='pending'?'<p class="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900">طلب الاشتراك قيد المراجعة · طريقة الدفع: '+escHtml(sub.paymentMethod==='wallet'?'محفظة التطبيق':'تحويل أموال')+'</p>':sub.paymentStatus==='paid'?'<p class="mt-2 text-[10px] text-emerald-700">تم تأكيد السداد</p>':'';
  const renewal=sub.renewalRequest?.requestedAt?'<p class="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900">طلب التجديد: '+escHtml(sub.renewalRequest.paymentStatus==='pending'?'قيد المراجعة':sub.renewalRequest.paymentStatus||'')+'</p>':'';
  const needsRenewal=['active','expired','paused'].includes(sub.status)&&(!sub.renewalRequest?.requestedAt||sub.renewalRequest?.paymentStatus!=='pending');
  return '<article class="rounded-xl border border-slate-200 bg-white p-3"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">'+escHtml(types[sub.type]||'اشتراك')+' · '+escHtml(sub.code||'')+'</b><span class="rounded-full bg-slate-100 px-2 py-1 text-[10px]">'+escHtml(statusLabels[sub.status]||sub.status||'')+'</span></div><p class="mt-2 text-[10px] text-slate-600">ينتهي '+escHtml(new Date(sub.endsAt).toLocaleDateString('ar-EG'))+' · القيمة '+escHtml(String(sub.amount||0))+' جنيه</p>'+payment+details+(Array.isArray(sub.includedServices)&&sub.includedServices.length?'<p class="mt-2 text-[10px] text-slate-600">الخدمات المشمولة: '+sub.includedServices.map(escHtml).join(' · ')+'</p>':'')+(Array.isArray(sub.excludedSupplies)&&sub.excludedSupplies.length?'<p class="mt-1 text-[10px] text-slate-600">غير مشمول: '+sub.excludedSupplies.map(escHtml).join(' · ')+'</p>':'')+renewal+(sub.status==='active'&&sub.type==='maintenance'?'<button type="button" onclick="requestUnifiedClientVisit(&quot;'+escAttr(sub._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-lg border border-slate-200 p-2 text-[11px] font-bold">طلب زيارة صيانة</button>':'')+(needsRenewal?'<button type="button" onclick="requestUnifiedClientRenewal(&quot;'+escAttr(sub._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-2 w-full rounded-lg border border-slate-200 p-2 text-[11px] font-bold">طلب تجديد الاشتراك</button>':'')+'</article>';
 }).join('');
 const planCards=plans.map(plan=>{
  const id=String(plan._id),open=Boolean((state.unifiedPlanDetailsOpen||{})[id]),typeLabel=types[plan.type]||'اشتراك';
  const details='<div class="mt-3 border-t border-slate-100 pt-3 space-y-2 text-[10px] text-slate-600"><p>النوع: '+escHtml(typeLabel)+' · المدة: '+Number(plan.durationDays||0).toLocaleString('ar-EG')+' يوم</p>'+(plan.description?'<p>'+escHtml(plan.description)+'</p>':'')+(plan.type==='maintenance'?'<p>عدد زيارات الصيانة: '+Number(plan.visitCount||0).toLocaleString('ar-EG')+'</p>':'<p>عدد الأجهزة المسموح بها: '+Number(plan.allowedDevices||1).toLocaleString('ar-EG')+'</p>')+(Array.isArray(plan.includedServices)&&plan.includedServices.length?'<p><b>الخدمات المشمولة:</b> '+plan.includedServices.map(escHtml).join(' · ')+'</p>':'')+(Array.isArray(plan.excludedSupplies)&&plan.excludedSupplies.length?'<p><b>غير مشمول في السعر:</b> '+plan.excludedSupplies.map(escHtml).join(' · ')+'</p>':'')+'<div class="pt-2">'+(subs.some(item=>String(item.plan)===id&&['pending','active','paused'].includes(item.status))?'<p class="font-bold text-blue-800">لديك طلب أو اشتراك قائم لهذه الباقة.</p>':'<p class="mb-2 font-bold">طريقة الدفع</p><div class="flex flex-wrap gap-2"><label class="flex items-center gap-2 rounded-lg border p-2"><input type="radio" name="subscription-payment-'+escAttr(id)+'" value="wallet" '+(state.unifiedPaymentMethods?.[id]==='wallet'?'checked':'')+' onchange="setUnifiedClientPaymentMethod(\''+escAttr(id)+'\',\'wallet\')"> محفظة التطبيق</label><label class="flex items-center gap-2 rounded-lg border p-2"><input type="radio" name="subscription-payment-'+escAttr(id)+'" value="transfer" '+(state.unifiedPaymentMethods?.[id]==='transfer'?'checked':'')+' onchange="setUnifiedClientPaymentMethod(\''+escAttr(id)+'\',\'transfer\')"> تحويل أموال</label></div><button type="button" onclick="requestUnifiedClientPlan(&quot;'+escAttr(id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-xl bg-slate-900 p-2.5 text-[11px] font-bold text-white">'+(state.unifiedCommerceSubmitting===id?'جاري إرسال الطلب...':'طلب الاشتراك')+'</button>')+'</div></div>';
  return '<article class="rounded-xl border border-slate-200 bg-white p-3"><div class="flex items-center justify-between gap-2" dir="rtl"><div class="min-w-0"><b class="block text-[12px]">'+escHtml(plan.name||typeLabel)+'</b><strong class="mt-1 block text-[12px] text-slate-800">'+Number(plan.price||0).toLocaleString('ar-EG')+' جنيه</strong></div><button type="button" onclick="toggleUnifiedPlanDetails(&quot;'+escAttr(id)+'&quot;)" aria-expanded="'+(open?'true':'false')+'" class="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold">'+(open?'إخفاء التفاصيل':'تفاصيل')+'</button></div>'+(open?details:'')+'</article>';
 }).join('');
 const visitRows=visits.map(visit=>{
  const pending=visit.status==='awaiting_client_confirmation',status=visit.status==='completed'?'تم تأكيد الزيارة':pending?'في انتظار تأكيدك':visit.status==='in_progress'?'جاري تنفيذ الزيارة':visit.status==='cancelled'?'ملغاة':'زيارة مجدولة';
  return '<article class="rounded-lg border border-slate-200 p-3"><div class="flex items-center justify-between gap-2"><b class="text-[11px]">زيارة صيانة</b><span class="text-[10px]">'+status+'</span></div><p class="mt-1 text-[10px] text-slate-500">'+escHtml(new Date(visit.scheduledAt).toLocaleString('ar-EG'))+'</p>'+(visit.workDescription?'<p class="mt-2 text-[10px]">'+escHtml(visit.workDescription)+'</p>':'')+(pending?'<button type="button" onclick="confirmUnifiedClientVisit(&quot;'+escAttr(visit._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-lg bg-emerald-700 p-2.5 text-[11px] font-bold text-white">تأكيد استلام الزيارة وإنهاء الخدمة</button>':'')+'</article>';
 }).join('');
 const tabButton=(id,label)=>'<button type="button" onclick="setClientCommerceView(\''+id+'\')" class="flex-1 rounded-xl border p-3 text-[12px] font-black '+(view===id?'border-slate-900 bg-slate-900 text-white':'border-slate-200 bg-white text-slate-700')+'">'+label+'</button>';
 return '<section class="panel mt-4 p-4 space-y-4"><div><h3 class="font-extrabold text-[14px]">الاشتراكات</h3><p class="mt-1 text-[11px] text-slate-500">تابع اشتراكاتك أو تصفح الباقات المتاحة.</p></div><div class="flex gap-2" dir="rtl">'+tabButton('current','اشتراكاتي')+tabButton('available','الاشتراكات المتاحة')+'</div>'+(view==='current'?'<div class="space-y-3"><h4 class="font-bold text-[12px]">اشتراكاتي الحالية ('+subs.length+')</h4>'+(subscriptionCards||'<p class="rounded-lg bg-slate-50 p-3 text-center text-[11px] text-slate-500">لا توجد اشتراكات مسجلة على حسابك حاليًا.</p>')+'</div>'+(visits.length?'<div class="space-y-2 border-t pt-3"><h4 class="font-bold text-[12px]">زيارات الصيانة</h4>'+visitRows+'</div>':''):'<div class="space-y-2"><h4 class="font-bold text-[12px]">الاشتراكات المتاحة</h4>'+(planCards||'<p class="rounded-lg bg-slate-50 p-3 text-center text-[11px] text-slate-500">لا توجد باقات متاحة حاليًا.</p>')+'</div>')+(state.commerceLoading?'<p class="text-center text-[11px] text-slate-500">جاري تحديث الاشتراكات...</p>':'')+(state.commerceError?'<p class="rounded-lg bg-red-50 p-3 text-[11px] text-red-700">'+escHtml(state.commerceError)+'</p>':'')+'<button type="button" onclick="loadClientCommerce()" class="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] font-bold">تحديث بيانات الاشتراكات</button></section>';
}
function setUnifiedClientPaymentMethod(planId,method){if(!['wallet','transfer'].includes(method))return;state.unifiedPaymentMethods=state.unifiedPaymentMethods||{};state.unifiedPaymentMethods[String(planId)]=method;}
function toggleUnifiedPlanDetails(planId){state.unifiedPlanDetailsOpen=state.unifiedPlanDetailsOpen||{};const id=String(planId);state.unifiedPlanDetailsOpen[id]=!state.unifiedPlanDetailsOpen[id];render();}
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
