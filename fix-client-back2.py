import pathlib
p = pathlib.Path("frontend/js/client-actions.js")
t = p.read_text(encoding="utf-8")
s = t.find("function goBack")
e = t.find("function toggleService")
block = t[s:e]
print("before:", block[:180])
block2 = block.replace("return false;", "window.location.href='/';return true;")
t = t[:s] + block2 + t[e:]
p.write_text(t, encoding="utf-8")
print("client-actions goBack fixed")
