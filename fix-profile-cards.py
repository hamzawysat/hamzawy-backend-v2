import re, pathlib
p = pathlib.Path("frontend/password.html")
t = p.read_text(encoding="utf-8")

# 1) شيل الكلام اللي فوق الكارتين
t = re.sub(r'<p class="muted" id="profileIntro">.*?</p>', '', t, count=1, flags=re.S)

# 2) طلّع الزرارين من جوه الكروت وخليهم كارتين عراض ورا بعض + كارت خروج وراهم
old = re.compile(
    r'<div class="card"><h2>بيانات الحساب</h2><div id="profileData">.*?</div>'
    r'<button id="editClientProfileButton"[^>]*>.*?</button></div>'
    r'<div class="card"><h2>إعدادات الأمان</h2><p class="muted">.*?</p>'
    r'<button class="btn" type="button" id="change-password-button">.*?</button></div>',
    flags=re.S
)
new = (
    '<div class="card"><h2>بيانات الحساب</h2><div id="profileData">'
    '<p class="muted">جاري تحميل بيانات الحساب...</p></div></div>'
    '<button id="editClientProfileButton" class="btn profile-wide-card hidden" type="button">✏️ تعديل بياناتي</button>'
    '<button class="btn profile-wide-card" type="button" id="change-password-button">🔒 تغيير كلمة المرور</button>'
    '<button class="btn profile-wide-card profile-logout-card" type="button" id="profile-logout-button">🚪 تسجيل خروج</button>'
)
t2, n = old.subn(new, t)
print("profile-replaced:", n)
t = t2

# 3) ستايل الكارت العريض + النجاح أزرق مش أخضر
css = """<style>
.profile-wide-card{display:block;width:100%;margin:12px 0 0;text-align:center;padding:16px;border-radius:16px;background:#fff;border:1px solid #D5DDFE;box-shadow:0 2px 8px rgba(9,45,158,.08);color:#101F9B;font-size:17px;font-weight:700}
.profile-logout-card{color:#B91C1C;border-color:#FECACA}
#notice.success,.notice.success,.alert-success,.toast.success,.success-msg{background:#DBEAFE!important;color:#1E40AF!important;border:1px solid #93C5FD!important}
#notice.success *, .notice.success *{color:#1E40AF!important}
</style>
"""
if "profile-wide-card" not in t:
    t = t.replace("</head>", css + "</head>", 1)

# 4) زرار الخروج: امسح التوكن وارجع لصفحة الدخول
js = """<script>
document.getElementById('profile-logout-button')?.addEventListener('click', function(){
  try{ ['token','authToken','hamzawy_token','user','client','fanni'].forEach(function(k){ localStorage.removeItem(k); sessionStorage.removeItem(k); }); }catch(e){}
  location.href = '/client.html';
});
</script>
"""
if "profile-logout-button" not in t.split("<script>")[-1]:
    t = t.replace("</body>", js + "</body>", 1)

p.write_text(t, encoding="utf-8")
print("done")
