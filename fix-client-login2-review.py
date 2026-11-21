p = "frontend/js/client-account.js"
t = open(p, encoding="utf-8").read()
# 1. الليبلات على الشمال زي الفني
for lbl in ["رقم الموبايل", "كلمة السر", "الاسم بالكامل"]:
    old = f'<label class="block mb-1.5 text-[11px] font-extrabold">{lbl}</label>'
    new = f'<label class="block mb-1.5 text-[11px] font-extrabold" style="text-align:left">{lbl}</label>'
    if old in t:
        t = t.replace(old, new)
        print(f"✅ الليبل {lbl} بقى على الشمال")
# 2. نسيت كلمة السر فوق زرار الدخول على الشمال - زي الفني
old_submit = '<button type="submit"'
new_forgot = '<div style="text-align:left"><a href="password.html?role=client&mode=recovery" style="color:#101F9B;font-weight:800;font-size:13px">نسيت كلمة السر؟ استعادة</a></div>'
if old_submit in t and "نسيت كلمة السر؟ استعادة" not in t:
    # نحطه قبل أول زرار submit في الدخول - بس في وضع الدخول مش التسجيل
    # هنحطه قبل h+='<button type="submit"
    t = t.replace("h+='<button type=\"submit\"", "h+='" + new_forgot + "<button type=\"submit\"", 1)
    print("✅ حطيت نسيت كلمة السر فوق الدخول")
# 3. زرار الدخول يبقى أزرق غامق زي الفني
if "account-submit w-full h-11" in t:
    t = t.replace("account-submit w-full h-11 rounded-xl blue-btn font-black text-[13px] bg-blue-600 text-white", "account-submit w-full h-12 rounded-xl font-black text-[15px] text-white\" style=\"background:#101F9B!important;color:#FFFFFF!important", 1)
    print("✅ زرار الدخول بقى أزرق غامق")
open(p, "w", encoding="utf-8").write(t)
print("خلص - المرحلة 2")
