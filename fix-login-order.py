p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
login_btn = """    <button type="button" onclick="doLogin()" ${state.loading?'disabled':''} class="w-full h-[56px] rounded-2xl text-white text-[20px] font-black shadow-lg" style="background:#101F9B">${state.loading?'جاري تسجيل الدخول...':'تسجيل الدخول'}</button>
    <div class="mt-1"><a class="text-[15px] font-extrabold" style="color:#101F9B" href="password.html?role=fanni&mode=recovery">نسيت كلمة السر؟ استعادة</a></div>"""
fixed = """    <div class="mt-1 text-left"><a class="text-[15px] font-extrabold" style="color:#101F9B" href="password.html?role=fanni&mode=recovery">نسيت كلمة السر؟ استعادة</a></div>
    <button type="button" onclick="doLogin()" ${state.loading?'disabled':''} class="w-full h-[56px] rounded-2xl text-white text-[20px] font-black shadow-lg" style="background:#101F9B">${state.loading?'جاري تسجيل الدخول...':'تسجيل الدخول'}</button>"""
assert login_btn in t, "ترتيب مش لاقيه"
t = t.replace(login_btn, fixed, 1)
# كبر جملة الأمان من 10px لـ 14px زي التطبيق
t = t.replace("text-[10px] leading-5 text-slate-500\">بياناتك وحسابك في أمان", "text-[14px] leading-5 text-slate-500\">بياناتك وحسابك في أمان", 1)
# خلي كارت الدخول مدور زي التطبيق
t = t.replace('<section class="fanni-login-panel account-panel mt-4 panel p-5 animate-fade">', '<section class="fanni-login-panel account-panel mt-4 panel p-5 animate-fade" style="border-radius:28px">', 1)
open(p, "w", encoding="utf-8").write(t)
print("اتظبط الترتيب: نسيت فوق الدخول، على الشمال، والأمان 14px")
