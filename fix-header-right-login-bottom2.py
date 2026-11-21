p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
# 1. الهيدر يروح يمين
old_h = '<div class="mx-auto w-full max-w-[640px] px-4 pt-2 pb-1 flex items-center justify-end gap-2">'
if old_h in t:
    t = t.replace(old_h, '<div class="mx-auto w-full max-w-[640px] px-4 pt-2 pb-1 flex items-center justify-start gap-2" style="direction:rtl">', 1)
    print("1. الهيدر بقى على اليمين - S فوق الجرس")
else:
    print("1. الهيدر متعملش قبل كده أو اتعمل - هكمل")
# 2. الزرارين تحت الكارت - التاني باسمه المختصر منصات التواصل
old_safe = "${state.tab==='login'?'<p class=\"mt-4 text-center text-[14px] leading-5 text-slate-500\">بياناتك وحسابك في أمان</p>':''}"
if old_safe in t and "منصات التواصل" not in t.split(old_safe)[1][:500]:
    new_safe = old_safe + "\n    ${state.tab==='login'?'<div class=\"mt-5 flex gap-2\"><a href=\"/download\" class=\"flex-1 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black text-white\" style=\"background:#101F9B!important;color:#FFFFFF!important\">⬇ تحميل التطبيق</a><a href=\"/links\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"flex-1 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black\" style=\"background:#EEF2FF!important;color:#101F9B!important;border:1px solid #D5DDFE!important\">🔗 منصات التواصل</a></div>':''}"
    t = t.replace(old_safe, new_safe, 1)
    print("2. رجعت تحميل التطبيق + منصات التواصل تحت الكارت")
else:
    # لو الزرارين اتعملوا بالاسم الطويل قبل كده، نختصر الاسم بس
    if "تابعنا على منصات التواصل" in t:
        t = t.replace("🔗 تابعنا على منصات التواصل", "🔗 منصات التواصل", 1)
        print("2. اختصرت الاسم لـ منصات التواصل")
    else:
        print("2. الزرارين موجودين بالاسم المختصر")
open(p, "w", encoding="utf-8").write(t)
print("خلص")
