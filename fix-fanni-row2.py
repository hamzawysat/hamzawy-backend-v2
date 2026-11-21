import pathlib
p = pathlib.Path("frontend/js/fanni-render.js")
t = p.read_text(encoding="utf-8")
old = '<button type="button" onclick="toggleNotifications()" aria-label="الاشعارات" title="الاشعارات" class="relative h-9 w-9 flex items-center justify-center shrink-0" style="color:#94A3B8;font-size:24px;line-height:1">🔔${notificationBadge()}</button>                        <div class="flex items-center gap-1 min-w-0"><span class="font-extrabold text-[17px] leading-none whitespace-nowrap" style="color:#101F9B">لوحة الفني</span><span aria-hidden="true" style="color:#101F9B;font-size:20px">🛰️</span></div>'
new = '<div class="flex items-center gap-1.5 shrink-0"><button type="button" onclick="toggleNotifications()" aria-label="الاشعارات" title="الاشعارات" class="relative h-9 w-9 flex items-center justify-center shrink-0" style="color:#94A3B8;font-size:24px;line-height:1">🔔${notificationBadge()}</button><a href="/" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8EDFF;color:#101F9B;border:1px solid #D5DDFE">القائمة الرئيسية</a><a href="/download" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8F5E9;color:#1B7A2E;border:1px solid #C8E6C9">تحميل التطبيق</a></div><div class="flex items-center gap-1 min-w-0"><span class="font-extrabold text-[17px] leading-none whitespace-nowrap" style="color:#101F9B">لوحة الفني</span><span aria-hidden="true" style="color:#101F9B;font-size:20px">🛰️</span></div>'
assert old in t, "fanni row2 not found"
t = t.replace(old, new, 1)
p.write_text(t, encoding="utf-8")
print("fanni row2 fixed like client")
