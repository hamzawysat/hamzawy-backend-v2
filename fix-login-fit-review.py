p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
print("قبل:")
for s in ['text-[34px]', 'text-[26px]', 'mb-6', 'mt-4 text-[15px]']:
    print(f"  {s} موجود: {t.count(s)} مرة")
# 1. عنوان حمزاوي سات 34 -> 28
t = t.replace('text-[34px]', 'text-[28px]', 1)
print("✅ عنوان حمزاوي سات 34 -> 28")
# 2. أهلاً بيك 26 -> 21
t = t.replace('text-[26px]', 'text-[21px]', 1)
print("✅ أهلاً بيك 26 -> 21")
# 3. مسافة فوق اللوجو mb-6 -> mb-3 (أول واحدة بس في الدخول)
t = t.replace('text-center mb-6', 'text-center mb-3', 1)
print("✅ مسافة اللوجو mb-6 -> mb-3")
open(p, "w", encoding="utf-8").write(t)
print("خلص - راجع الفرق تحت")
