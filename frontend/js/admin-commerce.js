'use strict';
function commerceEscAttr(value){return String(value??'').replace(/[&<>"'`]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[ch]));}
function unifiedTypeLabel(type){const labels={maintenance:'صيانة سنوية',air_network:'اشتراك محلي',iptv:'اشتراك ترفيهي'};return labels[String(type||'')]||'اشتراك';}
const UNIFIED_SERVICE_OPTIONS={maintenance:['كشف دوري','ضبط الإشارة','صيانة الطبق','فحص الكابلات','ضبط الرسيفر','تنظيف وحدة الاستقبال','فحص التوصيلات','دعم فني عن بُعد'],iptv:['تفعيل الخدمة','تحديث بيانات التشغيل','دعم فني','إعداد التطبيق','إضافة جهاز','تجديد بيانات الخدمة'],air_network:['تفعيل الشبكة','ضبط الراوتر','فحص الاتصال','إعداد الأجهزة','دعم فني','تحديث بيانات الدخول']};
const UNIFIED_SUPPLY_OPTIONS=['طبق دش','رسيفر','وحدة LNB','كابل دش','كابل شبكة','راوتر','سويتش شبكة','أكسس بوينت','حوامل ومسامير','محولات كهرباء','أجهزة إضافية'];
function openUnifiedSubscriptionForm({title,fields,submitLabel='حفظ البيانات'}){
 return new Promise(resolve=>{
  const overlay=document.createElement('div');overlay.className='fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/55 p-3';
  const html=fields.map(f=>{const v=f.value??f.defaultValue??'';const label='<label class="mb-1 block text-xs font-bold text-slate-700">'+escHtml(f.label)+'</label>';
   if(f.type==='checkboxes'){const chosen=Array.isArray(v)?v:[];return '<fieldset class="rounded-xl border border-slate-200 p-3"><legend class="px-1 text-xs font-bold">'+escHtml(f.label)+'</legend><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">'+f.options.map(o=>{const value=typeof o==='string'?o:o.value,text=typeof o==='string'?o:o.label;return '<label class="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs"><input type="checkbox" name="'+commerceEscAttr(f.name)+'" value="'+commerceEscAttr(value)+'" '+(chosen.includes(value)?'checked':'')+' class="h-4 w-4 accent-blue-600"><span>'+escHtml(text)+'</span></label>';}).join('')+'</div></fieldset>';}
   if(f.type==='select')return '<div>'+label+'<select name="'+commerceEscAttr(f.name)+'" '+(f.required?'required':'')+' class="form-input w-full">'+f.options.map(o=>{const value=typeof o==='string'?o:o.value,text=typeof o==='string'?o:o.label;return '<option value="'+commerceEscAttr(value)+'" '+(String(v)===String(value)?'selected':'')+'>'+escHtml(text)+'</option>';}).join('')+'</select></div>';
   if(f.type==='checkbox')return '<label class="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs font-bold"><input type="checkbox" name="'+commerceEscAttr(f.name)+'" '+(v?'checked':'')+' class="h-4 w-4 accent-blue-600">'+escHtml(f.label)+'</label>';
   const type=f.type==='number'?'number':f.type==='url'?'text':f.type==='datetime-local'?'datetime-local':f.type==='date'?'date':'text';return '<div>'+label+'<input name="'+commerceEscAttr(f.name)+'" type="'+type+'" value="'+commerceEscAttr(v)+'" '+(f.required?'required':'')+' '+(f.min!==undefined?'min="'+f.min+'"':'')+' '+(f.max!==undefined?'max="'+f.max+'"':'')+' '+(f.step!==undefined?'step="'+f.step+'"':'')+' class="form-input w-full"></div>';
  }).join('');
  overlay.innerHTML='<section role="dialog" aria-modal="true" class="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" dir="rtl"><div class="sticky top-0 z-10 -mx-4 -mt-4 mb-3 flex items-center justify-between border-b bg-white p-4"><h3 class="text-base font-black">'+escHtml(title)+'</h3><button type="button" data-cancel class="rounded-lg px-3 py-1 text-lg">×</button></div><form class="space-y-3"><div class="grid grid-cols-1 sm:grid-cols-2 gap-3">'+html+'</div><div class="flex gap-2 border-t pt-3"><button type="button" data-cancel class="flex-1 rounded-xl border p-2.5 text-sm font-bold">إلغاء</button><button type="submit" class="flex-1 rounded-xl bg-slate-900 p-2.5 text-sm font-bold text-white">'+escHtml(submitLabel)+'</button></div></form></section>';
  const close=v=>{overlay.remove();resolve(v);};overlay.addEventListener('click',e=>{if(e.target===overlay)close(null);});overlay.querySelectorAll('[data-cancel]').forEach(b=>b.addEventListener('click',()=>close(null)));
  overlay.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget,out={};fields.forEach(f=>{if(f.type==='checkboxes')out[f.name]=Array.from(form.querySelectorAll('input[name="'+f.name+'"]:checked')).map(x=>x.value);else if(f.type==='checkbox')out[f.name]=Boolean(form.elements[f.name]?.checked);else if(f.type==='number')out[f.name]=Number(form.elements[f.name]?.value);else out[f.name]=String(form.elements[f.name]?.value??'').trim();});close(out);});
  document.body.appendChild(overlay);overlay.querySelector('input,select')?.focus();
 });
}
function unifiedPlanFields(p={}){const type=p.type||'maintenance';return [
 {name:'type',label:'نوع الاشتراك',type:'select',value:type,required:true,options:[{value:'maintenance',label:'صيانة سنوية'},{value:'iptv',label:'اشتراك ترفيهي'},{value:'air_network',label:'اشتراك محلي'}]},
 {name:'name',label:'اسم الباقة',type:'text',value:p.name||'',required:true},
 {name:'price',label:'السعر بالجنيه',type:'number',value:p.price??0,min:0,step:'0.01',required:true},
 {name:'durationDays',label:'مدة الاشتراك بالأيام',type:'number',value:p.durationDays??365,min:1,max:3650,required:true},
 {name:'visitCount',label:'عدد زيارات الصيانة',type:'select',value:String(p.visitCount??0),options:Array.from({length:21},(_,i)=>({value:String(i),label:i+' زيارة'}))},
 {name:'allowedDevices',label:'عدد الأجهزة المسموح بها',type:'select',value:String(p.allowedDevices??1),options:Array.from({length:20},(_,i)=>({value:String(i+1),label:(i+1)+' جهاز'}))},
 {name:'includedServices',label:'الخدمات المشمولة — علّم على الاختيارات',type:'checkboxes',value:p.includedServices||[],options:Array.from(new Set([...Object.values(UNIFIED_SERVICE_OPTIONS).flat(),...(p.includedServices||[])]))},
 {name:'excludedSupplies',label:'المستلزمات غير المشمولة — علّم على الاختيارات',type:'checkboxes',value:p.excludedSupplies||[],options:Array.from(new Set([...UNIFIED_SUPPLY_OPTIONS,...(p.excludedSupplies||[])]))},
 {name:'active',label:'الخطة متاحة للعملاء',type:'checkbox',value:p.active!==false}
];}
// All subscription administration is handled by the unified subscriptions API.
async function loadCommerceCatalog(){return loadClientSubscriptions();}
function renderUnifiedSubscriptionPlans(){
 const plans=state.unifiedSubscriptionPlans||[];
 const cards=plans.map(plan=>{
  const services=Array.isArray(plan.includedServices)?plan.includedServices:[];
  const supplies=Array.isArray(plan.excludedSupplies)?plan.excludedSupplies:[];
  return '<article class="premium-card p-3 space-y-2"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">'+escHtml(unifiedTypeLabel(plan.type))+' · '+escHtml(plan.name||'باقة بدون اسم')+'</b><span class="rounded-full px-2 py-1 text-[10px] '+(plan.active===false?'bg-slate-100 text-slate-500':'bg-emerald-50 text-emerald-700')+'">'+(plan.active===false?'غير متاحة':'متاحة للعملاء')+'</span></div><p class="text-sm font-black">'+Number(plan.price||0).toLocaleString('ar-EG')+' جنيه</p><div class="grid grid-cols-2 gap-2 text-[10px] text-slate-600"><p>المدة: '+Number(plan.durationDays||0)+' يوم</p><p>زيارات الصيانة: '+Number(plan.visitCount||0)+'</p><p>الأجهزة: '+Number(plan.allowedDevices||1)+'</p></div>'+(services.length?'<p class="text-[10px]">الخدمات: '+services.map(escHtml).join('، ')+'</p>':'')+(supplies.length?'<p class="text-[10px]">مستلزمات غير مشمولة: '+supplies.map(escHtml).join('، ')+'</p>':'')+'<div class="flex flex-wrap gap-2"><button type="button" class="pill-btn soft-btn" onclick="editUnifiedSubscriptionPlan(\''+commerceEscAttr(plan._id)+'\')">تعديل الباقة</button></div></article>';
 }).join('');
 return '<div class="premium-panel p-4 mt-4 space-y-3">'+(state.commerceLoading?'<p class="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">جاري تحميل باقات الاشتراك...</p>':'')+(state.unifiedSubscriptionError?'<div class="rounded-lg bg-red-50 p-3 text-xs text-red-700">'+escHtml(state.unifiedSubscriptionError)+'<button type="button" class="pill-btn soft-btn mt-2" onclick="loadClientSubscriptions()">إعادة المحاولة</button></div>':'')+'<div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-black text-sm">إدارة باقات الاشتراك</h2><p class="text-[10px] text-slate-500">إعداد باقات الصيانة السنوية والاشتراك المحلي والترفيهي</p></div><button type="button" class="pill-btn primary-btn" onclick="createUnifiedSubscriptionPlan()">إضافة باقة جديدة</button></div><div class="grid grid-cols-1 md:grid-cols-2 gap-2">'+(cards||(state.unifiedPlansLoaded?'<p class="premium-card p-4 text-center text-[11px] text-slate-500">لا توجد باقات اشتراك حتى الآن.</p>':'<p class="premium-card p-4 text-center text-[11px] text-slate-500">لم يتم تحميل الباقات بعد.</p>'))+'</div></div>';
}
function renderCommercePlans(){return renderUnifiedSubscriptionPlans();}
function renderCommerceSubscriptions(){return renderUnifiedSubscriptionPanel();}
async function createAdminClientSubscription(clientPhone){return createUnifiedSubscription(clientPhone);}

/* Unified satellite subscriptions: maintenance, air-network and IPTV. */
async function fetchUnifiedSubscriptionResource(path,label){
 return new Promise(resolve=>{
  let settled=false;
  const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
  const timer=setTimeout(()=>finish({ok:false,error:new Error('انتهت مهلة تحميل '+label+' (15 ثانية). تحقق من اتصال الخادم ثم أعد المحاولة.')}),15000);
  tryApi([path],{method:'GET'}).then(data=>finish({ok:true,data})).catch(error=>finish({ok:false,error}));
 });
}
function safeCommerceRender(context='subscriptions'){
 if(typeof safeAdminRender==='function')return safeAdminRender(context);
 try{render();return true;}
 catch(error){console.error('[admin-ui] subscription render failed:',context,error);return false;}
}
async function loadClientSubscriptions(){
 const tab=state.tab;
 const plansOnly=tab==='commercePlans';
 if(!getToken()){state.commerceLoading=false;state.unifiedSubscriptionError='انتهت جلسة الإدارة. سجّل الدخول مرة أخرى ثم أعد المحاولة.';if(['commercePlans','commerceSubscriptions'].includes(tab))render();return;}
 const requestId=(Number(state.unifiedSubscriptionLoadId)||0)+1;
 state.unifiedSubscriptionLoadId=requestId;
 state.commerceLoading=true;
 state.unifiedSubscriptionError='';
 if(plansOnly)state.unifiedPlansLoaded=false;
 else {state.unifiedSubscriptionsLoaded=false;}
 safeCommerceRender('subscriptions-loading');
 try{
  const jobs=plansOnly
   ? [['plans','/api/subscriptions/admin/plans','الباقات']]
   : [['plans','/api/subscriptions/admin/plans','الباقات'],['subscriptions','/api/subscriptions/admin/list','اشتراكات العملاء']];
  const results=await Promise.all(jobs.map(async ([key,path,label])=>[key,await fetchUnifiedSubscriptionResource(path,label)]));
  if(state.unifiedSubscriptionLoadId!==requestId)return;
  const errors=[];
  for(const [key,result] of results){
   if(result.ok){
    if(key==='plans'){state.unifiedSubscriptionPlans=extractList(result.data,['plans']);state.unifiedPlansLoaded=true;}
    else if(key==='subscriptions'){state.unifiedSubscriptions=extractList(result.data,['subscriptions']);state.unifiedSubscriptionsLoaded=true;}
   }else{
    errors.push(result.error?.message||('تعذر تحميل '+key));
    if(key==='plans')state.unifiedPlansLoaded=false;
    else if(key==='subscriptions')state.unifiedSubscriptionsLoaded=false;
   }
  }
  state.unifiedSubscriptionError=errors.join(' — ');
  if(errors.length)showToast(state.unifiedSubscriptionError,'error');
 }catch(error){
  if(state.unifiedSubscriptionLoadId===requestId)state.unifiedSubscriptionError=error?.message||'تعذر تحميل بيانات الاشتراكات';
 }finally{
  if(state.unifiedSubscriptionLoadId===requestId){
   state.commerceLoading=false;
   if(['commercePlans','commerceSubscriptions'].includes(state.tab))safeCommerceRender('subscriptions-loaded');
  }
 }
}
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
 const v=await openUnifiedSubscriptionForm({title:'إضافة خطة اشتراك',fields:unifiedPlanFields(),submitLabel:'إنشاء الخطة'});if(!v)return;
 if(!v.name||v.name.length<2)return showToast('اسم الباقة مطلوب','error');
 if(!Number.isFinite(v.price)||v.price<0||!Number.isInteger(v.durationDays)||v.durationDays<1||v.durationDays>3650)return showToast('راجع السعر ومدة الاشتراك','error');
 try{await tryApi(['/api/subscriptions/admin/plans'],{method:'POST',body:JSON.stringify(v)});showToast('تم إنشاء الخطة','success');await loadClientSubscriptions();}
 catch(e){showToast(e.message||'تعذر إنشاء الخطة','error');}
}
async function editUnifiedSubscriptionPlan(id){
 const p=(state.unifiedSubscriptionPlans||[]).find(x=>String(x._id)===String(id));if(!p)return;
 const v=await openUnifiedSubscriptionForm({title:'تعديل خطة '+p.name,fields:unifiedPlanFields(p),submitLabel:'حفظ التعديلات'});if(!v)return;
 if(!v.name||v.name.length<2||!Number.isFinite(v.price)||v.price<0||!Number.isInteger(v.durationDays)||v.durationDays<1||v.durationDays>3650)return showToast('راجع بيانات الخطة','error');
 try{await tryApi(['/api/subscriptions/admin/plans/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify(v)});showToast('تم تحديث الخطة','success');await loadClientSubscriptions();}
 catch(e){showToast(e.message||'تعذر تعديل الخطة','error');}
}
async function createUnifiedSubscription(clientPhone=''){
 const plans=(state.unifiedSubscriptionPlans||[]).filter(p=>p.active!==false);if(!plans.length)return showToast('لا توجد خطط مفعلة. أنشئ خطة أو فعّل خطة موجودة أولًا.','error');
 const v=await openUnifiedSubscriptionForm({title:'إضافة اشتراك لعميل',submitLabel:'إنشاء وتفعيل الاشتراك',fields:[
  {name:'clientPhone',label:'رقم هاتف العميل المسجل',type:'text',value:clientPhone,required:true},
  {name:'planId',label:'الخطة',type:'select',required:true,options:plans.map(p=>({value:String(p._id),label:unifiedTypeLabel(p.type)+' — '+p.name+' · '+Number(p.price||0).toLocaleString('ar-EG')+' جنيه'}))},
  {name:'address',label:'عنوان العميل',type:'text'},
  {name:'dishSize',label:'مقاس الطبق',type:'select',options:['','60 سم','70 سم','80 سم','90 سم','100 سم','120 سم']},
  {name:'receiverType',label:'نوع الرسيفر',type:'select',options:['','HD','4K','Android','رسيفر عادي','آخر']},
  {name:'networkName',label:'اسم الباقة المحلية',type:'text'},
  {name:'deviceType',label:'نوع الجهاز / الخدمة',type:'select',options:['','رسيفر','تلفزيون ذكي','هاتف','راوتر','Access Point','جهاز آخر']},
  {name:'activationCode',label:'بيانات التفعيل أو الدخول',type:'text'},
  {name:'portalUrl',label:'رابط الخدمة الترفيهية',type:'url'},
  {name:'iptvUsername',label:'اسم مستخدم الترفيه',type:'text'},
  {name:'iptvPassword',label:'كلمة مرور الترفيه',type:'text'},
  {name:'allowedDevices',label:'عدد الأجهزة',type:'select',value:'1',options:Array.from({length:20},(_,i)=>({value:String(i+1),label:(i+1)+' جهاز'}))}
 ]});if(!v)return;
 const p=plans.find(x=>String(x._id)===String(v.planId));if(!p)return showToast('اختار خطة صحيحة','error');
 const phone=normalizePhoneInput(v.clientPhone);if(!/^01[0-9]{9}$/.test(phone))return showToast('رقم هاتف العميل غير صحيح','error');
 const body={...v,clientPhone:phone,type:p.type,planId:p._id};
 try{const result=await tryApi(['/api/subscriptions/admin/create'],{method:'POST',body:JSON.stringify(body)});showToast(result.message||'تم إنشاء الاشتراك','success');await loadClientSubscriptions();}
 catch(e){showToast(e.message||'تعذر إنشاء الاشتراك','error');}
}
async function setUnifiedSubscriptionStatus(id,status){
  const note=prompt('سبب / ملاحظة (اختياري):','')||'';
  try{await tryApi(['/api/subscriptions/admin/'+encodeURIComponent(id)+'/status'],{method:'PATCH',body:JSON.stringify({status,note})});showToast('تم تحديث الحالة','success');await loadClientSubscriptions();}
  catch(error){showToast(error.message||'تعذر تحديث الحالة','error');}
}
async function completeUnifiedSubscriptionDetails(id){
 const sub=(state.unifiedSubscriptions||[]).find(item=>String(item._id)===String(id));if(!sub)return;
 const fields=[{name:'address',label:'عنوان العميل',type:'text',value:sub.address||''}];
 if(sub.type==='maintenance')fields.push(
  {name:'dishSize',label:'مقاس الطبق',type:'select',value:sub.dishSize||'',options:['','60 سم','70 سم','80 سم','90 سم','100 سم','120 سم','آخر']},
  {name:'receiverType',label:'نوع الرسيفر',type:'select',value:sub.receiverType||'',options:['','HD','4K','Android','رسيفر عادي','آخر']},
  {name:'visitsIncluded',label:'عدد زيارات الصيانة المشمولة',type:'select',value:String(sub.visitsIncluded??0),options:Array.from({length:21},(_,i)=>({value:String(i),label:i+' زيارة'}))}
 );
 if(sub.type==='air_network')fields.push(
  {name:'networkName',label:'اسم الشبكة / الباقة المحلية',type:'text',value:sub.networkName||''},
  {name:'activationCode',label:'كود أو بيانات التفعيل',type:'text',value:sub.activationCode||''},
  {name:'deviceType',label:'نوع الجهاز',type:'select',value:sub.deviceType||'',options:['','راوتر','Access Point','رسيفر','تلفزيون ذكي','هاتف','جهاز آخر']}
 );
 if(sub.type==='iptv')fields.push(
  {name:'deviceType',label:'نوع الجهاز',type:'select',value:sub.deviceType||'',options:['','رسيفر','تلفزيون ذكي','هاتف','تابلت','جهاز آخر']},
  {name:'portalUrl',label:'رابط بوابة الخدمة',type:'url',value:sub.portalUrl||''},
  {name:'iptvUsername',label:'اسم المستخدم',type:'text',value:sub.iptvUsername||''},
  {name:'iptvPassword',label:'كلمة المرور',type:'text',value:sub.iptvPassword||''},
  {name:'allowedDevices',label:'عدد الأجهزة المسموح بها',type:'select',value:String(sub.allowedDevices||1),options:Array.from({length:20},(_,i)=>({value:String(i+1),label:(i+1)+' جهاز'}))}
 );
 fields.push({name:'notes',label:'ملاحظات الاشتراك',type:'text',value:sub.notes||''});
 const values=await openUnifiedSubscriptionForm({title:'استكمال بيانات '+unifiedTypeLabel(sub.type)+' · '+sub.code,fields,submitLabel:'حفظ بيانات الاشتراك'});if(!values)return;
 try{
  const result=await tryApi(['/api/subscriptions/admin/'+encodeURIComponent(id)+'/details'],{method:'PATCH',body:JSON.stringify(values)});
  showToast(result.message||'تم حفظ بيانات الاشتراك','success');await loadClientSubscriptions();
 }catch(error){showToast(error.message||'تعذر حفظ بيانات الاشتراك','error');}
}
async function editUnifiedSubscriptionDates(id){
 const sub=(state.unifiedSubscriptions||[]).find(item=>String(item._id)===String(id));if(!sub)return;
 const toLocalDate=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10):'';};
 const values=await openUnifiedSubscriptionForm({title:'تعديل مدة الاشتراك · '+sub.code,submitLabel:'حفظ تاريخ الاشتراك',fields:[{name:'startsAt',label:'بداية الاشتراك',type:'date',value:toLocalDate(sub.startsAt),required:true},{name:'endsAt',label:'نهاية الاشتراك',type:'date',value:toLocalDate(sub.endsAt),required:true}]});if(!values)return;
 const startsAt=new Date(values.startsAt+'T00:00:00'),endsAt=new Date(values.endsAt+'T23:59:59');
 if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)return showToast('تاريخ النهاية يجب أن يكون بعد تاريخ البداية.','error');
 try{const result=await tryApi(['/api/subscriptions/admin/'+encodeURIComponent(id)+'/dates'],{method:'PATCH',body:JSON.stringify({startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()})});showToast(result.message||'تم تعديل بداية ونهاية الاشتراك','success');await loadClientSubscriptions();}
 catch(error){showToast(error.message||'تعذر تعديل مدة الاشتراك','error');}
}
async function deleteUnifiedSubscription(id){
  const row=(state.unifiedSubscriptions||[]).find(item=>String(item._id)===String(id));
  if(!row)return showToast('الاشتراك غير موجود','error');
  if(!confirm('تحذير: سيتم حذف اشتراك '+(row.code||'')+' للعميل '+(row.clientName||row.clientPhone||'')+' نهائيًا، مع حذف زياراته المرتبطة. لن يتم رد أي مبالغ تلقائيًا ولا يمكن التراجع. هل تريد المتابعة؟'))return;
  try{
    const result=await tryApi(['/api/subscriptions/admin/'+encodeURIComponent(id)],{method:'DELETE'});
    showToast(result.message||'تم حذف الاشتراك نهائيًا','success');
    await loadClientSubscriptions();
  }catch(error){showToast(error.message||'تعذر حذف الاشتراك','error');}
}
async function renewUnifiedSubscription(id){
 const row=(state.unifiedSubscriptions||[]).find(x=>String(x._id)===String(id));if(!row)return;
 const v=await openUnifiedSubscriptionForm({title:'تجديد اشتراك '+row.code,submitLabel:'تأكيد التجديد',fields:[
  {name:'amount',label:'سعر التجديد بالجنيه',type:'number',value:row.amount,min:0,step:'0.01',required:true},
  {name:'durationDays',label:'مدة التجديد بالأيام',type:'number',value:row.durationDays,min:1,max:3650,required:true}
 ]});if(!v)return;
 if(!Number.isFinite(v.amount)||v.amount<0||!Number.isInteger(v.durationDays)||v.durationDays<1||v.durationDays>3650)return showToast('راجع السعر والمدة','error');
 try{await tryApi(['/api/subscriptions/admin/'+encodeURIComponent(id)+'/renew'],{method:'POST',body:JSON.stringify(v)});showToast('تم التجديد','success');await loadClientSubscriptions();}
 catch(e){showToast(e.message||'تعذر التجديد','error');}
}
async function assignUnifiedSubscriptionVisit(id,visitId=''){
  if(!Array.isArray(state.fannis)||!state.fannis.length){try{await loadAll();}catch(_){}}
  const technicians=(state.fannis||[]).filter(item=>!item.isDisabled&&(item.isApproved===true||item.status==='معتمد'||item.status==='approved'));
  if(!technicians.length)return showToast('لا يوجد فنيون معتمدون ومتاحون للإسناد حاليًا.','error');
  const now=new Date(Date.now()+60*60*1000),localDateTime=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  const values=await openUnifiedSubscriptionForm({title:'إسناد زيارة صيانة',submitLabel:'تأكيد إسناد الزيارة',fields:[
    {name:'technicianId',label:'اختيار الفني المسؤول',type:'select',required:true,options:technicians.map(item=>({value:String(item._id),label:String(item.name||'فني')+' — '+String(item.phone||'')}))},
    {name:'scheduledAt',label:'موعد الزيارة',type:'datetime-local',value:localDateTime,required:true}
  ]});
  if(!values)return;
  const scheduledAt=new Date(values.scheduledAt);
  if(!Number.isFinite(scheduledAt.getTime())||scheduledAt.getTime()<Date.now())return showToast('اختار موعدًا صحيحًا في المستقبل.','error');
  try{await tryApi(['/api/subscriptions/admin/visits'],{method:'POST',body:JSON.stringify({...(!visitId?{subscriptionId:id}:{visitId}),technicianId:values.technicianId,scheduledAt:scheduledAt.toISOString()})});showToast('تم إسناد الزيارة للفني بنجاح.','success');await loadClientSubscriptions();}
  catch(error){showToast(error.message||'تعذر إسناد الزيارة','error');}
}
function applyUnifiedSubscriptionFilters(){state.unifiedSubscriptionFilters={search:String(document.getElementById('unified-subscription-search')?.value||'').trim(),status:String(document.getElementById('unified-subscription-status')?.value||''),type:String(document.getElementById('unified-subscription-type')?.value||'')};render();}
function renderUnifiedSubscriptionCard(sub){
 const daysLeft=Math.ceil((new Date(sub.endsAt).getTime()-Date.now())/86400000);
 const credentials=sub.type==='iptv'?'<div class="text-xs break-all space-y-1"><p>الجهاز: '+escHtml(sub.deviceType||'—')+' · الأجهزة المسموحة: '+escHtml(String(sub.allowedDevices||1))+'</p><p>رابط الخدمة: '+escHtml(sub.portalUrl||'—')+'</p><p>اسم المستخدم: '+escHtml(sub.iptvUsername||'—')+'</p><p>كلمة المرور: '+escHtml(sub.iptvPassword||'—')+'</p></div>':sub.type==='air_network'?'<div class="text-xs space-y-1"><p>اسم الباقة: '+escHtml(sub.networkName||'—')+'</p><p>بيانات التفعيل: '+escHtml(sub.activationCode||'—')+'</p><p>نوع الجهاز: '+escHtml(sub.deviceType||'—')+'</p></div>':'<div class="text-xs space-y-1"><p>مقاس الطبق: '+escHtml(sub.dishSize||'—')+' · نوع الرسيفر: '+escHtml(sub.receiverType||'—')+'</p><p>الزيارات: المشمول '+escHtml(String(sub.visitsIncluded??0))+' · المستهلك '+escHtml(String(sub.visitsConsumed??0))+' · المتبقي '+escHtml(String(sub.visitsRemaining??sub.visitsIncluded??0))+'</p></div>';
 const payment='<p class="text-[10px] text-slate-600">الدفع: '+escHtml(sub.paymentMethod==='wallet'?'محفظة التطبيق':sub.paymentMethod==='transfer'?'تحويل أموال':'الإدارة')+' · '+escHtml(sub.paymentStatus==='paid'?'تم السداد':sub.paymentStatus==='pending'?'قيد المراجعة':'مرفوض')+'</p>';
 const labels={active:'نشط',pending:'قيد مراجعة الإدارة',paused:'موقوف',expired:'منتهي',cancelled:'ملغي'};
 const whatsapp=sub.status==='active'&&daysLeft>=0&&daysLeft<=7?'<button type="button" class="pill-btn soft-btn" onclick="openUnifiedSubscriptionWhatsApp(\''+escHtml(sub._id)+'\')">تذكير واتساب</button>':'';
 const renew=['active','paused','expired'].includes(sub.status)?'<button type="button" class="pill-btn soft-btn" onclick="renewUnifiedSubscription(\''+escHtml(sub._id)+'\')">تجديد</button>':'';
 const visit=sub.type==='maintenance'&&sub.status==='active'?'<button type="button" class="pill-btn soft-btn" onclick="assignUnifiedSubscriptionVisit(\''+escHtml(sub._id)+'\')">إسناد زيارة</button>':'';
 const pause=sub.status==='active'?'<button type="button" class="pill-btn soft-btn" onclick="setUnifiedSubscriptionStatus(\''+escHtml(sub._id)+'\',\'paused\')">تعليق</button>':'';
 const activate=['pending','paused'].includes(sub.status)?'<button type="button" class="pill-btn soft-btn" onclick="setUnifiedSubscriptionStatus(\''+escHtml(sub._id)+'\',\'active\')">'+(sub.status==='pending'?'تأكيد السداد والتفعيل':'تفعيل')+'</button>':'';
 const details=!['pending','cancelled'].includes(sub.status)?'<button type="button" class="pill-btn soft-btn" onclick="completeUnifiedSubscriptionDetails(\''+escHtml(sub._id)+'\')">استكمال البيانات</button>':'';
 const dates=['active','paused','expired'].includes(sub.status)?'<button type="button" class="pill-btn soft-btn" onclick="editUnifiedSubscriptionDates(\''+escHtml(sub._id)+'\')">تعديل بداية ونهاية الاشتراك</button>':'';
 const del='<button type="button" class="pill-btn soft-btn text-red-700" onclick="deleteUnifiedSubscription(\''+escHtml(sub._id)+'\')">حذف نهائي</button>';
 return '<article class="premium-card p-3 space-y-2"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">'+escHtml(unifiedTypeLabel(sub.type))+' · '+escHtml(sub.code)+'</b><span class="text-[10px]">'+escHtml(labels[sub.status]||sub.status||'')+'</span></div><p class="text-[10px] text-slate-500">من '+(sub.startsAt?new Date(sub.startsAt).toLocaleDateString('ar-EG'):'—')+' إلى '+(sub.endsAt?new Date(sub.endsAt).toLocaleDateString('ar-EG'):'—')+' · '+Number(sub.amount||0).toLocaleString('ar-EG')+' جنيه · متبقي '+Math.max(0,daysLeft)+' يوم</p>'+(sub.address?'<p class="text-[10px] text-slate-600">العنوان: '+escHtml(sub.address)+'</p>':'')+payment+credentials+(Array.isArray(sub.includedServices)&&sub.includedServices.length?'<p class="text-[10px]">الخدمات المشمولة: '+sub.includedServices.map(escHtml).join(' · ')+'</p>':'')+(Array.isArray(sub.excludedSupplies)&&sub.excludedSupplies.length?'<p class="text-[10px]">المستلزمات غير المشمولة: '+sub.excludedSupplies.map(escHtml).join(' · ')+'</p>':'')+(sub.notes?'<p class="text-[10px]">'+escHtml(sub.notes)+'</p>':'')+whatsapp+'<div class="flex flex-wrap gap-2">'+renew+visit+pause+activate+details+dates+del+'</div></article>';
}
function renderUnifiedSubscriptionPanel(){
 const allRows=state.unifiedSubscriptions||[];
 const filters=state.unifiedSubscriptionFilters||{};
 const needle=String(filters.search||'').toLowerCase();
 const rows=allRows.filter(sub=>(!filters.status||sub.status===filters.status)&&(!filters.type||sub.type===filters.type)&&(!needle||[sub.code,sub.clientName,sub.clientPhone].some(value=>String(value||'').toLowerCase().includes(needle))));
 const activeCount=allRows.filter(sub=>sub.status==='active').length;
 const pendingCount=allRows.filter(sub=>sub.status==='pending').length;
 const expiringCount=allRows.filter(sub=>sub.status==='active'&&new Date(sub.endsAt)>=new Date()&&new Date(sub.endsAt)<=new Date(Date.now()+7*86400000)).length;
 const statusLabels={active:'نشط',pending:'قيد مراجعة الإدارة',paused:'موقوف',expired:'منتهي',cancelled:'ملغي'};
 const groupedRows=new Map();
 rows.forEach(sub=>{const key=String(sub.client?._id||sub.client||sub.clientPhone||sub.clientName||'unknown');if(!groupedRows.has(key))groupedRows.set(key,[]);groupedRows.get(key).push(sub);});
 const expandedCustomers=state.expandedUnifiedSubscriptionCustomers||{};
 const cards=Array.from(groupedRows.entries()).map(([key,customerRows])=>{const first=customerRows[0]||{};const name=first.clientName||first.clientPhone||'عميل بدون اسم';const expanded=expandedCustomers[key]===true;return '<section class="premium-card p-3 space-y-2"><button type="button" class="w-full flex items-center justify-between gap-2 text-right" aria-expanded="'+String(expanded)+'" onclick="toggleUnifiedSubscriptionCustomer(\''+commerceEscAttr(key)+'\')"><span><b class="text-sm">'+escHtml(name)+'</b><small class="block text-[10px] text-slate-500">'+escHtml(first.clientPhone||'')+' · '+customerRows.length+' اشتراك</small></span><span class="text-xs font-bold">'+(expanded?'إخفاء الاشتراكات ▲':'عرض الاشتراكات ▼')+'</span></button>'+(expanded?'<div class="grid grid-cols-1 gap-2">'+customerRows.map(renderUnifiedSubscriptionCard).join('')+'</div>':'')+'</section>';}).join('');
 return '<div class="premium-panel p-4 mt-4 space-y-3">'+(state.commerceLoading?'<p class="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">جاري تحميل بيانات الاشتراكات...</p>':'')+(state.unifiedSubscriptionError?'<div class="rounded-lg bg-red-50 p-3 text-xs text-red-700">'+escHtml(state.unifiedSubscriptionError)+'<button type="button" class="pill-btn soft-btn mt-2" onclick="loadClientSubscriptions()">إعادة المحاولة</button></div>':'')+'<div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-black text-sm">اشتراكات العملاء وطلبات الدفع</h2><p class="text-[10px] text-slate-500">متابعة الصيانة السنوية والترفيهي والمحلي وزيارات الفنيين</p></div><button type="button" class="pill-btn primary-btn" onclick="createUnifiedSubscription()">إضافة اشتراك</button></div><div class="grid grid-cols-2 md:grid-cols-4 gap-2"><div class="premium-card p-3"><b>'+allRows.length+'</b><p class="text-[10px]">إجمالي الاشتراكات</p></div><div class="premium-card p-3"><b>'+activeCount+'</b><p class="text-[10px]">نشطة</p></div><div class="premium-card p-3"><b>'+pendingCount+'</b><p class="text-[10px]">قيد المراجعة</p></div><div class="premium-card p-3"><b>'+expiringCount+'</b><p class="text-[10px]">تنتهي خلال 7 أيام</p></div></div><div class="grid grid-cols-1 md:grid-cols-4 gap-2"><input id="unified-subscription-search" class="form-input" value="'+commerceEscAttr(filters.search||'')+'" placeholder="بحث بالكود أو اسم العميل أو الهاتف"><select id="unified-subscription-status" class="form-input"><option value="">كل الحالات</option><option value="active" '+(filters.status==='active'?'selected':'')+'>نشط</option><option value="pending" '+(filters.status==='pending'?'selected':'')+'>قيد المراجعة</option><option value="paused" '+(filters.status==='paused'?'selected':'')+'>موقوف</option><option value="expired" '+(filters.status==='expired'?'selected':'')+'>منتهي</option><option value="cancelled" '+(filters.status==='cancelled'?'selected':'')+'>ملغي</option></select><select id="unified-subscription-type" class="form-input"><option value="">كل الأنواع</option><option value="maintenance" '+(filters.type==='maintenance'?'selected':'')+'>صيانة سنوية</option><option value="air_network" '+(filters.type==='air_network'?'selected':'')+'>اشتراك محلي</option><option value="iptv" '+(filters.type==='iptv'?'selected':'')+'>اشتراك ترفيهي</option></select><button type="button" class="pill-btn soft-btn" onclick="applyUnifiedSubscriptionFilters()">تطبيق البحث والفلاتر</button></div><h3 class="font-bold text-sm">العملاء ('+groupedRows.size+' عميل · '+rows.length+' اشتراك)</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-2">'+(cards||(state.unifiedSubscriptionsLoaded?'<p class="premium-card p-4 text-center text-[11px] text-slate-500">لا توجد اشتراكات في هذا الاختيار.</p>':'<p class="premium-card p-4 text-center text-[11px] text-slate-500">تعذر تأكيد خلو القائمة قبل اكتمال التحميل.</p>'))+'</div></div>';
}
function toggleUnifiedSubscriptionCustomer(key){state.expandedUnifiedSubscriptionCustomers=state.expandedUnifiedSubscriptionCustomers||{};state.expandedUnifiedSubscriptionCustomers[key]=!state.expandedUnifiedSubscriptionCustomers[key];safeCommerceRender('subscription-customer-toggle');}
function renderCommerce(){return state.tab==='commercePlans'?renderCommercePlans():renderUnifiedSubscriptionPanel();}
async function loadUnifiedSubscriptionVisits(){
 if(!getToken()){state.commerceLoading=false;state.unifiedSubscriptionError='انتهت جلسة الإدارة. سجّل الدخول مرة أخرى ثم أعد المحاولة.';safeCommerceRender('subscription-visits-auth');return;}
 const requestId=(Number(state.unifiedVisitsLoadId)||0)+1;state.unifiedVisitsLoadId=requestId;state.commerceLoading=true;state.unifiedSubscriptionError='';state.unifiedVisitsLoaded=false;safeCommerceRender('subscription-visits-loading');
 try{
  const result=await fetchUnifiedSubscriptionResource('/api/subscriptions/admin/visits','زيارات الصيانة');
  if(state.unifiedVisitsLoadId!==requestId)return;
  if(!result.ok)throw result.error||new Error('تعذر تحميل زيارات الصيانة');
  state.unifiedSubscriptionVisits=extractList(result.data,['visits']);state.unifiedVisitsLoaded=true;
 }catch(error){if(state.unifiedVisitsLoadId===requestId)state.unifiedSubscriptionError=error?.message||'تعذر تحميل زيارات الصيانة';}
 finally{if(state.unifiedVisitsLoadId===requestId){state.commerceLoading=false;safeCommerceRender('subscription-visits-loaded');}}
}
function setUnifiedSubscriptionVisitSearch(value){state.unifiedSubscriptionVisitSearch=String(value||'');safeCommerceRender('subscription-visits-search');}
function renderUnifiedSubscriptionVisits(){
 const visits=state.unifiedSubscriptionVisits||[];
 const needle=String(state.unifiedSubscriptionVisitSearch||'').trim().toLocaleLowerCase('ar');
 const filtered=visits.filter(visit=>[visit.client?.name,visit.technician?.name,visit.subscription?.code,visit.client?.phone].some(value=>String(value||'').toLocaleLowerCase('ar').includes(needle)));
 const grouped=new Map();
 filtered.forEach(visit=>{const key=String(visit.client?._id||visit.client?.id||visit.client?.phone||visit.client?.name||'unknown');if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(visit);});
 const statusLabels={requested:'طلب جديد — لم يتم الإسناد',completed:'مكتملة',awaiting_client_confirmation:'بانتظار تأكيد العميل',in_progress:'جاري التنفيذ',scheduled:'تم إسناد الفني'};
 const cards=Array.from(grouped.entries()).map(([key,items])=>{
  const client=items[0]?.client||{};const name=client.name||'عميل بدون اسم';
  const rows=items.map(visit=>'<article class="rounded-xl border border-slate-200 bg-white p-3 space-y-1"><div class="flex items-center justify-between gap-2"><b class="text-[11px]">'+commerceEscAttr(visit.subscription?.code||'زيارة صيانة')+'</b><span class="text-[10px]">'+commerceEscAttr(statusLabels[visit.status]||visit.status||'مجدولة')+'</span></div><p class="text-[11px]">الفني المسند: <b>'+commerceEscAttr(visit.technician?.name||'لم يتم إسناد فني بعد')+'</b></p><p class="text-[10px] text-slate-500">'+commerceEscAttr(visit.scheduledAt?new Date(visit.scheduledAt).toLocaleString('ar-EG'):'موعد غير محدد')+'</p>'+(visit.workDescription?'<p class="text-[10px] text-slate-600">ملاحظة العميل: '+commerceEscAttr(visit.workDescription)+'</p>':'')+(visit.status==='requested'?'<button type="button" class="pill-btn primary-btn mt-2" onclick="assignUnifiedSubscriptionVisit(\''+commerceEscAttr(visit.subscription?._id||'')+'\',\''+commerceEscAttr(visit._id)+'\')">إسناد الطلب لفني</button>':'')+'</article>').join('');
  return '<section class="premium-card p-3 space-y-2"><div class="flex items-center justify-between gap-2"><div><b class="text-sm">'+commerceEscAttr(name)+'</b><p class="text-[10px] text-slate-500">'+commerceEscAttr(client.phone||'')+'</p></div><span class="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">'+items.length+' زيارة</span></div><div class="grid grid-cols-1 md:grid-cols-2 gap-2">'+rows+'</div></section>';
 }).join('');
 return '<div class="premium-panel p-4 mt-4 space-y-3">'+(state.commerceLoading?'<p class="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">جاري تحميل زيارات الصيانة...</p>':'')+(state.unifiedSubscriptionError?'<div class="rounded-lg bg-red-50 p-3 text-xs text-red-700">'+commerceEscAttr(state.unifiedSubscriptionError)+'<button type="button" class="pill-btn soft-btn mt-2" onclick="loadUnifiedSubscriptionVisits()">إعادة المحاولة</button></div>':'')+'<div><h2 class="font-black text-sm">زيارات الصيانة</h2><p class="text-[10px] text-slate-500">متابعة الزيارات مجمّعة حسب العميل، مع إظهار الفني المسند لكل زيارة</p></div><input id="unified-subscription-visit-search" type="search" class="form-input w-full" value="'+commerceEscAttr(state.unifiedSubscriptionVisitSearch||'')+'" oninput="setUnifiedSubscriptionVisitSearch(this.value)" placeholder="ابحث باسم العميل أو الفني المسند إليه الزيارة" aria-label="بحث باسم العميل أو الفني"><div class="flex items-center justify-between text-[11px] text-slate-500"><span>'+filtered.length+' زيارة</span><span>'+grouped.size+' عميل</span></div><div class="grid grid-cols-1 gap-3">'+(cards||(state.unifiedVisitsLoaded?'<p class="premium-card p-4 text-center text-[11px] text-slate-500">'+(needle?'لا توجد زيارات تطابق البحث.':'لا توجد زيارات صيانة مسجلة.')+'</p>':'<p class="premium-card p-4 text-center text-[11px] text-slate-500">لم يتم تحميل الزيارات بعد.</p>'))+'</div></div>';
}
