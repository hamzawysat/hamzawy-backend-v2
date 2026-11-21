p = "frontend/js/client-account.js"
t = open(p, encoding="utf-8").read()
# 1. نص الزرارين يبقى أبيض بجد - حتى لو المتصفح بيجبر اللون
t = t.replace('style="background:#101F9B!important;color:#FFFFFF!important">', 'style="background:#101F9B!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">')
t = t.replace('style="background:#2E7CF6!important;color:#FFFFFF!important">', 'style="background:#2E7CF6!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important">')
print("✅ نص الزرارين بقى أبيض")
# 2. نصغر المسافات فوق علشان الصفحة تظبط من غير سكرول
t = t.replace('min-h-screen px-4 py-6', 'min-h-screen px-4 py-3', 1)
t = t.replace('<div class="flex w-full justify-between mb-4">', '<div class="flex w-full justify-between mb-2">', 1)
t = t.replace('<div class="text-center mb-3">', '<div class="text-center mb-2">', 1)
print("✅ صغرت المسافات فوق")
open(p, "w", encoding="utf-8").write(t)
