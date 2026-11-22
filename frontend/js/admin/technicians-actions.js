'use strict';

async function removeOffer(sn,idx){if(!confirm('هل تريد إزالة هذا العرض؟'))return; try{await tryApi([`/api/admin/offers/${encodeURIComponent(sn)}/${idx}`],{method:'DELETE'}); showToast('تمت إزالة العرض'); await loadOrders();}catch(e){showToast(e.message);}}


async function rejectOffer(sn,idx){if(!confirm('رفض هذا العرض مع سبب؟'))return; try{await tryApi([`/api/admin/offers/${encodeURIComponent(sn)}/${idx}/reject`],{method:'POST',body:JSON.stringify({reason:'غير مناسب'})}); showToast('تم رفض العرض'); await loadOrders();}catch(e){showToast(e.message);}}

async function openFanniRegistrationReview(id){
 const row=(state.pendingFanniRegistrations||[]).find(item=>String(item._id)===String(id));
 if(!row)return showToast('طلب التسجيل غير موجود. حدّث القائمة وحاول مرة أخرى.','error');
 const existing=document.getElementById('fanni-registration-review-modal');if(existing)existing.remove();
 const modal=document.createElement('div');modal.id='fanni-registration-review-modal';modal.className='fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/80 p-3';
 modal.innerHTML='<section dir="rtl" class="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"><header class="flex items-center justify-between border-b pb-3"><div><h2 class="font-black text-base">مراجعة تسجيل الفني</h2><p class="mt-1 text-xs text-slate-500">قارن الاسم والرقم المكتوبين بصور البطاقة.</p></div><button type="button" data-close class="rounded-lg bg-slate-100 px-3 py-2">إغلاق ✕</button></header><div class="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4"><div><p class="mb-2 text-xs font-black">الصورة الشخصية</p><div id="fanni-review-photo" class="rounded-xl bg-slate-50 p-2 text-center text-xs text-slate-500">تحميل...</div></div><div><p class="mb-2 text-xs font-black">وجه البطاقة الأمامي</p><div id="fanni-review-front" class="rounded-xl bg-slate-50 p-2 text-center text-xs text-slate-500">تحميل...</div></div><div><p class="mb-2 text-xs font-black">وجه البطاقة الخلفي</p><div id="fanni-review-back" class="rounded-xl bg-slate-50 p-2 text-center text-xs text-slate-500">تحميل...</div></div></div><div class="grid sm:grid-cols-2 gap-3"><label class="text-xs font-black">الاسم الذي كتبه الفني<input id="fanni-review-name" class="field mt-2" maxlength="50"></label><label class="text-xs font-black">الرقم القومي الذي كتبه الفني<input id="fanni-review-national-id" class="field mt-2" inputmode="numeric" maxlength="14"></label></div><p id="fanni-review-reason" class="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"></p><div class="mt-4 grid grid-cols-2 gap-2"><button type="button" id="fanni-review-approve" class="pill-btn primary-pill">موافقة واعتماد</button><button type="button" id="fanni-review-reject" class="pill-btn danger-pill">رفض وطلب صور أوضح</button></div></section>';
 document.body.appendChild(modal);
 const urls=[];const close=()=>{urls.forEach(url=>URL.revokeObjectURL(url));modal.remove();};
 modal.querySelector('[data-close]').addEventListener('click',close);modal.addEventListener('click',event=>{if(event.target===modal)close();});
 modal.querySelector('#fanni-review-name').value=row.name||'';
 modal.querySelector('#fanni-review-national-id').value=row.nationalId||'';
 modal.querySelector('#fanni-review-reason').textContent=row.identityReviewReason||'';
 try{
  for(const [key,url,alt] of [['photo',row.photoUrl,'الصورة الشخصية'],['front',row.frontUrl,'الوجه الأمامي للبطاقة'],['back',row.backUrl,'الوجه الخلفي للبطاقة']]){
   const response=await fetch(BASE_URL+url,{headers:{Authorization:'Bearer '+getToken()},credentials:'omit'});
   if(!response.ok)throw new Error('تعذر تحميل '+alt+'.');
   const objectUrl=URL.createObjectURL(await response.blob());urls.push(objectUrl);
   const target=modal.querySelector('#fanni-review-'+key);target.innerHTML='';
   const image=document.createElement('img');image.src=objectUrl;image.alt=alt;image.className='mx-auto max-h-[48vh] w-full rounded-lg object-contain';target.appendChild(image);
  }
 }catch(error){showToast(error.message||'تعذر تحميل صور المراجعة.','error');}
 modal.querySelector('#fanni-review-approve').addEventListener('click',async()=>{
  const name=modal.querySelector('#fanni-review-name').value.trim();const nationalId=modal.querySelector('#fanni-review-national-id').value.trim();
  if(name.length<2||nationalId.replace(/[^0-9٠-٩۰-۹]/g,'').length!==14)return showToast('راجع الاسم واكتب الرقم القومي المكوّن من 14 رقمًا.','error');
  if(!confirm('هل قارنت البيانات بصور البطاقة وتريد اعتماد الفني؟'))return;
  try{const result=await tryApi(['/api/admin/fanni-registration-requests/'+encodeURIComponent(id)+'/approve'],{method:'POST',body:JSON.stringify({name,nationalId})});showToast(result.message||'تم اعتماد الفني.');close();await loadAll();}catch(error){showToast(error.message||'تعذرت الموافقة.','error');}
 });
 modal.querySelector('#fanni-review-reject').addEventListener('click',async()=>{
  const reason=prompt('اكتب سبب طلب إعادة رفع صور أوضح:','صورة البطاقة غير واضحة. ارفع صورة أوضح للوجهين بإضاءة جيدة ومن دون اهتزاز.');if(reason===null)return;
  try{const result=await tryApi(['/api/admin/fanni-registration-requests/'+encodeURIComponent(id)+'/reject'],{method:'POST',body:JSON.stringify({reason})});showToast(result.message||'تم طلب إعادة رفع الصور.');close();await loadAll();}catch(error){showToast(error.message||'تعذر إرسال طلب إعادة الرفع.','error');}
 });
}
