'use strict';

async function loadClients(query=state.clientSearch||'',page=state.clientPage||1){state.clientsLoading=true;state.clientSearch=String(query||'').trim();state.clientPage=Math.max(1,Number(page)||1);if(state.tab==='clients')render();try{const params=new URLSearchParams({page:String(state.clientPage),limit:String(state.clientLimit||25)});if(state.clientSearch)params.set('search',state.clientSearch);if(state.clientStatusFilter==='active')params.set('status','نشط');if(state.clientStatusFilter==='suspended')params.set('status','معلق');const data=await tryApi(['/api/admin/clients?'+params.toString()],{method:'GET'});state.clients=extractList(data,['clients','items']);state.clientTotal=Number(data.total||0);state.clientPages=Number(data.pages||0);state.clientPage=Number(data.page||state.clientPage);applyClientFilter();}catch(e){state.clients=[];state.filteredClients=[];showToast(e.message||'تعذر تحميل العملاء','error');}finally{state.clientsLoading=false;if(state.tab==='clients')render();}}


async function searchClients(){await loadClients(String(document.getElementById('client-search')?.value||'').trim());}


async function openClient(phone){const client=(state.clients||[]).find(item=>String(item.phone||'')===String(phone||''));if(!client||!(client.id||client._id))return showToast('حساب العميل غير موجود في القائمة الحالية','error');return openClientProfile(String(client.id||client._id));}


async function blockClient(phone){if(!phone)return showToast('رقم هاتف العميل غير متاح','error');const reason=prompt('سبب تعليق حساب العميل '+phone+' (مطلوب للتوثيق):','مراجعة إدارية');if(reason===null)return;if(reason.trim().length<2)return showToast('اكتب سببًا واضحًا من حرفين على الأقل','error');if(!confirm('تأكيد تعليق حساب العميل '+phone+'؟ سيُمنع من تسجيل الدخول واستخدام المسارات المحمية.'))return;try{const data=await tryApi([`/api/admin/clients/${encodeURIComponent(phone)}/block`],{method:'POST',body:JSON.stringify({reason:reason.trim()})});showToast(data.message||'تم تعليق حساب العميل');await loadClients(state.clientSearch||'');}catch(e){showToast(e.message||'تعذر تعليق حساب العميل','error');}}


async function unblockClient(phone){if(!phone)return showToast('رقم هاتف العميل غير متاح','error');if(!confirm('إعادة تفعيل حساب العميل '+phone+'؟'))return;try{const data=await tryApi([`/api/admin/clients/${encodeURIComponent(phone)}/unblock`],{method:'POST',body:JSON.stringify({})});showToast(data.message||'تمت إعادة تفعيل حساب العميل');await loadClients(state.clientSearch||'');}catch(e){showToast(e.message||'تعذر إعادة تفعيل حساب العميل','error');}}


async function changeAccountPassword(role,identifier){
 if(!identifier)return showToast('بيانات الحساب غير متاحة','error');
 const label=role==='client'?'العميل':'الفني';
 const newPassword=prompt('اكتب كلمة السر الجديدة لـ'+label+' (8 أحرف على الأقل):');
 if(newPassword===null)return;
 if(newPassword.length<8||newPassword.length>128)return showToast('كلمة السر يجب أن تكون من 8 إلى 128 حرفًا','error');
 const confirmPassword=prompt('أعد كتابة كلمة السر الجديدة للتأكيد:');
 if(confirmPassword===null)return;
 if(newPassword!==confirmPassword)return showToast('كلمتا السر غير متطابقتين','error');
 if(!confirm('تأكيد تغيير كلمة سر '+label+'؟'))return;
 const path=role==='client'?'/api/admin/clients/'+encodeURIComponent(identifier)+'/password':'/api/admin/fannis/'+encodeURIComponent(identifier)+'/password';
 try{
  const data=await tryApi([path],{method:'PATCH',body:JSON.stringify({newPassword,confirmPassword})});
  showToast(data.message||'تم تغيير كلمة السر بنجاح');
 }catch(e){showToast(e.message||'تعذر تغيير كلمة السر','error');}
}


async function deleteRegisteredClient(phone){return showToast('الحذف النهائي متوقف. استخدم أرشفة الحساب من ملف العميل أو قائمة الإجراءات.','error');}


async function noteClient(phone){if(!phone)return showToast('رقم هاتف العميل غير متاح','error');const note=prompt('الملاحظة الداخلية للعميل '+phone+' (حتى 2000 حرف):');if(note===null)return;if(!note.trim())return showToast('اكتب الملاحظة قبل الحفظ','error');try{const data=await tryApi([`/api/admin/clients/${encodeURIComponent(phone)}/note`],{method:'POST',body:JSON.stringify({note:note.trim()})});showToast(data.message||'تم حفظ الملاحظة الداخلية');}catch(e){showToast(e.message||'تعذر حفظ الملاحظة','error');}}



/* Bulk region management and live counters */
