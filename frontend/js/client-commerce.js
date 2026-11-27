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
    const [catalog,subscriptions,unifiedPlans,unifiedMine]=await Promise.all([API.getClientCommerce(),API.getClientSubscriptions(),API.getUnifiedSubscriptionPlans(),API.getUnifiedClientSubscriptions()]);
    state.commerceItems=Array.isArray(catalog.items)?catalog.items:[];
    state.commerceSubscriptions=Array.isArray(subscriptions.subscriptions)?subscriptions.subscriptions:[];
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
  if(!window.confirm('إرسال طلب '+unifiedClientTypeLabel(plan.type)+'؟ سيتم التواصل معك لتأكيد التفعيل والسداد.'))return;
  state.unifiedCommerceSubmitting=String(planId);render();
  try{const result=await API.requestUnifiedSubscription({planId:String(planId)});showToast(result.message||'تم إرسال الطلب للإدارة.','success');await loadClientCommerce();}
  catch(error){showToast(error.message||'تعذر إرسال الطلب.');}
  finally{state.unifiedCommerceSubmitting='';render();}
}
async function requestUnifiedClientRenewal(subscriptionId){
  if(state.unifiedCommerceSubmitting)return;
  if(!window.confirm('إرسال طلب تجديد الاشتراك للإدارة؟'))return;
  state.unifiedCommerceSubmitting=String(subscriptionId);render();
  try{const result=await API.requestUnifiedSubscriptionRenewal({subscriptionId:String(subscriptionId)});showToast(result.message||'تم إرسال طلب التجديد.','success');}
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
function renderUnifiedClientSubscriptions(){
 const plans=state.unifiedSubscriptionPlans||[],subs=state.unifiedSubscriptions||[],visits=state.unifiedSubscriptionVisits||[];
 const status={active:'نشط',paused:'موقوف مؤقتًا',expired:'منتهي',cancelled:'ملغي'};
 const subscriptionCards=subs.map(s=>{
  const days=Math.max(0,Math.ceil((new Date(s.endsAt).getTime()-Date.now())/86400000));
  const details=s.type==='iptv'?'<div class="mt-2 rounded-xl bg-slate-50 p-3 text-[11px]"><b>نوع الخدمة:</b> اشتراك ترفيهي<br><b>بيانات الدخول:</b> '+escHtml(s.iptvUsername||'—')+' / '+escHtml(s.iptvPassword||'—')+'<br><b>رابط الخدمة:</b> '+escHtml(s.portalUrl||'—')+'<br><b>عدد الأجهزة:</b> '+escHtml(String(s.allowedDevices||1))+'</div>':s.type==='air_network'?'<div class="mt-2 rounded-xl bg-slate-50 p-3 text-[11px]"><b>اسم الباقة:</b> '+escHtml(s.networkName||'—')+'<br><b>بيانات الدخول:</b> '+escHtml(s.activationCode||'—')+'</div>':(s.dishSize||s.receiverType)?'<div class="mt-2 rounded-xl bg-slate-50 p-3 text-[11px]"><b>تفاصيل الخدمة:</b> '+escHtml([s.dishSize,s.receiverType].filter(Boolean).join(' · '))+'</div>':'';
  return '<article class="rounded-xl border border-slate-200 p-3"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">'+escHtml(unifiedClientTypeLabel(s.type))+' · '+escHtml(s.code||'')+'</b><span class="text-[10px]">'+escHtml(status[s.status]||s.status||'')+'</span></div><p class="mt-2 text-[11px] text-slate-600">ينتهي '+escHtml(new Date(s.endsAt).toLocaleDateString('ar-EG'))+' · متبقي '+days+' يوم</p>'+details+(Array.isArray(s.includedServices)&&s.includedServices.length?'<p class="mt-2 text-[10px] text-slate-600">'+s.includedServices.map(escHtml).join(' · ')+'</p>':'')+(s.type==='maintenance'&&s.status==='active'?'<button type="button" onclick="requestUnifiedClientVisit(&quot;'+escAttr(s._id)+'&quot;)" class="mt-3 w-full rounded-xl border border-slate-200 p-2 text-[11px] font-bold">طلب زيارة صيانة</button>':'')+(['active','expired','paused'].includes(s.status)?'<button type="button" onclick="requestUnifiedClientRenewal(&quot;'+escAttr(s._id)+'&quot;)" class="mt-2 w-full rounded-xl border border-slate-200 p-2 text-[11px] font-bold">طلب تجديد الاشتراك</button>':'')+'</article>';
 }).join('');
 const planCards=plans.map(p=>'<article class="rounded-xl border border-slate-200 p-3"><b class="text-[12px]">اسم الباقة: '+escHtml(p.name||unifiedClientTypeLabel(p.type))+'</b><p class="mt-1 text-[11px] text-slate-500">'+escHtml(p.description||'')+'</p><p class="mt-1 text-[11px]">المدة: '+escHtml(String(p.durationDays))+' يوم · السعر: '+escHtml(String(p.price))+' جنيه</p><button type="button" onclick="requestUnifiedClientPlan(&quot;'+escAttr(p._id)+'&quot;)" '+(state.unifiedCommerceSubmitting?'disabled':'')+' class="mt-3 w-full rounded-xl bg-slate-900 p-2 text-[11px] font-bold text-white">طلب الاشتراك</button></article>').join('');
 const visitRows=visits.map(v=>'<p class="mt-1 text-[10px] text-slate-600">'+escHtml(new Date(v.scheduledAt).toLocaleString('ar-EG'))+' · '+(v.status==='completed'?'تمت الزيارة':'زيارة مجدولة')+'</p>').join('');
 return '<section class="panel mt-4 p-4 space-y-3"><div><h3 class="font-extrabold text-[14px]">اشتراكاتي الخاصة</h3><p class="mt-1 text-[11px] text-slate-500">بيانات الباقات والخدمات المرتبطة بحسابك فقط</p></div><h4 class="font-bold text-[12px]">الاشتراكات الحالية</h4><div class="space-y-2">'+(subscriptionCards||'<p class="text-[11px] text-slate-500">لا توجد اشتراكات حاليًا.</p>')+'</div>'+(visitRows?'<div class="border-t pt-3"><b class="text-[12px]">مواعيد الصيانة</b>'+visitRows+'</div>':'')+'<div class="border-t pt-3"><h4 class="font-bold text-[12px]">الباقات المتاحة</h4><div class="mt-2 space-y-2">'+(planCards||'<p class="text-[11px] text-slate-500">لا توجد باقات متاحة.</p>')+'</div></div></section>';
}

function renderClientSubscriptions(){
  const items=state.commerceItems||[],subs=state.commerceSubscriptions||[];
  const statusLabel={active:'نشط',pending:'قيد المراجعة',paused:'موقوف مؤقتًا',cancelled:'ملغي',expired:'منتهي'};
  const activeView=state.commerceView||'available';
  return `<section class="mt-4 space-y-4 animate-fade">
    <div class="panel p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="font-extrabold text-[15px]">الاشتراكات</h3><p class="mt-1 text-[11px] text-slate-500">تابع اشتراكاتك أو استعرض الباقات المتاحة.</p></div><div class="text-left"><span class="text-[10px] text-slate-500">رصيد المحفظة</span><p class="font-black text-[16px]">${escHtml(Number(state.walletBalance||0).toLocaleString('ar-EG'))} ج</p></div></div>
    <button type="button" onclick="loadClientCommerce()" class="mt-3 w-full h-10 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-extrabold">تحديث الاشتراكات والباقات</button>
    ${state.commerceLoading?'<p class="py-4 text-center text-[12px] text-slate-500">جاري تحميل البيانات...</p>':''}
    ${state.commerceError?'<p class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold text-red-700">'+escHtml(state.commerceError)+'</p>':''}</div>
    <div class="client-commerce-tabs flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2" role="tablist" aria-label="أقسام الاشتراكات">
      <button type="button" role="tab" aria-selected="${activeView==='current'}" onclick="setClientCommerceView('current')" class="client-commerce-tab ${activeView==='current'?'is-active':''}">اشتراكاتي الحالية <span class="mr-1 text-[10px] opacity-80">(${subs.length})</span></button>
      <button type="button" role="tab" aria-selected="${activeView==='available'}" onclick="setClientCommerceView('available')" class="client-commerce-tab ${activeView==='available'?'is-active':''}">الاشتراكات المتاحة <span class="mr-1 text-[10px] opacity-80">(${items.length})</span></button>
    </div>
    ${activeView==='available'?`<div class="panel p-4"><h3 class="font-extrabold text-[14px]">الاشتراكات المتاحة</h3><div class="mt-3 space-y-3">
    ${items.length?items.map(item=>'<article class="rounded-xl border border-slate-200 p-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><h4 class="font-extrabold text-[13px]">'+escHtml(item.name)+'</h4><p class="mt-1 text-[11px] text-slate-500">'+escHtml(item.description||'')+'</p><p class="mt-1 text-[10px] text-slate-500">المدة: '+escHtml(String(item.durationDays||30))+' يوم</p></div><strong class="shrink-0 text-[14px]">'+escHtml(String(item.price))+' ج</strong></div>'+(Array.isArray(item.features)&&item.features.length?'<ul class="mt-2 list-disc pr-5 text-[10px] text-slate-600">'+item.features.map(x=>'<li>'+escHtml(x)+'</li>').join('')+'</ul>':'')+'<button type="button" onclick="purchaseClientSubscription(&quot;'+escAttr(item._id)+'&quot;)" '+(state.commerceSubmitting?'disabled':'')+' class="mt-3 w-full h-10 rounded-xl blue-btn text-[11px] font-extrabold">'+(state.commerceSubmitting===String(item._id)?'جاري إرسال الطلب...':'إرسال طلب الاشتراك')+'</button></article>').join(''):'<p class="rounded-xl bg-slate-50 p-4 text-center text-[11px] text-slate-500">لا توجد باقات متاحة حاليًا.</p>'}
    </div></div>`:`<div class="panel p-4"><h3 class="font-extrabold text-[14px]">اشتراكاتي الحالية</h3><div class="mt-3 space-y-2">
    ${subs.length?subs.map(sub=>'<article class="rounded-xl border border-slate-200 p-3"><div class="flex items-start justify-between gap-2"><div><b class="text-[12px]">'+escHtml(sub.itemName||'اشتراك')+'</b><p class="mt-1 text-[10px] text-slate-500">'+(sub.startsAt?'من '+escHtml(new Date(sub.startsAt).toLocaleDateString('ar-EG')):'')+(sub.endsAt?' إلى '+escHtml(new Date(sub.endsAt).toLocaleDateString('ar-EG')):'')+'</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold">'+escHtml(statusLabel[sub.status]||sub.status)+'</span></div><p class="mt-2 text-[10px] text-slate-600">طريقة الدفع: '+escHtml(sub.paymentMethod==='تحويل أموال'?'تحويل أموال':sub.paymentMethod==='محفظة العميل'?'محفظة التطبيق':sub.paymentMethod||'غير محددة')+' · حالة الدفع: '+escHtml(sub.paymentStatus==='paid'?'مدفوع':sub.paymentStatus==='pending'?'بانتظار المراجعة':sub.paymentStatus||'غير محددة')+'</p><div class="mt-2 flex items-center justify-between text-[11px]"><span>قيمة التجديد</span><b>'+escHtml(String(sub.amount||0))+' جنيه</b></div>'+(sub.transactionNumber?'<p class="mt-1 text-[10px] font-bold text-blue-700" dir="ltr">رقم العملية: '+escHtml(sub.transactionNumber)+'</p>':'')+(Array.isArray(sub.history)&&sub.history.length?'<div class="mt-2 space-y-1">'+sub.history.filter(item=>item.transactionNumber).map(item=>'<p class="text-[10px] text-slate-600" dir="ltr">تجديد · رقم العملية: '+escHtml(item.transactionNumber)+'</p>').join('')+'</div>':'')+(sub.subscriptionDetails?'<div class="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-6 whitespace-pre-wrap break-words"><b class="block mb-1">تفاصيل الاشتراك</b>'+escHtml(sub.subscriptionDetails)+'</div>':'')+(['active','expired'].includes(sub.status)?'<button type="button" onclick="renewClientSubscription(&quot;'+escAttr(sub._id)+'&quot;)" '+(state.commerceSubmitting?'disabled':'')+' class="mt-3 w-full h-10 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-extrabold">تجديد الاشتراك</button>':'')+'</article>').join(''):'<p class="rounded-xl bg-slate-50 p-4 text-center text-[11px] text-slate-500">لم تشترك في أي باقة حتى الآن.</p>'}
    </div></div>`}
  </section>`+renderUnifiedClientSubscriptions();
}

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
