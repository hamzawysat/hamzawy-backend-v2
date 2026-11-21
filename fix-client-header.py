import pathlib
p = pathlib.Path("frontend/js/client-render.js")
t = p.read_text(encoding="utf-8")

# 1 - الصف الأول يبقى زي الفني: لوجو + اسم بس
t = t.replace(
  '<div class="mx-auto w-full max-w-[640px] px-3 sm:px-4 py-2 flex items-center justify-between gap-2">',
  '<div class="mx-auto w-full max-w-[640px] px-4 pt-2 pb-1 flex items-center justify-start gap-2" style="direction:rtl">',
  1
)
# 2 - اللوجو من 64px لـ 40px زي الفني
t = t.replace(
  'brand-mark h-16 w-16 sm:h-[84px] sm:w-[84px]',
  'brand-mark h-10 w-10',
  1
)
# 3 - الاسم يبقى 20px من غير truncate، والشعار يتشال من الصف الأول
t = t.replace(
  '<div class="min-w-0"><h1 class="font-extrabold text-[16px] leading-tight truncate"><span class="sonaa-brand-shimmer">',
  '<div class="min-w-0"><span class="font-extrabold text-[20px] leading-none" style="color:#101F9B"><span class="sonaa-brand-shimmer">',
  1
)
# اقفل الـ span بدل h1 وشيل سطر الشعار
t = t.replace(
  '</span></h1><p class="client-header-slogan mt-2 text-sm sm:text-base font-black whitespace-nowrap">كل خدمة تبدأ بخطوة</p></div>',
  '</span></span></div>',
  1
)
# 4 - اقفل الصف الأول وافتح صف تاني للزرار زي الفني
t = t.replace(
  '</div>                                                <div class="flex flex-col items-end gap-1.5 shrink-0">',
  '</div></div><div class="mx-auto w-full max-w-[640px] px-4 py-2 flex items-center justify-between gap-2" style="border-top:1px solid #EEF2FF"><div class="flex items-center gap-1 min-w-0"><span class="font-extrabold text-[24px] leading-none" style="color:#101F9B">مرحباً</span></div><div class="flex flex-col items-end gap-1.5 shrink-0">',
  1
)
p.write_text(t, encoding="utf-8")
print("header patched")
