import pathlib
p = pathlib.Path("new_gate.js")
t = p.read_text(encoding="utf-8")
old1 = "margin-top:auto;margin-bottom:auto;box-sizing:border-box"
new1 = "margin-top:0;margin-bottom:0;box-sizing:border-box;flex:1;display:flex;flex-direction:column;justify-content:center"
if old1 in t:
    t = t.replace(old1, new1)
    print("fill fixed")
else:
    print("fill pattern NOT found")
p.write_text(t, encoding="utf-8")
