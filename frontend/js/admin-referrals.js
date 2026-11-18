'use strict';

async function loadReferralManagement(){
 state.referralsLoading=true;
 try{
  const query=new URLSearchParams();if(state.referralFrom)query.set('from',state.referralFrom);if(state.referralTo)query.set('to',state.referralTo);
  const [summary,list]=await Promise.all([
   tryApi(['/api/referrals/admin/summary'],{method:'GET'}),
   tryApi(['/api/referrals/admin/list'+(query.toString()?'?'+query.toString():'')],{method:'GET'})
  ]);
  state.referralSummary=summary;
  state.referrals=Array.isArray(list.referrals)?list.referrals:[];
  state.referralsError='';
 }catch(error){state.referralsError=error.message||'تعذر تحميل الدعوات';}
 finally{state.referralsLoading=false;if(state.tab==='referrals')render();}
}
async function toggleReferralSystem(enabled){
 if(!confirm(enabled?'تأكيد تشغيل نظام الدعوات؟':'تأكيد إيقاف إنشاء الدعوات الجديدة؟ الدعوات المسجلة ستواصل الاستحقاق والصرف.'))return;
 try{
  const result=await tryApi(['/api/referrals/admin/settings'],{method:'PATCH',body:JSON.stringify({enabled})});
  if(state.referralSummary)state.referralSummary.enabled=result.enabled;
  showToast(result.enabled?'تم تشغيل نظام الدعوات':'تم إيقاف الدعوات الجديدة مع استمرار الدعوات القديمة','success');
  await loadReferralManagement();
 }catch(error){showToast(error.message||'تعذر تغيير حالة النظام','error');}
}
function filteredReferralRows(){
 const q=String(state.referralSearch||'').trim().toLowerCase();
 return (state.referrals||[]).filter(x=>{
  if(state.referralKind!=='all'&&x.kind!==state.referralKind)return false;
  if(state.referralStatus!=='all'&&x.status!==state.referralStatus)return false;
  if(state.referralPaid==='yes'&&(!x.inviterReward?.paidAt||!x.inviteeReward?.paidAt))return false;
  if(state.referralPaid==='no'&&(x.inviterReward?.paidAt&&x.inviteeReward?.paidAt))return false;
  if(!q)return true;
  return [x.number,x.inviterData?.name,x.inviterData?.phone,x.inviter,x.inviteeData?.name,x.inviteeData?.phone,x.invitee].some(v=>String(v||'').toLowerCase().includes(q));
 });
}
function exportReferralReport(){const rows=filteredReferralRows();const header=['رقم الدعوة','النوع','الداعي','معرف الداعي','المدعو','معرف المدعو','تاريخ الدعوة','الحالة','الإنجاز','المطلوب','مكافأة الداعي','تاريخ صرف الداعي','مكافأة المدعو','تاريخ صرف المدعو'];const quote=v=>{let value=String(v??'');if(/^[=+\-@]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';};const data=rows.map(x=>[x.number,x.kind==='client'?'عميل':'فني',x.inviterData?.name,x.inviterData?.id||x.inviter,x.inviteeData?.name,x.inviteeData?.id||x.invitee,x.invitedAt,referralStatusLabel(x.status),x.completedCount,x.requiredCount,(x.inviterReward?.paidAt?x.inviterReward.amount:(x.kind==='fanni'?150:50)),x.inviterReward?.paidAt||'',(x.inviteeReward?.paidAt?x.inviteeReward.amount:(x.kind==='fanni'?150:50)),x.inviteeReward?.paidAt||'']);const csv='\uFEFF'+[header,...data].map(row=>row.map(quote).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='hamzawy-referral-rewards.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast('تم تجهيز تقرير الدعوات للتنزيل','success');}
function referralStatusLabel(s){return ({pending:'معلقة',in_progress:'قيد التقدم',eligible:'مستحقة',completed:'مكتملة',rejected:'مرفوضة'})[s]||s||'—';}
async function openReferralDetails(id){try{state.referralDetail=await tryApi(['/api/referrals/admin/'+encodeURIComponent(id)],{method:'GET'});render();}catch(error){showToast(error.message||'تعذر تحميل تفاصيل الدعوة','error');}}
function closeReferralDetails(){state.referralDetail=null;render();}
function renderReferralManagement(){
 const s=state.referralSummary||{};
 const rows=filteredReferralRows();
 const paidClient=(s.rewards||[]).find(x=>x._id==='client')||{};
 const paidFanni=(s.rewards||[]).find(x=>x._id==='fanni')||{};
 const paidClientTotal=Number(paidClient.inviterPaid||0)+Number(paidClient.inviteePaid||0);
 const paidFanniTotal=Number(paidFanni.inviterPaid||0)+Number(paidFanni.inviteePaid||0);
 const paidTotal=paidClientTotal+paidFanniTotal;
 const dueTotal=Number(paidClient.inviterDue||0)+Number(paidClient.inviteeDue||0)+Number(paidFanni.inviterDue||0)+Number(paidFanni.inviteeDue||0);
 return `<section class="mt-4 space-y-3">
  <div class="premium-panel p-4">
   <div class="flex items-center justify-between gap-3"><div><h2 class="text-base font-black">إدارة الدعوات والمكافآت</h2><p class="mt-1 text-[11px] text-slate-500">مراجعة الدعوات ومتابعة استحقاق وصرف المكافآت للطرفين</p></div><span class="rounded-full px-3 py-1 text-[10px] font-extrabold ${s.enabled?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}">${s.enabled?'النظام يعمل':'الدعوات الجديدة متوقفة'}</span></div>
   <div class="mt-3 flex items-center justify-between gap-3 rounded-xl border p-3"><div><p class="text-xs font-extrabold">تشغيل نظام الدعوات</p><p class="mt-1 text-[10px] text-slate-500">الإيقاف يمنع الدعوات الجديدة فقط ولا يوقف الدعوات السابقة</p></div><button type="button" onclick="toggleReferralSystem(${!s.enabled})" class="rounded-xl px-4 py-2.5 text-xs font-extrabold text-white ${s.enabled?'bg-rose-700':'bg-emerald-700'}">${s.enabled?'إيقاف':'تشغيل'}</button></div>
  </div>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
   ${[['إجمالي الدعوات',s.total||0],['دعوات العملاء',s.clients||0],['دعوات الفنيين',s.technicians||0],['مكافآت العملاء المصروفة',paidClientTotal+' ج'],['مكافآت الفنيين المصروفة',paidFanniTotal+' ج'],['إجمالي المكافآت المصروفة',paidTotal+' ج'],['المكافآت المستحقة',dueTotal+' ج'],['دعوات معلقة',(s.statuses||{}).pending||0],['قيد التقدم',(s.statuses||{}).in_progress||0],['مستحقة',(s.statuses||{}).eligible||0],['مكتملة',(s.statuses||{}).completed||0],['مرفوضة',(s.statuses||{}).rejected||0]].map(([label,value])=>'<article class="premium-panel p-3"><p class="text-[10px] font-bold text-slate-500">'+label+'</p><p class="mt-1 text-xl font-black">'+value+'</p></article>').join('')}
  </div>
  <div class="premium-panel p-3 space-y-2">
   <h3 class="text-sm font-black">سجل الدعوات</h3>
   <input class="field" placeholder="بحث بالاسم أو المعرف أو رقم الدعوة" value="${escHtml(state.referralSearch||'')}" oninput="state.referralSearch=this.value;render()">
   <div class="grid grid-cols-3 gap-2">
    <select class="field" onchange="state.referralKind=this.value;render()"><option value="all">كل الأنواع</option><option value="client" ${state.referralKind==='client'?'selected':''}>عملاء</option><option value="fanni" ${state.referralKind==='fanni'?'selected':''}>فنيون</option></select>
    <select class="field" onchange="state.referralStatus=this.value;render()"><option value="all">كل الحالات</option><option value="pending">معلقة</option><option value="in_progress">قيد التقدم</option><option value="eligible">مستحقة</option><option value="completed">مكتملة</option><option value="rejected">مرفوضة</option></select>
    <select class="field" onchange="state.referralPaid=this.value;render()"><option value="all">كل عمليات الصرف</option><option value="yes">تم الصرف للطرفين</option><option value="no">لم يكتمل الصرف</option></select>
   </div>
   <div class="grid grid-cols-2 gap-2"><label class="text-[10px] font-bold text-slate-600">من تاريخ<input type="date" class="field mt-1" value="${escHtml(state.referralFrom||'')}" onchange="state.referralFrom=this.value;loadReferralManagement()"></label><label class="text-[10px] font-bold text-slate-600">إلى تاريخ<input type="date" class="field mt-1" value="${escHtml(state.referralTo||'')}" onchange="state.referralTo=this.value;loadReferralManagement()"></label></div>
    ${state.referralsLoading?'<p class="p-5 text-center text-xs">جاري تحميل الدعوات...</p>':state.referralsError?'<p class="rounded-xl bg-red-50 p-3 text-xs text-red-700">'+escHtml(state.referralsError)+'</p>':rows.length?'<div class="overflow-x-auto"><table class="w-full min-w-[680px] text-right text-[11px]"><thead><tr class="border-b text-slate-500"><th class="p-2">رقم الدعوة</th><th class="p-2">النوع</th><th class="p-2">تاريخ الدعوة</th><th class="p-2">الداعي</th><th class="p-2">المدعو</th><th class="p-2">الإنجاز</th><th class="p-2">الحالة</th><th class="p-2">مكافأة الداعي</th><th class="p-2">مكافأة المدعو</th><th class="p-2">إجراء</th></tr></thead><tbody>'+rows.map(x=>'<tr class="border-b align-top"><td class="p-2 font-black">'+escHtml(x.number)+'</td><td class="p-2">'+(x.kind==='client'?'عميل':'فني')+'</td><td class="p-2">'+new Date(x.invitedAt).toLocaleDateString('ar-EG')+'</td><td class="p-2">'+escHtml(x.inviterData?.name||x.inviter)+'<small class="block text-slate-500">'+escHtml(x.inviterData?.id||x.inviter)+'</small></td><td class="p-2">'+escHtml(x.inviteeData?.name||x.invitee)+'<small class="block text-slate-500">'+escHtml(x.inviteeData?.id||x.invitee)+'</small></td><td class="p-2">'+Number(x.completedCount||0)+' / '+Number(x.requiredCount||0)+'</td><td class="p-2">'+referralStatusLabel(x.status)+'</td><td class="p-2">'+Number(x.inviterReward?.paidAt?x.inviterReward.amount:(x.kind==='fanni'?150:50))+' ج — '+(x.inviterReward?.paidAt?'صُرف '+new Date(x.inviterReward.paidAt).toLocaleDateString('ar-EG'):'لم يصرف')+'</td><td class="p-2">'+Number(x.inviteeReward?.paidAt?x.inviteeReward.amount:(x.kind==='fanni'?150:50))+' ج — '+(x.inviteeReward?.paidAt?'صُرف '+new Date(x.inviteeReward.paidAt).toLocaleDateString('ar-EG'):'لم يصرف')+'</td><td class="p-2"><button type="button" data-id="'+escHtml(x._id)+'" onclick="openReferralDetails(this.dataset.id)" class="mb-1 rounded-lg border px-2 py-1.5 font-bold">تفاصيل</button> '+(x.status!=='completed'&&x.status!=='rejected'&&!x.inviterReward?.paidAt&&!x.inviteeReward?.paidAt?'<button type="button" data-id="'+escHtml(x._id)+'" onclick="rejectReferral(this.dataset.id)" class="rounded-lg bg-rose-50 px-2 py-1.5 font-bold text-rose-700">رفض</button>':'—')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="p-5 text-center text-xs text-slate-500">لا توجد دعوات مطابقة.</p>'}
   ${state.referralDetail?.referral?`<div class="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/60 p-3" onclick="if(event.target===this)closeReferralDetails()"><section class="max-h-[85vh] w-full max-w-[620px] overflow-y-auto rounded-2xl bg-white p-4 text-right shadow-2xl"><div class="flex items-center justify-between gap-3"><h3 class="text-base font-black">تفاصيل الدعوة ${escHtml(state.referralDetail.referral.number)}</h3><button type="button" onclick="closeReferralDetails()" class="rounded-lg border px-3 py-2 text-xs font-bold">إغلاق</button></div><div class="mt-3 grid grid-cols-2 gap-2 text-xs"><div class="rounded-xl bg-slate-50 p-3"><b>الداعي</b><p>${escHtml(state.referralDetail.inviter?.name||'—')}</p><p>${escHtml(state.referralDetail.inviter?.phone||'')}</p></div><div class="rounded-xl bg-slate-50 p-3"><b>المدعو</b><p>${escHtml(state.referralDetail.invitee?.name||'—')}</p><p>${escHtml(state.referralDetail.invitee?.phone||'')}</p></div></div><p class="mt-3 text-xs font-bold">الحالة: ${referralStatusLabel(state.referralDetail.referral.status)} — الإنجاز: ${Number(state.referralDetail.referral.completedCount||0)} / ${Number(state.referralDetail.referral.requiredCount||0)}</p><h4 class="mt-4 text-sm font-black">سجل الإنجازات</h4><div class="mt-2 space-y-2">${(state.referralDetail.referral.achievementLog||[]).map(a=>'<div class="rounded-lg border p-2 text-xs">'+escHtml(a.orderSN||'')+' — '+new Date(a.completedAt).toLocaleString('ar-EG')+'</div>').join('')}</div><h4 class="mt-4 text-sm font-black">حركات المحفظة</h4><div class="mt-2 space-y-2">${(state.referralDetail.transactions||[]).map(t=>'<div class="rounded-lg border p-2 text-xs">'+escHtml(t.description)+' — '+Number(t.amount||0)+' جنيه — '+new Date(t.createdAt).toLocaleString('ar-EG')+'</div>').join('')}</div></section></div>`:''}
   <div class="grid grid-cols-2 gap-2"><button type="button" onclick="loadReferralManagement()" class="rounded-xl border bg-white p-2.5 text-xs font-extrabold">تحديث القائمة</button><button type="button" onclick="exportReferralReport()" class="rounded-xl bg-slate-900 p-2.5 text-xs font-extrabold text-white">تصدير تقرير CSV</button></div>
  </div>
 </section>`;
}
async function rejectReferral(id){
 const reason=prompt('اكتب سبب رفض الدعوة (إجباري):');
 if(reason===null)return;
 if(reason.trim().length<3)return showToast('سبب الرفض لازم يكون 3 أحرف على الأقل','error');
 if(!confirm('تأكيد رفض الدعوة؟ لن يمكن صرف مكافآتها بعد الرفض.'))return;
 try{await tryApi(['/api/referrals/admin/'+encodeURIComponent(id)+'/reject'],{method:'POST',body:JSON.stringify({reason:reason.trim()})});showToast('تم رفض الدعوة وتسجيل السبب','success');await loadReferralManagement();}
 catch(error){showToast(error.message||'تعذر رفض الدعوة','error');}
}
