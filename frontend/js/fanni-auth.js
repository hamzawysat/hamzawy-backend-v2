'use strict';

function errorBox(s){
 return `<p class="text-[12px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3 leading-6">${esc(s)}</p>`;
}

function successBox(s){
 return `<p class="text-[12px] font-bold text-white bg-[#2E86FF] border border-[#2E86FF] rounded-xl p-3">${esc(s)}</p>`;
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
  if(data.mustChangePassword){location.href='password.html?role=fanni&mode=change&support=1';return;}
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

async function compressRegistrationIdImage(file){
 try{
  let bitmap;
  if(typeof createImageBitmap==='function')bitmap=await createImageBitmap(file);
  else{
   const tempUrl=URL.createObjectURL(file);
   try{bitmap=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('تعذر قراءة الصورة'));image.src=tempUrl;});}
   finally{URL.revokeObjectURL(tempUrl);}
  }
  const width=bitmap.width||bitmap.naturalWidth||0,height=bitmap.height||bitmap.naturalHeight||0;
  if(!width||!height)throw new Error('أبعاد الصورة غير صالحة');
  // Normalize camera EXIF orientation and prepare a clear image for private review.
  const scale=Math.min(1.5,2560/Math.max(width,height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d',{alpha:false});
  if(!context)throw new Error('تعذر تجهيز الصورة');
  context.fillStyle='#FFFFFF';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  if(bitmap.close)bitmap.close();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('تعذر ضغط الصورة')),'image/jpeg',0.90));
  return new File([blob],(file.name||'identity').replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:Date.now()});
 }catch(error){console.warn('تعذر ضغط صورة البطاقة، سيتم رفع الأصل:',error);return file;}
}
function readRegistrationIdPreview(file){
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('تعذر تجهيز معاينة الصورة'));reader.readAsDataURL(file);});
}
async function handleRegistrationIdUpload(side,file){
 if(!['front','back'].includes(side)||!file)return;
 const idKey=side==='front'?'regIdFrontFileId':'regIdBackFileId';
 const previewKey=side==='front'?'regIdFrontPreview':'regIdBackPreview';
 const loadingKey=side==='front'?'regIdFrontUploading':'regIdBackUploading';
 const statusKey=side==='front'?'regIdFrontUploadStatus':'regIdBackUploadStatus';
 const validTypes=['image/jpeg','image/png','image/webp'];
 if(!validTypes.includes(file.type)){state[statusKey]='نوع الملف غير مدعوم. اختار صورة JPG أو PNG أو WebP.';toast(state[statusKey],'error');render();return;}
 if(file.size>15*1024*1024){state[statusKey]='حجم الصورة أكبر من 15 ميجابايت. قلّل حجمها أو اختار صورة أخرى.';toast(state[statusKey],'error');render();return;}
 state[idKey]='';state[previewKey]='';state[loadingKey]=true;state[statusKey]='جاري تجهيز الصورة لتقليل وقت الرفع...';state.error='';render();
 try{
  const optimizedFile=await compressRegistrationIdImage(file);
  state[previewKey]=await readRegistrationIdPreview(optimizedFile);
  state[statusKey]='تم تجهيز الصورة، جاري رفعها...';render();
  const result=await API.uploadRegistrationIdentity(side,optimizedFile);
  if(!result?.fileId)throw new Error('لم نتأكد من حفظ الصورة. حاول رفعها مرة أخرى.');
  state[idKey]=result.fileId;state[statusKey]='تم رفع الصورة بنجاح ✓';
  toast(side==='front'?'تم رفع صورة الوجه الأمامي بنجاح':'تم رفع صورة الوجه الخلفي بنجاح','success');
 }catch(e){state[idKey]='';state[statusKey]=e.message||'تعذر رفع الصورة. تحقق من الاتصال وحاول مرة أخرى.';toast(state[statusKey],'error');}
 finally{state[loadingKey]=false;render();}
}
async function handleRegistrationProfilePhotoUpload(file){
 if(!file)return;
 const validTypes=['image/jpeg','image/png','image/webp'];
 if(!validTypes.includes(file.type)){state.regProfilePhotoUploadStatus='نوع الصورة غير مدعوم.';render();return;}
 if(file.size>15*1024*1024){state.regProfilePhotoUploadStatus='حجم الصورة أكبر من 15 ميجابايت.';render();return;}
 state.regProfilePhotoFileId='';state.regProfilePhotoUploading=true;state.regProfilePhotoUploadStatus='جاري تجهيز الصورة الشخصية...';render();
 try{
  const optimized=await compressRegistrationIdImage(file);
  const result=await API.uploadRegistrationIdentity('profile',optimized);
  if(!result?.fileId)throw new Error('لم نتمكن من حفظ الصورة الشخصية.');
  state.regProfilePhotoFileId=result.fileId;state.regProfilePhotoPreview=await readRegistrationIdPreview(optimized);state.regProfilePhotoUploadStatus='تم رفع الصورة الشخصية بنجاح ✓';
  toast('تم رفع الصورة الشخصية بنجاح','success');
 }catch(error){state.regProfilePhotoFileId='';state.regProfilePhotoUploadStatus=error.message||'تعذر رفع الصورة الشخصية.';toast(state.regProfilePhotoUploadStatus,'error');}
 finally{state.regProfilePhotoUploading=false;render();}
}
async function submitFanniIdentityResubmission(){
 const nationalId=String(state.regNationalId||'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\\D/g,'');
 if(nationalId.length!==14||!state.regIdFrontFileId||!state.regIdBackFileId||state.regIdFrontUploading||state.regIdBackUploading)return toast('اكتب الرقم القومي وارفع صورتي البطاقة من الأمام والخلف أولًا.','error');
 try{
  const result=await API.updateIdentityCard({nationalId,identityCardFrontFileId:state.regIdFrontFileId,identityCardBackFileId:state.regIdBackFileId});
  if(typeof currentUser==='object'&&currentUser){currentUser.identityReviewStatus='pending';currentUser.identityReviewReason='';}
  state.regNationalId='';state.regIdFrontFileId='';state.regIdBackFileId='';state.regIdFrontPreview='';state.regIdBackPreview='';
  toast(result.message||'تم إرسال الصور للمراجعة.','success');render();
 }catch(error){toast(error.message||'تعذر إرسال صور البطاقة.','error');}
}
async function handleFanniProfilePhotoChange(file){
 if(!file)return;
 const validTypes=['image/jpeg','image/png','image/webp'];
 if(!validTypes.includes(file.type)||file.size>15*1024*1024)return toast('اختار صورة JPG أو PNG أو WebP لا تتجاوز 15 ميجابايت.','error');
 try{
  const optimized=await compressRegistrationIdImage(file);
  const uploaded=await API.uploadRegistrationIdentity('profile',optimized);
  if(!uploaded?.fileId)throw new Error('تعذر رفع الصورة.');
  const saved=await API.updateProfilePhoto({profilePhotoFileId:uploaded.fileId});
  if(typeof currentUser==='object'&&currentUser)currentUser.profilePhotoUrl=saved.profilePhotoUrl||('/api/fanni/'+String(currentUser._id||currentUser.id)+'/photo?v='+Date.now());
  toast(saved.message||'تم تحديث الصورة الشخصية.','success');render();
 }catch(error){toast(error.message||'تعذر تحديث الصورة الشخصية.','error');}
}
function previewRegistrationIdImage(side){
 const previewKey=side==='front'?'regIdFrontPreview':side==='back'?'regIdBackPreview':'';
 const src=previewKey?state[previewKey]:'';
 if(!src){toast('لا توجد صورة لمعاينتها.','error');return;}
 document.getElementById('registrationIdPreviewModal')?.remove();
 const overlay=document.createElement('div');overlay.id='registrationIdPreviewModal';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label',side==='front'?'معاينة الوجه الأمامي للبطاقة':'معاينة الوجه الخلفي للبطاقة');
 overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.94);display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;';
 const panel=document.createElement('div');panel.style.cssText='width:min(100%,760px);max-height:100%;display:flex;flex-direction:column;gap:12px;align-items:center;';
 const heading=document.createElement('div');heading.textContent=side==='front'?'معاينة الوجه الأمامي للبطاقة':'معاينة الوجه الخلفي للبطاقة';heading.style.cssText='width:100%;color:#fff;text-align:center;font-size:15px;font-weight:800;';
 const close=document.createElement('button');close.type='button';close.textContent='إغلاق المعاينة';close.style.cssText='align-self:flex-end;background:#fff;color:#111827;border:0;border-radius:10px;padding:10px 16px;font-weight:800;';
 const img=document.createElement('img');img.alt=side==='front'?'صورة الوجه الأمامي للبطاقة':'صورة الوجه الخلفي للبطاقة';
 img.src=src;img.style.cssText='display:block;width:auto;height:auto;max-width:100%;max-height:calc(100dvh - 125px);object-fit:contain;border-radius:12px;background:#fff;opacity:1;';
 const error=document.createElement('p');error.textContent='تعذر عرض الصورة. أعد اختيار الصورة وحاول مرة أخرى.';
 error.style.cssText='display:none;color:#fff;font-size:13px;font-weight:700;text-align:center;';
 img.onerror=()=>{img.style.display='none';error.style.display='block';};
 close.addEventListener('click',()=>overlay.remove());overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove();});
 panel.append(heading,close,img,error);overlay.append(panel);document.body.append(overlay);close.focus();
}
function clearRegistrationIdImage(side){
 const idKey=side==='front'?'regIdFrontFileId':'regIdBackFileId';
 const previewKey=side==='front'?'regIdFrontPreview':'regIdBackPreview';
 const statusKey=side==='front'?'regIdFrontUploadStatus':'regIdBackUploadStatus';
 if(state[previewKey]?.startsWith('blob:'))URL.revokeObjectURL(state[previewKey]);
 state[idKey]='';state[previewKey]='';state[statusKey]='تم إزالة الصورة. اختار صورة بديلة.';state.error='';render();
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
 if(!state.regGuidelinesAccepted){state.error='لازم تقرأ ميثاق حمزاوي سات للتعامل المهني وتحدد الموافقة قبل إنشاء الحساب.';render();return}
 const nationalId=String(state.regNationalId||'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\\D/g,'');
 if(nationalId.length!==14){state.error='اكتب الرقم القومي المكوّن من 14 رقمًا.';render();return}
 if(!state.regIdFrontFileId||!state.regIdBackFileId||state.regIdFrontUploading||state.regIdBackUploading){state.error='لازم ترفع صورة البطاقة من الأمام والخلف وتنتظر اكتمال الرفع قبل التسجيل.';render();return}
 if(!state.regProfilePhotoFileId||state.regProfilePhotoUploading){state.error='لازم تلتقط صورتك الشخصية بالكاميرا وتنتظر اكتمال الرفع.';render();return}

 state.loading=true;
 state.error='';
 render({scrollTargetId:'fanniRegistrationCheckingMessage'});

 try{
  const registrationResult = await API.register({
   name:clean(state.regName,50),
   phone:state.regPhone.replace(/\D/g,''),
   password:state.regPass,
   specialties:[...state.regSpecialties],
   areas,
   guidelinesAccepted:state.regGuidelinesAccepted,
   identityCardFrontFileId:state.regIdFrontFileId,
   identityCardBackFileId:state.regIdBackFileId,
   profilePhotoFileId:state.regProfilePhotoFileId,
   nationalId,
   referralCode:(new URLSearchParams(window.location.search).get('ref')||'').slice(0,50)
  });

  state.loading=false;
  state.loginPhone=state.regPhone;
  state.regName='';
  state.regPhone='';
  state.regPass='';
  state.regPassConfirm='';
  state.regGuidelinesAccepted=false;
  state.regIdFrontFileId='';state.regIdBackFileId='';state.regIdFrontPreview='';state.regIdBackPreview='';
  state.regNationalId='';state.regProfilePhotoFileId='';state.regProfilePhotoPreview='';state.regProfilePhotoUploadStatus='';
  state.regSpecialties=[];
  state.regAreas=[];
  state.regAreaSearch='';
  state.regAreaCustom='';
  state.tab='login';
  state.pendingMsg=registrationResult?.message||'تم إنشاء حساب بنجاح. حسابك قيد مراجعة الإدارة.';
  state.error='';

  render({scrollTargetId:'fanniRegistrationPendingMessage'});
  toast('تم التسجيل - الحساب بانتظار مراجعة الإدارة','pending');
 }catch(e){
  state.loading=false;
  state.error=e.message;
  render({scrollTargetId:'fanniRegistrationResult'});
 }
}

