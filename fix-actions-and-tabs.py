import pathlib
# 1 - الإجراءات: كل واحد كارت button لوحده
p = pathlib.Path("frontend/css/ui-light-surfaces.css")
t = p.read_text(encoding="utf-8")
t += "\nhtml[data-sonaa-theme=\"client\"] body #app .client-home-actions{display:grid !important; gap:7px !important; padding:0 !important; background:transparent !important; box-shadow:none !important; overflow:visible !important;}\nhtml[data-sonaa-theme=\"client\"] body #app .client-home-action, html[data-sonaa-theme=\"client\"] body #app a.client-home-action, html[data-sonaa-theme=\"client\"] body #app button.client-home-action{display:flex !important; align-items:center !important; gap:11px !important; width:100% !important; min-height:48px !important; padding:7px 11px !important; border:1px solid #E6EAF2 !important; border-radius:13px !important; background:#FFFFFF !important; background-image:none !important; box-shadow:0 2px 0 #E6EAF2 !important; text-decoration:none !important;}\n"
p.write_text(t, encoding="utf-8")
# 2 - التبوبات اللي تحت في المتصفح: نفس التطبيق 5 بس
r = pathlib.Path("frontend/js/client-render.js")
s = r.read_text(encoding="utf-8")
old = "{id:'home',icon:'⌂',label:'الرئيسية'},{id:'new',icon:'＋',label:'طلب جديد'},{id:'orders',icon:'📋',label:'طلباتي'},{id:'wallet',icon:'💳',label:'المحفظة'},{id:'subscriptions',icon:'📄',label:'الاشتراكات'},{id:'store',icon:'🛍️',label:'المتجر'},{id:'complaint',icon:'🎧',label:'الشكاوى'}"
new = "{id:'home',icon:'⌂',label:'الرئيسية'},{id:'store',icon:'🛍️',label:'المتجر'},{id:'wallet',icon:'💳',label:'المحفظة'},{id:'orders',icon:'📋',label:'الطلبات'},{id:'profile',icon:'👤',label:'حسابي'}"
assert old in s, "bottom nav not found"
s = s.replace(old, new, 1)
# الشبكة من 7 لـ 5 زي التطبيق
s = s.replace("grid grid-cols-7", "grid grid-cols-5", 1)
r.write_text(s, encoding="utf-8")
print("actions + tabs fixed")
