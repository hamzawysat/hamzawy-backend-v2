'use strict';

async function loadFanniCardLedger(){
  if(!getToken())return;
  state.cardLedgerLoading=true;
  state.cardLedgerError='';
  if(state.tab==='fanniCardLedger')render();
  try{
    const data=await tryApi(['/api/admin/fanni-card-ledger'],{method:'GET'});
    state.fanniCardLedger=Array.isArray(data.cards)?data.cards:[];
  }catch(error){
    state.fanniCardLedger=[];
    state.cardLedgerError=error.message||'تعذر تحميل سجل البطاقات الفنيين';
  }finally{
    state.cardLedgerLoading=false;
    if(state.tab==='fanniCardLedger')render();
  }
}

function renderFanniCardLedger(){
  const cards=Array.isArray(state.fanniCardLedger)?state.fanniCardLedger:[];
  return `<section class="mt-4 space-y-3">
    <div class="premium-panel p-4">
      <h2 class="text-sm font-black">سجل البطاقات الفنيين</h2>
      <p class="mt-1 text-xs text-slate-500">سجل مستقل لأسماء الفنيين وأرقام بطاقاتهم، مع محاولات التسجيل المكررة وقرارات الإدارة.</p>
      <div class="mt-3 text-xs font-bold text-slate-600">عدد البطاقات المسجلة: ${cards.length}</div>
    </div>
    ${state.cardLedgerError?`<div class="premium-panel p-4 text-sm font-bold text-red-700">${escHtml(state.cardLedgerError)}</div>`:''}
    ${state.cardLedgerLoading?`<div class="premium-panel p-8 text-center text-sm">جاري تحميل سجل البطاقات...</div>`:''}
    ${!state.cardLedgerLoading&&!cards.length?`<div class="premium-panel p-8 text-center text-sm text-slate-500">لا توجد بطاقات مسجلة حتى الآن.</div>`:''}
    ${cards.map(card=>`
      <article class="premium-card p-4 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div><h3 class="font-black text-sm">${escHtml(card.fanniName||'فني')}</h3><p class="text-xs text-slate-500 mt-1">الاسم المقروء من البطاقة: ${escHtml(card.extractedName||'غير متاح')}</p></div>
          <span class="text-[10px] font-black rounded-full px-3 py-1 ${card.duplicateAttempts?.some(a=>a.status==='قيد مراجعة الأدمن')?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-700'}">${escHtml(card.status||'مسجلة')}</span>
        </div>
        <div class="rounded-xl bg-slate-50 p-3 text-xs"><span class="text-slate-500">رقم البطاقة القومي</span><div class="mt-1 font-black tracking-wider" dir="ltr">${escHtml(card.nationalId||'')}</div></div>
        <div class="text-xs text-slate-500">أول تسجيل: ${card.firstRegisteredAt?new Date(card.firstRegisteredAt).toLocaleString('ar-EG'): '—'}</div>
        ${(card.linkedTechnicians||[]).length>1?`<div class="text-xs font-bold text-slate-700">حسابات مرتبطة بالبطاقة: ${card.linkedTechnicians.map(x=>escHtml(x.name)).join('، ')}</div>`:''}
        ${(card.duplicateAttempts||[]).length?`<div class="border-t pt-3 space-y-2"><h4 class="text-xs font-black">محاولات التسجيل المتكررة</h4>
          ${card.duplicateAttempts.map(attempt=>`
            <div class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <div class="text-xs font-black">${escHtml(attempt.applicantName)} — ${escHtml(attempt.applicantPhone)}</div>
              <div class="text-[10px] text-slate-500">${escHtml(attempt.status)} · ${attempt.createdAt?new Date(attempt.createdAt).toLocaleString('ar-EG'):''}</div>
              ${attempt.status==='قيد مراجعة الأدمن'?`<div class="flex flex-wrap gap-2"><button class="pill-btn primary-pill" onclick="reviewFanniCardAttempt('${card.id}','${attempt.id}','تم السماح بعد المراجعة')">السماح الاستثنائي</button><button class="pill-btn danger-pill" onclick="reviewFanniCardAttempt('${card.id}','${attempt.id}','تكرار مؤكد')">تأكيد التكرار</button></div>`:''}
              ${attempt.reviewNote?`<p class="text-[10px] text-slate-600">${escHtml(attempt.reviewNote)}</p>`:''}
            </div>`).join('')}
        </div>`:''}
      </article>`).join('')}
  </section>`;
}

async function reviewFanniCardAttempt(cardId,attemptId,status){
  const note=prompt('اكتب ملاحظة المراجعة (اختياري):','');
  if(note===null)return;
  if(status==='تكرار مؤكد'&&!confirm('تأكيد أن البطاقة مستخدمة بالفعل؟'))return;
  try{
    await tryApi(['/api/admin/fanni-card-ledger/'+encodeURIComponent(cardId)+'/attempts/'+encodeURIComponent(attemptId)],{method:'PATCH',body:JSON.stringify({status,note})});
    showToast('تم حفظ قرار مراجعة البطاقة','success');
    await loadFanniCardLedger();
  }catch(error){showToast(error.message||'تعذر حفظ قرار المراجعة','error');}
}
