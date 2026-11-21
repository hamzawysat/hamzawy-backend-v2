p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
old = '<div class="w-full max-w-[440px] mx-auto"'
if old in t:
    t = t.replace(old, '<div class="w-full max-w-[440px] mx-auto" style="margin-top:-20px"', 1)
    print("✅ رفعت الصفحة كلها 20px لفوق - أكلت المساحة اللي فوق رجوع")
else:
    print("❌ مش لاقي حاوية الدخول")
open(p, "w", encoding="utf-8").write(t)
print("خلص - راجع الفرق تحت")
