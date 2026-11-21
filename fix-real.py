import re
p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
orig = t

# 1. الهيدر: نلاقي كل أماكن "حمزاوي سات" ونغير التاني بس لـ "لوحة الفني"
idxs = [m.start() for m in re.finditer("حمزاوي سات", t)]
print(f"لقيت كلمة حمزاوي سات {len(idxs)} مرة")
if len(idxs) >= 2:
    i = idxs[1]
    t = t[:i] + "لوحة الفني" + t[i+len("حمزاوي سات"):]
    print("1. ✅ غيرت التانية لـ لوحة الفني - الأولى فضلت حمزاوي سات")
else:
    print("1. ❌ لسه مش لاقي التانية - ابعتلي أول 5 سطور من grep")

# 2. التصغير: نشيل الستايل القديم اللي مش شغال، ونحط ستايل شغال + نحط الكلاس على الحاوية
t = t.replace('<style id="login-shrink">.login-shrink{zoom:.90;transform-origin:top center}.login-shrink .login-logo{width:84px!important;height:84px!important}.login-shrink input{height:48px!important}.login-shrink button{height:48px!important}</style>', '')
# نحط ستايل جديد بيصغر فعلا: zoom على الحاوية كلها
style = '<style id="login-shrink2">.login-shrink{zoom:.88!important;transform-origin:top center!important}.login-shrink img{max-height:84px!important}</style>'
if 'login-shrink2' not in t:
    t = style + t
    print("2. ✅ حطيت ستايل التصغير الجديد")
# نحط الكلاس login-shrink على أول حاوية فيها حساب فني / دخول
# ندور على أول div فيه max-w-[640px] بعد كلمة تسجيل الدخول
m = re.search(r'<div class="mx-auto w-full max-w-\[640px\]', t)
if m and 'login-shrink' not in t[m.start():m.start()+200]:
    t = t[:m.start()] + t[m.start():].replace('mx-auto w-full max-w-[640px]', 'mx-auto w-full max-w-[640px] login-shrink', 1)
    print("2. ✅ حطيت كلاس login-shrink على الحاوية - دلوقتي التصغير هيشتغل")
else:
    print("2. الكلاس موجود قبل كده")

open(p, "w", encoding="utf-8").write(t)
print("خلص - لو شفت ✅ ✅ يبقى الاتنين اتعملوا")
