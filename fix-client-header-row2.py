import pathlib
p = pathlib.Path("frontend/js/client-render.js")
t = p.read_text(encoding="utf-8")
old = '<div class="flex items-center gap-1 min-w-0"><span class="font-extrabold text-[24px] leading-none" style="color:#101F9B">لوحة العميل</span><span aria-hidden="true" style="color:#101F9B;font-size:20px">🏠</span></div></div></header>'
new = '<div class="flex items-center gap-1 min-w-0"><span class="font-extrabold text-[24px] leading-none" style="color:#101F9B">لوحة العميل</span><span aria-hidden="true" style="color:#101F9B;font-size:20px">🛰️</span></div><div class="flex items-center gap-1.5 shrink-0"><a href="/" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8EDFF;color:#101F9B;border:1px solid #D5DDFE">القائمة الرئيسية</a><a href="/download" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8F5E9;color:#1B7A2E;border:1px solid #C8E6C9">تحميل التطبيق</a></div></div></header>'
assert old in t, "header row2 not found"
t = t.replace(old, new, 1)
p.write_text(t, encoding="utf-8")
print("row2 + satellite fixed")
