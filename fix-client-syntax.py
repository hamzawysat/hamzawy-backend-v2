p = "frontend/js/client-account.js"
t = open(p, encoding="utf-8").read()
old = "نسيت كلمة السر؟ استعادة</a></div>')+\"<button"
new = "نسيت كلمة السر؟ استعادة</a></div>');h+='<button"
if old in t:
    t = t.replace(old, new, 1)
    print("✅ صلحت القوس")
else:
    print("❌ مش لاقي المكان - ابعتلي سطر 59")
open(p, "w", encoding="utf-8").write(t)
