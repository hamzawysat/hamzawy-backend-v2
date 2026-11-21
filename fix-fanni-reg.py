import pathlib
p = pathlib.Path("frontend/js/fanni-render.js")
t = p.read_text(encoding="utf-8")
# 1. من فوق: نشيل الـ -20px اللي بياكل الهيدر + نلغي الـ 100vh
t = t.replace('margin-top:-20px', 'margin-top:0', 1)
t = t.replace('min-height:100vh', 'min-height:auto', 1)
print("✅ شلت -20px و 100vh - اللي فوق هيبان")
# 2. من تحت: الـ main كان pb-[160px] وده بيحشر الكارت - نخليه pb-8
t = t.replace("pb-[160px]", "pb-8", 1)
print("✅ شلت pb-[160px]")
# 3. فراغ تحت زرار إنشاء حساب فني علشان ميبقاش مقصوص
t = t.replace('<button onclick="doRegister()"', '<div style="padding-bottom:calc(24px + env(safe-area-inset-bottom))"><button onclick="doRegister()"', 1)
# نقفل الـ div بعد الزرار - ندور على السطر اللي بعد الزرار فيه errorBox
t = t.replace("${state.error?errorBox(state.error):''}              </div>", "${state.error?errorBox(state.error):''}</div>              </div>", 1)
print("✅ حطيت فراغ تحت زرار الإنشاء")
p.write_text(t, encoding="utf-8")

# 4. مربع البحث - box-sizing
c = pathlib.Path("frontend/css/fanni-layout.css")
ct = c.read_text(encoding="utf-8")
if "fanni-picker-search{box-sizing:border-box" not in ct:
    ct = ct.replace(".fanni-picker-search{", ".fanni-picker-search{box-sizing:border-box;width:100%;min-width:0;overflow:hidden;", 1)
    ct = ct.replace(".fanni-area-picker{", ".fanni-area-picker{box-sizing:border-box;width:100%;min-width:0;overflow:hidden;", 1)
    print("✅ صلحت مربع البحث - مش هيطلع بره الكارت تاني")
c.write_text(ct, encoding="utf-8")
print("خلص")
