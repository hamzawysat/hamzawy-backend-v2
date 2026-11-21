p = "frontend/js/client-account.js"
t = open(p, encoding="utf-8").read()
# 1. نبدل الناف اللي فوق (3 زرارين + تابعنا) + البراند ببلوك زي الفني
start = t.find('<nav dir="rtl" class="account-top-nav')
end = t.find('<div class="panel account-panel', start)
print(f"البلوك من {start} لـ {end} - طوله {end-start} حرف")
if start!=-1 and end!=-1:
    new_block = """<div class="flex w-full justify-between mb-4"><button type="button" onclick="window.location.href='/'" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold no-yellow-btn" style="background:#FFFFFF!important;color:#101F9B!important">‹ الصفحة الرئيسية</button><button type="button" onclick="goBack()" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold">رجوع ›</button></div><div class="text-center mb-3"><div class="mx-auto w-[68px] h-[68px] rounded-[28px] bg-white border border-slate-200 flex items-center justify-center shadow-sm p-3"><img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" alt="شعار حمزاوي سات" style="width:100%;height:100%;object-fit:contain"></div><h1 class="mt-2 text-[24px] font-black" style="color:#101F9B">حمزاوي سات</h1><p class="mt-1 text-[15px] font-bold text-slate-500">خدماتك وشغلك... في مكان واحد</p><div class="mt-2"><span class="inline-block px-4 py-1.5 rounded-full bg-[#E8EDFF] text-[#101F9B] text-[14px] font-extrabold">حساب عميل</span></div><h2 class="mt-2 text-[18px] font-black leading-7" style="color:#101F9B">"""+("""'تسجيل عميل جديد'""" if False else """'+(reg?'تسجيل عميل جديد':'أهلاً بيك في حمزاوي سات')+'""")+"""</h2><p class="mt-1 text-[14px] text-slate-500">'+(reg?'أنشئ حساب عميل جديد علشان تطلب الخدمات وتتابع طلباتك.':'سجّل دخولك علشان تطلب خدمة وتتابع طلباتك من حسابك.')+'</p></div>"""
    t = t[:start] + new_block + t[end:]
    print("✅ بدلت الناف + البراند ببلوك زي الفني - حساب عميل")
else:
    print("❌ مش لاقي بلوك الناف")
open(p, "w", encoding="utf-8").write(t)
print("خلص - المرحلة 1 بس")
