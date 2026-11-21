p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
# 1. نحط كلاس no-yellow على زرار الصفحة الرئيسية
old_btn = '<button type="button" onclick="window.location.href=\'/\'" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold">‹ الصفحة الرئيسية</button>'
new_btn = '<button type="button" onclick="window.location.href=\'/\'" class="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[#101F9B] text-[15px] font-extrabold no-yellow-btn" style="background:#FFFFFF!important;color:#101F9B!important">‹ الصفحة الرئيسية</button>'
if old_btn in t:
    t = t.replace(old_btn, new_btn, 1)
    print("✅ حطيت كلاس no-yellow-btn على الصفحة الرئيسية")
else:
    print("❌ مش لاقي زرار الصفحة الرئيسية")
# 2. نحط قاعدة تمنع الأصفر لما يتداس - في أول الستايل بتاع الصفحة
rule = "<style>.no-yellow-btn:active,.no-yellow-btn:focus{background:#FFFFFF!important;color:#101F9B!important;box-shadow:none!important}</style>"
if "no-yellow-btn:active" not in t:
    t = rule + t
    print("✅ حطيت قاعدة تمنع الأصفر لما يتداس")
open(p, "w", encoding="utf-8").write(t)
print("خلص - راجع الفرق تحت")
