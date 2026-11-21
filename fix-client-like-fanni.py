import pathlib, re
p = pathlib.Path("frontend/js/client-account.js")
t = p.read_text(encoding="utf-8")
# نبدل الفانكشن كلها من أولها لحد renderPublicContent
pat = re.compile(r"function renderAccountGate\(\)\{.*?\\nfunction renderPublicContent", re.DOTALL)
new_fn = """function renderAccountGate(){
 var reg=state.accountAuthMode==='register';
 document.title=reg?'تسجيل عميل جديد | حمزاوي سات':'تسجيل دخول العميل | حمزاوي سات';
 var h='<main class="account-gate fanni-login-gate" style="background:#EEF2FF;min-height:100svh;min-height:100dvh;padding-top:max(1rem,env(safe-area-inset-top));padding-bottom:max(1rem,env(safe-area-inset-bottom));width:100%;margin-inline:auto;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:flex-start"><style>header.bg-white{display:none!important}html,body{overflow-x:hidden!important}</style>';
 h+='<div class="w-full max-w-[440px] mx-auto px-4" style="margin-top:auto;margin-bottom:auto;margin-inline:auto;box-sizing:border-box">';
 h+='<div class="flex w-full justify-between mb-4"><button type="button" onclick="window.location.href=\\'/\\'" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold" style="background:#FFFFFF!important;color:#101F9B!important;-webkit-text-fill-color:#101F9B!important">‹ الصفحة الرئيسية</button><button type="button" onclick="goBack()" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold" style="background:#FFFFFF!important;color:#101F9B!important;-webkit-text-fill-color:#101F9B!important">رجوع ›</button></div>';
 h+='<div class="text-center mb-3"><div class="mx-auto w-[68px] h-[68px] rounded-[28px] bg-white border border-slate-200 flex items-center justify-center shadow-sm p-3"><img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" alt="شعار حمزاوي سات" style="width:100%;height:100%;object-fit:contain"></div>';
 h+='<h1 class="mt-2 text-[24px] font-black" style="color:#101F9B">حمزاوي سات</h1><p class="mt-1 text-[15px] font-bold text-slate-500">خدماتك وشغلك... في مكان واحد</p>';
 h+='<div class="mt-4"><span class="inline-block px-4 py-1.5 rounded-full bg-[#E8EDFF] text-[#101F9B] text-[14px] font-extrabold">حساب عميل</span></div>';
 h+='<h2 class="mt-2 text-[18px] font-black leading-7" style="color:#101F9B">'+(reg?'تسجيل عميل جديد':'أهلاً بيك في حمزاوي سات')+'</h2>';
 h+='<p class="mt-1 text-[14px] text-slate-500">'+(reg?'أنشئ حساب عميل جديد علشان تطلب الخدمات وتتابع طلباتك.':'سجّل دخولك علشان تطلب خدمة وتتابع طلباتك من حسابك.')+'</p></div>';
 h+='<section class="fanni-login-panel account-panel mt-2 panel p-4" style="border-radius:28px;width:100%;margin-inline:auto;box-sizing:border-box">';
 h+='<div class="account-tabs flex justify-center" style="padding:0!important;margin:0 0 20px!important;background:transparent!important;border:0!important;display:'+(reg?'flex':'none')+'!important"><button type="button" onclick="setAccountAuthMode(this.dataset.next)" data-next="'+(reg?'login':'register')+'" class="account-switch-link h-9 px-4 rounded-full bg-[#F4F6FF] border border-dashed border-[#D5DDFE] text-[#172DAD] text-[12px] font-black inline-flex items-center justify-center gap-1.5" style="color:#172DAD!important;-webkit-text-fill-color:#172DAD!important"><span>'+(reg?'لتسجيل الدخول':'لتسجيل عميل جديد')+'</span><small class="underline decoration-dashed">اضغط هنا</small></button></div>';
 h+='<form class="space-y-4" onkeydown="if(state.accountAuthMode===\\'login\\'&&event.key===\\'Enter\\'){event.preventDefault();if(event.target&&event.target.id===\\'accountPassword\\'){window.__sonaaClientLoginIntent=true;submitClientAccount(event);}else{document.getElementById(\\'accountPassword\\').focus();}}" onsubmit="if(state.accountAuthMode===\\'login\\'&&!window.__sonaaClientLoginIntent){event.preventDefault();return false;}window.__sonaaClientLoginIntent=false;submitClientAccount(event)">';
 if(reg&&clientReferralCodeFromUrl())h+='<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-bold text-emerald-800">تم فتح التسجيل من خلال دعوة صديق. أكمل التسجيل لتفعيل الدعوة.</div>';
 if(reg)h+='<div><label class="field-label" style="color:#101F9B;text-align:left;display:block">الاسم بالكامل</label><input id="accountName" required minlength="2" maxlength="50" autocomplete="name" class="field" placeholder="اكتب اسمك"></div>';
 h+='<div><label class="field-label" style="color:#101F9B;text-align:left;display:block">رقم الهاتف</label><input id="accountPhone" required type="tel" inputmode="tel" autocomplete="tel" maxlength="20" class="field" placeholder="01xxxxxxxxx" value="'+escAttr(reg?'':(state.accountLoginPhone||''))+'" dir="ltr"></div>';
 h+='<div><label class="field-label" style="color:#101F9B;text-align:left;display:block">كلمة السر</label><input id="accountPassword" required type="password" minlength="'+(reg?8:1)+'" maxlength="128" autocomplete="'+(reg?'new-password':'current-password')+'" class="field" placeholder="'+(reg?'8 أحرف على الأقل':'اكتب كلمة السر')+'" value="'+escAttr(reg?'':(state.accountLoginPassword||''))+'"></div>';
 if(reg)h+='<div><label class="field-label" style="color:#101F9B;text-align:left;display:block">تأكيد كلمة السر</label><input id="accountConfirmPassword" required type="password" minlength="8" maxlength="128" autocomplete="new-password" class="field" placeholder="أعد كتابة كلمة السر"></div>';
 if(state.accountError)h+='<p class="rounded-xl bg-red-50 border border-red-200 p-3 text-[11px] leading-5 font-bold text-red-700">'+escHtml(state.accountError)+'</p>';
 if(!reg)h+='<div style="text-align:left"><a href="password.html?role=client&mode=recovery" style="color:#101F9B;font-weight:800;font-size:15px;text-decoration:underline">نسيت كلمة السر؟ استعادة</a></div>';
 h+='<button type="submit" '+(state.accountLoading?'disabled':'')+' onclick="window.__sonaaClientLoginIntent=true" class="w-full h-[56px] rounded-2xl text-[18px] font-black" style="background:#101F9B!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">'+(state.accountLoading?'جاري التنفيذ...':reg?'إنشاء حساب العميل':'تسجيل الدخول')+'</button>';
 h+='</form>';
 if(!reg)h+='<button type="button" onclick="setAccountAuthMode(\\'register\\')" class="w-full h-[56px] mt-4 rounded-2xl text-[18px] font-black" style="background:#EEF2FF!important;color:#101F9B!important;-webkit-text-fill-color:#101F9B!important;border:1px solid #D5DDFE!important">إنشاء حساب عميل جديد</button>';
 h+='<p class="mt-3 text-center text-[13px] text-slate-500">بياناتك وحسابك في أمان</p>';
 h+='<div class="mt-3 flex gap-2" style="padding-bottom:max(0.5rem,env(safe-area-inset-bottom))"><a href="/download" class="flex-1 h-[52px] rounded-2xl inline-flex items-center justify-center gap-1.5 text-[15px] font-black" style="background:#101F9B!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">⬇ تحميل التطبيق</a><a href="/links" target="_blank" rel="noopener noreferrer" class="flex-1 h-[52px] rounded-2xl inline-flex items-center justify-center gap-1.5 text-[15px] font-black border border-slate-200" style="background:#EEF2FF!important;color:#101F9B!important;-webkit-text-fill-color:#101F9B!important">🔗 منصات التواصل</a></div>';
 h+='</section></div></main>';
 document.getElementById('app').innerHTML=h+renderPublicContent()+`<a href="support.html?role=client" aria-label="خدمة العملاء" title="خدمة العملاء" class="support-float prelogin-floating" style="bottom:18px;left:18px;right:auto;top:auto;position:fixed;z-index:40;width:48px;height:48px;border-radius:9999px;background:[STRIPPED 1282 bytes]
}
function renderPublicContent"""
if not pat.search(t):
    print("❌ مش لاقي الفانكشن - ابعتلي أول سطرين من renderAccountGate")
else:
    t = pat.sub(new_fn, t, count=1)
    p.write_text(t, encoding="utf-8")
    print("✅ بدلت صفحة العميل كلها بشكل الفني")
