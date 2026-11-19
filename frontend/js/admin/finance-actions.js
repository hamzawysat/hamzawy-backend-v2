'use strict';

function adminFanniWalletOperationKey(kind, fanniId, amount, reason) {
 const signature=[kind,String(fanniId),String(amount),String(reason||'').trim()].join('|');
 const storageKey='admin-fanni-wallet-op:'+encodeURIComponent(signature);
 try {
  let key=sessionStorage.getItem(storageKey);
  if(!key){key=(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():('afw-'+Date.now()+'-'+Math.random().toString(36).slice(2));sessionStorage.setItem(storageKey,key);}
  return {key,clear:()=>sessionStorage.removeItem(storageKey)};
 } catch (_) {
  const key=(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():('afw-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  return {key,clear:()=>{}};
 }
}

async function loadWalletTransactions(){const fanniId=String(document.getElementById('wallet-fanni')?.value||state.walletSelectedFanniId||'');if(!fanniId)return showToast('اختار الفني الأول','error');state.walletSelectedFanniId=fanniId;state.walletLoading=true;state.walletTransactions=[];render();try{const data=await tryApi([`/api/admin/wallet/transactions/${encodeURIComponent(fanniId)}`],{method:'GET'});state.walletTransactions=extractList(data,['transactions','data','items']);showToast('تم تحميل كشف الحساب الحقيقي');}catch(e){state.walletTransactions=[];showToast(e.message||'تعذر تحميل كشف الحساب','error');}finally{state.walletLoading=false;if(['wallets','fannis'].includes(state.tab))render();}}


async function addWalletBalance(){
 const fanniId=String(document.getElementById('wallet-fanni')?.value||state.walletSelectedFanniId||'');
 if(!fanniId)return showToast('اختار الفني الأول','error');
 const fanni=state.fannis.find(f=>String(f._id)===fanniId);
 const raw=prompt('اكتب مبلغ الرصيد المراد إضافته إلى محفظة '+(fanni?.name||'الفني')+' بالجنيه:','100');
 if(raw===null)return;
 const amount=Number(raw);
 if(raw.trim()===''||!Number.isFinite(amount)||amount<=0)return showToast('اكتب مبلغًا صحيحًا أكبر من صفر','error');
 const reason=prompt('سبب إضافة الرصيد (مطلوب للتوثيق):','إضافة رصيد إدارية');
 if(reason===null)return;
 if(!reason.trim())return showToast('اكتب سبب الإضافة','error');
 const operation=adminFanniWalletOperationKey('credit',fanniId,amount,reason);
 if(!confirm('تأكيد إضافة '+amount+' جنيه إلى محفظة '+(fanni?.name||'الفني')+'؟'))return;
 try{
  const data=await tryApi([`/api/admin/fannis/${encodeURIComponent(fanniId)}/add-balance`],{method:'POST',body:JSON.stringify({amount,reason:reason.trim(),idempotencyKey:operation.key})});
  operation.clear();
  showToast((data.message||'تمت إضافة الرصيد وتسجيل الحركة المالية')+(data.transactionNumber?' · رقم العملية: '+data.transactionNumber:''));
  await loadAll();
  await loadWalletTransactions();
 }catch(e){showToast(e.message||'تعذرت إضافة الرصيد','error');}
}

async function freezeWallet(){const fanniId=String(document.getElementById('wallet-fanni')?.value||state.walletSelectedFanniId||'');if(!fanniId)return showToast('اختار الفني الأول','error');const fanni=state.fannis.find(f=>String(f._id)===fanniId);const action=fanni?.isFrozen?'unfreeze':'freeze';const reason=prompt(action==='freeze'?'سبب تجميد المحفظة (مطلوب للتوثيق):':'سبب إلغاء تجميد المحفظة:','مراجعة إدارية');if(reason===null)return;if(!reason.trim())return showToast('اكتب سبب الإجراء','error');if(!confirm(action==='freeze'?'تأكيد تجميد محفظة هذا الفني؟':'تأكيد إلغاء تجميد المحفظة؟'))return;try{const data=await tryApi([`/api/admin/wallet/freeze/${encodeURIComponent(fanniId)}`],{method:'POST',body:JSON.stringify({action,reason:reason.trim()})});showToast(data.message||'تم تنفيذ الإجراء');await loadAll();await loadWalletTransactions();}catch(e){showToast(e.message||'تعذر تحديث حالة المحفظة','error');}}


async function adjustWallet(){const fanniId=String(document.getElementById('wallet-fanni')?.value||state.walletSelectedFanniId||'');if(!fanniId)return showToast('اختار الفني الأول','error');const fanni=state.fannis.find(f=>String(f._id)===fanniId);const current=Number(fanni?.walletBalance??fanni?.balance??0);const raw=prompt(`الرصيد الحالي ${current} جنيه. اكتب الرصيد الجديد بعد التسوية:` ,String(current));if(raw===null)return;const amount=Number(raw);if(raw.trim()===''||!Number.isFinite(amount)||amount<0)return showToast('اكتب رصيدًا صحيحًا غير سالب','error');const reason=prompt('سبب التسوية (مطلوب للتوثيق):','تسوية إدارية');if(reason===null)return;if(!reason.trim())return showToast('اكتب سبب التسوية','error');const operation=adminFanniWalletOperationKey('settlement',fanniId,amount,reason);if(!confirm(`تأكيد تغيير الرصيد من ${current} إلى ${amount} جنيه؟`))return;try{const data=await tryApi([`/api/admin/fannis/${encodeURIComponent(fanniId)}/set-balance`],{method:'POST',body:JSON.stringify({amount,reason:reason.trim(),idempotencyKey:operation.key})});operation.clear();showToast((data.message||'تمت التسوية وتسجيل الحركة المالية')+(data.transactionNumber?' · رقم العملية: '+data.transactionNumber:''));await loadAll();await loadWalletTransactions();}catch(e){showToast(e.message||'تعذرت تسوية الرصيد','error');}}


async function deductWalletBalance(){
 const fanniId=String(state.walletSelectedFanniId||'');
 if(!fanniId)return showToast('اختار الفني أولًا','error');
 const fanni=state.fannis.find(item=>String(item._id)===fanniId);
 const raw=prompt('اكتب مبلغ الخصم من محفظة '+(fanni?.name||'الفني')+' بالجنيه:','100');
 if(raw===null)return;
 const amount=Number(raw);
 if(raw.trim()===''||!Number.isInteger(amount)||amount<=0)return showToast('اكتب مبلغًا صحيحًا أكبر من صفر','error');
 const reason=prompt('سبب الخصم الإداري (مطلوب للتوثيق):','تسوية إدارية');
 if(reason===null)return;
 if(reason.trim().length<2)return showToast('اكتب سببًا واضحًا للخصم','error');
 const operation=adminFanniWalletOperationKey('debit',fanniId,amount,reason);
 if(!confirm('تأكيد خصم '+amount+' جنيه من محفظة '+(fanni?.name||'الفني')+'؟ لن يتم الخصم إذا كان الرصيد غير كافٍ.'))return;
 try{
  const data=await tryApi([`/api/admin/fannis/${encodeURIComponent(fanniId)}/deduct-balance`],{method:'POST',body:JSON.stringify({amount,reason:reason.trim(),idempotencyKey:operation.key})});
  operation.clear();
  showToast((data.message||'تم خصم الرصيد وتسجيل الحركة المالية')+(data.transactionNumber?' · رقم العملية: '+data.transactionNumber:''),'success');
  await loadAll();
  state.walletSelectedFanniId=fanniId;
  await loadWalletTransactions();
 }catch(e){showToast(e.message||'تعذر خصم الرصيد','error');}
}
