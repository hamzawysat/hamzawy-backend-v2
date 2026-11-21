p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
old = '<div class="flex w-full justify-start mb-4"><button type="button" onclick="goBack()" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold">رجوع ›</button></div>'
new = '<div class="flex w-full justify-between mb-4"><a href="/" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold flex items-center">‹ الصفحة الرئيسية</a><button type="button" onclick="goBack()" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold">رجوع ›</button></div>'
if old in t:
    t = t.replace(old, new, 1)
    print("✅ حطيت الصفحة الرئيسية قصاد رجوع - نفس اللون والارتفاع")
else:
    print("❌ سطر رجوع مش زي المتوقع - ابعتلي السطر بتاعه")
open(p, "w", encoding="utf-8").write(t)
print("خلص - راجع الفرق تحت")
