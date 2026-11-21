p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()

# 1. الصف التاني: حمزاوي سات -> لوحة الفني (من غير ما نلمس الصف الأول)
# الصف التاني هو اللي جنبه القمر الصناعي
old2 = "🛰️ حمزاوي سات"
if old2 in t:
    t = t.replace(old2, "🛰️ لوحة الفني", 1)
    print("1. الصف التاني بقى: لوحة الفني - مش مكررة")
else:
    print("1. مش لاقي الصف التاني - ابعتلي السطر بتاعه")

# 2. تصغير صفحة الدخول كلها 10% - عشان رجوع فوق والكارتين تحت يبانوا من غير سكرول
# هنحط ستايل تصغير على حاوية الدخول بس
old_login_wrap = '<div class="mx-auto w-full max-w-[640px] px-4'
if old_login_wrap in t and "login-shrink" not in t:
    # نضيف ستايل عام مرة واحدة فوق
    style = """<style id="login-shrink">.login-shrink{zoom:.90;transform-origin:top center}.login-shrink .login-logo{width:84px!important;height:84px!important}.login-shrink input{height:48px!important}.login-shrink button{height:48px!important}</style>"""
    # نحطه قبل أول حاوية دخول
    t = t.replace(old_login_wrap, style + old_login_wrap, 1)
    print("2. ضفت تصغير 10% لصفحة الدخول")
else:
    print("2. التصغير موجود قبل كده أو الحاوية مختلفة")

open(p, "w", encoding="utf-8").write(t)
print("خلص")
