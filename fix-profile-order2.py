p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
# 1. نفتح كارت الشاراتي الأخضر جوه بيانات العمل قبل كلمة شاراتي
t = t.replace(
  '      <div class="font-extrabold text-[12px] text-emerald-900">شاراتي</div>',
  '      <div class="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"><div class="font-extrabold text-[12px] text-emerald-900">شاراتي</div>',
  1)
# 2. نشيل سطر الكارت الفاضي اللي قبل تسجيل الخروج
t = t.replace('     <div class="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">\n     <button onclick="logout()"', '     <button onclick="logout()"', 1)
open(p, "w", encoding="utf-8").write(t)
print("اتصلح")
