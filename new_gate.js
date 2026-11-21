function renderAccountGate(){
var reg=state.accountAuthMode==='register';
document.title=reg?'تسجيل عميل جديد | حمزاوي سات':'تسجيل دخول العميل | حمزاوي سات';
var h='<main class="account-gate" style="background:#EEF2FF;';
h+='min-height:100svh;min-height:100dvh;';
h+='padding-top:max(1rem,env(safe-area-inset-top));';
h+='padding-bottom:max(1rem,env(safe-area-inset-bottom));';
h+='width:100%;box-sizing:border-box;display:flex;';
h+='flex-direction:column;align-items:center;';
h+='justify-content:flex-start">';
h+='<div class="w-full max-w-[440px] mx-auto px-4" ';
h+='style="margin-top:auto;margin-bottom:auto;box-sizing:border-box">';
var Q=String.fromCharCode(39);
h+='<div class="flex w-full justify-between mb-4">';
h+='<button type="button" onclick="window.location.href=' + Q + '/' + Q + '" ';
h+='class="h-10 px-4 rounded-xl border border-slate-200 bg-white ';
h+='text-[15px] font-extrabold" style="background:#FFFFFF!important;';
h+='color:#101F9B!important">‹ الصفحة الرئيسية</button>';
h+='<button type="button" onclick="goBack()" ';
h+='class="h-10 px-4 rounded-xl border border-slate-200 bg-white ';
h+='text-[15px] font-extrabold" style="background:#FFFFFF!important;';
h+='color:#101F9B!important">رجوع ›</button></div>';
h+='<div class="text-center mb-3"><div class="mx-auto w-[68px] h-[68px] ';
h+='rounded-[28px] bg-white border border-slate-200 flex ';
h+='items-center justify-center shadow-sm p-3">';
h+='<img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" ';
h+='alt="شعار حمزاوي سات" style="width:100%;height:100%;object-fit:contain"></div>';
h+='<h1 class="mt-2 text-[24px] font-black" style="color:#101F9B">حمزاوي سات</h1>';
h+='<p class="mt-1 text-[15px] font-bold text-slate-500">';
h+='خدماتك وشغلك... في مكان واحد</p>';
h+='<div class="mt-4"><span class="inline-block px-4 py-1.5 rounded-full ';
h+='bg-[#E8EDFF] text-[#101F9B] text-[14px] font-extrabold">حساب عميل</span></div>';
h+='<h2 class="mt-2 text-[18px] font-black leading-7" ';
h+='style="color:#101F9B">'+(reg?'تسجيل عميل جديد':'أهلاً بيك في حمزاوي سات')+'</h2>';
h+='<p class="mt-1 text-[14px] text-slate-500">'+(reg?'أنشئ حساب عميل جديد '+
'علشان تطلب الخدمات وتتابع طلباتك.':'سجّل دخولك علشان تطلب خدمة '+
'وتتابع طلباتك من حسابك.')+'</p></div>';
h+='<section class="account-panel mt-2 panel p-4" ';
h+='style="border-radius:28px;width:100%;box-sizing:border-box">';
h+='<div class="account-tabs flex justify-center" ';
h+='style="padding:0!important;margin:0 0 20px!important;';
h+='background:transparent!important;border:0!important;';
h+='display:'+(reg?'flex':'none')+'!important">';
h+='<button type="button" onclick="setAccountAuthMode(this.dataset.next)" ';
h+='data-next="'+(reg?'login':'register')+'" ';
h+='class="h-9 px-4 rounded-full bg-[#F4F6FF] border border-dashed ';
h+='border-[#D5DDFE] text-[#172DAD] text-[12px] font-black ';
h+='inline-flex items-center justify-center gap-1.5">';
h+='<span>'+(reg?'لتسجيل الدخول':'لتسجيل عميل جديد')+'</span>';
h+='<small class="underline decoration-dashed">اضغط هنا</small></button></div>';
h+='<form class="space-y-4" onsubmit="submitClientAccount(event)">';
if(reg&&clientReferralCodeFromUrl()){h+='<div class="rounded-xl border ';
h+='border-emerald-200 bg-emerald-50 p-3 text-[11px] font-bold ';
h+='text-emerald-800">تم فتح التسجيل من خلال دعوة صديق. ';
h+='أكمل التسجيل لتفعيل الدعوة.</div>';}
if(reg){h+='<div><label style="color:#101F9B;text-align:left;';
h+='display:block;font-weight:800;font-size:15px">الاسم بالكامل</label>';
h+='<input id="accountName" required minlength="2" maxlength="50" ';
h+='autocomplete="name" class="field" style="height:52px!important;font-size:15px!important;font-weight:700!important;padding:0 16px!important;text-align:right!important;box-sizing:border-box!important" placeholder="اكتب اسمك"></div>';}
h+='<div><label style="color:#101F9B;text-align:left;';
h+='display:block;font-weight:800;font-size:15px">رقم الهاتف</label>';
h+='<input id="accountPhone" required type="tel" inputmode="tel" ';
h+='autocomplete="tel" maxlength="20" class="field" style="height:52px!important;font-size:15px!important;font-weight:700!important;padding:0 16px!important;text-align:right!important;box-sizing:border-box!important" ';
h+='placeholder="01xxxxxxxxx" value="'+escAttr(reg?'':(state.accountLoginPhone||''))+'" dir="ltr"></div>';
h+='<div><label style="color:#101F9B;text-align:left;';
h+='display:block;font-weight:800;font-size:15px">كلمة السر</label>';
h+='<input id="accountPassword" required type="password" ';
h+='minlength="'+(reg?8:1)+'" maxlength="128" ';
h+='autocomplete="'+(reg?'new-password':'current-password')+'" class="field" style="height:52px!important;font-size:15px!important;font-weight:700!important;padding:0 16px!important;text-align:right!important;box-sizing:border-box!important" ';
h+='placeholder="'+(reg?'8 أحرف على الأقل':'اكتب كلمة السر')+'" ';
h+='value="'+escAttr(reg?'':(state.accountLoginPassword||''))+'"></div>';
if(reg){h+='<div><label style="color:#101F9B;text-align:left;';
h+='display:block;font-weight:800;font-size:15px">تأكيد كلمة السر</label>';
h+='<input id="accountConfirmPassword" required type="password" ';
h+='minlength="8" maxlength="128" autocomplete="new-password" ';
h+='class="field" style="height:52px!important;font-size:15px!important;font-weight:700!important;padding:0 16px!important;text-align:right!important;box-sizing:border-box!important" placeholder="أعد كتابة كلمة السر"></div>';}
if(state.accountError){h+='<p class="rounded-xl bg-red-50 border ';
h+='border-red-200 p-3 text-[11px] leading-5 font-bold text-red-700">';
h+=escHtml(state.accountError)+'</p>';}
if(!reg){h+='<div style="text-align:left"><a href="password.html?role=client&mode=recovery" ';
h+='style="color:#101F9B;font-weight:800;font-size:15px;text-decoration:underline">';
h+='نسيت كلمة السر؟ استعادة</a></div>';}
h+='<button type="submit" '+(state.accountLoading?'disabled':'')+' ';
h+='class="w-full h-[56px] rounded-2xl text-[18px] font-black" ';
h+='style="background:#101F9B!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">';
h+=(state.accountLoading?'جاري التنفيذ...':reg?'إنشاء حساب العميل':'تسجيل الدخول');
h+='</button></form>';
if(!reg){h+='<button type="button" onclick="setAccountAuthMode(' + Q + 'register' + Q + ')" ';
h+='class="w-full h-[56px] mt-4 rounded-2xl text-[18px] font-black" ';
h+='style="background:#EEF2FF!important;color:#101F9B!important;-webkit-text-fill-color:#101F9B!important;';
h+='border:1px solid #D5DDFE!important">إنشاء حساب عميل جديد</button>';}
h+='<p class="mt-3 text-center text-[13px] text-slate-500">بياناتك وحسابك في أمان</p>';
h+='<div class="mt-3 flex gap-2" ';
h+='style="padding-bottom:max(0.5rem,env(safe-area-inset-bottom))">';
h+='<a href="/download" class="flex-1 h-[52px] rounded-2xl ';
h+='inline-flex items-center justify-center gap-1.5 text-[15px] font-black" ';
h+='style="background:#101F9B!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">⬇ تحميل التطبيق</a>';
h+='<a href="/links" target="_blank" rel="noopener noreferrer" ';
h+='class="flex-1 h-[52px] rounded-2xl inline-flex items-center ';
h+='justify-center gap-1.5 text-[15px] font-black border border-slate-200" ';
h+='style="background:#EEF2FF!important;color:#101F9B!important;-webkit-text-fill-color:#101F9B!important">🔗 منصات التواصل</a></div>';
h+='</section></div></main>';
document.getElementById('app').innerHTML=h+renderPublicContent();
}
