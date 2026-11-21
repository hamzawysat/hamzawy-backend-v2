p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
old = '<a href="/" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold flex items-center">‹ الصفحة الرئيسية</a>'
new = '<button type="button" onclick="window.location.href=\'/\'" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold">‹ الصفحة الرئيسية</button>'
if old in t:
    t = t.replace(old, new, 1)
    print("✅ خليته button زي رجوع بالظبط - مش a")
else:
    print("❌ مش لاقي سطر الصفحة الرئيسية")
open(p, "w", encoding="utf-8").write(t)
print("خلص - راجع الفرق تحت")
