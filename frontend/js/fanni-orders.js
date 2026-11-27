'use strict';

async function loadOrders(page=1,append=false){
 if(!getToken())return false;
 if(state.loading)return null;

 state.loading=true;
 render();

 try{
  const data=await API.available(page);
  const incoming=extractList(data,['orders','requests','items']);
  state.orders=append?[...(state.orders||[]),...incoming]:incoming;
  state.ordersPagination=data.pagination||{page,limit:20,total:state.orders.length,pages:1};
  applyFilter();
  state.loading=false;
  render();
  return true;
 }catch(e){
  state.loading=false;
  if(!append){state.orders=[];state.filteredOrders=[];}
  render();
  toast(e.message,'error');
  return false;
 }
}

function toggleFanniRatingBlock(sn){
 const select=document.getElementById('rating-stars-'+sn);
 const wrap=document.getElementById('rating-block-wrap-'+sn);
 if(wrap)wrap.style.display=Number(select?.value)===1?'flex':'none';
 if(Number(select?.value)!==1){
  const checkbox=document.getElementById('rating-block-'+sn);
  if(checkbox)checkbox.checked=false;
 }
}
async function submitFanniRating(sn){
 const stars=Number(document.getElementById('rating-stars-'+sn)?.value);
 const comment=String(document.getElementById('rating-comment-'+sn)?.value||'').trim().slice(0,500);
 const blockFuture=Boolean(document.getElementById('rating-block-'+sn)?.checked);
 if(!Number.isInteger(stars)||stars<1||stars>5){toast('اختار عدد النجوم','error');return;}
 if(blockFuture&&stars!==1){toast('إيقاف التعامل متاح مع تقييم نجمة واحدة فقط','error');return;}
 try{await API.rateOrder(sn,{stars,comment,blockFuture});toast('تم حفظ تقييمك بنجاح');await loadMyOffers();}
 catch(e){toast(e.message||'تعذر حفظ التقييم','error');}
}
async function completeOrder(sn){
 const code=String(sn||'').trim().toUpperCase();
 if(!code){toast('كود الطلب غير موجود','error');return;}
 if(state.completingOrder)return;
 if(!confirm('هل تؤكد إنك أنهيت تنفيذ المهمة؟'))return;
 state.completingOrder=code;render();
 try{
  const result=await API.complete(code);
  toast(result?.message||'تم تسجيل طلب إنهاء الخدمة، في انتظار تأكيد العميل.');
  state.tab='myOrders';state.myOrdersView='active';
  await loadMyOffers();
 }catch(e){toast(e?.message||'تعذر إكمال المهمة','error');}
 finally{state.completingOrder='';render();}
}
async function completeSubscriptionVisit(visitId){
 const id=String(visitId||'').trim();
 if(!id||state.completingSubscriptionVisit)return;
 if(!confirm('هل تؤكد إنهاء زيارة الصيانة؟ سيصل طلب التأكيد للعميل، ولن تُغلق الزيارة قبل تأكيده.'))return;
 state.completingSubscriptionVisit=id;render();
 try{
  const result=await API.updateSubscriptionVisit(id,{status:'completed',workDescription:''});
  toast(result?.message||'تم إرسال طلب إنهاء الزيارة للعميل.');
  await loadMyOffers();
 }catch(error){toast(error?.message||'تعذر إنهاء زيارة الصيانة','error');}
 finally{state.completingSubscriptionVisit='';render();}
}
function renderFanniSubscriptionVisits(){
 const visits=state.subscriptionVisits||[];
 if(!visits.length)return '';
 return '<div class="mt-4 space-y-2"><h4 class="text-[13px] font-extrabold">زيارات اشتراكات الصيانة</h4>'+visits.map(visit=>{
  const pending=visit.status==='awaiting_client_confirmation';
  const started=visit.status==='in_progress';
  const status=pending?'في انتظار تأكيد العميل':started?'جاري التنفيذ':'موعد زيارة مجدول';
  return '<article class="panel p-3 space-y-2"><div class="flex items-center justify-between gap-2"><b class="text-[12px]">زيارة '+esc(visit.subscription?.code||'صيانة سنوية')+'</b><span class="text-[10px]">'+status+'</span></div><p class="text-[11px] text-slate-600">'+esc(visit.client?.name||'العميل')+' · '+esc(new Date(visit.scheduledAt).toLocaleString('ar-EG'))+'</p>'+(visit.subscription?.address?'<p class="text-[10px] text-slate-500">'+esc(visit.subscription.address)+'</p>':'')+(pending?'<p class="rounded-lg bg-amber-50 p-2 text-[10px] font-bold text-amber-900">تم إرسال طلب إنهاء الزيارة. لن تُحسب مكتملة قبل تأكيد العميل.</p>':'<button type="button" data-visit-id="'+esc(visit._id)+'" onclick="completeSubscriptionVisit(this.dataset.visitId)" '+(state.completingSubscriptionVisit===String(visit._id)?'disabled':'')+' class="primary-btn w-full h-10 text-[11px]">'+(state.completingSubscriptionVisit===String(visit._id)?'جاري إرسال طلب الإنهاء...':'إنهاء الخدمة وطلب تأكيد العميل')+'</button>')+'</article>';
 }).join('')+'</div>';
}
