try{if(document && !document.getElementById('no-yellow-style')){var s=document.createElement('style');s.id='no-yellow-style';s.textContent='.no-yellow-btn:active,.no-yellow-btn:focus{background:#FFFFFF!important;color:#2E7CF6!important;box-shadow:none!important}';document.head.appendChild(s);}}catch(e){}

// login-shrink-fix: تصغير صفحة الدخول 12% بالـ JS مش بالـ HTML
try{
  if(document && !document.getElementById('login-shrink2')){
    var s=document.createElement('style'); s.id='login-shrink2';
    s.textContent='.login-shrink{zoom:.88!important;transform-origin:top center!important}.login-shrink img{max-height:84px!important}';
    document.head.appendChild(s);
  }
}catch(e){}
'use strict';

function renderContent(){
  const isBrowserDashboard=!window.ReactNativeWebView&&!navigator.standalone&&!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)&&!/;\s*wv\)/i.test(navigator.userAgent||'');
  const user=currentUser||getUser();
  const specialties=Array.isArray(user?.specialties)?user.specialties:[];
  const areas=Array.isArray(user?.areas)?user.areas:[];
  const authenticated=!!getToken()&&!forceTechnicianRegistration;
 document.title=authenticated?'لوحة الفني | حمزاوي سات':(state.tab==='register'?'تسجيل فني جديد | لوحة الفني':'تسجيل دخول الفني | حمزاوي سات');
 const balance=state.walletBalance||user?.walletBalance||user?.balance||user?.wallet||0;
 const approved=isApproved();
 const status=user?.status||'غير محدد';
 const guidelinesAccepted=Boolean(user?.technicianGuidelinesAcceptedAt&&user?.technicianGuidelinesVersion==='2026-10-20-v1');
 if(authenticated && approved && !guidelinesAccepted){document.getElementById('app').innerHTML='<main class="mx-auto max-w-[680px] p-4"><section class="panel p-5 space-y-3"><h1 class="text-xl font-black">ميثاق حمزاوي سات للتعامل المهني مع العملاء</h1><p class="text-sm leading-7">اقرأ التعليمات التالية ووافق عليها قبل استخدام لوحة الفني.</p><div class="max-h-[55vh] overflow-y-auto rounded-xl border p-4 text-sm leading-7"><p>١. التزم بسعر العرض الذي وافق عليه العميل. أي زيادة تحتاج موافقة صريحة مسجلة داخل المنصة قبل التنفيذ.</p><p>٢. تعامل باحترام وصدق، دون ضغط أو تهديد أو تضليل.</p><p>٣. قبل قبول العرض، الردود المسموحة «نعم»، «لا»، «حسب الاتفاق». ممنوع تبادل بيانات الاتصال أو التحايل على المنصة قبل القبول.</p><p>٤. لا تضغط إنهاء المهمة إلا بعد إنجازها فعلًا.</p><p>٥. احمِ بيانات العميل ولا تستخدمها خارج الطلب.</p><p>٦. يحق للطرفين التقييم بعد الإكمال؛ ممنوع الإكراه على تقييم إيجابي أو التلاعب بالتقييمات.</p><p>٧. المخالفات قد تؤدي إلى مراجعة الطلب أو تعليق الحساب أو إيقافه.</p><p class="font-extrabold">بالضغط على الموافقة، تؤكد أنك قرأت التعليمات وفهمتها وتتعهد بالالتزام بها أثناء استخدام منصة حمزاوي سات.</p></div><label class="flex gap-2 items-start text-sm font-bold"><input id="guidelinesAcceptedCheck" type="checkbox" class="mt-1"> قرأت ميثاق حمزاوي سات للتعامل المهني وأوافق على الالتزام به.</label><button type="button" onclick="if(!document.getElementById(\'guidelinesAcceptedCheck\')?.checked){toast(\'لازم تحدد الموافقة أولًا.\',\'error\');return;}acceptTechnicianGuidelines()" class="primary-btn w-full h-12 rounded-xl font-extrabold">موافق ثم تأكيد</button></section></main>';return;}

 if(fanniReferralPageOpen&&authenticated){document.title='دعوات الفني | حمزاوي سات';document.getElementById('app').innerHTML='<main dir="rtl" class="mx-auto min-h-screen w-full max-w-[680px] px-4 py-5"><button type="button" onclick="closeFanniReferralPage()" class="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 shadow-sm">← رجوع للرئيسية</button><section class="space-y-3"><h1 class="text-lg font-black text-slate-900">دعوة فني واكسب 150 جنيه مكافأة</h1>'+(renderFanniReferralCard()||'<div class="rounded-2xl border border-[#D5DDFE] bg-[#EEF2FF] p-4 text-sm font-bold text-[#2E7CF6]">جاري تحميل بيانات الدعوة...</div>')+'</section></main>';return;}
 document.getElementById('app').innerHTML=`
 
  <div class="${isBrowserDashboard?'dashboard-top-shell sticky top-0 z-50':'dashboard-top-shell'}">
 <style>.fanni-home-availability-toggle.is-available{background:#E8F5E9!important;color:#1B7A2E!important;border:1px solid #4CAF50!important}.fanni-home-availability-toggle.is-paused{background:#FFEBEE!important;color:#D32F2F!important;border:1px solid #EF5350!important}.fanni-home-availability-toggle.is-available strong{color:#1B7A2E!important;-webkit-text-fill-color:#1B7A2E!important}.fanni-home-availability-toggle.is-paused strong{color:#D32F2F!important;-webkit-text-fill-color:#D32F2F!important}</style><style>[class*="online"],[class*="avail"],[class*="toggle"]{background:#E8F5E9!important;color:#1B7A2E!important;border:1px solid #4CAF50!important}[class*="online"].offline,[class*="avail"].offline,[class*="toggle"].offline,[class*="online"].off,[class*="avail"].off{background:#FFEBEE!important;color:#D32F2F!important;border:1px solid #EF5350!important}</style><style>#sonaa-web-push-enable{display:none!important}</style><header class="bg-white">
  <div class="mx-auto w-full max-w-[640px] px-4 pt-2 pb-1 flex items-center justify-center gap-2" style="direction:rtl;position:relative">
    <div class="h-8 w-8 flex items-center justify-center shrink-0" style="color:#2E7CF6;font-weight:900;font-size:18px;position:absolute;right:16px;top:50%;transform:translateY(-50%)">${esc(String(t?.name||"ف").trim().charAt(0)||"ف")}</div>
    <div class="brand-mark h-10 w-10 rounded-lg flex items-center justify-center shrink-0"><img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" alt="شعار حمزاوي سات" style="width:100%;height:100%;object-fit:contain"></div>
    <span class="font-extrabold text-[20px] leading-none" style="color:#2E7CF6">حمزاوي سات</span>
  </div>
  <div class="mx-auto w-full max-w-[640px] px-4 py-2 flex items-center justify-between gap-2" style="border-top:1px solid #EEF2FF">
    <div class="flex items-center gap-1.5 shrink-0"><button type="button" onclick="toggleNotifications()" aria-label="الاشعارات" title="الاشعارات" class="relative h-9 w-9 flex items-center justify-center shrink-0" style="color:#94A3B8;font-size:24px;line-height:1">🔔${notificationBadge()}</button><a href="/" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8EDFF;color:#2E7CF6;border:1px solid #D5DDFE">القائمة الرئيسية</a><a href="/download" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8F5E9;color:#1B7A2E;border:1px solid #C8E6C9">تحميل التطبيق</a></div><div class="flex items-center gap-1 min-w-0"><span class="font-extrabold text-[17px] leading-none whitespace-nowrap" style="color:#2E7CF6">لوحة الفني</span><span aria-hidden="true" style="color:#2E7CF6;font-size:20px">🛰️</span></div>
  </div>
</header>
<style>nav.fanni-browser-bottom-nav button.fanni-section-tab.is-active, nav button.fanni-section-tab.is-active{background:#FFFFFF!important;background-image:none!important;box-shadow:none!important;color:#2E7CF6!important;border:0!important}.fanni-section-tab.is-active{background:#FFFFFF!important;background-image:none!important;box-shadow:none!important;color:#2E7CF6!important;border:0!important}.fanni-section-tab{background:transparent!important;border:0!important;box-shadow:none!important}</style><nav class="${isBrowserDashboard?'fanni-dashboard-tabs fanni-browser-bottom-nav border-t border-slate-200 bg-white/95 backdrop-blur-xl shadow-sm safe-bottom':'fixed bottom-0 inset-x-0 z-30 border-t bg-white/95 backdrop-blur-xl safe-bottom'}">
   <div class="mx-auto max-w-[680px] px-1 h-[70px] grid grid-cols-5 gap-0.5">
    ${authenticated?[{id:'home',icon:'⌂',label:'الرئيسية'},{id:'store',icon:'🛍️',label:'المتجر'},{id:'wallet',icon:'💳',label:'المحفظة'},{id:'myOrders',icon:'📋',label:'الطلبات'},{id:'profile',icon:'👤',label:'حسابي'}].map(t=>{return `<button type="button" onclick="openTechnicianSection('${t.id}')" class="fanni-section-tab ${state.tab===t.id?'is-active':''}"><span class="fanni-section-tab-icon">${t.icon}</span><span class="fanni-section-tab-label">${t.label}</span></button>`}).join(''):`<button onclick="setTab('login')">🔑<span class="block text-[10px]">دخول</span></button><button onclick="setTab('register')">📝<span class="block text-[10px]">تسجيل</span></button><button onclick="goClient()">👥<span class="block text-[10px]">عميل</span></button><button onclick="setTab('register')">🧑‍🔧<span class="block text-[10px]">فني</span></button>`}
       
   </div>
  </nav>
  </div>
  ${notificationPanel()}

 ${renderFanniPublicContent()}<main class="mx-auto max-w-[680px] px-3 fanni-browser-main ${isBrowserDashboard?'pb-8':'pb-[160px]'}">
 ${!authenticated?`
  <section class="account-gate fanni-login-gate mt-0 px-4 py-4 flex flex-col items-center justify-start" style="background:#EEF2FF;min-height:100svh;min-height:100dvh;padding-top:max(1rem,env(safe-area-inset-top));padding-bottom:max(1rem,env(safe-area-inset-bottom));width:100%;margin-inline:auto;box-sizing:border-box"><style>header.bg-white{display:none!important}nav.fanni-browser-bottom-nav{display:none!important}html,body{overflow-x:hidden!important}main.fanni-browser-main{margin-inline:auto!important;max-width:440px!important;padding-inline:0!important;box-sizing:border-box!important}section.account-gate{margin-inline:auto!important;max-width:440px!important;width:100%!important;box-sizing:border-box!important;overflow-x:hidden!important}section.account-gate>div{margin-inline:auto!important;max-width:100%!important;box-sizing:border-box!important}section.account-gate .account-panel{margin-inline:auto!important;max-width:100%!important;box-sizing:border-box!important;transform:none!important}</style>
   <div class="w-full max-w-[440px] mx-auto" style="margin-top:auto;margin-bottom:auto;margin-inline:auto">
    <div class="flex w-full justify-between mb-4"><button type="button" onclick="window.location.href='/'" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#2E7CF6] text-[15px] font-extrabold no-yellow-btn" style="background:#FFFFFF!important;color:#2E7CF6!important">‹ الصفحة الرئيسية</button><button type="button" onclick="goBack()" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#2E7CF6] text-[15px] font-extrabold">رجوع ›</button></div>
    
    <div class="text-center mb-3">
     <div class="mx-auto w-[68px] h-[68px] rounded-[28px] bg-white border border-slate-200 flex items-center justify-center shadow-sm p-3"><img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" alt="شعار حمزاوي سات" style="width:100%;height:100%;object-fit:contain"></div>
     <h1 class="mt-2 text-[24px] font-black" style="color:#2E7CF6">حمزاوي سات</h1>
     <p class="mt-1 text-[15px] font-bold text-slate-500">خدماتك وشغلك... في مكان واحد</p>
     <div class="mt-4"><span class="inline-block px-4 py-1.5 rounded-full bg-[#E8EDFF] text-[#2E7CF6] text-[14px] font-extrabold">حساب فني</span></div>
     <h2 class="mt-2 text-[18px] font-black leading-7" style="color:#2E7CF6">${state.tab==='register'?'تسجيل فني جديد':'أهلاً بيك يا فني حمزاوي سات'}</h2>
     <p class="mt-1 text-[14px] text-slate-500">${state.tab==='register'?'أنشئ حسابك وابدأ استقبال الطلبات':'سجّل دخولك وتابع فرص الشغل المتاحة ليك.'}</p>
    </div>
    <section class="fanni-login-panel account-panel mt-2 panel p-4 animate-fade" style="border-radius:28px;width:100%;margin-inline:auto;box-sizing:border-box">
     <div class="account-tabs fanni-login-tabs flex justify-center gap-2" style="padding:0!important;margin:0 0 20px!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;display:${state.tab==='register'?'flex':'none'}!important">
       <button type="button" onclick="setTab(state.tab==='register'?'login':'register')" class="account-switch-link h-9 px-4 rounded-full bg-[#F4F6FF] border border-dashed border-[#D5DDFE] text-[#2E7CF6] text-[12px] font-black inline-flex items-center justify-center gap-1.5 hover:bg-[#E8EDFF] transition-colors" style="width:auto!important;min-height:36px!important;height:36px!important;display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding:6px 16px!important;border:1px dashed #D5DDFE!important;border-radius:9999px!important;background:#F4F6FF!important;background-image:none!important;color:#2E7CF6!important;-webkit-text-fill-color:#2E7CF6!important;box-shadow:none!important;font-size:12px!important;font-weight:900!important;white-space:nowrap!important" aria-label="${state.tab==='register'?'تسجيل الدخول':'تسجيل فني جديد'}"><span style="color:#2E7CF6!important;-webkit-text-fill-color:#2E7CF6!important;background:transparent!important;background-image:none!important">${state.tab==='register'?'لتسجيل الدخول':'لتسجيل فني جديد'}</span><small style="color:#2E7CF6!important;-webkit-text-fill-color:#2E7CF6!important;background:transparent!important;background-image:none!important;font-size:10px!important;font-weight:700!important;text-decoration:underline dashed;text-underline-offset:2px">اضغط هنا</small></button>
      </div>
  ${state.tab==='register'?`
   <div class="space-y-4">
    ${new URLSearchParams(window.location.search).get('ref')?'<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-bold text-emerald-800">تم فتح تسجيل الفني من خلال دعوة. أكمل التسجيل لتفعيل الدعوة.</div>':''}
    <div><label class="field-label">الاسم بالكامل *</label><input id="fanniRegName" class="field" autocomplete="name" enterkeyhint="next" value="${esc(state.regName)}" oninput="state.regName=this.value.slice(0,50)" placeholder="الاسم بالكامل"></div>
    <div><label class="field-label">رقم التليفون *</label><input id="fanniRegPhone" class="field" inputmode="numeric" autocomplete="tel" enterkeyhint="next" value="${esc(state.regPhone)}" oninput="state.regPhone=this.value.replace(/\\D/g,'').slice(0,11)" placeholder="01xxxxxxxxx"></div>

    <div class="rounded-2xl border p-3">
     <div class="font-extrabold text-[12px] mb-3">التخصصات * ${SERVICES_LOADING?'<span class="text-[#18324F] 600">(جاري التحميل...)</span>':SERVICES_ERROR?'<span class="text-red-600">(فشل التحميل)</span>':''}</div>
     ${SERVICES_LOADING?`
       <div class="py-6 text-center"><div class="inline-block h-6 w-6 border-2 border-[#D5DDFE] 600 border-t-transparent rounded-full animate-spin"></div><p class="mt-2 text-[11px] font-bold text-slate-600">جاري تحميل التخصصات...</p></div>
     `:SERVICES_ERROR?`
       <div class="rounded-xl bg-red-50 border border-red-200 p-3 text-center"><p class="text-[11px] font-bold text-red-700">${esc(SERVICES_ERROR)}</p><button onclick="loadServices()" class="mt-2 secondary-btn px-4 py-2 text-[11px]">إعادة المحاولة</button><p class="mt-2 text-[10px] text-slate-500">إذا لم تظهر التخصصات، اضغط على إعادة المحاولة.</p></div>
     `:CATEGORIES.map((cat,index)=>{
      const selectedCount=cat.services.filter(s=>state.regSpecialties.includes(s)).length;
      const categoryId='specialty-category-'+index;
      const isOpen=state.openSpecialtyCategory===cat.label;
      return `<section class="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
       <button type="button" onclick="toggleSpecialtyCategory(this.dataset.category)" data-category="${esc(cat.label)}" aria-expanded="${isOpen}" aria-controls="${categoryId}" class="fanni-specialty-category-head flex w-full items-center justify-between gap-3 p-3 text-right">
        <span class="min-w-0"><span class="block text-[12px] font-extrabold text-slate-800">${esc(cat.emoji)} ${esc(cat.label)}</span><span class="mt-1 block text-[10px] font-bold text-slate-500">${selectedCount?'تم اختيار '+selectedCount+' خدمة':'اضغط لعرض الخدمات'}</span></span>
        <span class="flex shrink-0 items-center gap-2"><span class="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-extrabold text-[#18324F] 800">${selectedCount}</span><span class="text-slate-500">${isOpen?'−':'+'}</span></span>
       </button>
       ${isOpen?`<div id="${categoryId}" class="fanni-specialty-options grid grid-cols-3 gap-2 border-t p-3 max-[380px]:grid-cols-2">${cat.services.map(s=>`<label class="service-chip ${state.regSpecialties.includes(s)?'selected':''}"><input type="checkbox" data-specialty="${esc(s)}" ${state.regSpecialties.includes(s)?'checked':''} onchange="toggleSpecialty(this.dataset.specialty)"><span class="service-icon" aria-hidden="true">${serviceIconFor(s)}</span><span>${esc(s)}</span></label>`).join('')}</div>`:''}
      </section>`;
     }).join('')}
    </div>

    <div>
      <label class="field-label">مناطق العمل *</label>
      <p class="mb-2 text-[10px] text-slate-500">ابحث عن المناطق اللي تقدر تشتغل فيها واختار كل المناطق المناسبة.</p>
      ${renderFanniAreaPicker(state.regAreas,state.regAreaSearch,'regAreaSearchInput','onRegAreaSearch','toggleRegArea')}
     </div>
    <div><label class="field-label">كلمة السر *</label><input id="fanniRegPassword" type="password" class="field" autocomplete="new-password" enterkeyhint="next" value="${esc(state.regPass)}" oninput="state.regPass=this.value.slice(0,100)" placeholder="6 أحرف على الأقل"></div>
    <div><label class="field-label">تأكيد كلمة السر *</label><input id="fanniRegPasswordConfirm" type="password" class="field" autocomplete="new-password" enterkeyhint="go" value="${esc(state.regPassConfirm)}" oninput="state.regPassConfirm=this.value.slice(0,100)" placeholder="اكتب كلمة السر مرة تانية"><p class="text-[10px] text-slate-500 mt-1">لازم تكون مطابقة لكلمة السر الأولى.</p></div>

    <section class="rounded-2xl border border-blue-200 bg-blue-50/60 p-3 space-y-3">
     <div><h2 class="font-extrabold text-sm text-slate-900">صورة بطاقة الرقم القومي *</h2><p class="mt-1 text-[11px] leading-5 text-slate-600">ارفع صورة واضحة للوجه الأمامي والخلفي. الصورتان مطلوبتان ولن يتم إنشاء الحساب بدونهما، وسيتم حفظهما بشكل خاص لمراجعة الإدارة.</p></div>
     ${[['front','الوجه الأمامي','regIdFrontPreview','regIdFrontFileId','regIdFrontUploading','regIdFrontUploadStatus'],['back','الوجه الخلفي','regIdBackPreview','regIdBackFileId','regIdBackUploading','regIdBackUploadStatus']].map(([side,label,previewKey,fileKey,loadingKey,statusKey])=>`<div class="rounded-xl border border-slate-200 bg-white p-3 space-y-2"><div class="flex items-center justify-between gap-2"><span class="text-xs font-extrabold text-slate-800">${label}</span><span class="text-[10px] font-bold ${state[fileKey]?'text-emerald-700':state[loadingKey]?'text-blue-700':'text-red-600'}">${state[fileKey]?'تم الرفع ✓':state[loadingKey]?'جاري الرفع...':'مطلوب'}</span></div>${state[previewKey]?`<img src="${esc(state[previewKey])}" alt="معاينة ${label}" class="max-h-40 w-full rounded-lg object-contain bg-slate-50">`:''}<div class="grid grid-cols-2 gap-2"><label class="cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-2 py-2.5 text-center text-xs font-extrabold text-blue-800">${state[fileKey]?'اختيار من المعرض مرة أخرى':'اختيار من المعرض'}<input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" ${state[loadingKey]||state.loading?'disabled':''} onchange="handleRegistrationIdUpload('${side}',this.files?.[0]);this.value=''"></label><label class="cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2.5 text-center text-xs font-extrabold text-emerald-800">📷 التقاط بالكاميرا<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" class="hidden" ${state[loadingKey]||state.loading?'disabled':''} onchange="handleRegistrationIdUpload('${side}',this.files?.[0]);this.value=''"></label></div><div class="flex items-center gap-2">${state[previewKey]?`<button type="button" class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800" onclick="previewRegistrationIdImage('${side}')">معاينة الصورة</button><button type="button" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700" onclick="clearRegistrationIdImage('${side}')">إزالة</button>`:''}</div><p class="text-[11px] font-bold ${state[fileKey]?'text-emerald-700':state[loadingKey]?'text-blue-700':'text-slate-600'}" role="status" aria-live="polite">${state[loadingKey]?'جاري رفع الصورة، من فضلك انتظر...':(state[statusKey]|| (state[fileKey]?'تم رفع الصورة بنجاح.':'لم يتم رفع الصورة بعد.'))}</p></div>`).join('')}
     <p class="text-[10px] leading-5 text-slate-500">الصيغ المقبولة: JPG وPNG وWebP — الحد الأقصى 15 ميجابايت لكل صورة.</p>
    </section>

    <section class="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-3">
     <h2 class="font-extrabold text-sm text-slate-900">ميثاق حمزاوي سات للتعامل المهني مع العملاء</h2>
     <p class="text-xs leading-6 text-slate-700">اقرأ الميثاق التالي قبل إنشاء حسابك. الموافقة مطلوبة لإتمام التسجيل.</p>
     <div class="max-h-52 overflow-y-auto rounded-xl border border-amber-200 bg-white p-3 text-xs leading-6 space-y-2">
      <p>١. التزم بسعر العرض الذي وافق عليه العميل. أي زيادة تحتاج موافقة صريحة مسجلة داخل المنصة قبل التنفيذ.</p>
      <p>٢. تعامل باحترام وصدق، دون ضغط أو تهديد أو تضليل.</p>
      <p>٣. قبل قبول العرض، الردود المسموحة «نعم»، «لا»، «حسب الاتفاق». ممنوع تبادل بيانات الاتصال أو التحايل على المنصة قبل القبول.</p>
      <p>٤. لا تضغط إنهاء المهمة إلا بعد إنجازها فعلًا.</p>
      <p>٥. احمِ بيانات العميل ولا تستخدمها خارج الطلب.</p>
      <p>٦. يحق للطرفين التقييم بعد الإكمال؛ ممنوع الإكراه على تقييم إيجابي أو التلاعب بالتقييمات.</p>
      <p>٧. المخالفات قد تؤدي إلى مراجعة الطلب أو تعليق الحساب أو إيقافه.</p>
     </div>
     <label class="flex items-start gap-2 text-xs font-bold leading-6 text-slate-800"><input type="checkbox" class="mt-1 shrink-0" ${state.regGuidelinesAccepted?'checked':''} onchange="state.regGuidelinesAccepted=this.checked"> قرأت ميثاق حمزاوي سات للتعامل المهني وفهمته وأوافق على الالتزام به.</label>
    </section>
    <button onclick="doRegister()" ${state.loading||SERVICES_LOADING?'disabled':''} class="primary-btn w-full h-12">${state.loading?'جاري إنشاء الحساب...':SERVICES_LOADING?'جاري تحميل التخصصات...':'إنشاء حساب فني'}</button>
    ${state.error?errorBox(state.error):''}
   </div>`:`
   <div class="space-y-4">
    <div><label class="field-label" style="color:#2E7CF6;text-align:left;display:block">رقم الهاتف</label><input id="fanniLoginPhone" class="field" type="tel" inputmode="numeric" enterkeyhint="next" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('fanniLoginPassword')?.focus()}" autocomplete="tel" value="${esc(state.loginPhone)}" oninput="state.loginPhone=this.value.replace(/\\D/g,'').slice(0,11)" placeholder="01xxxxxxxxx"></div>
    <div><label class="field-label" style="text-align:left;display:block">كلمة السر</label><input id="fanniLoginPassword" type="password" class="field" enterkeyhint="go" onkeydown="if(event.key==='Enter'){event.preventDefault();doLogin()}" autocomplete="current-password" value="${esc(state.loginPass)}" oninput="state.loginPass=this.value" placeholder="اكتب كلمة السر"></div>
     
    <div class="mt-1 text-left"><a class="text-[15px] font-extrabold" style="color:#2E7CF6" href="password.html?role=fanni&mode=recovery">نسيت كلمة السر؟ استعادة</a></div>
    <button type="button" onclick="doLogin()" ${state.loading?'disabled':''} class="w-full h-[56px] rounded-2xl text-[20px] font-black shadow-lg" style="background:#2E7CF6!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;border:1px solid #2E7CF6!important">${state.loading?'جاري تسجيل الدخول...':'تسجيل الدخول'}</button>
    <button type="button" onclick="setTab('register')" class="w-full h-[56px] rounded-2xl text-[18px] font-black" style="background:#EEF2FF!important;color:#2E7CF6!important;-webkit-text-fill-color:#2E7CF6!important;border:1px solid #D5DDFE!important">إنشاء حساب فني جديد</button>
    ${state.pendingMsg?`<div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center text-[12px] font-bold text-amber-800">${esc(state.pendingMsg)}</div>`:''}
    ${state.error?errorBox(state.error):''}
    ${state.tab==='login'?'<p class="mt-4 text-center text-[14px] leading-5 text-slate-500">بياناتك وحسابك في أمان</p>':''}
    ${state.tab==='login'?'<div class="mt-3 flex gap-2"><a href="/download" class="flex-1 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black text-white" style="background:#2E7CF6!important;color:#FFFFFF!important">⬇ تحميل التطبيق</a><a href="/links" target="_blank" rel="noopener noreferrer" class="flex-1 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black" style="background:#EEF2FF!important;color:#2E7CF6!important;border:1px solid #D5DDFE!important">🔗 منصات التواصل</a></div>':''}
   </div>`}
  </section>
   </div>
  </section>
 `:`
  ${state.tab==='home'?`
    <section class="fanni-home-dashboard mt-4 space-y-3" aria-labelledby="fanniHomeTitle">
      <div class="fanni-home-profile px-1 py-2" style="background:#F5F5F7">
        <div class="fanni-home-profile-top">
          <div class="fanni-home-profile-avatar" aria-hidden="true"><span>✦</span><b>${esc(String(user?.name||'فني').trim().charAt(0)||'ف')}</b></div>
          <div class="fanni-home-profile-name">
            <h2 id="fanniHomeTitle">مرحباً ${esc(user?.name||'بك')}</h2>
            <p>${esc(user?.level||'مبتدئ')} • ${approved?'معتمد':esc(status)} • ${esc(balance)} جنيه</p>
          </div>
          <button type="button" onclick="toggleOrderAvailability()" ${state.availabilitySaving||!approved?'disabled':''} class="fanni-home-availability-toggle ${user?.acceptingOrders===false?'is-paused':'is-available'}">
            <strong>${state.availabilitySaving?'جارٍ التحديث...':user?.acceptingOrders===false?'● OFF · غير متصل الآن':'● ON · متصل الآن'}</strong>
            <small>${user?.acceptingOrders===false?'اضغط للتفعيل':'اضغط للإيقاف'}</small>
          </button>
        </div>
      </div>
      ${user?.acceptingOrders===false?'<div class="fanni-home-offline-note"><span>⚠️</span><span>أنت غير متصل ولن تستقبل طلبات جديدة. فعّل ON لاستقبال الطلبات.</span></div>':''}

      <button type="button" onclick="setTab('available')" class="fanni-home-jobs-banner w-full" style="background:#2E74E0!important;background-image:none!important;color:#FFFFFF!important;border-radius:24px;padding:20px 16px">
        <span class="fanni-home-jobs-icon">💼</span>
        <span><strong style="color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">فرص عمل متاحة</strong><small style="color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">استكشف الطلبات المتاحة، واختَر المناسب لك وقدّم عرضك</small><em style="background:#FFFFFF;color:#2E7CF6;border-radius:12px;padding:8px 16px;display:inline-block;margin-top:12px">استكشف الفرص ←</em></span>
      </button>

      <div class="fanni-home-section-head" style="text-align:right;margin:16px 0 12px"><h3 style="color:#0A1030;font-size:24px;font-weight:900;line-height:1.2">الإحصائيات</h3></div>
      <div class="fanni-home-stats">
        <button type="button" onclick="setTab('wallet')" class="fanni-home-stat-card">
          <span class="fanni-home-stat-icon" style="background:#E0E7FF;border-radius:9999px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:22px">💳</span><small style="color:#6B7280">رصيد المحفظة</small><strong data-home-stat="wallet">${Number(balance||0).toLocaleString('ar-EG')} ج</strong>
        </button>
        <button type="button" onclick="setTab('available')" class="fanni-home-stat-card">
          <span class="fanni-home-stat-icon" style="background:#E0E7FF;border-radius:9999px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:22px">💼</span><small style="color:#6B7280">فرص متاحة</small><strong data-home-stat="available">${state.filteredOrders.length}</strong>
        </button>
        <button type="button" onclick="setTab('myOrders');setMyOrdersView('completed')" class="fanni-home-stat-card">
          <span class="fanni-home-stat-icon" style="background:#E0E7FF;border-radius:9999px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:22px">✓</span><small style="color:#6B7280">مهام مكتملة</small><strong data-home-stat="completed">${state.completedOffers.length}</strong>
        </button>
        <button type="button" onclick="setTab('myOffers')" class="fanni-home-stat-card">
          <span class="fanni-home-stat-icon" style="background:#E0E7FF;border-radius:9999px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:22px">📄</span><small style="color:#6B7280">عروضي</small><strong data-home-stat="offers">${state.myOffers.length}</strong>
        </button>
      </div>

      <style>@keyframes referralGlow{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(10,30,165,0.35)}50%{transform:scale(1.03);box-shadow:0 0 0 8px rgba(10,30,165,0.12),0 0 22px rgba(10,30,165,0.35)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(10,30,165,0.35)}}</style><button type="button" onclick="openFanniReferralPage()" class="fanni-home-referral w-full" style="background:#DCE6FF!important;animation:referralGlow 2s ease-in-out infinite;border-radius:16px;padding:14px">
        <span class="fanni-home-referral-icon">🎁</span>
        <span><strong style="color:#0A1030">ادعُ صديقك واربح 150 جنيه مكافأة</strong><small>شارك رابط الدعوة واكسب رصيد لكل صديق ينضم</small></span>
        <b style="background:#2470E0!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;border-radius:12px;padding:10px 16px;white-space:nowrap">دعوة الآن ←</b>
      </button>

      <div class="fanni-home-section-head" style="text-align:right;margin:16px 0 12px"><h3 style="color:#0A1030;font-size:24px;font-weight:900;line-height:1.2">إجراءات سريعة</h3></div>
      <div class="fanni-home-actions">
        <button type="button" onclick="setTab('myOrders');setMyOrdersView('completed')" class="fanni-home-action"><span>📋</span><strong>سجل المهام</strong><i>‹</i></button>
        <button type="button" onclick="setTab('myOffers')" class="fanni-home-action"><span>📊</span><strong>التقارير</strong><i>‹</i></button>
        <button type="button" onclick="setTab('profile')" class="fanni-home-action"><span>⚙️</span><strong>الإعدادات</strong><i>‹</i></button>
        <button type="button" onclick="openTechnicianSection('support')" class="fanni-home-action"><span>🎧</span><strong>طلب دعم فني</strong><i>‹</i></button>
      </div>
      ${!approved?`<div class="fanni-home-review-note">حسابك ${esc(status)}. تقدر تراجع بياناتك، وإرسال العروض وشحن المحفظة متاحان بعد اعتماد الإدارة.</div>`:''}
    </section>`:''}
  ${state.tab==='myOrders'?`<div class="mt-3 panel p-2 grid grid-cols-2 gap-2"><button type="button" onclick="setMyOrdersView('active')" class="fanni-orders-view-tab ${state.myOrdersView==='active'?'is-active':''}">العروض الجارية (${state.myOffers.length})</button><button type="button" onclick="setMyOrdersView('completed')" class="fanni-orders-view-tab ${state.myOrdersView==='completed'?'is-active':''}">المهام المكتملة (${state.completedOffers.length})</button></div>`:''}

  ${state.tab==='available'?`
   <section class="mt-4 space-y-3">
    ${user?.acceptingOrders===false?'<div class="panel border border-amber-300 bg-amber-50 p-5 text-center"><p class="text-[14px] font-black text-amber-900">استقبال الطلبات الجديدة متوقف</p><p class="mt-2 text-[12px] leading-6 text-amber-800">فعّل استلام الطلبات عشان تقدر تشوف الطلبات الجديدة وتقدم عروضك.</p><button type="button" onclick="toggleOrderAvailability()" class="mt-3 rounded-xl bg-emerald-700 px-5 py-2.5 text-[12px] font-extrabold text-white">تفعيل استلام الطلبات</button></div>':''}

    <div class="flex justify-between items-center px-1"><h3 class="section-title">الطلبات المتاحة</h3></div>

    <div class="panel p-3 space-y-2">
      <input class="field" value="${esc(state.search)}" oninput="onSearch(this.value)" placeholder="ابحث بكود الطلب أو المنطقة">
      <select class="field" onchange="onFilterSkill(this.value)">
        <option>الكل</option>
        ${SERVICES_LOADING?`<option disabled>جاري تحميل الخدمات...</option>`:
          SERVICES_ERROR?`<option disabled>تعذر تحميل الخدمات</option>`:
          ALL_SERVICES.map(s=>`<option ${state.filterSkill===s?'selected':''}>${esc(s)}</option>`).join('')}
      </select>
      ${SERVICES_ERROR?`<div class="rounded-xl bg-red-50 border border-red-200 p-2 flex justify-between items-center"><span class="text-[11px] text-red-700 font-bold">${esc(SERVICES_ERROR)}</span><button onclick="loadServices()" class="secondary-btn px-3 py-1 text-[10px]">إعادة المحاولة</button></div>`:''}
    </div>

    ${state.loading?'<div class="panel p-6 text-center text-[12px]">جاري تحميل الطلبات...</div>':''}
    ${!state.loading&&!state.filteredOrders.length?'<div class="empty-state panel p-8 text-center" role="status"><div class="text-3xl">📋</div><p class="text-[13px] font-extrabold mt-3">لا توجد طلبات متاحة حاليًا</p><p class="text-[11px] text-slate-500 mt-1">سيتم إشعارك عند وجود طلبات جديدة.</p><button type="button" onclick="loadOrders()" class="secondary-btn mt-4 px-5 py-2 text-[11px]">تحديث الطلبات</button></div>':''}

    ${state.filteredOrders.map(o=>{
      const sn=o.sn||o.orderSn||'';
      return `<article class="panel p-4 space-y-3">
       <div class="flex justify-between items-start gap-3">
        <div class="min-w-0"><span class="font-black text-[11px] bg-[#2E7CF6] text-white px-2.5 py-1 rounded-lg">${esc(sn||'بدون كود')}</span><span class="text-[10px] px-2.5 py-1 rounded-full bg-[#E8EDFF] border text-[#18324F] 700 font-extrabold">${esc(o.service||o.specialty||'')}</span></div>
        <span class="text-[10px] rounded-full bg-emerald-50 px-2 py-1">${esc(o.status||'جديد')}</span>
       </div>

       <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div class="text-[10px] font-extrabold text-slate-500 mb-1">منطقة الخدمة</div>
        <p class="text-[12px] font-bold text-slate-800">📍 ${esc(o.area||'غير محددة')}</p>
        <p class="text-[10px] text-slate-500 mt-2">بيانات التواصل والعنوان التفصيلي غير متاحة قبل قبول العميل للعرض.</p>
       </div>
       <div class="rounded-xl border border-amber-100 bg-amber-50 p-3"><div class="text-[10px] font-extrabold text-amber-900 mb-2">تقييم العميل وسجل أعماله</div><div class="flex flex-wrap gap-2 text-[10px] font-extrabold"><span class="rounded-full border border-amber-200 bg-white px-2 py-1 text-amber-800">★ ${Number(o.clientRatingAverage||0).toFixed(1)} (${Number(o.clientRatingCount||0)} تقييم)</span><span class="rounded-full border border-emerald-200 bg-white px-2 py-1 text-emerald-800">✓ ${Number(o.clientCompletedJobs||0)} عمل مكتمل</span></div></div>

       ${String(o.budget??'').trim()?`<div class="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 break-words">💰 ميزانية العميل: ${esc(String(o.budget).slice(0,50))}</div>`:''}

       <div class="rounded-xl border border-slate-100 p-3">
        <div class="text-[10px] font-extrabold text-slate-500 mb-1">وصف الطلب</div>
        <p class="text-[12px] bg-slate-50 rounded-xl leading-6 break-words">${esc(String(o.description||o.desc||'بدون وصف').slice(0,180))}</p>${o.hasVoiceRecording?`<button type="button" onclick="playOrderVoice('${esc(sn)}',this)" class="mt-2 rounded-xl bg-blue-700 px-3 py-2 text-[11px] text-white">🎙️ تشغيل التسجيل الصوتي</button>`:''}
       </div>

       ${hasSubmittedOffer(sn)
        ? '<div class="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-center text-[12px] font-extrabold text-amber-800">✓ تم تقديم عرضك على هذا الطلب — في انتظار رد العميل</div>'
        : `<button data-sn="${esc(sn)}" onclick="openOffer(this.dataset.sn)" ${!approved?'disabled':''} class="primary-btn w-full h-11 text-[12px]">${approved?'تقديم عرض لهذا الطلب':'العروض بعد اعتماد الحساب'}</button>`}
      </article>`;
    }).join('')}
    ${state.ordersPagination?.page<state.ordersPagination?.pages?`<button type="button" onclick="loadOrders(${Number(state.ordersPagination.page)+1},true)" ${state.loading?'disabled':''} class="secondary-btn w-full py-3 text-[12px]">${state.loading?'جاري تحميل المزيد...':'تحميل 20 طلبًا إضافيًا'}</button>`:''}
   </section>`:''}

  ${state.tab==='myOrders'&&state.myOrdersView==='active'?`
   <section class="mt-4 space-y-3">
    <div class="flex justify-between items-center"><h3 class="section-title">عروضي</h3></div>

    ${!state.myOffers.length?'<div class="empty-state panel p-8 text-center" role="status"><div class="text-3xl">💼</div><p class="text-[13px] font-extrabold mt-3">لا توجد طلبات جارية حاليا</p><p class="text-[11px] text-slate-500 mt-1">ستظهر هنا الطلبات التي قدمت عليها عروضًا أو تم قبولها.</p><button type="button" onclick="loadMyOffers()" class="secondary-btn mt-4 px-5 py-2 text-[11px]">تحديث الطلبات الجارية</button></div>':state.myOffers.map(o=>`<article class="panel p-4 space-y-3">
     <div class="flex justify-between gap-3">
      <div><div class="text-[10px] text-slate-500">كود الطلب</div><b class="font-mono text-[12px]">${esc(o.orderSn||o.sn||o.order?.sn||'')}</b></div>
      <div><div class="text-[10px] text-slate-500">سعر عرضك</div><b class="text-[#18324F] 700">${esc(o.price??o.priceNum??'غير متاح')} جنيه</b></div>
     </div>

     <div class="flex flex-wrap items-center gap-2">
      <span class="text-[10px] rounded-full px-3 py-1 font-extrabold ${o?.accepted===true?'bg-emerald-50 text-emerald-800 border border-emerald-100':'bg-amber-50 text-amber-800 border border-amber-100'}">${o?.accepted===true?'تم قبول عرضك':'بانتظار قرار العميل'}</span>
      <span class="text-[10px] rounded-full bg-slate-100 text-slate-700 px-3 py-1">${esc(o.orderStatus||o.status||'حالة غير محددة')}</span>
      ${o.service?`<span class="text-[10px] rounded-full bg-[#E8EDFF] text-[#18324F] 800 px-3 py-1">${esc(o.service)}</span>`:''}
     </div>

     ${o.message?`<div class="rounded-xl border border-slate-100 bg-slate-50 p-3"><div class="text-[10px] text-slate-500 font-extrabold mb-1">رسالة العرض</div><p class="text-[12px] leading-6 break-words">${esc(o.message)}</p></div>`:''}

     ${renderAcceptedClient(o)}
     ${o?.accepted===true ? `<button type="button" onclick="document.getElementById('fanni-accepted-chat-${esc(o.orderSn||o.sn||o.order?.sn||'')}')?.scrollIntoView({behavior:'smooth',block:'center'})" class="w-full h-10 rounded-xl primary-btn text-[11px] font-extrabold">الدخول إلى المحادثة</button>` : ''}
     ${o?.accepted===true ? '<div class="rounded-xl border border-slate-200 p-3 space-y-2"><p class="text-[12px] font-extrabold">محادثة الطلب</p>'+'<div id="fanni-accepted-chat-'+esc(o.orderSn||o.sn||o.order?.sn||'')+'">'+(Array.isArray(o.chatMessages)?o.chatMessages.map(m=>'<div class="rounded-lg p-2 '+(m.senderRole==='fanni'?'bg-[#E8EDFF]':'bg-emerald-50')+'"><p class="text-[10px] font-bold">'+(m.senderRole==='fanni'?'أنت':'العميل')+'</p><p class="text-[12px] whitespace-pre-wrap break-words">'+esc(m.text||'')+'</p></div>').join(''):'')+'</div>'+'<textarea id="fanni-chat-'+esc(o.orderSn)+'" data-sn="'+esc(o.orderSn)+'" data-offer-id="'+esc(o._id||'')+'" maxlength="1000" onkeydown="if(event.keyCode===13&&!event.shiftKey){event.preventDefault();sendFanniChat(this.dataset.sn,this.dataset.offerId)}" class="field min-h-[70px]" placeholder="اكتب ردك للعميل"></textarea><button type="button" onclick="sendFanniChat(\''+esc(o.orderSn)+'\',\''+esc(o._id||'')+'\')" class="primary-btn w-full h-10 text-[12px]">إرسال الرسالة</button><p class="text-[10px] text-slate-500">طلب زيادة السعر: اكتب السعر الإجمالي الجديد وسبب الزيادة. لن يتغير السعر إلا بعد موافقة العميل داخل المنصة.</p><input id="price-change-'+esc(o.orderSn)+'" type="number" min="1" step="1" class="field" placeholder="السعر الجديد عند وجود شغل إضافي"><input id="price-reason-'+esc(o.orderSn)+'" maxlength="500" class="field" placeholder="سبب تعديل السعر"><button type="button" onclick="requestFanniPriceChange(\''+esc(o.orderSn)+'\')" class="secondary-btn w-full h-10 text-[12px]">إرسال طلب زيادة السعر للعميل</button></div>' : '<div class="rounded-xl border border-slate-200 p-3 space-y-2"><p class="text-[12px] font-extrabold">استفسارات العميل قبل قبول العرض</p>'+'<div id="fanni-prechat-chat-'+esc(o.orderSn||o.sn||o.order?.sn||'')+'-'+esc(o._id||'')+'">'+(Array.isArray(o.chatMessages)?o.chatMessages.map(m=>'<div class="rounded-lg p-2 '+(m.senderRole==='fanni'?'bg-[#E8EDFF]':'bg-emerald-50')+'"><p class="text-[10px] font-bold">'+(m.senderRole==='fanni'?'أنت':'العميل')+'</p><p class="text-[12px]">'+esc(m.text||'')+'</p></div>').join(''):'')+'</div>'+'<div class="grid grid-cols-3 gap-2"><button type="button" onclick="sendFanniQuickReply(\''+esc(o.orderSn)+'\',\''+esc(o._id||'')+'\',\'نعم\')" class="secondary-btn text-xs">نعم</button><button type="button" onclick="sendFanniQuickReply(\''+esc(o.orderSn)+'\',\''+esc(o._id||'')+'\',\'لا\')" class="secondary-btn text-xs">لا</button><button type="button" onclick="sendFanniQuickReply(\''+esc(o.orderSn)+'\',\''+esc(o._id||'')+'\',\'حسب الاتفاق\')" class="secondary-btn text-xs">حسب الاتفاق</button></div></div>'}
     ${o?.accepted===true && o.orderStatus==='تم اختيار فني' ? `<button data-sn="${esc(o.orderSn||o.sn||o.order?.sn||'')}" onclick="completeOrder(this.dataset.sn)" class="primary-btn w-full h-11 text-[12px]">إنهاء المهمة</button>` : ''}
    </article>`).join('')}
   </section>`:''}
     ${state.tab==='myOrders'&&state.myOrdersView==='completed'?`
   <section class="mt-4 space-y-3">
    <div class="flex justify-between items-center">
     <h3 class="section-title">المهام المكتملة</h3>
     
    </div>

    ${!state.completedOffers.length?'<div class="panel p-8 text-center"><div class="text-2xl">🏁</div><p class="text-[13px] font-extrabold mt-3">لا توجد مهام مكتملة</p><p class="text-[11px] text-slate-500 mt-1">المهام التي تنهيها ستظهر هنا.</p></div>':state.completedOffers.map(o=>`<article class="panel p-4 space-y-3">
     <div class="flex justify-between gap-3">
      <div>
       <div class="text-[10px] text-slate-500">كود الطلب</div>
       <b class="font-mono text-[12px]">${esc(o.orderSn||o.sn||o.order?.sn||'')}</b>
      </div>
      <div>
       <div class="text-[10px] text-slate-500">سعر عرضك</div>
       <b class="text-[#18324F] 700">${esc(o.price??o.priceNum??'غير متاح')} جنيه</b>
      </div>
     </div>

     <div class="flex flex-wrap items-center gap-2">
      <span class="text-[10px] rounded-full px-3 py-1 font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-100">تم إنهاء المهمة</span>
      ${o.service?`<span class="text-[10px] rounded-full bg-[#E8EDFF] text-[#18324F] 800 px-3 py-1">${esc(o.service)}</span>`:''}
     </div>

     ${renderAcceptedClient(o)}
     ${o.myRating ? '<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p class="text-[12px] font-extrabold text-emerald-800">تقييمك للعميل: '+('★'.repeat(Number(o.myRating.stars)||0))+' ('+(Number(o.myRating.stars)||0)+'/5)</p>'+(o.myRating.comment?'<p class="mt-1 text-[12px]">'+esc(o.myRating.comment)+'</p>':'')+'</div>' : !dismissedFanniRatings.has(String(o.orderSn||o.sn||o.order?.sn||'').toUpperCase()) && !isRatingSkipped('fanni',o.orderSn||o.sn||o.order?.sn) ? '<div id="fanni-rating-'+esc(o.orderSn||o.sn||o.order?.sn||'')+'" class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2"><h4 class="text-[13px] font-extrabold text-amber-900">قيّم العميل</h4><p class="text-[11px] text-amber-800">التقييم يظهر لك وللعميل. التعليق اختياري.</p><label class="field-label">عدد النجوم</label><select id="rating-stars-'+esc(o.orderSn)+'" class="field" onchange="toggleFanniRatingBlock(\''+esc(o.orderSn)+'\')"><option value="5">★★★★★ — 5 نجوم</option><option value="4">★★★★ — 4 نجوم</option><option value="3">★★★ — 3 نجوم</option><option value="2">★★ — نجمتان</option><option value="1">★ — نجمة واحدة</option></select><label class="field-label">تعليق (اختياري)</label><textarea id="rating-comment-'+esc(o.orderSn)+'" maxlength="500" class="field min-h-[72px]" placeholder="ملاحظاتك عن التعامل مع العميل"></textarea><label id="rating-block-wrap-'+esc(o.orderSn)+'" style="display:none" class="flex items-start gap-2 text-[12px] font-bold text-red-800"><input id="rating-block-'+esc(o.orderSn)+'" type="checkbox" class="mt-1"> عدم استقبال طلبات مستقبلية من هذا العميل</label><button type="button" onclick="submitFanniRating(\''+esc(o.orderSn)+'\')" class="primary-btn w-full h-11 text-[12px]">إرسال التقييم</button><button type="button" onclick="dismissRatingPrompt(\''+esc(o.orderSn)+'\')" class="w-full h-10 rounded-xl border border-amber-300 bg-white text-amber-900 font-extrabold text-[12px]">تخطي التقييم</button></div>' : ''}
     ${Array.isArray(o.ratings)&&o.ratings.length ? '<div class="rounded-xl border border-slate-200 p-3"><p class="text-[12px] font-extrabold">التقييمات المتبادلة</p>'+o.ratings.map(r=>'<div class="mt-2 border-t border-slate-100 pt-2"><p class="text-[12px] font-bold">'+(r.reviewerRole==='client'?'تقييم العميل لك':'تقييمك للعميل')+' — '+('★'.repeat(Number(r.stars)||0))+' ('+(Number(r.stars)||0)+'/5)</p>'+(r.comment?'<p class="text-[12px] mt-1">'+esc(r.comment)+'</p>':'')+'</div>').join('')+'</div>' : ''}
    </article>`).join('')}
   </section>`:''}

  ${state.tab==='store'?renderStoreCatalog('fanni'):''}

  ${state.tab==='wallet'?`
   <section class="mt-4 space-y-4">
    <div class="panel p-4"><div class="flex justify-between items-center"><div><h3 class="section-title">محفظتي</h3><p class="text-[10px] text-slate-500 mt-1">رصيدك ومتابعة معاملات المحفظة</p></div><b class="text-[#18324F] 800">${esc(balance)} ج</b></div></div>
   <div class="fanni-wallet-tabs" role="tablist" aria-label="أقسام المحفظة">${[{id:"topup",label:"شحن المحفظة",icon:"＋"},{id:"requests",label:"طلبات الشحن",icon:"📥"},{id:"transactions",label:"سجل العمليات",icon:"📄"}].map(tab=>'<button type="button" role="tab" aria-selected="'+((state.walletTab||"topup")===tab.id?"true":"false")+'" onclick="setFanniWalletTab(\''+tab.id+'\')" class="'+((state.walletTab||"topup")===tab.id?"fanni-wallet-tab is-active":"fanni-wallet-tab")+'"><span class="fanni-wallet-tab-icon">'+tab.icon+'</span>'+tab.label+'</button>').join("")}</div>
    <div class="panel p-4 ${((state.walletTab||"topup")==="topup")?"":"hidden"}">

     <div class="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2">
      <p class="text-[11px] font-extrabold text-[#2E7CF6]">أرقام التحويل المعتمدة</p>
      ${[[1,state.walletPhone1],[2,state.walletPhone2]].map(([index,value])=>({index,number:String(value||'').trim()})).filter(item=>/^01[0-9]{9}$/.test(item.number)).map(({index,number})=>'<div class="flex items-center justify-between gap-2 rounded-lg bg-white border border-blue-100 p-3"><span id="wallet-transfer-number-'+index+'" class="font-mono font-black text-[16px] text-slate-900" dir="ltr">'+esc(number)+'</span><button type="button" onclick="copyWalletNumber('+index+')" class="rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-extrabold text-blue-800" aria-label="نسخ رقم التحويل">نسخ</button></div>').join('')}
      ${[[state.walletPhone1],[state.walletPhone2]].every(([value])=>!/^01[0-9]{9}$/.test(String(value||'').trim()))?'<p class="text-[11px] text-amber-800">أرقام التحويل غير متاحة حاليًا. تواصل مع خدمة العملاء قبل التحويل.</p>':''}
      <p class="text-[10px] text-slate-600 leading-5">راجع الرقم وبيانات التحويل قبل إرسال أي مبلغ. طلب الشحن يحتاج مراجعة الإدارة.</p>
     </div>

     ${!approved?'<div class="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">لا يمكن تقديم طلب شحن قبل اعتماد حسابك.</div>':''}

     <div class="mt-4 space-y-3">
      <div><label class="field-label">رقم الهاتف المحوّل منه *</label><input class="field" inputmode="numeric" value="${esc(state.walletFromPhone)}" oninput="state.walletFromPhone=this.value.replace(/\\D/g,'').slice(0,11)" placeholder="01xxxxxxxxx"></div>

      <div><label class="field-label">المبلغ بالجنيه *</label><input class="field" type="number" min="10" max="10000" step="1" value="${esc(state.walletAmount)}" oninput="state.walletAmount=this.value.slice(0,5)" placeholder="100"></div>

      <div><label class="field-label">نوع المحفظة المحوَّل منها</label><select class="field" onchange="state.walletMethod=this.value"><option value="vodafone_cash" ${state.walletMethod==='vodafone_cash'?'selected':''}>فودافون كاش</option><option value="orange_cash" ${state.walletMethod==='orange_cash'?'selected':''}>أورنج كاش</option><option value="etisalat_cash" ${state.walletMethod==='etisalat_cash'?'selected':''}>اتصالات كاش</option><option value="we_cash" ${state.walletMethod==='we_cash'?'selected':''}>WE Pay</option></select><p class="text-[11px] font-bold text-red-600 mt-2">⚠️ الشحن للمحفظة فقط. لا نقبل التحويلات عبر إنستاباي (InstaPay).</p></div>

      <div><label class="field-label">الكود المرجعي للتحويل (اختياري)</label><input class="field" value="${esc(state.walletRef)}" oninput="state.walletRef=this.value.slice(0,50)" maxlength="50" placeholder="اكتب الكود إن وجد"></div>

      <button onclick="submitWallet()" ${state.walletLoading||!approved?'disabled':''} class="primary-btn w-full h-12">${state.walletLoading?'جاري إرسال الطلب...':'إرسال طلب الشحن للإدارة'}</button>

      ${state.success?successBox(state.success):''}
      ${state.error?errorBox(state.error):''}
     </div>
    </div>

    <div class="panel p-4 ${state.walletTab==="requests"?"":"hidden"}">
     <div class="flex justify-between items-center"><div><h4 class="text-[13px] font-extrabold">سجل الشحن</h4><p class="text-[10px] text-slate-500 mt-1">حالة طلبات الشحن السابقة</p></div></div>

     <div class="mt-3 space-y-2">
      ${!state.walletHistory.length?'<div class="rounded-xl bg-slate-50 p-5 text-center text-[11px] text-slate-500">لا توجد طلبات شحن سابقة.</div>':state.walletHistory.map(h=>`<div class="rounded-xl border bg-slate-50 p-3">
       <div class="flex justify-between gap-2"><b class="text-[12px]">${esc(h.amount??'')} جنيه</b><span class="text-[10px] text-slate-500">${esc(h.senderNumber||h.fromPhone||h.phone||'')}</span></div>
       <p class="text-[10px] text-slate-500 mt-2">الكود: ${esc(h.referenceNumber||h.reference||h.referenceCode||'بدون')}</p>
       <p class="text-[10px] mt-1 text-[#18324F] 700 font-bold">الحالة: ${esc(h.status||'قيد المراجعة')}</p>
       ${h.transactionNumber?`<p class="text-[10px] font-bold text-blue-700 mt-1" dir="ltr">رقم العملية: ${esc(h.transactionNumber)}</p>`:''}
       ${h.createdAt?`<p class="text-[10px] text-slate-400 mt-1">${esc(new Date(h.createdAt).toLocaleString('ar-EG'))}</p>`:''}
      </div>`).join('')}
     </div>
    </div>
    <div class="panel p-4 ${state.walletTab==="transactions"?"":"hidden"}">
     <h4 class="text-[13px] font-extrabold">سجل الحركات المالية</h4>
     <p class="text-[10px] text-slate-500 mt-1">كل الإضافات والخصومات ومستحقات الطلبات التي تم تحويلها لمحفظتك.</p>
     <div class="mt-3 space-y-2">
      ${(state.walletTransactions||[]).length?(state.walletTransactions||[]).map(x=>'<div class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="flex justify-between gap-2"><b class="text-[11px]">'+esc(x.type==='technician_settlement'?'مستحقات تنفيذ طلب':x.type==='commission'?'عمولة المنصة':x.type==='topup'?'شحن محفظة':x.type==='admin_adjustment'?'تسوية إدارية':x.type==='refund'?'استرداد':x.type==='referral_reward'?'مكافأة دعوة':'حركة مالية')+'</b><strong class="'+(Number(x.amount)>=0?'text-emerald-700':'text-red-700')+'">'+(Number(x.amount)>0?'+':'')+esc(String(x.amount))+' ج</strong></div><p class="mt-1 text-[10px] font-bold text-blue-700" dir="ltr">رقم العملية: '+esc(x.transactionNumber||'—')+'</p><p class="mt-1 text-[10px] text-slate-600">'+esc(x.description||'')+(x.referralNumber?' • رقم الدعوة: '+esc(x.referralNumber):'')+'</p><p class="mt-1 text-[9px] text-slate-400">'+(x.createdAt?esc(new Date(x.createdAt).toLocaleString('ar-EG')):'')+'</p></div>').join(''):'<div class="rounded-xl bg-slate-50 p-5 text-center text-[11px] text-slate-500">لا توجد حركات مالية مسجلة حتى الآن.</div>'}
     </div>
    </div>
   </section>`:''}

  ${state.tab==='profile'?`
   <section class="mt-4 panel p-4">
    <div class="flex items-center gap-3 pb-4 border-b"><div class="text-2xl">👤</div><div><h3 class="section-title">بيانات حسابي</h3><p class="text-[10px] text-slate-500 mt-1">راجع بياناتك وعدّل رقم التليفون والتخصصات ومناطق العمل</p></div></div>
    ${state.editProfileMode?`
     <div class="mt-4 space-y-4">
      <div><label class="field-label">رقم التليفون *</label><input id="fanniEditPhone" class="field" inputmode="numeric" autocomplete="tel" maxlength="11" enterkeyhint="next" value="${esc(state.editPhone)}" oninput="state.editPhone=this.value.replace(/\\D/g,'').slice(0,11)" placeholder="01xxxxxxxxx"><p class="text-[10px] text-slate-500 mt-1">رقم مصري من 11 رقمًا وغير مسجل لحساب آخر.</p></div>
      <div><label class="field-label">مناطق العمل *</label><p class="text-[10px] text-slate-500 mb-2">ابحث واختار كل المناطق اللي تقدر تشتغل فيها.</p>${renderFanniAreaPicker(state.editAreas,state.editAreaSearch,'editAreaSearchInput','onEditAreaSearch','toggleEditArea')}</div>
       <div class="rounded-2xl border p-3">
       <div class="font-extrabold text-[12px] mb-3">التخصصات * <span class="text-slate-500">(${state.editSpecialties.length} مختار)</span></div>
       ${SERVICES_LOADING?`<p class="py-4 text-center text-[11px]">جاري تحميل التخصصات...</p>`:SERVICES_ERROR?`<div class="rounded-xl bg-red-50 border border-red-200 p-3 text-[11px] text-red-700">${esc(SERVICES_ERROR)} <button type="button" onclick="loadServices()" class="secondary-btn px-3 py-1">إعادة المحاولة</button></div>`:CATEGORIES.map((cat,index)=>{
        const selectedCount=cat.services.filter(s=>state.editSpecialties.includes(s)).length;
        const categoryId='edit-specialty-category-'+index;
        const isOpen=state.openSpecialtyCategory===cat.label;
        return `<section class="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
         <button type="button" onclick="toggleEditSpecialtyCategory(this.dataset.category)" data-category="${esc(cat.label)}" aria-expanded="${isOpen}" aria-controls="${categoryId}" class="flex w-full items-center justify-between gap-3 bg-slate-50 p-3 text-right">
          <span><span class="block text-[12px] font-extrabold">${esc(cat.emoji)} ${esc(cat.label)}</span><span class="mt-1 block text-[10px] text-slate-500">${selectedCount?'تم اختيار '+selectedCount+' خدمة':'اضغط لعرض الخدمات'}</span></span><span class="text-[#18324F] 700 font-black">${isOpen?'−':'+'}</span>
         </button>
         ${isOpen?`<div id="${categoryId}" class="fanni-specialty-options grid grid-cols-3 gap-2 max-[380px]:grid-cols-2 border-t p-3">${cat.services.map(s=>`<button type="button" data-specialty="${esc(s)}" aria-pressed="${state.editSpecialties.includes(s)}" onclick="event.preventDefault();event.stopPropagation();toggleEditSpecialty(this.dataset.specialty)" class="service-chip ${state.editSpecialties.includes(s)?'selected':''}"><span class="service-icon" aria-hidden="true">${serviceIconFor(s)}</span><span>${esc(s)}</span></button>`).join('')}</div>`:''}
        </section>`;
       }).join('')}
      </div>
      ${state.error?errorBox(state.error):''}
      <div class="grid grid-cols-2 gap-2"><button type="button" onclick="cancelEditProfile()" class="secondary-btn h-11" ${state.editSaving?'disabled':''}>إلغاء</button><button type="button" onclick="saveProfileChanges()" class="primary-btn h-11" ${state.editSaving?'disabled':''}>${state.editSaving?'جاري الحفظ...':'حفظ التعديلات'}</button></div>
     </div>
    `:`
     <div class="mt-4 space-y-4 text-[12px]"><div class="rounded-2xl border border-[#D5DDFE] 100 bg-[#E8EDFF]/60 p-3"><div class="mb-2 font-extrabold text-[#18324F] 900">بيانات الحساب</div>${[['الاسم',user?.name],['رقم الهاتف',user?.phone],['حالة الحساب',user?.status],['رصيد المحفظة',balance+' جنيه']].map(x=>`<div class="rounded-xl bg-white border p-3 mb-2"><div class="text-[12px] text-slate-500 mb-1">${x[0]}</div><b style="font-size:15px" >${esc(x[1]||'غير متاح')}</b></div>`).join('')}</div><div class="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div class="mb-2 font-extrabold text-slate-800">بيانات العمل</div>${[['التخصصات',specialties.join('، ')||'لا توجد خدمات ضمن تخصص حمزاوي سات حاليًا'],['مناطق العمل',areas.join('، ') ]].map(x=>`<div class="rounded-xl bg-white border p-3 mb-2"><div class="text-[12px] text-slate-500 mb-1">${x[0]}</div><b style="font-size:15px" >${esc(x[1]||'غير متاح')}</b></div>`).join('')}      <div class="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"><div class="font-extrabold text-[12px] text-emerald-900">شاراتي</div>
      <div class="mt-2 flex flex-wrap gap-1.5">${(Array.isArray(user?.badges)?user.badges:[]).map(b=>({trusted:'✓ فني موثوق',top_rated:'★ الأعلى تقييمًا',verified:'✓ تم التحقق',fast_response:'⚡ سريع الاستجابة',premium:'◆ فني مميز',gold:'★ الشارة الذهبية'}[b]||'')).filter(Boolean).map(label=>`<span class="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-extrabold text-emerald-800">${esc(label)}</span>`).join('')||'<span class="text-[11px] text-slate-500">لا توجد شارات ممنوحة حاليًا</span>'}</div>
     </div></div></div>
     <button type="button" onclick="beginEditProfile()" class="mt-4 w-full h-11 rounded-xl bg-[#E8EDFF] border border-[#D5DDFE] 200 text-[#18324F] 800 font-extrabold text-[12px]">✏️ تعديل البيانات</button>
     <button type="button" onclick="location.href='password.html?role=fanni&mode=change'" class="mt-2 w-full h-11 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-extrabold text-[12px]">🔒 تغيير كلمة المرور</button>
     <button onclick="logout()" class="fanni-profile-logout mt-4 w-full h-11 rounded-xl font-extrabold text-[12px]">تسجيل الخروج</button>
    `}
   </section>`:''}
 `}
 
 ${state.offerModal?`
 <div class="fixed inset-0 z-50 bg-[#07152e]/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 overflow-y-auto">
  <div class="w-full max-w-[480px] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain bg-white rounded-[22px] p-5 shadow-2xl" style="padding-bottom:max(1.25rem,env(safe-area-inset-bottom))">
   <div class="flex justify-between items-center pb-3 border-b"><div><h3 class="font-extrabold text-[15px]">تقديم عرض</h3><p class="text-[10px] text-slate-500 mt-1">كود الطلب: ${esc(state.offerModal.sn)}</p></div><button onclick="closeOffer()" class="h-9 w-9 rounded-xl bg-slate-100">✕</button></div>

   <div class="mt-4 space-y-4">
    <div><label class="field-label">السعر بالجنيه *</label><input id="fanniOfferPrice" class="field" type="number" min="10" max="1000000" step="1" enterkeyhint="next" value="${esc(state.offerPrice)}" oninput="state.offerPrice=this.value.slice(0,7)" placeholder="150"></div>

    <div><label class="field-label">رسالتك للعميل *</label><textarea id="fanniOfferMessage" class="field min-h-[100px]" enterkeyhint="go" oninput="state.offerMessage=this.value.slice(0,500)" placeholder="اكتب تفاصيل العرض والوقت المتوقع للوصول">${esc(state.offerMessage)}</textarea><p class="text-[10px] text-slate-500 mt-1">من 5 إلى 500 حرف.</p></div>

    ${state.offerError?errorBox(state.offerError):''}

    <button onclick="submitOffer()" ${state.offerSubmitting||!approved?'disabled':''} class="primary-btn w-full h-12">${state.offerSubmitting?'جاري إرسال العرض...':'إرسال العرض للعميل'}</button>

    ${!approved?'<p class="text-[11px] text-amber-700">لا يمكن إرسال عرض قبل اعتماد الحساب.</p>':''}
   </div>
  </div>
 </div>`:''}
 </main>

 
  ${globalRefreshInProgress?`<style>.global-refresh.is-refreshing svg{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style>`:''}
  <style>.global-refresh-float{display:none!important}</style><button id="global-refresh" type="button" onclick="handleGlobalRefresh()" aria-label="تحديث البيانات" title="تحديث البيانات" class="global-refresh global-refresh-float ${authenticated?'':'prelogin-floating'} ${globalRefreshInProgress?'is-refreshing':''}" ${authenticated?'':'style="bottom:18px;left:18px;right:auto;top:auto;position:fixed;z-index:40;width:48px;height:48px;border-radius:9999px;background:#2E7CF6;border:2px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(20,38,165,.30);"' }><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 17 5l3 7M4 12l3 7a7 7 0 0 0 11.4-2"/></svg></button>`;
 
}


let __fanniLastRenderedTab = null;

function render(){
  const appRoot = document.getElementById('app');
  const preserveViewport = __fanniLastRenderedTab === state.tab;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const active = appRoot && appRoot.contains(document.activeElement) ? document.activeElement : null;
  const focusState = active ? {
    id: active.id || '',
    specialty: active.getAttribute('data-specialty'),
    category: active.getAttribute('data-category'),
    area: active.getAttribute('data-area'),
    tagName: active.tagName,
    type: active.getAttribute('type'),
    selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
    selectionDirection: active.selectionDirection || 'none'
  } : null;

  try {
    const result = renderContent();
    __fanniLastRenderedTab = state.tab;

    // renderContent replaces the complete app markup. Keep the user's viewport
    // and active form control when the current tab is only being updated.
    if (preserveViewport) {
      requestAnimationFrame(() => {
        const root = document.getElementById('app');
        if (root && focusState) {
          let target = focusState.id ? document.getElementById(focusState.id) : null;
          if (!target && focusState.specialty !== null) {
            target = Array.from(root.querySelectorAll('[data-specialty]')).find(el =>
              el.getAttribute('data-specialty') === focusState.specialty &&
              el.tagName === focusState.tagName &&
              (focusState.type === null || el.getAttribute('type') === focusState.type)
            ) || null;
          }
          if (!target && focusState.category !== null) {
            target = Array.from(root.querySelectorAll('[data-category]')).find(el =>
              el.getAttribute('data-category') === focusState.category
            ) || null;
          }
          if (!target && focusState.area !== null) {
            target = Array.from(root.querySelectorAll('[data-area]')).find(el =>
              el.getAttribute('data-area') === focusState.area
            ) || null;
          }
          if (target && typeof target.focus === 'function') {
            try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
            if (focusState.selectionStart !== null && typeof target.setSelectionRange === 'function') {
              try {
                target.setSelectionRange(
                  focusState.selectionStart,
                  focusState.selectionEnd,
                  focusState.selectionDirection
                );
              } catch (_) {}
            }
          }
        }
        window.scrollTo(scrollX, scrollY);
      });
    }
    return result;
  } catch (error) {
    __fanniLastRenderedTab = state.tab;
    console.error('Technician dashboard render failed:', error);
    const root = document.getElementById('app');
    if (root) root.innerHTML = '<main class="mx-auto max-w-[680px] p-6"><section class="empty-state panel p-6 text-center" role="alert"><p class="font-extrabold">تعذر عرض بيانات الصفحة حاليًا.</p><p class="mt-2 text-sm text-slate-500">حاول إعادة تحميل الصفحة.</p><button type="button" onclick="location.reload()" class="primary-btn mt-4 px-5 py-3">إعادة المحاولة</button></section></main>';
  }
}
function renderFanniPublicContent(){const c=state.publicContent||{announcement:'',faqs:[]};const faqs=Array.isArray(c.faqs)?c.faqs:[];if(!String(c.announcement||'').trim()&&!faqs.length)return '';return '<section class="mx-auto mt-3 w-full max-w-[640px] space-y-2">'+(String(c.announcement||'').trim()?'<div class="panel border-blue-200 bg-blue-50 p-3 text-[12px] font-bold leading-6">'+esc(c.announcement)+'</div>':'')+(faqs.length?'<details class="panel p-3"><summary class="cursor-pointer text-[12px] font-extrabold">الأسئلة الشائعة</summary><div class="mt-3 space-y-3">'+faqs.map(f=>'<div class="border-t pt-2"><p class="text-[11px] font-extrabold">'+esc(f.question)+'</p><p class="mt-1 text-[11px] leading-5 text-slate-600">'+esc(f.answer)+'</p></div>').join('')+'</div></details>':'')+'</section>';}
