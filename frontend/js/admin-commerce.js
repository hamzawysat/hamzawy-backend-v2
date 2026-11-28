'use strict';
async function loadCommerceCatalog(){if(!getToken())return;state.commerceLoading=true;render();try{const data=await tryApi(['/api/admin/commerce/catalog'],{method:'GET'});state.commerceItems=extractList(data,['items']);}catch(error){state.commerceItems=[];showToast(error.message||'تعذر تحميل الباقات','error');}finally{state.commerceLoading=false;if(state.tab==='commercePlans')render();}}
async function loadClientSubscriptions(){if(!getToken())return;state.commerceLoading=true;render();try{const data=await tryApi(['/api/admin/commerce/subscriptions'],{method:'GET'});state.clientSubscriptions=extractList(data,['subscriptions']);}catch(error){state.clientSubscriptions=[];showToast(error.message||'تعذر تحميل الاشتراكات','error');}finally{state.commerceLoading=false;if(state.tab==='commerceSubscriptions')render();}}
async function openCommercePlanEditor(id){const item=(state.commerceItems||[]).find(x=>String(x._id)===String(id));const name=prompt('اسم الباقة:',item?.name||'');if(name===null)return;const priceRaw=prompt('السعر بالجنيه:',String(item?.price??''));if(priceRaw===null)return;const price=Number(priceRaw);if(!Number.isFinite(price)||price<0)return showToast('السعر غير صحيح','error');const daysRaw=prompt('مدة الاشتراك بالأيام:',String(item?.durationDays??30));if(daysRaw===null)return;const durationDays=Number(daysRaw);if(!Number.isInteger(durationDays)||durationDays<1||durationDays>3650)return showToast('المدة يجب أن تكون من يوم إلى 3650 يومًا','error');const description=prompt('وصف الباقة:',item?.description||'')??'';const payload={name:name.trim(),price,durationDays,description,active:item?.active!==false,features:Array.isArray(item?.features)?item.features:[]};if(!payload.name)return showToast('اسم الباقة مطلوب','error');const method=item?'PATCH':'POST',url=item?'/api/admin/commerce/catalog/'+encodeURIComponent(id):'/api/admin/commerce/catalog';try{await tryApi([url],{method,body:JSON.stringify(payload)});showToast(item?'تم تحديث الباقة':'تم إنشاء الباقة','success');await loadCommerceCatalog();}catch(error){showToast(error.message||'تعذر حفظ الباقة','error');}}
async function toggleCommercePlan(id){const item=(state.commerceItems||[]).find(x=>String(x._id)===String(id));if(!item)return;try{await tryApi(['/api/admin/commerce/catalog/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({active:!item.active})});await loadCommerceCatalog();}catch(error){showToast(error.message||'تعذر تحديث الباقة','error');}}
async function createClientSubscription(){const clientPhone=prompt('رقم هاتف العميل المسجل:','');if(clientPhone===null)return;const itemId=prompt('اكتب معرّف الباقة من القائمة:','');if(itemId===null)return;const status=confirm('تفعيل الاشتراك فورًا؟ اضغط إلغاء لإنشاء طلب بانتظار المراجعة.')?'active':'pending';const paymentStatus=status==='active'?'paid':'pending';try{await tryApi(['/api/admin/commerce/subscriptions'],{method:'POST',body:JSON.stringify({clientPhone:normalizePhoneInput(clientPhone),itemId,status,paymentStatus})});showToast('تم إنشاء الاشتراك','success');await loadClientSubscriptions();}catch(error){showToast(error.message||'تعذر إنشاء الاشتراك','error');}}
async function createAdminClientSubscription(clientPhone){
  const phone=normalizePhoneInput(clientPhone||'');
  if(!/^01[0-9]{9}$/.test(phone))return showToast('رقم هاتف العميل غير صحيح','error');
  try{
    if(!Array.isArray(state.commerceItems)||!state.commerceItems.length)await loadCommerceCatalog();
    const items=(state.commerceItems||[]).filter(item=>item.active!==false&&Number(item.price)>0);
    if(!items.length)return showToast('لا توجد باقات اشتراك مفعلة بسعر أكبر من صفر','error');
    const choices=items.map((item,index)=>(index+1)+') '+item.name+' — '+Number(item.price).toLocaleString('ar-EG')+' جنيه — '+Number(item.durationDays)+' يوم').join('\\n');
    const selected=prompt('اختار رقم الباقة للعميل '+phone+':\\n\\n'+choices,'1');
    if(selected===null)return;
    const index=Number(selected)-1,item=items[index];
    if(!Number.isInteger(index)||!item)return showToast('اختيار الباقة غير صحيح','error');
    if(!confirm('تأكيد تفعيل باقة '+item.name+' بسعر '+Number(item.price).toLocaleString('ar-EG')+' جنيه؟ سيتم خصم المبلغ من محفظة العميل فورًا.'))return;
    const daysRaw=prompt('مدة الاشتراك بالأيام (من 1 إلى 3650):',String(item.durationDays||30));
    if(daysRaw===null)return;
    const durationDays=Number(daysRaw);
    if(!Number.isInteger(durationDays)||durationDays<1||durationDays>3650)return showToast('المدة يجب أن تكون من يوم إلى 3650 يومًا','error');
    const amountRaw=prompt('المبلغ المطلوب خصمه من محفظة العميل بالجنيه (اكتب 0 للتفعيل بدون خصم):',String(item.price||0));
    if(amountRaw===null)return;
    const amount=Number(amountRaw);
    if(!Number.isFinite(amount)||amount<0||amount>100000000)return showToast('مبلغ الخصم غير صحيح','error');
    if(!confirm('تأكيد تفعيل '+item.name+' لمدة '+durationDays+' يومًا مع خصم '+amount.toLocaleString('ar-EG')+' جنيه؟'+(amount===0?' لن يتم خصم أي مبلغ.':' سيتم الخصم من محفظة العميل.')))return;
    const result=await tryApi(['/api/admin/commerce/subscriptions'],{method:'POST',body:JSON.stringify({clientPhone:phone,itemId:item._id,status:'active',durationDays,amount})});
    showToast(result.message||'تم تفعيل الاشتراك حسب المدة والمبلغ المحددين','success');
    if(typeof loadClients==='function')await loadClients();
    if(state.tab==='commerceSubscriptions')await loadClientSubscriptions();
  }catch(error){showToast(error.message||'تعذر تفعيل اشتراك العميل','error');}
}
async function editClientSubscriptionDetails(id){
  const sub=(state.clientSubscriptions||[]).find(item=>String(item._id)===String(id));
  if(!sub)return showToast('الاشتراك غير موجود','error');
  const details=prompt('اكتب تفاصيل الاشتراك (مثال: رقم السيريال أو بيانات الجهاز):',sub.subscriptionDetails||'');
  if(details===null)return;
  try{
    const result=await tryApi(['/api/admin/commerce/subscriptions/'+encodeURIComponent(id)+'/details'],{method:'PATCH',body:JSON.stringify({details})});
    showToast(result.message||'تم حفظ تفاصيل الاشتراك','success');
    await loadClientSubscriptions();
  }catch(error){showToast(error.message||'تعذر حفظ تفاصيل الاشتراك','error');}
}
async function renewClientSubscription(id){if(!confirm('تأكيد تجديد الاشتراك؟'))return;try{await tryApi(['/api/admin/commerce/subscriptions/'+encodeURIComponent(id)+'/renew'],{method:'POST',body:JSON.stringify({})});showToast('تم تجديد الاشتراك','success');await loadClientSubscriptions();}catch(error){showToast(error.message||'تعذر تجديد الاشتراك','error');}}
async function changeClientSubscriptionStatus(id,status){try{await tryApi(['/api/admin/commerce/subscriptions/'+encodeURIComponent(id)+'/status'],{method:'PATCH',body:JSON.stringify({status,reason:'تحديث من لوحة الإدارة'})});showToast('تم تحديث حالة الاشتراك','success');await loadClientSubscriptions();}catch(error){showToast(error.message||'تعذر تحديث الاشتراك','error');}}
function renderCommercePlans(){const rows=state.commerceItems||[];return `<section class="mt-4 space-y-3"><div class="premium-panel p-4 flex items-center justify-between gap-2"><div><h2 class="font-black text-sm">باقات الاشتراك</h2><p class="text-[11px] text-slate-500 mt-1">كتالوج مرن قابل لإضافة المنتجات لاحقًا</p></div><button class="pill-btn primary-btn" onclick="openCommercePlanEditor()">إضافة باقة</button></div>${state.commerceLoading?'<p class="text-center p-5">جاري التحميل...</p>':''}${rows.length?rows.map(item=>`<article class="premium-card p-4 flex items-center justify-between gap-3"><div class="min-w-0"><h3 class="font-black text-sm">${escHtml(item.name)}</h3><p class="text-xs text-slate-500 mt-1">${Number(item.price).toLocaleString('ar-EG')} جنيه · ${Number(item.durationDays)} يوم</p><p class="text-[11px] text-slate-500 mt-1">${escHtml(item.description||'')}</p><p class="text-[10px] text-slate-500 mt-1" dir="ltr">${escHtml(item._id)}</p><span class="text-[10px] font-bold ${item.active?'text-emerald-700':'text-red-600'}">${item.active?'مفعلة':'متوقفة'}</span></div><div class="flex flex-col gap-2 shrink-0"><button class="pill-btn soft-btn" onclick="openCommercePlanEditor('${item._id}')">تعديل</button><button class="pill-btn soft-btn" onclick="toggleCommercePlan('${item._id}')">${item.active?'إيقاف':'تفعيل'}</button></div></article>`).join(''):'<p class="premium-panel p-6 text-center text-sm text-slate-500">لا توجد باقات حتى الآن.</p>'}</section>`;}
function setClientSubscriptionStatusTab(tab){if(!['active','expired','pending'].includes(tab))return;state.clientSubscriptionStatusTab=tab;render();}
function renderCommerceSubscriptions(){
  const rows=state.clientSubscriptions||[];
  const now=Date.now();
  const groupOf=sub=>{
    const status=String(sub.status||'').toLowerCase();
    if(status==='pending')return 'pending';
    if(status==='active'){
      if(!sub.endsAt)return 'active';
      const end=Date.parse(sub.endsAt);
      return Number.isFinite(end)&&end>now?'active':'expired';
    }
    // Keep paused/cancelled/expired and unknown legacy records visible in the non-active tab.
    return 'expired';
  };
  const tabs=[
    {id:'active',label:'الاشتراكات السارية'},
    {id:'expired',label:'الاشتراكات المنتهية'},
    {id:'pending',label:'طلبات الاشتراك الجديدة'}
  ];
  const selected=tabs.some(tab=>tab.id===state.clientSubscriptionStatusTab)?state.clientSubscriptionStatusTab:'active';
  state.clientSubscriptionStatusTab=selected;
  const filtered=rows.filter(sub=>groupOf(sub)===selected);
  const tabButtons=tabs.map(tab=>{
    const count=rows.filter(sub=>groupOf(sub)===tab.id).length;
    return '<button type="button" onclick="setClientSubscriptionStatusTab(\''+tab.id+'\')" class="rounded-xl px-3 py-2 text-[11px] font-black border '+(selected===tab.id?'bg-blue-700 text-white border-blue-700':'bg-white text-slate-700 border-slate-200')+'">'+tab.label+' <span class="mr-1">'+count+'</span></button>';
  }).join('');
  const cards=filtered.map(sub=>{
    const client=sub.client||{};
    const end=sub.endsAt?new Date(sub.endsAt).toLocaleDateString('ar-EG'):'—';
    const labels={active:'نشط',pending:'بانتظار التفعيل',paused:'موقوف مؤقتًا',cancelled:'ملغي',expired:'منتهي'};
    const status=labels[sub.status]||sub.status||'غير محدد';
    return '<article class="premium-card p-4 space-y-2"><div class="flex items-start justify-between gap-2"><div><h3 class="font-black text-sm">'+escHtml(client.name||'عميل')+'</h3><p class="text-xs text-slate-500" dir="ltr">'+escHtml(client.phone||'')+'</p></div><span class="text-xs font-black">'+escHtml(status)+'</span></div>'+
      '<p class="text-sm font-bold">'+escHtml(sub.itemName||'اشتراك')+' · '+Number(sub.amount||0).toLocaleString('ar-EG')+' جنيه</p>'+
      '<p class="text-xs text-slate-500">ينتهي: '+end+' · الدفع: '+escHtml(sub.paymentStatus||'')+'</p>'+
      (sub.transactionNumber?'<p class="text-[10px] font-bold text-blue-700" dir="ltr">رقم العملية: '+escHtml(sub.transactionNumber)+'</p>':'')+
      (Array.isArray(sub.history)&&sub.history.length?'<div class="space-y-1">'+sub.history.filter(item=>item.transactionNumber).map(item=>'<p class="text-[10px] text-slate-600" dir="ltr">تجديد · رقم العملية: '+escHtml(item.transactionNumber)+'</p>').join('')+'</div>':'')+
      (sub.subscriptionDetails?'<div class="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-6 whitespace-pre-wrap break-words"><b class="block mb-1">تفاصيل الاشتراك</b>'+escHtml(sub.subscriptionDetails)+'</div>':'')+
      '<div class="flex flex-wrap gap-2"><button class="pill-btn soft-btn" onclick="editClientSubscriptionDetails(\''+escHtml(sub._id)+'\')">'+(sub.subscriptionDetails?'تعديل التفاصيل':'إضافة تفاصيل الاشتراك')+'</button>'+
      '<button class="pill-btn soft-btn" onclick="renewClientSubscription(\''+escHtml(sub._id)+'\')">تجديد</button>'+
      (sub.status==='active'?'<button class="pill-btn soft-btn" onclick="changeClientSubscriptionStatus(\''+escHtml(sub._id)+'\',\'paused\')">إيقاف مؤقت</button>':'<button class="pill-btn soft-btn" onclick="changeClientSubscriptionStatus(\''+escHtml(sub._id)+'\',\'active\')">تفعيل</button>')+
      '<button class="pill-btn soft-btn" onclick="changeClientSubscriptionStatus(\''+escHtml(sub._id)+'\',\'cancelled\')">إلغاء</button></div></article>';
  }).join('');
  return '<section class="mt-4 space-y-3"><div class="premium-panel p-4 flex items-center justify-between gap-2"><div><h2 class="font-black text-sm">اشتراكات العملاء</h2><p class="text-[11px] text-slate-500 mt-1">متابعة الاشتراكات السارية والمنتهية وطلبات التفعيل الجديدة</p></div><button class="pill-btn primary-btn" onclick="createClientSubscription()">إضافة اشتراك</button></div>'+
    '<div class="flex flex-wrap gap-2">'+tabButtons+'</div>'+
    (state.commerceLoading?'<p class="text-center p-5">جاري التحميل...</p>':'')+
    (filtered.length?cards:'<p class="premium-panel p-6 text-center text-sm text-slate-500">لا توجد سجلات في هذا التبويب.</p>')+'</section>';
}
function renderCommerce(){return state.tab==='commercePlans'?renderCommercePlans():renderCommerceSubscriptions();}


/* Unified satellite subscriptions: maintenance, air-network and IPTV. */
const _loadLegacyClientSubscriptions = loadClientSubscriptions;
loadClientSubscriptions = async function(){
  await _loadLegacyClientSubscriptions();
  try {
    const [plans, rows, visits] = await Promise.all([
      tryApi(['/api/subscriptions/admin/plans'],{method:'GET'}),
      tryApi(['/api/subscriptions/admin/list'],{method:'GET'}),
      tryApi(['/api/subscriptions/admin/visits'],{method:'GET'})
    ]);
    state.unifiedSubscriptionPlans = extractList(plans,['plans']);
    state.unifiedSubscriptions = extractList(rows,['subscriptions']);
    state.unifiedSubscriptionVisits = extractList(visits,['visits']);
  } catch(error) {
    state.unifiedSubscriptionPlans = state.unifiedSubscriptionPlans || [];
    state.unifiedSubscriptions = state.unifiedSubscriptions || [];
    state.unifiedSubscriptionVisits = state.unifiedSubscriptionVisits || [];
    showToast(error.message || 'تعذر تحميل الاشتراكات الموحدة','error');
  }
  if(state.tab==='commerceSubscriptions') render();
};
function unifiedTypeLabel(type){return ({maintenance:'صيانة سنوية',air_network:'اشتراك محلي',iptv:'اشتراك ترفيهي'})[type]||'اشتراك';}
function openUnifiedSubscriptionWhatsApp(id){
 const s=(state.unifiedSubscriptions||[]).find(x=>String(x._id)===String(id));if(!s)return;
 const raw=String(s.clientPhone||'').replace(/[^0-9]/g,'');const phone=raw.startsWith('0')?'20'+raw.slice(1):raw.startsWith('20')?raw:raw.length===10&&raw.startsWith('1')?'20'+raw:raw;
 if(!phone||phone.length<10)return showToast('رقم هاتف العميل غير صالح','error');
 const end=new Date(s.endsAt).toLocaleDateString('ar-EG');
 const message='مرحبًا '+String(s.clientName||'')+'، نذكّرك بقرب انتهاء '+unifiedTypeLabel(s.type)+' بتاريخ '+end+'. للتجديد أو الاستفسار يرجى التواصل مع الإدارة.';
 window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message),'_blank','noopener');
}
async function createUnifiedSubscriptionPlan(){
  const choice=prompt('نوع الخدمة:\n1- صيانة سنوية\n2- اشتراك محلي\n3- اشتراك ترفيهي','1');if(choice===null)return;
  const type=({'1':'maintenance','2':'air_network','3':'iptv'})[choice.trim()];if(!type)return showToast('نوع الخدمة غير صحيح','error');
  const name=prompt('اسم الباقة:','');if(name===null||!name.trim())return;
  const price=Number(prompt('السعر بالجنيه (تحدده الإدارة):','0'));if(!Number.isFinite(price)||price<0)return showToast('السعر غير صحيح','error');
  const durationDays=Number(prompt('المدة بالأيام:','365'));if(!Number.isInteger(durationDays)||durationDays<1||durationDays>3650)return showToast('المدة غير صحيحة','error');
  const visitCount=type==='maintenance'?Number(prompt('عدد زيارات الصيانة المشمولة:','0')):0;if(!Number.isInteger(visitCount)||visitCount<0||visitCount>100)return showToast('عدد الزيارات غير صحيح','error');
  const includedServices=(type==='maintenance'?(prompt('الخدمات المشمولة، افصل بينها بفاصلة:','')||''):'').split(',').map(x=>x.trim()).filter(Boolean);
  const excludedSupplies=(type==='maintenance'?(prompt('المستلزمات غير المشمولة، افصل بينها بفاصلة:','')||''):'').split(',').map(x=>x.trim()).filter(Boolean);
  const allowedDevices=type==='iptv'?Number(prompt('عدد الأجهزة المسموح بها:','1')):1;if(!Number.isInteger(allowedDevices)||allowedDevices<1||allowedDevices>20)return showToast('عدد الأجهزة غير صحيح','error');
  try{
    await tryApi(['/api/subscriptions/admin/plans'],{method:'POST',body:JSON.stringify({type,name:name.trim(),price,durationDays,visitCount,includedServices,excludedSupplies,allowedDevices,active:true})});
    showToast('تم إنشاء الخطة','success');await loadClientSubscriptions();
  }catch(error){showToast(error.message||'تعذر إنشاء الخطة','error');}
}
async function editUnifiedSubscriptionPlan(id){
 const p=(state.unifiedSubscriptionPlans||[]).find(x=>String(x._id)===String(id));if(!p)return;
 const name=prompt('اسم الباقة:',p.name);if(name===null)return;
 const price=Number(prompt('السعر بالجنيه:',String(p.price)));if(!Number.isFinite(price)||price<0)return showToast('السعر غير صحيح','error');
 const durationDays=Number(prompt('المدة بالأيام:',String(p.durationDays)));if(!Number.isInteger(durationDays)||durationDays<1||durationDays>3650)return showToast('المدة غير صحيحة','error');
 const active=confirm('موافق = تفعيل الخطة، إلغاء = إيقافها');
 try{await tryApi(['/api/subscriptions/admin/plans/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({name:name.trim(),price,durationDays,active})});showToast('تم تحديث الخطة','success');await loadClientSubscriptions();}
 catch(e){showToast(e.message||'تعذر تعديل الخطة','error');}
}
async function createUnifiedSubscription(){
  const clientPhone=prompt('رقم هاتف العميل المسجل:','');if(clientPhone===null)return;
  const plans=state.unifiedSubscriptionPlans||[];if(!plans.length)return showToast('أنشئ خطة اشتراك أولًا','error');
  const choices=plans.map((p,i)=>(i+1)+') '+unifiedTypeLabel(p.type)+' — '+p.name+' — '+Number(p.price).toLocaleString('ar-EG')+' جنيه / '+p.durationDays+' يوم').join('\n');
  const pick=Number(prompt('اختار رقم الخطة:\n'+choices,'1'))-1;const plan=plans[pick];if(!plan)return showToast('اختيار الخطة غير صحيح','error');
  const body={clientPhone:normalizePhoneInput(clientPhone),type:plan.type,planId:plan._id};
  body.address=prompt('عنوان العميل:','')||'';
  if(plan.type==='maintenance'){body.dishSize=prompt('مقاس الطبق:','')||'';body.receiverType=prompt('نوع الرسيفر:','')||'';}
  if(plan.type==='air_network'){body.networkName=prompt('اسم الباقة:','')||'';body.deviceType=prompt('نوع الخدمة:','')||'';body.activationCode=prompt('بيانات الدخول:','')||'';}
  if(plan.type==='iptv'){body.deviceType=prompt('نوع الخدمة:','')||'';body.iptvUsername=prompt('بيانات الدخول - اسم المستخدم:','')||'';body.iptvPassword=prompt('بيانات الدخول - كلمة المرور:','')||'';body.portalUrl=prompt('رابط الخدمة:','')||'';body.allowedDevices=Number(prompt('عدد الأجهزة:','1'))||1;}
  if(!confirm('تأكيد إنشاء وتفعيل الاشتراك للعميل '+body.clientPhone+'؟'))return;
  try{const result=await tryApi(['/api/subscriptions/admin/create'],{method:'POST',body:JSON.stringify(body)});showToast(result.message||'تم إنشاء الاشتراك','success');await loadClientSubscriptions();}
  catch(error){showToast(error.message||'تعذر إنشاء الاشتراك','error');}
}
async function setUnifiedSubscriptionStatus(id,status){
  const row=(state.unifiedSubscriptions||[]).find(item=>String(item._id)===String(id));if(!row)return;
  const body={status,note:prompt('سبب / ملاحظة (اختياري):','')||''};
  if(row.status==='pending'&&status==='active'){
    body.address=prompt('عنوان العميل: ',row.address||'')||'';
    if(row.type==='maintenance'){body.dishSize=prompt('مقاس الطبق:','')||'';body.receiverType=prompt('نوع الرسيفر:','')||'';if(!body.dishSize||!body.receiverType)return showToast('استكمل مقاس الطبق ونوع الرسيفر قبل التفعيل','error');}
    else if(row.type==='air_network'){body.networkName=prompt('اسم الباقة المحلية:','')||'';body.deviceType=prompt('نوع الجهاز:','')||'';body.activationCode=prompt('كود / بيانات التفعيل:','')||'';if(!body.networkName||!body.deviceType||!body.activationCode)return showToast('استكمل بيانات الاشتراك المحلي قبل التفعيل','error');}
    else if(row.type==='iptv'){body.deviceType=prompt('نوع الجهاز:','')||'';body.iptvUsername=prompt('اسم مستخدم IPTV:','')||'';body.iptvPassword=prompt('كلمة مرور IPTV:','')||'';body.portalUrl=prompt('رابط الخدمة (اختياري):','')||'';body.allowedDevices=Number(prompt('عدد الأجهزة:','1'));if(!body.deviceType||!body.iptvUsername||!body.iptvPassword||!Number.isInteger(body.allowedDevices)||body.allowedDevices<1||body.allowedDevices>20)return showToast('استكمل بيانات IPTV بشكل صحيح قبل التفعيل','error');if(body.portalUrl&&!/^https?:\\/\\//i.test(body.portalUrl))return showToast('رابط الخدمة يجب أن يبدأ بـ http أو https','error');}
    if(!confirm('تأكيد مراجعة الدفع واستكمال البيانات الفنية وتفعيل الاشتراك؟'))return;
  }
  try{const result=await tryApi(['/api/subscriptions/admin/'+encodeURIComponent(id)+'/status'],{method:'PATCH',body:JSON.stringify(body)});showToast(result.message||'تم تحديث الحالة','success');await loadClientSubscriptions();}
  catch(error){showToast(error.message||'تعذر تحديث الحالة','error');}
}
async function renewUnifiedSubscription(id){
  const row=(state.unifiedSubscriptions||[]).find(x=>String(x._id)===String(id));if(!row)return;
  const amount=Number(prompt('سعر التجديد بالجنيه:',String(row.amount)));if(!Number.isFinite(amount)||amount<0)return;
  const durationDays=Number(prompt('مدة التجديد بالأيام:',String(row.durationDays)));if(!Number.isInteger(durationDays)||durationDays<1||durationDays>3650)return;
  try{await tryApi(['/api/subscriptions/admin/'+encodeURIComponent(id)+'/renew'],{method:'POST',body:JSON.stringify({amount,durationDays})});showToast('تم التجديد','success');await loadClientSubscriptions();}
  catch(error){showToast(error.message||'تعذر التجديد','error');}
}
async function assignUnifiedSubscriptionVisit(id){
  const technicians=prompt('معرّف الفني المعتمد:','');if(technicians===null)return;
  const scheduledAt=prompt('موعد الزيارة بصيغة ISO مثل 2026-12-01T10:00:00:','');if(scheduledAt===null)return;
  try{await tryApi(['/api/subscriptions/admin/visits'],{method:'POST',body:JSON.stringify({subscriptionId:id,technicianId:technicians.trim(),scheduledAt})});showToast('تم إسناد الزيارة','success');await loadClientSubscriptions();}
  catch(error){showToast(error.message||'تعذر إسناد الزيارة','error');}
}
function applyUnifiedSubscriptionFilters(){state.unifiedSubscriptionFilters={search:String(document.getElementById('unified-subscription-search')?.value||'').trim(),status:String(document.getElementById('unified-subscription-status')?.value||''),type:String(document.getElementById('unified-subscription-type')?.value||'')};render();}
function renderUnifiedSubscriptionPanel(){
 const plans=state.unifiedSubscriptionPlans||[],allRows=state.unifiedSubscriptions||[];
 const filters=state.unifiedSubscriptionFilters||{},needle=String(filters.search||'').toLowerCase();
 const rows=allRows.filter(s=>(!filters.status||s.status===filters.status)&&(!filters.type||s.type===filters.type)&&(!needle||[s.code,s.clientName,s.clientPhone].some(v=>String(v||'').toLowerCase().includes(needle))));
 const activeCount=allRows.filter(s=>s.status==='active').length,pendingCount=allRows.filter(s=>s.status==='pending').length,expiringCount=allRows.filter(s=>s.status==='active'&&new Date(s.endsAt)>=new Date()&&new Date(s.endsAt)<=new Date(Date.now()+7*86400000)).length;
 const planCards=plans.map(p=>'<article class="premium-card p-3"><b>'+escHtml(unifiedTypeLabel(p.type)+' · '+p.name)+'</b><p class="text-xs text-slate-500">'+Number(p.price).toLocaleString('ar-EG')+' جنيه · '+p.durationDays+' يوم · '+Number(p.visitCount||0)+' زيارة</p><p class="text-xs">'+(p.active?'مفعلة':'متوقفة')+'</p><button class="pill-btn soft-btn mt-2" onclick="editUnifiedSubscriptionPlan(\''+p._id+'\')">تعديل الخطة</button></article>').join('');
 const cards=rows.map(s=>{
  const daysLeft=s.endsAt?Math.ceil((new Date(s.endsAt).getTime()-Date.now())/86400000):null;
  const credentials=s.type==='iptv'?'<p class="text-xs break-all">بيانات الدخول: '+escHtml(s.iptvUsername||'')+' / '+escHtml(s.iptvPassword||'')+'</p>':s.type==='air_network'?'<p class="text-xs break-all">بيانات الدخول: '+escHtml(s.networkName||'')+' / '+escHtml(s.activationCode||'')+'</p>':'';
  const whatsapp=s.status==='active'&&daysLeft!==null&&daysLeft>=0&&daysLeft<=7?'<button class="pill-btn soft-btn" onclick="openUnifiedSubscriptionWhatsApp(\''+s._id+'\')">تذكير واتساب</button>':'';
  const dateLine=s.status==='pending'?'طلب جديد — بانتظار استكمال البيانات الفنية ومراجعة الدفع':'ينتهي '+(s.endsAt?new Date(s.endsAt).toLocaleDateString('ar-EG'):'—')+' · '+Number(s.amount).toLocaleString('ar-EG')+' جنيه';
  const actions=s.status==='pending'?'<button class="pill-btn primary-btn" onclick="setUnifiedSubscriptionStatus(\''+s._id+'\',\'active\')">استكمال البيانات والتفعيل</button>':'<button class="pill-btn soft-btn" onclick="renewUnifiedSubscription(\''+s._id+'\')">تجديد</button><button class="pill-btn soft-btn" onclick="assignUnifiedSubscriptionVisit(\''+s._id+'\')">إسناد زيارة</button><button class="pill-btn soft-btn" onclick="setUnifiedSubscriptionStatus(\''+s._id+'\',\'paused\')">تعليق</button><button class="pill-btn soft-btn" onclick="setUnifiedSubscriptionStatus(\''+s._id+'\',\'active\')">تفعيل</button>';
  return '<article class="premium-card p-3 space-y-2"><div class="flex justify-between gap-2"><b>'+escHtml(unifiedTypeLabel(s.type))+' · '+escHtml(s.code)+'</b><span class="text-xs">'+escHtml(s.status)+'</span></div><p class="text-xs">'+escHtml(s.clientName||'')+' · '+escHtml(s.clientPhone||'')+'</p><p class="text-xs">'+dateLine+'</p>'+credentials+whatsapp+'<div class="flex flex-wrap gap-2">'+actions+'</div></article>';
 }).join('');
 return '<section class="premium-panel p-4 mt-4 space-y-3"><div class="flex flex-wrap justify-between gap-2"><div><h2 class="font-black">الاشتراكات الموحدة · صيانة / اشتراك محلي / اشتراك ترفيهي</h2><p class="text-xs text-slate-500">خطط وأسعار ومدد مستقلة، وسجل اشتراكات وزيارات</p></div><div class="flex gap-2"><button class="pill-btn soft-btn" onclick="createUnifiedSubscriptionPlan()">إضافة خطة</button><button class="pill-btn primary-btn" onclick="createUnifiedSubscription()">إضافة اشتراك</button></div></div><h3 class="font-bold text-sm">الخطط ('+plans.length+')</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-2">'+planCards+'</div>'+'<div class="grid grid-cols-2 md:grid-cols-4 gap-2"><div class="premium-card p-3"><b>'+allRows.length+'</b><p class="text-xs">إجمالي الاشتراكات</p></div><div class="premium-card p-3"><b>'+activeCount+'</b><p class="text-xs">نشطة</p></div><div class="premium-card p-3"><b>'+pendingCount+'</b><p class="text-xs">قيد المراجعة</p></div><div class="premium-card p-3"><b>'+expiringCount+'</b><p class="text-xs">تنتهي خلال 7 أيام</p></div></div><div class="grid grid-cols-1 md:grid-cols-4 gap-2"><input id="unified-subscription-search" class="form-input" value="'+escAttr(filters.search||'')+'" placeholder="بحث بالكود أو اسم العميل أو الهاتف"><select id="unified-subscription-status" class="form-input"><option value="">كل الحالات</option><option value="active" '+(filters.status==='active'?'selected':'')+'>نشط</option><option value="pending" '+(filters.status==='pending'?'selected':'')+'>قيد المراجعة</option><option value="paused" '+(filters.status==='paused'?'selected':'')+'>موقوف</option><option value="expired" '+(filters.status==='expired'?'selected':'')+'>منتهي</option><option value="cancelled" '+(filters.status==='cancelled'?'selected':'')+'>ملغي</option></select><select id="unified-subscription-type" class="form-input"><option value="">كل الأنواع</option><option value="maintenance" '+(filters.type==='maintenance'?'selected':'')+'>صيانة سنوية</option><option value="air_network" '+(filters.type==='air_network'?'selected':'')+'>اشتراك محلي</option><option value="iptv" '+(filters.type==='iptv'?'selected':'')+'>اشتراك ترفيهي</option></select><button class="pill-btn soft-btn" onclick="applyUnifiedSubscriptionFilters()">تطبيق البحث والفلاتر</button></div><h3 class="font-bold text-sm pt-2">الاشتراكات ('+rows.length+' من '+allRows.length+')</h3>'+'<div class="grid grid-cols-1 md:grid-cols-2 gap-2">'+(cards||'<p class="text-xs text-slate-500">لا توجد اشتراكات بعد.</p>')+'</div></section>';
}
const _renderCommerceSubscriptions = renderCommerceSubscriptions;
renderCommerceSubscriptions = function(){return _renderCommerceSubscriptions() + renderUnifiedSubscriptionPanel();};
