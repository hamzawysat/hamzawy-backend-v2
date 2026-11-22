'use strict';

async function removeOffer(sn,idx){if(!confirm('هل تريد إزالة هذا العرض؟'))return; try{await tryApi([`/api/admin/offers/${encodeURIComponent(sn)}/${idx}`],{method:'DELETE'}); showToast('تمت إزالة العرض'); await loadOrders();}catch(e){showToast(e.message);}}


async function rejectOffer(sn,idx){if(!confirm('رفض هذا العرض مع سبب؟'))return; try{await tryApi([`/api/admin/offers/${encodeURIComponent(sn)}/${idx}/reject`],{method:'POST',body:JSON.stringify({reason:'غير مناسب'})}); showToast('تم رفض العرض'); await loadOrders();}catch(e){showToast(e.message);}}

async function openFanniRegistrationReview(id){
 const row=(state.pendingFanniRegistrations||[]).find(item=>String(item._id)===String(id));
 if(!row)return showToast('طلب التسجيل غير موجود. حدّث القائمة وحاول مرة أخرى.','error');
 const existing=document.getElementById('fanni-registration-review-modal');if(existing)existing.remove();
 const modal=document.createElement('div');modal.id='fanni-registration-review-modal';modal.className='fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/80 p-3';
 modal.innerHTML=`<section dir="rtl" class="w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
 <header class="flex items-center justify-between border-b pb-3"><div><h2 class="font-black text-base">مراجعة تسجيل الفني</h2><p class="mt-1 text-xs text-slate-500">راجع البيانات والصور، ثم حدد المطلوب من الفني بدقة.</p></div><button type="button" data-close class="rounded-lg bg-slate-100 px-3 py-2">إغلاق ✕</button></header>
 <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4"><div><p class="mb-2 text-xs font-black">الصورة الشخصية</p><div id="fanni-review-photo" class="rounded-xl bg-slate-50 p-2 text-center text-xs text-slate-500">تحميل...</div></div><div><p class="mb-2 text-xs font-black">وجه البطاقة الأمامي</p><div id="fanni-review-front" class="rounded-xl bg-slate-50 p-2 text-center text-xs text-slate-500">تحميل...</div></div><div><p class="mb-2 text-xs font-black">وجه البطاقة الخلفي</p><div id="fanni-review-back" class="rounded-xl bg-slate-50 p-2 text-center text-xs text-slate-500">تحميل...</div></div></div>
 <div class="grid sm:grid-cols-2 gap-3"><label class="text-xs font-black">الاسم الذي كتبه الفني<input id="fanni-review-name" class="field mt-2" maxlength="50"></label><label class="text-xs font-black">الرقم القومي الذي كتبه الفني<input id="fanni-review-national-id" class="field mt-2" inputmode="numeric" maxlength="14"></label></div>
 <div class="mt-4 rounded-xl border border-slate-200 p-3"><h3 class="font-black text-sm">لو مطلوب تعديل بيانات</h3><p class="mt-1 text-xs text-slate-500">اختار الحقول التي تريد من الفني تعديلها داخل التطبيق.</p><div class="mt-3 grid grid-cols-2 gap-3 text-sm">
 <label class="flex items-center gap-2"><input type="checkbox" data-review-field="name"> الاسم</label>
 <label class="flex items-center gap-2"><input type="checkbox" data-review-field="phone"> رقم الهاتف</label>
 <label class="flex items-center gap-2"><input type="checkbox" data-review-field="specialties"> التخصصات</label>
 <label class="flex items-center gap-2"><input type="checkbox" data-review-field="areas"> مناطق العمل</label>
 </div></div>
 <div class="mt-3 rounded-xl border border-slate-200 p-3"><h3 class="font-black text-sm">لو مطلوب إعادة رفع صور</h3><p class="mt-1 text-xs text-slate-500">اختار صورة واحدة أو أكثر. الفني لن يرى إلا الصور المحددة.</p><div class="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
 <label class="flex items-center gap-2"><input type="checkbox" data-review-image="profile"> الصورة الشخصية</label>
 <label class="flex items-center gap-2"><input type="checkbox" data-review-image="front"> البطاقة – الوجه الأمامي</label>
 <label class="flex items-center gap-2"><input type="checkbox" data-review-image="back"> البطاقة – الوجه الخلفي</label>
 </div></div>
 <label class="mt-3 block text-xs font-black">رسالة الإدارة للفني<textarea id="fanni-review-reason" class="field mt-2 min-h-[100px]" maxlength="500" placeholder="اكتب المطلوب بوضوح، وسيظهر للفني بخط كبير ولون مميز..."></textarea></label>
 <div class="mt-4 grid grid-cols-2 gap-2"><button type="button" id="fanni-review-approve" class="pill-btn primary-pill">موافقة واعتماد</button><button type="button" id="fanni-review-reject" class="pill-btn danger-pill">إرسال المطلوب للفني</button></div></section>`;
 document.body.appendChild(modal);
 const urls=[];const close=()=>{urls.forEach(url=>URL.revokeObjectURL(url));modal.remove();};
 modal.querySelector('[data-close]').addEventListener('click',close);modal.addEventListener('click',event=>{if(event.target===modal)close();});
 modal.querySelector('#fanni-review-name').value=row.name||'';
 modal.querySelector('#fanni-review-national-id').value=row.nationalId||'';
 modal.querySelector('#fanni-review-reason').value=row.identityReviewReason||'';
 const existingFields=Array.isArray(row.identityReviewFields)?row.identityReviewFields:[];
 const existingImages=Array.isArray(row.identityReviewImages)&&row.identityReviewImages.length?row.identityReviewImages:(row.identityReviewImage==='both'?['front','back']:row.identityReviewImage?[row.identityReviewImage]:[]);
 modal.querySelectorAll('[data-review-field]').forEach(input=>{input.checked=existingFields.includes(input.dataset.reviewField);});
 modal.querySelectorAll('[data-review-image]').forEach(input=>{input.checked=existingImages.includes(input.dataset.reviewImage);});
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
  const reason=modal.querySelector('#fanni-review-reason').value.trim();
  const fields=Array.from(modal.querySelectorAll('[data-review-field]:checked')).map(input=>input.dataset.reviewField);
  const images=Array.from(modal.querySelectorAll('[data-review-image]:checked')).map(input=>input.dataset.reviewImage);
  if(!reason)return showToast('اكتب رسالة الإدارة التي ستظهر للفني.','error');
  if(!fields.length&&!images.length)return showToast('حدد حقل بيانات أو صورة واحدة على الأقل.','error');
  if(!confirm('إرسال المطلوب المحدد للفني؟'))return;
  try{const result=await tryApi(['/api/admin/fanni-registration-requests/'+encodeURIComponent(id)+'/reject'],{method:'POST',body:JSON.stringify({reason,fields,images})});showToast(result.message||'تم إرسال المطلوب للفني.');close();await loadAll();}catch(error){showToast(error.message||'تعذر إرسال المطلوب للفني.','error');}
 });
}
