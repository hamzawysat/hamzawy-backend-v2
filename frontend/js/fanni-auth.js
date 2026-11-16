'use strict';

function errorBox(s){
 return `<p class="text-[12px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 leading-6">${esc(s)}</p>`;
}

function successBox(s){
 return `<p class="text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">${esc(s)}</p>`;
}

async function doLogin(){
 if(state.loading)return;

 if(!V.phone(state.loginPhone)){state.error='رقم التليفون غير صحيح';render();return}
 if(!V.text(state.loginPass,1,100)){state.error='اكتب كلمة السر';render();return}

 state.loading=true;
 state.error='';
 state.pendingMsg='';
 render();

 try{
  const data=await API.login({
   phone:state.loginPhone.replace(/\D/g,''),
   password:state.loginPass
  });

  const token=extractToken(data);
  const user=extractUser(data);

  if(!token)throw new Error('تعذر إتمام تسجيل الدخول. حاول مرة أخرى.');
  if(!user)throw new Error('تعذر تحميل بيانات الحساب. حدّث الصفحة وحاول مرة أخرى.');

  // A registration URL may keep ?tab=register after switching to login.
  // Once login succeeds, remove that URL-only gate so the dashboard can render.
  forceTechnicianRegistration=false;
  setAuth(token,user);
  currentUser=user;
  startFanniPolling();
  if(data.mustChangePassword&&!window.IS_EDITOR_PREVIEW){location.href='password.html?role=fanni&mode=change&support=1';return;}
  state.loading=false;
  state.tab='home';
  state.loginPass='';
  render();

  toast('تم تسجيل الدخول بنجاح');
  await loadProfile();
  await Promise.allSettled([loadOrders(),loadMyOffers(),loadWalletHistory(),loadNotifications()]);
 }catch(e){
  state.loading=false;

  if(/pending|review|مراجعة|انتظار|قيد/i.test(e.message)){
   state.pendingMsg='حسابك قيد مراجعة الإدارة.';
  }

  state.error=e.message;
  render();
 }
}

async function handleRegistrationIdUpload(side,file){
 if(!['front','back'].includes(side)||!file)return;
 const validTypes=['image/jpeg','image/png','image/webp'];
 if(!validTypes.includes(file.type)){state.error='صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP.';render();return;}
 if(file.size>5*1024*1024){state.error='حجم الصورة أكبر من 5 ميجابايت. اختار صورة أصغر.';render();return;}
 const idKey=side==='front'?'regIdFrontFileId':'regIdBackFileId';
 const previewKey=side==='front'?'regIdFrontPreview':'regIdBackPreview';
 const loadingKey=side==='front'?'regIdFrontUploading':'regIdBackUploading';
 state[idKey]='';state[previewKey]=URL.createObjectURL(file);state[loadingKey]=true;state.error='';render();
 try{const result=await API.uploadRegistrationIdentity(side,file);if(!result?.fileId)throw new Error('لم نتأكد من حفظ الصورة. حاول رفعها مرة أخرى.');state[idKey]=result.fileId;toast(side==='front'?'تم رفع وجه البطاقة الأمامي':'تم رفع وجه البطاقة الخلفي');}
 catch(e){state[idKey]='';state.error=e.message||'تعذر رفع صورة البطاقة. حاول مرة أخرى.';}
 finally{state[loadingKey]=false;render();}
}
function clearRegistrationIdImage(side){
 const idKey=side==='front'?'regIdFrontFileId':'regIdBackFileId';const previewKey=side==='front'?'regIdFrontPreview':'regIdBackPreview';
 if(state[previewKey]&&state[previewKey].startsWith('blob:'))URL.revokeObjectURL(state[previewKey]);state[idKey]='';state[previewKey]='';state.error='';render();
}

async function doRegister(){
 if(state.loading)return;

 if(!V.text(state.regName,2,50)){state.error='الاسم لازم يكون حرفين على الأقل';render();return}
 if(!V.phone(state.regPhone)){state.error='رقم التليفون غير صحيح';render();return}
 if(SERVICES_LOADING){state.error='جاري تحميل قائمة التخصصات، انتظر لحظة.';render();return}
 if(SERVICES_ERROR){state.error='تعذر تحميل التخصصات: '+SERVICES_ERROR+' - اضغط إعادة المحاولة.';render();return}
 if(!CATEGORIES.length){state.error='قائمة التخصصات غير متاحة حاليًا.';render();return}
 if(!state.regSpecialties.length){state.error='اختار تخصصًا واحدًا على الأقل';render();return}

 const areas=[...new Set((state.regAreas||[]).filter(Boolean))];
 if(!areas.length){state.error='اختار منطقة عمل واحدة على الأقل من القائمة';render();return}
 if(!V.text(state.regPass,6,100)){state.error='كلمة السر لازم تكون 6 أحرف على الأقل';render();return}
 if(state.regPass!==state.regPassConfirm){state.error='تأكيد كلمة السر غير مطابق. اكتب نفس كلمة السر في الخانتين.';render();return}
 if(!state.regGuidelinesAccepted){state.error='لازم تقرأ ميثاق التعامل المهني وتحدد الموافقة قبل إنشاء الحساب.';render();return}
 if(!state.regIdFrontFileId||!state.regIdBackFileId||state.regIdFrontUploading||state.regIdBackUploading){state.error='لازم ترفع صورة البطاقة من الأمام والخلف وتنتظر اكتمال الرفع قبل التسجيل.';render();return}

 state.loading=true;
 state.error='';
 render();

 try{
  await API.register({
   name:clean(state.regName,50),
   phone:state.regPhone.replace(/\D/g,''),
   password:state.regPass,
   specialties:[...state.regSpecialties],
   areas,
   guidelinesAccepted:state.regGuidelinesAccepted,
   identityCardFrontFileId:state.regIdFrontFileId,
   identityCardBackFileId:state.regIdBackFileId
  });

  state.loading=false;
  state.loginPhone=state.regPhone;
  state.regName='';
  state.regPhone='';
  state.regPass='';
  state.regPassConfirm='';
  state.regGuidelinesAccepted=false;
  state.regIdFrontFileId='';state.regIdBackFileId='';state.regIdFrontPreview='';state.regIdBackPreview='';
  state.regSpecialties=[];
  state.regAreas=[];
  state.regAreaSearch='';
  state.regAreaCustom='';
  state.tab='login';
  state.pendingMsg='تم إنشاء حساب بنجاح. حسابك قيد مراجعة الإدارة.';
  state.error='';

  render();
  toast('تم التسجيل - الحساب بانتظار مراجعة الإدارة','pending');
 }catch(e){
  state.loading=false;
  state.error=e.message;
  render();
 }
}

