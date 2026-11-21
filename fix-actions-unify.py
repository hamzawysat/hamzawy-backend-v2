import pathlib
p = pathlib.Path("frontend/css/ui-light-surfaces.css")
t = p.read_text(encoding="utf-8")
# استثني زرار الإجراءات من قاعدة الزرار العامة زي الهيرو والدعوة
if ":not(.client-home-action)" not in t:
    t = t.replace(":not(.client-home-referral){", ":not(.client-home-referral):not(.client-home-action){", 1)
    print("exempted")
else:
    print("already exempted")
t += "\nhtml[data-sonaa-theme=\"client\"] body #app .client-home-action, html[data-sonaa-theme=\"client\"] body #app a.client-home-action, html[data-sonaa-theme=\"client\"] body #app button.client-home-action{background:transparent !important; background-image:none !important; box-shadow:none !important; border:0 !important; border-bottom:1px solid #EDF0F5 !important; border-radius:0 !important; color:inherit !important; -webkit-text-fill-color:inherit !important;}\nhtml[data-sonaa-theme=\"client\"] body #app .client-home-action:last-child{border-bottom:0 !important;}\n"
p.write_text(t, encoding="utf-8")
print("done")
