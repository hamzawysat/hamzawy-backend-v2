import pathlib
p = pathlib.Path("frontend/js/fanni-navigation.js")
t = p.read_text(encoding="utf-8")
old = "return false;}"
# هنبدل آخر return false في goBack بس
# نلاقي الفانكشن ونبدل جواها
s = t.find("function goBack")
e = t.find("function setMyOrdersView")
block = t[s:e]
print("before:", block[:200])
block2 = block.replace("return false;", "window.location.href='/';return true;")
t = t[:s] + block2 + t[e:]
p.write_text(t, encoding="utf-8")
print("fanni goBack fixed")
