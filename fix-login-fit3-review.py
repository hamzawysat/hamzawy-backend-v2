p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
# 1. اللوجو 84 -> 68
if "w-[84px] h-[84px]" in t:
    t = t.replace("w-[84px] h-[84px]", "w-[68px] h-[68px]", 1)
    print("✅ اللوجو 84 -> 68")
# 2. عنوان حمزاوي سات 28 -> 24
if "text-[28px]" in t:
    t = t.replace("text-[28px]", "text-[24px]", 1)
    print("✅ العنوان 28 -> 24")
# 3. الكارتين اللي تحت: mt-5 -> mt-3
if "mt-5 flex gap-2" in t:
    t = t.replace("mt-5 flex gap-2", "mt-3 flex gap-2", 1)
    print("✅ الكارتين mt-5 -> mt-3")
else:
    print("⚠️ سطر الكارتين مش زي المتوقع - ابعتلي السطر بتاعه")
# 4. الكارتين طولهم h-12 -> h-11 (الاتنين اللي فيهم تحميل التطبيق)
import re
m = re.search(r"تحميل التطبيق.{0,200}", t)
print(f"سطر الكارتين: {m.group(0)[:150] if m else 'مش لاقيه'}")
open(p, "w", encoding="utf-8").write(t)
print("خلص - راجع الفرق تحت")
