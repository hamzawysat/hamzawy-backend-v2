p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
# 1. نخفي الهيدر + الجرس + الشريط اللي تحت في صفحة الدخول بس - بستايل جوة صفحة الدخول
old_gate = "<section class=\"account-gate fanni-login-gate mt-5 px-4 py-6 flex flex-col items-center\">"
new_gate = "<section class=\"account-gate fanni-login-gate mt-0 px-4 py-4 flex flex-col items-center\" style=\"background:#EEF2FF;min-height:100vh\"><style>header.bg-white{display:none!important}nav.fanni-browser-bottom-nav{display:none!important}</style>"
assert old_gate in t, "gate مش لاقيه"
t = t.replace(old_gate, new_gate, 1)
print("1. خفيت الهيدر والجرس والشريط في الدخول")
# 2. نشيل الناف اللي فوق (القائمة الرئيسية / تحميل / رجوع) ونحط رجوع بس زي التطبيق
import re
t = re.sub(r'<nav dir="rtl" class="account-top-nav.*?</nav>', '<div class="flex w-full justify-start mb-4"><button type="button" onclick="goBack()" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold">رجوع ›</button></div>', t, count=1, flags=re.DOTALL)
print("2. شلت الناف وحطيت رجوع بس")
# 3. نشيل زرار تابعنا على منصات التواصل من صفحة الدخول
t = re.sub(r'<div class="flex justify-center mb-4"><a href="/links".*?</a></div>', '', t, count=1, flags=re.DOTALL)
print("3. شلت تابعنا")
# 4. نبدل عنوان الدخول بعنوان التطبيق
old_title = """     <div class="text-center mb-6">
     <div class="account-brand fanni-login-brand brand-mark mx-auto flex items-center justify-center"><img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" alt="شعار حمزاوي سات" width="144" height="144" decoding="async"></div>
     <h1 class="mt-4 text-2xl font-black">${state.tab==='register'?'تسجيل فني جديد':'تسجيل دخول الفني'}</h1>
     <p class="account-slogan mt-1 text-sm">حمزاوي سات كل خدمة تبدأ بخطوة</p>
    </div>"""
new_title = """     <div class="text-center mb-6">
     <div class="mx-auto w-[110px] h-[110px] rounded-[28px] bg-white border border-slate-200 flex items-center justify-center shadow-sm p-3"><img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" alt="شعار حمزاوي سات" style="width:100%;height:100%;object-fit:contain"></div>
     <h1 class="mt-4 text-[34px] font-black" style="color:#101F9B">حمزاوي سات</h1>
     <p class="mt-1 text-[15px] font-bold text-slate-500">خدماتك وشغلك... في مكان واحد</p>
     <div class="mt-4"><span class="inline-block px-4 py-1.5 rounded-full bg-[#E8EDFF] text-[#101F9B] text-[14px] font-extrabold">حساب فني</span></div>
     <h2 class="mt-4 text-[26px] font-black leading-9" style="color:#101F9B">${state.tab==='register'?'تسجيل فني جديد':'أهلاً بيك يا فني حمزاوي سات'}</h2>
     <p class="mt-1 text-[14px] text-slate-500">${state.tab==='register'?'أنشئ حسابك وابدأ استقبال الطلبات':'سجّل دخولك وتابع فرص الشغل المتاحة ليك.'}</p>
    </div>"""
assert old_title in t, "title مش لاقيه"
t = t.replace(old_title, new_title, 1)
print("4. بدلت العنوان بعنوان التطبيق")
# 5. نظبط كارت الدخول: رقم الهاتف - كلمة السر - نسيت - زرارين زي التطبيق
t = t.replace('<label class="field-label">رقم التليفون</label>', '<label class="field-label" style="color:#101F9B">رقم الهاتف</label>', 1)
# زرار الدخول: من دخول إلى حسابي رمادي لأزرق غامق تسجيل الدخول
t = t.replace("class=\"primary-btn w-full h-12\">${state.loading?'جاري تسجيل الدخول...':'دخول إلى حسابي'}", "class=\"w-full h-[56px] rounded-2xl text-white text-[20px] font-black shadow-lg\" style=\"background:#101F9B\">${state.loading?'جاري تسجيل الدخول...':'تسجيل الدخول'}", 1)
# اللينكين تحت: نبدلهم بسطر نسيت + زرار إنشاء حساب
old_links = """    <div class="mt-3 flex items-center justify-between gap-3" dir="rtl"><button type="button" onclick="setTab('register')" class="account-register-link text-xs font-bold text-black underline decoration-black underline-offset-2 hover:text-black">تسجيل فني جديد</button><a class="text-xs font-bold text-black underline decoration-black underline-offset-2 hover:text-black" href="password.html?role=fanni&mode=recovery">نسيت كلمة المرور؟</a></div>"""
new_links = """    <div class="mt-1"><a class="text-[15px] font-extrabold" style="color:#101F9B" href="password.html?role=fanni&mode=recovery">نسيت كلمة السر؟ استعادة</a></div>
    <button type="button" onclick="setTab('register')" class="w-full h-[56px] rounded-2xl text-[18px] font-black" style="background:#EEF2FF;color:#101F9B">إنشاء حساب فني جديد</button>"""
assert old_links in t, "links مش لاقيها"
t = t.replace(old_links, new_links, 1)
# جملة الأمان تحت: من كلمة السر لا تشارك لـ بياناتك وحسابك في أمان
t = t.replace("كلمة السر لا تشارك مع أي شخص.", "بياناتك وحسابك في أمان", 1)
print("5. ظبطت الكارت والزرارين زي التطبيق")
open(p, "w", encoding="utf-8").write(t)
print("خلص")
