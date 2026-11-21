p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
# 1. أهلاً بيك: 21 -> 18 + leading-9 -> leading-7 + mt-4 -> mt-2
old_h2 = 'mt-4 text-[21px] font-black leading-9'
if old_h2 in t:
    t = t.replace(old_h2, 'mt-2 text-[18px] font-black leading-7', 1)
    print("✅ أهلاً بيك 21 -> 18 + leading-7 + mt-2")
else:
    print("❌ سطر أهلاً بيك مش زي المتوقع")
# 2. عنوان حمزاوي سات: mt-4 -> mt-2
old_h1 = 'mt-4 text-[28px]'
if old_h1 in t:
    t = t.replace(old_h1, 'mt-2 text-[28px]', 1)
    print("✅ عنوان حمزاوي سات mt-4 -> mt-2")
# 3. الكارت: p-5 -> p-4 + mt-4 -> mt-2
old_card = 'fanni-login-panel account-panel mt-4 panel p-5'
if old_card in t:
    t = t.replace(old_card, 'fanni-login-panel account-panel mt-2 panel p-4', 1)
    print("✅ الكارت p-5 -> p-4 + mt-4 -> mt-2")
else:
    print("❌ سطر الكارت مش زي المتوقع")
open(p, "w", encoding="utf-8").write(t)
print("خلص - راجع الفرق تحت")
