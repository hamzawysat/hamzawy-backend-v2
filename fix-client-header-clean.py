import pathlib, re
p = pathlib.Path("frontend/js/client-render.js")
t = p.read_text(encoding="utf-8")
new_header = """<header class="bg-white"><div class="mx-auto w-full max-w-[640px] px-4 pt-2 pb-1 flex items-center justify-start gap-2" style="direction:rtl"><div class="h-8 w-8 flex items-center justify-center shrink-0" style="color:#101F9B;font-weight:900;font-size:18px">S</div><div class="brand-mark h-10 w-10 rounded-lg flex items-center justify-center shrink-0"><img class="sonaa-logo-svg" src="/images/LOGO_UPLOAD_HERE/logo.png" alt="شعار حمزاوي سات" style="width:100%;height:100%;object-fit:contain"></div><span class="font-extrabold text-[20px] leading-none" style="color:#101F9B">حمزاوي سات</span></div><div class="mx-auto w-full max-w-[640px] px-4 py-2 flex items-center justify-between gap-2" style="border-top:1px solid #EEF2FF"><button type="button" onclick="toggleNotifications()" aria-label="الاشعارات" title="الاشعارات" class="relative h-9 w-9 flex items-center justify-center shrink-0" style="color:#94A3B8;font-size:24px;line-height:1">🔔${notificationBadge()}</button><div class="flex items-center gap-1 min-w-0"><span class="font-extrabold text-[24px] leading-none" style="color:#101F9B">لوحة العميل</span><span aria-hidden="true" style="color:#101F9B;font-size:20px">🏠</span></div></div></header>"""
pat = re.compile(r"<header class=\"app-header.*?</header>", re.DOTALL)
assert pat.search(t), "client header not found"
t = pat.sub(new_header, t, count=1)
p.write_text(t, encoding="utf-8")
print("header cleaned like fanni")
