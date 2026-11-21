import pathlib
p = pathlib.Path("new_gate.js")
a = p.read_text(encoding="utf-8").splitlines()
# index 34,35,36 = سطور 35,36,37
a[34] = "h+='<p class=\"mt-1 text-[14px] text-slate-500\">'+(reg?'أنشئ حساب عميل جديد '+"
a[35] = "'علشان تطلب الخدمات وتتابع طلباتك.':'سجّل دخولك علشان تطلب خدمة '+"
a[36] = "'وتتابع طلباتك من حسابك.')+'</p></div>';"
p.write_text("\n".join(a) + "\n", encoding="utf-8")
print("fixed")
