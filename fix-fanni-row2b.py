import pathlib, re
p = pathlib.Path("frontend/js/fanni-render.js")
t = p.read_text(encoding="utf-8")
pat = re.compile(r'<button type="button" onclick="toggleNotifications\(\)".*?notificationBadge\(\)\}</button>\s*<div class="flex items-center gap-1 min-w-0"><span class="font-extrabold text-\[17px\] leading-none whitespace-nowrap" style="color:#101F9B">لوحة الفني</span><span aria-hidden="true" style="color:#101F9B;font-size:20px">🛰️</span></div>', re.DOTALL)
m = pat.search(t)
print("found:", bool(m))
assert m, "fanni row2 pattern not found"
bell = '<button type="button" onclick="toggleNotifications()" aria-label="الاشعارات" title="الاشعارات" class="relative h-9 w-9 flex items-center justify-center shrink-0" style="color:#94A3B8;font-size:24px;line-height:1">🔔${notificationBadge()}</button>'
cards = '<a href="/" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8EDFF;color:#101F9B;border:1px solid #D5DDFE">القائمة الرئيسية</a><a href="/download" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8F5E9;color:#1B7A2E;border:1px solid #C8E6C9">تحميل التطبيق</a>'
board = '<div class="flex items-center gap-1 min-w-0"><span class="font-extrabold text-[17px] leading-none whitespace-nowrap" style="color:#101F9B">لوحة الفني</span><span aria-hidden="true" style="color:#101F9B;font-size:20px">🛰️</span></div>'
new = f'<div class="flex items-center gap-1.5 shrink-0">{bell}{cards}</div>{board}'
t = pat.sub(new, t, count=1)
p.write_text(t, encoding="utf-8")
print("fanni row2 fixed like client")
