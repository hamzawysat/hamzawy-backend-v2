import pathlib
# 1 - اسمح لحسابي انها تفتح
p = pathlib.Path("frontend/js/client-actions.js")
t = p.read_text(encoding="utf-8")
old = "['home','new','orders','track','wallet','subscriptions','store','complaint']"
new = "['home','new','orders','track','wallet','subscriptions','store','complaint','profile']"
assert old in t, "setTab list not found"
t = t.replace(old, new, 1)
p.write_text(t, encoding="utf-8")
print("profile tab allowed")
# 2 - النجاح عند الفني: من أخضر لأزرق زي شريط المعاينة
f = pathlib.Path("frontend/js/fanni-auth.js")
s = f.read_text(encoding="utf-8")
s = s.replace("text-emerald-700 bg-emerald-50 border border-emerald-100", "text-white bg-[#2E86FF] border border-[#2E86FF]", 1)
f.write_text(s, encoding="utf-8")
print("fanni success -> blue")
