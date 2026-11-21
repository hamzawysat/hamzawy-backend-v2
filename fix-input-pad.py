import pathlib
p = pathlib.Path("new_gate.js")
t = p.read_text(encoding="utf-8")
old = 'style="height:52px!important;font-size:15px!important"'
new = 'style="height:52px!important;font-size:15px!important;font-weight:700!important;padding:0 16px!important;text-align:right!important;box-sizing:border-box!important"'
if old in t:
    t = t.replace(old, new)
    print("input padding fixed")
else:
    print("pattern NOT found - هات سطر الحقل")
p.write_text(t, encoding="utf-8")
