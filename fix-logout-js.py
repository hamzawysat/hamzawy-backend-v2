import pathlib
p = pathlib.Path("frontend/password.html")
t = p.read_text(encoding="utf-8")
js = """<script>
document.getElementById('profile-logout-button')?.addEventListener('click', function(){
  try{ ['token','authToken','hamzawy_token','user','client','fanni'].forEach(function(k){ localStorage.removeItem(k); sessionStorage.removeItem(k); }); }catch(e){}
  location.href = '/client.html';
});
</script>
"""
if "getElementById('profile-logout-button')" not in t:
    t = t.replace("</body>", js + "</body>", 1)
    p.write_text(t, encoding="utf-8")
    print("logout-js-added")
else:
    print("logout-js-already-there")
