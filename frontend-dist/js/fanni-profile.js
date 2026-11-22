'use strict';

async function submitFanniProfileEdit(payload){
 if(state.editSaving)return null;

 state.editSaving=true;
 state.error='';
 state.success='';
 render();
 toast('جاري إرسال طلب تعديل البيانات للإدارة للمراجعة...','pending');

 let outcome='error';
 let feedback='';
 try{
  const result=await API.updateProfile(payload);
  if(!result||typeof result!=='object'||Array.isArray(result)||result.success===false){
   throw new Error(result?.message||'لم يؤكد الخادم استلام طلب التعديل. حاول مرة أخرى.');
  }

  const updated=extractUser(result);
  if(updated&&typeof updated==='object'&&!Array.isArray(updated)){
   currentUser={...(currentUser||{}),...updated};
   setAuth(getToken(),currentUser);
  }

  state.editProfileMode=false;
  state.error='';
  state.success='';
  feedback=result?.message||result?.data?.message||'تم إرسال طلب التعديل للإدارة للمراجعة';
  outcome='success';
  return result;
 }catch(error){
  feedback=error?.message||'تعذر إرسال طلب تعديل البيانات';
  state.error=feedback;
  return null;
 }finally{
  state.editSaving=false;
  render();
  if(outcome==='success')toast(feedback,'success');
  else if(feedback)toast(feedback,'error');
 }
}


function beginEditProfile(){
 const user=currentUser||getUser()||{};
 state.editPhone=String(user.phone||'');
 state.editAreas=Array.isArray(user.areas)?user.areas.filter(area=>String(area||'').trim()!=='جميع المناطق'):[];
 state.editAreaSearch='';
 state.editSpecialties=Array.isArray(user.specialties)?user.specialties.filter(value=>ALL_SERVICES.includes(String(value||'').trim().replace(/\s+/g,' '))):[];
 state.editProfileMode=true;state.openSpecialtyCategory='';state.error='';state.success='';render();
}
function cancelEditProfile(){state.editProfileMode=false;state.editSaving=false;state.error='';state.success='';render();}
function toggleEditSpecialtyCategory(label){state.openSpecialtyCategory=state.openSpecialtyCategory===label?'':label;render();}
function toggleEditSpecialty(specialty){
 if(state.editSpecialties.includes(specialty))state.editSpecialties=state.editSpecialties.filter(item=>item!==specialty);
 else if(state.editSpecialties.length<20)state.editSpecialties=[...state.editSpecialties,specialty];
 else return toast('يمكنك اختيار 20 تخصصًا كحد أقصى','error');
 render();
}
async function saveProfileChanges(){
 if(state.editSaving)return;

 const phone=String(state.editPhone||'').replace(/\D/g,'');
 if(!/^01[0-9]{9}$/.test(phone)){
  state.error='رقم التليفون لازم يكون 11 رقم ويبدأ بـ 01';
  render();
  return;
 }
 if(!Array.isArray(state.editSpecialties)||!state.editSpecialties.length){
  state.error='اختار تخصصًا واحدًا على الأقل';
  render();
  return;
 }

 const areas=[...new Set((state.editAreas||[]).filter(Boolean))];
 if(!areas.length){
  state.error='اختار منطقة عمل واحدة على الأقل من القائمة';
  render();
  return;
 }

 return submitFanniProfileEdit({
  phone,
  specialties:[...state.editSpecialties],
  areas
 });
}

async function toggleOrderAvailability(){
 if(!getToken()||!currentUser||currentUser.status!=='معتمد')return;
 if(state.availabilitySaving)return;
 const next=currentUser.acceptingOrders===false;
 state.availabilitySaving=true;
 render();
 try{
  const result=await API.availability(next);
  currentUser={...(currentUser||{}),acceptingOrders:result.acceptingOrders!==false};
  setAuth(getToken(),currentUser);
  if(!currentUser.acceptingOrders){state.orders=[];state.filteredOrders=[];state.ordersPagination={page:1,limit:20,total:0,pages:0};}
  else await loadOrders();
  toast(result.message||'تم تحديث حالة استقبال الطلبات.');
 }catch(error){toast(error.message||'تعذر تحديث حالة استقبال الطلبات.','error');}
 finally{state.availabilitySaving=false;render();}
}

async function loadProfile(){
 if(!getToken())return false;

 try{
  const data=await API.profile();
  const user=extractUser(data)||data?.data||data;

  if(user&&typeof user==='object'&&!Array.isArray(user)){
   currentUser={...(currentUser||{}),...user};
   setAuth(getToken(),currentUser);

   if(state.walletBalance===0){
    state.walletBalance=user.walletBalance??user.balance??user.wallet??0;
   }

   render();
   return true;
  }
  return false;
 }catch(e){
  if(e.status===401){
   clearAuth();
   currentUser=null;
   state.tab='login';
   state.error='انتهت جلسة الدخول. سجل دخولك مرة أخرى.';
   render();
  }else{
   log('profile',e);
  }
  return false;
 }
}


function ensureFanniReviewResubmissionState(){
 const user=currentUser||{};
 const id=String(user._id||user.id||'');
 if(state.reviewResubmissionForId===id&&Object.keys(state.reviewResubmissionFields||{}).length)return;
 state.reviewResubmissionForId=id;
 state.reviewResubmissionFields={
  name:String(user.name||''),phone:String(user.phone||''),
  specialties:Array.isArray(user.specialties)?[...user.specialties]:[],
  areas:Array.isArray(user.areas)?[...user.areas]:[]
 };
 state.reviewResubmissionImages={};
 state.reviewResubmissionUploading={};
 state.reviewResubmissionSaving=false;
}

function renderFanniReviewResubmission(){
 const user=currentUser||{};
 if(user.identityReviewStatus!=='needs_resubmission')return '';
 ensureFanniReviewResubmissionState();
 const requestedFields=Array.isArray(user.identityReviewFields)?user.identityReviewFields:[];
 const requestedImages=Array.isArray(user.identityReviewImages)&&user.identityReviewImages.length
  ?user.identityReviewImages
  :(user.identityReviewImage==='both'?['front','back']:user.identityReviewImage?[user.identityReviewImage]:[]);
 const fields=state.reviewResubmissionFields||{};
 const images=state.reviewResubmissionImages||{};
 const serviceOptions=(Array.isArray(ALL_SERVICES)?ALL_SERVICES:[]).map(value=>{
  const name=String(value||'').trim();
  return name?'<option value="'+esc(name)+'" '+(fields.specialties.includes(name)?'selected':'')+'>'+esc(name)+'</option>':'';
 }).join('');
 const areaValues=(Array.isArray(AREA_OPTIONS)?AREA_OPTIONS:[]).map(value=>typeof value==='string'?value:String(value?.name||value?.label||'')).filter(Boolean);
 const areaOptions=areaValues.map(value=>'<option value="'+esc(value)+'" '+(fields.areas.includes(value)?'selected':'')+'>'+esc(value)+'</option>').join('');
 const fieldControls=[
  requestedFields.includes('name')?'<label class="block text-xs font-bold">الاسم بالكامل<input class="field mt-1" maxlength="50" value="'+esc(fields.name||'')+'" oninput="state.reviewResubmissionFields.name=this.value"></label>':'',
  requestedFields.includes('phone')?'<label class="block text-xs font-bold">رقم الهاتف<input class="field mt-1" inputmode="numeric" maxlength="11" value="'+esc(fields.phone||'')+'" oninput="state.reviewResubmissionFields.phone=this.value.replace(/\\D/g,\'\').slice(0,11)"></label>':'',
  requestedFields.includes('specialties')?'<label class="block text-xs font-bold">التخصصات المطلوبة <small class="font-normal text-slate-500">يمكنك اختيار أكثر من تخصص</small><select multiple size="6" class="field mt-1" onchange="state.reviewResubmissionFields.specialties=Array.from(this.selectedOptions).map(option=>option.value)">'+serviceOptions+'</select></label>':'',
  requestedFields.includes('areas')?'<label class="block text-xs font-bold">مناطق العمل <small class="font-normal text-slate-500">يمكنك اختيار أكثر من منطقة</small><select multiple size="6" class="field mt-1" onchange="state.reviewResubmissionFields.areas=Array.from(this.selectedOptions).map(option=>option.value)">'+areaOptions+'</select></label>':''
 ].filter(Boolean).join('');
 const imageLabels={front:'الوجه الأمامي للبطاقة',back:'الوجه الخلفي للبطاقة',profile:'الصورة الشخصية'};
 const imageControls=requestedImages.map(side=>'<label class="block rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold">'+esc(imageLabels[side]||'الصورة المطلوبة')+'<input type="file" accept="image/jpeg,image/png,image/webp" capture="'+(side==='profile'?'user':'environment')+'" class="block w-full mt-2 text-xs" onchange="handleFanniReviewImageUpload(\''+side+'\',this.files?.[0]);this.value=\'\'" '+(state.reviewResubmissionUploading?.[side]?'disabled':'')+'><small class="mt-2 block '+(images[side]?.fileId?'text-emerald-700':'text-slate-500')+'">'+(state.reviewResubmissionUploading?.[side]?'جارٍ رفع الصورة...':images[side]?.fileId?'تم رفع الصورة بنجاح ✓':'لم يتم رفع الصورة المطلوبة بعد')+'</small></label>').join('');
 return '<section class="rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-3"><h3 class="text-sm font-black text-amber-900">مطلوب استكمال بيانات أو صور الحساب</h3><p class="text-xs leading-6 text-amber-800">'+esc(user.identityReviewReason||'يرجى استكمال البنود التي حددتها الإدارة.')+'</p>'+(fieldControls?'<div class="space-y-3">'+fieldControls+'</div>':'')+(imageControls?'<div class="space-y-2"><h4 class="text-xs font-black text-slate-700">الصور المطلوب إعادة رفعها</h4>'+imageControls+'</div>':'')+(!requestedFields.length&&!requestedImages.length?'<p class="text-xs text-red-700">لا توجد بنود محددة. تواصل مع الإدارة لتوضيح المطلوب.</p>':'')+'<button type="button" class="pill-btn primary-pill w-full" onclick="submitFanniReviewResubmission()" '+(state.reviewResubmissionSaving||Object.values(state.reviewResubmissionUploading||{}).some(Boolean)?'disabled':'')+'>'+(state.reviewResubmissionSaving?'جارٍ إرسال التعديلات...':'إرسال التعديلات للمراجعة')+'</button></section>';
}

async function handleFanniReviewImageUpload(side,file){
 if(!file||!['front','back','profile'].includes(side))return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)return toast('اختار صورة JPG أو PNG أو WebP لا تتجاوز 15 ميجابايت.','error');
 ensureFanniReviewResubmissionState();
 state.reviewResubmissionImages[side]={fileId:'',preview:''};
 state.reviewResubmissionUploading[side]=true;render();
 try{
  const optimized=await compressRegistrationIdImage(file);
  const uploaded=await API.uploadRegistrationIdentity(side,optimized);
  if(!uploaded?.fileId)throw new Error('تعذر تأكيد رفع الصورة. حاول مرة أخرى.');
  state.reviewResubmissionImages[side]={fileId:uploaded.fileId,preview:await readRegistrationIdPreview(optimized)};
  toast('تم رفع الصورة المطلوبة بنجاح.','success');
 }catch(error){state.reviewResubmissionImages[side]={fileId:'',preview:''};toast(error.message||'تعذر رفع الصورة.','error');}
 finally{state.reviewResubmissionUploading[side]=false;render();}
}

async function submitFanniReviewResubmission(){
 const user=currentUser||{};
 if(user.identityReviewStatus!=='needs_resubmission')return;
 ensureFanniReviewResubmissionState();
 const requestedFields=Array.isArray(user.identityReviewFields)?user.identityReviewFields:[];
 const requestedImages=Array.isArray(user.identityReviewImages)&&user.identityReviewImages.length?user.identityReviewImages:(user.identityReviewImage==='both'?['front','back']:user.identityReviewImage?[user.identityReviewImage]:[]);
 const current=state.reviewResubmissionFields||{};
 const fields={};
 for(const key of requestedFields){
  if(key==='name')fields.name=String(current.name||'').trim();
  if(key==='phone')fields.phone=String(current.phone||'').replace(/\\D/g,'');
  if(key==='specialties')fields.specialties=Array.isArray(current.specialties)?current.specialties:[];
  if(key==='areas')fields.areas=Array.isArray(current.areas)?current.areas:[];
 }
 const images={};
 for(const side of requestedImages){
  const fileId=state.reviewResubmissionImages?.[side]?.fileId;
  if(!fileId)return toast('ارفع كل الصور التي طلبتها الإدارة أولًا.','error');
  images[side]=fileId;
 }
 if(requestedFields.includes('name')&&fields.name.length<2)return toast('اكتب الاسم بشكل صحيح.','error');
 if(requestedFields.includes('phone')&&!/^01[0-9]{9}$/.test(fields.phone))return toast('اكتب رقم هاتف مصري صحيحًا.','error');
 if(requestedFields.includes('specialties')&&!fields.specialties.length)return toast('اختار تخصصًا واحدًا على الأقل.','error');
 if(requestedFields.includes('areas')&&!fields.areas.length)return toast('اختار منطقة عمل واحدة على الأقل.','error');
 state.reviewResubmissionSaving=true;render();
 try{
  const result=await API.reviewResubmission({fields,images});
  state.reviewResubmissionForId='';state.reviewResubmissionFields={};state.reviewResubmissionImages={};
  toast(result.message||'تم إرسال التعديلات للإدارة. حسابك ما زال قيد المراجعة.','success');
  await loadProfile();
 }catch(error){toast(error.message||'تعذر إرسال التعديلات.','error');}
 finally{state.reviewResubmissionSaving=false;render();}
}
