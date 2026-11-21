p = "frontend/js/fanni-render.js"
lines = open(p, encoding="utf-8").read().splitlines()
# سطور 24-26 هي الهيدر الأول - indices 23,24,25
print("قبل:", lines[23].strip()[:40], "|", lines[24].strip()[:40], "|", lines[25].strip()[:40])
# نبدل الترتيب: S الأول (يمين) - اللوجو - حمزاوي سات آخر (شمال)
hamzawy = lines[23]
logo = lines[24]
s_letter = lines[25]
lines[23] = s_letter
lines[24] = logo
lines[25] = hamzawy
print("بعد: S على اليمين، اللوجو، حمزاوي سات")
# نبدل القلم بقمر صناعي في السطر التاني
for i, l in enumerate(lines):
    if "✎" in l and "حمزاوي سات" in l:
        lines[i] = l.replace("✎", "🛰️")
        print("تم: القلم بقى قمر صناعي في سطر", i+1)
open(p, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("خلص")
