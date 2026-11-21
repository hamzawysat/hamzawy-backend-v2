p = "frontend/js/client-account.js"
t = open(p, encoding="utf-8").read()
# 1. نسيت تظهر في الدخول بس مش التسجيل
old_forgot = "h+='<div style=\"text-align:left\"><a href=\"password.html?role=client&mode=recovery\""
new_forgot = "h+=(reg?'':'<div style=\"text-align:left\"><a href=\"password.html?role=client&mode=recovery\""
if old_forgot in t:
    t = t.replace(old_forgot, new_forgot, 1)
    # نقفل القوس بتاع التيرناري بعد الـ </div>
    t = t.replace("نسيت كلمة السر؟ استعادة</a></div><button", "نسيت كلمة السر؟ استعادة</a></div>')+\"<button", 1)
    print("✅ نسيت بقت في الدخول بس")
else:
    print("⚠️ مش لاقي نسيت - ابعتلي سطر الدخول")
# 2. نشيل الـ pb-[95px] الكبير
if "panel account-panel p-4 pb-[95px]" in t:
    t = t.replace("panel account-panel p-4 pb-[95px]", "panel account-panel p-4", 1)
    print("✅ شلت الـ pb الكبير - الصفحة هتظبط من غير سكرول")
open(p, "w", encoding="utf-8").write(t)
print("خلص - تصليح 3b")
