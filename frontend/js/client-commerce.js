'use strict';

function clientCommerceKey(){
  return (window.crypto&&typeof window.crypto.randomUUID==='function')
    ? window.crypto.randomUUID()
    : 'commerce-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
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
  const paymentChoice=window.prompt('اختار طريقة الدفع قبل تأكيد الطلب:\n1 - محفظة التطبيق (الخصم بعد موافقة الإدارة)\n2 - تحويل أموال (مراجعة التحويل بواسطة الإدارة)\n\nاكتب 1 أو 2:','');
  if(paymentChoice===null)return;
  const paymentMethod=String(paymentChoice).trim()==='1'?'wallet':String(paymentChoice).trim()==='2'?'transfer':'';
  if(!paymentMethod)return showToast('اختار 1 للمحفظة أو 2 للتحويل.');
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
  const choice=window.prompt('اختار طريقة الدفع لطلب الاشتراك:\n1 - محفظة التطبيق (الخصم بعد موافقة الإدارة)\n2 - تحويل أموال (مراجعة التحويل قبل التفعيل)\n\nاكتب 1 أو 2:','');
  if(choice===null)return;
  const paymentMethod=String(choice).trim()==='1'?'wallet':String(choice).trim()==='2'?'transfer':'';
  if(!paymentMethod)return showToast('اختار 1 للمحفظة أو 2 للتحويل.');
  if(!window.confirm('تأكيد طلب '+unifiedClientTypeLabel(plan.type)+' بطريقة '+(paymentMethod==='wallet'?'محفظة التطبيق':'تحويل الأموال')+'؟'))return;
  state.unifiedCommerceSubmitting=String(planId);render();
  try{const result=await API.requestUnifiedSubscription({planId:String(planId),paymentMethod});showToast(result.message||'تم إرسال الطلب للإدارة.','success');await loadClientCommerce();}
  catch(error){showToast(error.message||'تعذر إرسال الطلب.');}
  finally{state.unifiedCommerceSubmitting='';render();}
}
async function requestUnifiedClientRenewal(subscriptionId){
  if(state.unifiedCommerceSubmitting)return;
  const choice=window.prompt('اختار طريقة الدفع للتجديد:\n1 - محفظة التطبيق\n2 - تحويل أموال\n\nاكتب 1 أو 2:','');
  if(choice===null)return;
  const paymentMethod=String(choice).trim()==='1'?'wallet':String(choice).trim()==='2'?'transfer':'';
  if(!paymentMethod)return showToast('اختار 1 للمحفظة أو 2 للتحويل.');
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
   const renewal=sub.renewalRequest?'<p class="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900">طلب التجديد: '+escHtml(sub.renewalRequest.paymentStatus==='pending'?'قيد المراجعة':sub.renewalRequest.paymentStatus||'')+' · '+escHtml(sub.renewalRequest.paymentMethod==='wallet'?'محفظة التطبيق':sub.renewalRequest.paymentMethod==='transfer'?'تحويل أموال':'')+'</p>':'';
   return '<article class="rounded-xl border border-slate-200 p-3"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">'+escHtml(type?.label||'اشتراك')+' · '+escHtml(sub.code||'')+'</b><span class="rounded-full bg-slate-100 px-2 py-1 text-[10px]">'+escHtml(statusLabels[sub.status]||sub.status||'')+'</span></div><p class="mt-2 text-[10px] text-slate-600">ينتهي '+escHtml(new Date(sub.endsAt).toLocaleDateString('ar-EG'))+' · متبقي '+daysLeft+' يوم · القيمة '+escHtml(String(sub.amount||0))+' جنيه</p>'+details+payment+(Array.isArray(sub.includedServices)&&sub.includedServices.length?'<p class="mt-2 text-[10px] text-slate-600">الخدمات المشمولة: '+sub.includedServices.map(escHtml).join(' · ')+'</p>':'')+renewal+(sub.status==='active'&&sub.type==='maintenance'?'<button type="button" onclick="requestUnifiedClientVisit(&quot;'+escAttr(sub._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-lg border border-slate-200 p-2 text-[11px] font-bold">طلب زيارة صيانة</button>':'')+(['active','expired','paused'].includes(sub.status)&&sub.renewalRequest?.paymentStatus!=='pending'?'<button type="button" onclick="requestUnifiedClientRenewal(&quot;'+escAttr(sub._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-2 w-full rounded-lg border border-slate-200 p-2 text-[11px] font-bold">طلب تجديد الاشتراك</button>':'')+'</article>';
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
