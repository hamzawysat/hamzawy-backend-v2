import re
p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()

# 1. نشيل أي <style> اتحط غلط في ملف الـ JS
t2 = re.sub(r'<style id="login-shrink[^>]*>.*?</style>', '', t, flags=re.DOTALL)
t2 = re.sub(r'<style id="login-shrink2".*?</style>', '', t2, flags=re.DOTALL)
print(f"شلت الستايل الغلط: {len(t)-len(t2)} حرف اتشال")
t = t2

# 2. نشيل الكلاس اللي اتحط غلط لو موجود
t = t.replace(' login-shrink', '')
print("شلت كلاس login-shrink الغلط")

# 3. نحط التصغير بالطريقة الصح: كود JS بيخلق ستايل، مش HTML في ملف JS
inject = """
// login-shrink-fix: تصغير صفحة الدخول 12% بالـ JS مش بالـ HTML
try{
  if(document && !document.getElementById('login-shrink2')){
    var s=document.createElement('style'); s.id='login-shrink2';
    s.textContent='.login-shrink{zoom:.88!important;transform-origin:top center!important}.login-shrink img{max-height:84px!important}';
    document.head.appendChild(s);
  }
}catch(e){}
"""
if 'login-shrink-fix' not in t:
    t = inject + t
    print("حطيت التصغير الصح بالـ JS")

# 4. نتأكد إن مفيش <style> فاضل في ملف JS
if '<style' in t:
    print("⚠️ لسه فيه <style> في الملف - متعملش push")
else:
    print("✅ الملف نضيف - مفيش <style> في ملف JS")

open(p, "w", encoding="utf-8").write(t)
print("خلص")
