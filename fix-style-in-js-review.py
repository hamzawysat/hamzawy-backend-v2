p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
print(f"أول 80 حرف: {t[:80]}")
# نشيل سطر الـ <style> الغلط من أول الملف
old = "<style>.no-yellow-btn:active,.no-yellow-btn:focus{background:#FFFFFF!important;color:#101F9B!important;box-shadow:none!important}</style>"
if old in t:
    t = t.replace(old, "", 1)
    print("✅ شلت سطر <style> الغلط من ملف JS")
else:
    print("❌ مش لاقي سطر الستايل الغلط")
# نحط القاعدة بالطريقة الصح - كود JS بيخلق ستايل، مش HTML
inject = """try{if(document && !document.getElementById('no-yellow-style')){var s=document.createElement('style');s.id='no-yellow-style';s.textContent='.no-yellow-btn:active,.no-yellow-btn:focus{background:#FFFFFF!important;color:#101F9B!important;box-shadow:none!important}';document.head.appendChild(s);}}catch(e){}\n"""
if "no-yellow-style" not in t:
    t = inject + t
    print("✅ حطيت القاعدة الصح بالـ JS")
open(p, "w", encoding="utf-8").write(t)
print("خلص")
