import pathlib
p = pathlib.Path("new_gate.js")
t = p.read_text(encoding="utf-8")
old = "margin-top:0;margin-bottom:0;box-sizing:border-box;flex:1;display:flex;flex-direction:column;justify-content:center"
new = "margin-top:auto;margin-bottom:auto;box-sizing:border-box"
if old in t:
    t = t.replace(old, new)
    print("flex:1 اتشال - رجعنا زي الفني")
else:
    print("مش لاقي flex:1 - ممكن GPT شاله خلاص")
p.write_text(t, encoding="utf-8")
