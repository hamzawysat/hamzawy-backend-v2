p = "frontend/js/fanni-render.js"
lines = open(p, encoding="utf-8").read().splitlines()
print("قبل:")
print(f"35: {lines[34][:120]}")
print(f"39: {lines[38][:160]}")
print(f"58: {lines[57][:160]}")
# نغير سطر 39 بس - من حمزاوي سات لـ لوحة الفني
if "حمزاوي سات" in lines[38] and "🛰" in lines[38]:
    lines[38] = lines[38].replace("حمزاوي سات", "لوحة الفني", 1)
    print("\n✅ غيرت سطر 39 بس")
else:
    print("\n❌ سطر 39 مش زي المتوقع - متكملش")
# تصغير الدخول من غير zoom - نصغر المقاسات نفسها
# سطر 58: اللوجو 110 -> 84
if "w-[110px]" in lines[57]:
    lines[57] = lines[57].replace("w-[110px] h-[110px]", "w-[84px] h-[84px]")
    print("✅ صغرت اللوجو 110 -> 84")
open(p, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\nبعد:")
lines2 = open(p, encoding="utf-8").read().splitlines()
print(f"39: {lines2[38][:160]}")
print(f"58: {lines2[57][:160]}")
