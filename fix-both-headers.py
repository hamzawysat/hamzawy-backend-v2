import pathlib
# --- العميل ---
p = pathlib.Path("frontend/js/client-render.js")
t = p.read_text(encoding="utf-8")
# حمزاوي سات في النص بالظبط: الصف الأول في النص، و S ثابتة على اليمين
t = t.replace('<div class="mx-auto w-full max-w-[640px] px-4 pt-2 pb-1 flex items-center justify-start gap-2" style="direction:rtl"><div class="h-8 w-8 flex items-center justify-center shrink-0" style="color:#101F9B;font-weight:900;font-size:18px">S</div>', '<div class="mx-auto w-full max-w-[640px] px-4 pt-2 pb-1 flex items-center justify-center gap-2" style="direction:rtl;position:relative"><div class="h-8 w-8 flex items-center justify-center shrink-0" style="color:#101F9B;font-weight:900;font-size:18px;position:absolute;right:16px;top:50%;transform:translateY(-50%)">S</div>', 1)
# لوحة العميل تصغر لسطر واحد
t = t.replace('style="color:#101F9B">لوحة العميل</span>', 'style="color:#101F9B">لوحة العميل</span>', 1)
t = t.replace('<span class="font-extrabold text-[24px] leading-none" style="color:#101F9B">لوحة العميل</span>', '<span class="font-extrabold text-[17px] leading-none whitespace-nowrap" style="color:#101F9B">لوحة العميل</span>', 1)
p.write_text(t, encoding="utf-8")
# --- الفني ---
f = pathlib.Path("frontend/js/fanni-render.js")
s = f.read_text(encoding="utf-8")
# حمزاوي سات في النص بالظبط زي العميل
s = s.replace('<div class="mx-auto w-full max-w-[640px] px-4 pt-2 pb-1 flex items-center justify-start gap-2" style="direction:rtl">', '<div class="mx-auto w-full max-w-[640px] px-4 pt-2 pb-1 flex items-center justify-center gap-2" style="direction:rtl;position:relative">', 1)
s = s.replace('<div class="h-8 w-8 flex items-center justify-center shrink-0" style="color:#101F9B;font-weight:900;font-size:18px">S</div>', '<div class="h-8 w-8 flex items-center justify-center shrink-0" style="color:#101F9B;font-weight:900;font-size:18px;position:absolute;right:16px;top:50%;transform:translateY(-50%)">S</div>', 1)
# لوحة الفني تصغر لسطر واحد + زرارين في الصف التاني زي العميل
s = s.replace('<span class="font-extrabold text-[24px] leading-none" style="color:#101F9B">لوحة الفني</span>', '<span class="font-extrabold text-[17px] leading-none whitespace-nowrap" style="color:#101F9B">لوحة الفني</span>', 1)
old_f = '</div>\n  </div>                                              </header>'
new_f = '</div><div class="flex items-center gap-1.5 shrink-0"><a href="/" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8EDFF;color:#101F9B;border:1px solid #D5DDFE">القائمة الرئيسية</a><a href="/download" class="h-9 px-3 rounded-xl inline-flex items-center justify-center text-[11px] font-extrabold whitespace-nowrap" style="background:#E8F5E9;color:#1B7A2E;border:1px solid #C8E6C9">تحميل التطبيق</a></div>\n  </div>                                              </header>'
if old_f in s:
    s = s.replace(old_f, new_f, 1)
    print("fanni row2 added")
else:
    print("fanni row2 pattern NOT found - check manually")
f.write_text(s, encoding="utf-8")
print("both headers fixed")
