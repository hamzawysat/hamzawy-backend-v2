p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
# === الأول: الليبلات على الشمال زي التطبيق ===
if 'رقم الهاتف</label>' in t and 'text-align:left' not in t.split('رقم الهاتف</label>')[0][-200:]:
    t = t.replace('<label class="field-label" style="color:#101F9B">رقم الهاتف</label>', '<label class="field-label" style="color:#101F9B;text-align:left;display:block">رقم الهاتف</label>', 1)
    print("1. ليبل رقم الهاتف بقى شمال")
t = t.replace('<div><label class="field-label">كلمة السر</label><input id="fanniLoginPassword"', '<div><label class="field-label" style="text-align:left;display:block">كلمة السر</label><input id="fanniLoginPassword"', 1)
print("1. ليبل كلمة السر بقى شمال")
# === التاني: الزرارين !important ===
old1 = 'class="w-full h-[56px] rounded-2xl text-white text-[20px] font-black shadow-lg" style="background:#101F9B"'
if old1 in t:
    t = t.replace(old1, 'class="w-full h-[56px] rounded-2xl text-[20px] font-black shadow-lg" style="background:#101F9B!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important;border:1px solid #101F9B!important"', 1)
    print("2. زرار الدخول بقى أزرق غامق !important")
old2 = 'class="w-full h-[56px] rounded-2xl text-[18px] font-black" style="background:#EEF2FF;color:#101F9B"'
if old2 in t:
    t = t.replace(old2, 'class="w-full h-[56px] rounded-2xl text-[18px] font-black" style="background:#EEF2FF!important;color:#101F9B!important;-webkit-text-fill-color:#101F9B!important;border:1px solid #D5DDFE!important"', 1)
    print("2. زرار إنشاء بقى أزرق فاتح !important")
# === التالت: التوسيط في النص ===
old_gate = '<section class="account-gate fanni-login-gate mt-0 px-4 py-4 flex flex-col items-center" style="background:#EEF2FF;min-height:100vh">'
if old_gate in t:
    t = t.replace(old_gate, '<section class="account-gate fanni-login-gate mt-0 px-4 py-4 flex flex-col items-center justify-center" style="background:#EEF2FF;min-height:100vh;width:100%;margin-inline:auto;box-sizing:border-box">', 1)
    print("3. السكشن بقى في النص")
old_inner = '   <div class="w-full max-w-[440px]">\n    <div class="flex w-full justify-start mb-4">'
if old_inner in t:
    t = t.replace(old_inner, '   <div class="w-full max-w-[440px] mx-auto" style="margin-inline:auto">\n    <div class="flex w-full justify-start mb-4">', 1)
    print("3. الكارت بقى mx-auto")
old_panel = '<section class="fanni-login-panel account-panel mt-4 panel p-5 animate-fade" style="border-radius:28px">'
if old_panel in t:
    t = t.replace(old_panel, '<section class="fanni-login-panel account-panel mt-4 panel p-5 animate-fade" style="border-radius:28px;width:100%;margin-inline:auto;box-sizing:border-box">', 1)
    print("3. كارت الدخول بقى في النص")
open(p, "w", encoding="utf-8").write(t)
print("خلص - الاتنين اتعملوا")
