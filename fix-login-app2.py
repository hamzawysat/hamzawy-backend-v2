import re
p = "frontend/js/fanni-render.js"
lines = open(p, encoding="utf-8").read().splitlines()
t = "\n".join(lines)
# 1. نخفي الهيدر والجرس والشريط في الدخول + خلفية فاتحة
old_gate = '<section class="account-gate fanni-login-gate mt-5 px-4 py-6 flex flex-col items-center">'
new_gate = '<section class="account-gate fanni-login-gate mt-0 px-4 py-4 flex flex-col items-center" style="background:#EEF2FF;min-height:100vh"><style>header.bg-white{display:none!important}nav.fanni-browser-bottom-nav{display:none!important}</style>'
assert old_gate in t, "gate"
t = t.replace(old_gate, new_gate, 1)
print("1. خفيت الهيدر والجرس والشريط")
# 2. الناف -> رجوع بس
t2 = re.sub(r'<nav dir="rtl" class="account-top-nav.*?</nav>', '<div class="flex w-full justify-start mb-4"><button type="button" onclick="goBack()" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold">رجوع ›</button></div>', t, count=1, flags=re.DOTALL)
assert t2 != t, "nav"
t = t2
print("2. رجوع بس")
# 3. شيل تابعنا
t2 = re.sub(r'<div class="flex justify-center mb-4"><a href="/links".*?</a></div>', '', t, count=1, flags=re.DOTALL)
assert t2 != t, "links"
t = t2
print("3. شلت تابعنا")
# 4. العنوان - بالسطور: ندور على سطر text-center mb-6 ونبدل 4 سطور بعده
ls = t.splitlines()
for i, l in enumerate(ls):
    if 'class="text-center mb-6"' in l:
        print("لقيت العنوان في سطر", i+1)
        new_block = [
        '    <div class="text-center mb-6">',
        '     <div class="mx-auto w-[110px] h-[110px] rounded-[28px] bg-white border border-slate-200 flex items-center justify-center shadow-sm p-3"><img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" alt="شعار حمزاوي سات" style="width:100%;height:100%;object-fit:contain"></div>',
        '     <h1 class="mt-4 text-[34px] font-black" style="color:#101F9B">حمزاوي سات</h1>',
        '     <p class="mt-1 text-[15px] font-bold text-slate-500">خدماتك وشغلك... في مكان واحد</p>',
        '     <div class="mt-4"><span class="inline-block px-4 py-1.5 rounded-full bg-[#E8EDFF] text-[#101F9B] text-[14px] font-extrabold">حساب فني</span></div>',
        '     <h2 class="mt-4 text-[26px] font-black leading-9" style="color:#101F9B">${state.tab===\'register\'?\'تسجيل فني جديد\':\'أهلاً بيك يا فني حمزاوي سات\'}</h2>',
        '     <p class="mt-1 text-[14px] text-slate-500">${state.tab===\'register\'?\'أنشئ حسابك وابدأ استقبال الطلبات\':\'سجّل دخولك وتابع فرص الشغل المتاحة ليك.\'}</p>',
        '    </div>',
        ]
        # السطور الأصلية: فتح + لوجو + h1 + p + قفل = 5 سطور
        ls[i:i+5] = new_block
        break
else:
    raise SystemExit("title مش لاقيه")
t = "\n".join(ls)
print("4. بدلت العنوان")
# 5. الكارت: رقم الهاتف - زرار الدخول - اللينكين - جملة الأمان
assert 'رقم التليفون' in t
t = t.replace('<label class="field-label">رقم التليفون</label>', '<label class="field-label" style="color:#101F9B">رقم الهاتف</label>', 1)
old_btn = "class=\"primary-btn w-full h-12\">${state.loading?'جاري تسجيل الدخول...':'دخول إلى حسابي'}"
assert old_btn in t, "btn"
t = t.replace(old_btn, "class=\"w-full h-[56px] rounded-2xl text-white text-[20px] font-black shadow-lg\" style=\"background:#101F9B\">${state.loading?'جاري تسجيل الدخول...':'تسجيل الدخول'}", 1)
old_links = "    <div class=\"mt-3 flex items-center justify-between gap-3\" dir=\"rtl\"><button type=\"button\" onclick=\"setTab('register')\" class=\"account-register-link text-xs font-bold text-black underline decoration-black underline-offset-2 hover:text-black\">تسجيل فني جديد</button><a class=\"text-xs font-bold text-black underline decoration-black underline-offset-2 hover:text-black\" href=\"password.html?role=fanni&mode=recovery\">نسيت كلمة المرور؟</a></div>"
assert old_links in t, "links2"
new_links = "    <div class=\"mt-1\"><a class=\"text-[15px] font-extrabold\" style=\"color:#101F9B\" href=\"password.html?role=fanni&mode=recovery\">نسيت كلمة السر؟ استعادة</a></div>\n    <button type=\"button\" onclick=\"setTab('register')\" class=\"w-full h-[56px] rounded-2xl text-[18px] font-black\" style=\"background:#EEF2FF;color:#101F9B\">إنشاء حساب فني جديد</button>"
t = t.replace(old_links, new_links, 1)
t = t.replace("كلمة السر لا تشارك مع أي شخص.", "بياناتك وحسابك في أمان", 1)
print("5. ظبطت الكارت والزرارين")
open(p, "w", encoding="utf-8").write(t + "\n")
print("خلص - اتحفظ")
