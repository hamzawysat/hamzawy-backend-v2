p = "frontend/js/client-account.js"
t = open(p, encoding="utf-8").read()
# 1. تصليح الـ style اللي اتكسر
old_bad = 'style="background:#101F9B!important;color:#FFFFFF!important hover:bg-blue-700 transition-colors"'
new_good = 'style="background:#101F9B!important;color:#FFFFFF!important"'
if old_bad in t:
    t = t.replace(old_bad, new_good)
    print("✅ صلحت style زرار الدخول")
else:
    print("⚠️ مش لاقي الـ style المكسور - ابعتلي سطر الدخول")
# 2. شيل اللينك المكرر تحت + خلي تسجيل عميل جديد زرار أزرق فاتح
old_bottom = """'+(reg?'':'<div class="mt-3 flex items-center justify-between gap-3" dir="rtl"><button type="button" onclick="setAccountAuthMode(\\'register\\')" class="account-register-link text-[11px] font-bold text-black underline decoration-black underline-offset-2 hover:text-black">تسجيل عميل جديد</button><a class="text-[11px] font-bold text-black underline decoration-black underline-offset-2 hover:text-black" href="password.html?role=client&mode=recovery">نسيت كلمة المرور؟</a></div>')+'<p class="mt-3 text-center text-[10px] leading-5 text-slate-400">كلمة السر لا تُشارك مع أي شخص.</p></div></div></main>'"""
new_bottom = """'+(reg?'':'<button type="button" onclick="setAccountAuthMode(\\'register\\')" class="w-full h-12 mt-3 rounded-xl font-black text-[15px] text-white" style="background:#2E7CF6!important;color:#FFFFFF!important">إنشاء حساب عميل جديد</button><p class="mt-3 text-center text-[12px] leading-5 text-slate-500">بالدخول أنت توافق على شروط الاستخدام وسياسة الخصوصية</p>')+'</div><div class="mt-4 flex gap-2"><a href="/download" class="flex-1 h-11 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-black text-white" style="background:#101F9B!important;color:#FFFFFF!important">⬇ تحميل التطبيق</a><a href="/links" target="_blank" rel="noopener noreferrer" class="flex-1 h-11 rounded-xl inline-flex items-center justify-center gap-1.5 text-[13px] font-black border border-slate-200 bg-white text-[#101F9B]">🔗 منصات التواصل</a></div></div></main>'"""
if old_bottom in t:
    t = t.replace(old_bottom, new_bottom)
    print("✅ تسجيل عميل جديد بقى زرار أزرق فاتح + شلت نسيت المكررة + رجعت تحميل + منصات تحت")
else:
    print("❌ مش لاقي بلوك الأسفل بالظبط - ابعتلي سطر 59 كامل")
open(p, "w", encoding="utf-8").write(t)
print("خلص - المرحلة 3")
