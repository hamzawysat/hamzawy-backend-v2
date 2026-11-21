p = "frontend/js/fanni-core.js"
t = open(p, encoding="utf-8").read()
old = "const bg=type==='success'?'bg-emerald-600':type==='pending'?'bg-amber-600':'bg-[#0b1b3a]';"
new = "const bg=type==='success'?'bg-[#2E7CF6]':type==='pending'?'bg-[#2E7CF6]':'bg-[#0b1b3a]';"
assert old in t, "مش لاقي سطر اللون"
t = t.replace(old, new, 1)
open(p, "w", encoding="utf-8").write(t)
print("اتغير: كل رسائل النجاح بقت أزرق فاتح #2E7CF6")
