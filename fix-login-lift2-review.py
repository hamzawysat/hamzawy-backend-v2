p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
old = '<div class="w-full max-w-[440px] mx-auto" style="margin-top:-20px" style="margin-inline:auto">'
new = '<div class="w-full max-w-[440px] mx-auto" style="margin-top:-20px;margin-inline:auto">'
if old in t:
    t = t.replace(old, new, 1)
    print("✅ دمجت الاتنين style في واحد - دلوقتي صح")
else:
    print("❌ مش لاقي السطر الغلط")
open(p, "w", encoding="utf-8").write(t)
print("خلص")
