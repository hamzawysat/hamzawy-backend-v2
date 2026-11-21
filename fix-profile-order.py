p = "frontend/js/fanni-render.js"
lines = open(p, encoding="utf-8").read().splitlines()
# سطر 366 هو index 365، سطور الشاراتي 369-371، سطر الخروج 372
print("قبل:", lines[369].strip()[:60], "|", lines[372].strip()[:40])
# 1. نكبر خط بيانات الحساب + بيانات العمل في سطر 366
# العناوين الصغيرة من 10px لـ 12px، والقيم نضيفلها 15px
lines[365] = lines[365].replace('text-[10px] text-slate-500', 'text-[12px] text-slate-500')
# نكبر القيمة <b> في بيانات الحساب والعمل - نضيف ستايل
lines[365] = lines[365].replace('<b>${esc(x[1]', '<b style="font-size:15px" >${esc(x[1]')
print("تم: كبرت خط بيانات الحساب وبيانات العمل")
# 2. ناخد بلوك الشاراتي كله
badges = lines[369:372]  # 3 سطور: فتح + عنوان + شارات + قفل
logout_line = lines[372]
# 3. نحط الشاراتي جوه بيانات العمل - في اخر سطر 366 قبل </div></div>
# سطر 366 بينتهي بـ </div></div> - هنحط الشاراتي قبله
badges_html = "\n".join(badges)
# نصغر margin الشاراتي لما يبقى جوه الكارت
badges_html = badges_html.replace('class="mt-4 rounded-xl', 'class="mt-3 rounded-xl')
lines[365] = lines[365].replace('</div></div>', badges_html + '</div></div>', 1)
print("تم: رفعت شاراتي جوه بيانات العمل")
# 4. مكان الشاراتي نحط تسجيل الخروج
lines[369:372] = [logout_line]
# 5. نشيل سطر تسجيل الخروج القديم - بقى مكرر
# بعد الاستبدال، السطر القديم بقى في index 370
if "تسجيل الخروج" in lines[370]:
    del lines[370]
    print("تم: تسجيل الخروج طلع مكان شاراتي")
open(p, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("خلص")
