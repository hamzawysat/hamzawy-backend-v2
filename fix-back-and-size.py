import pathlib
# 1. رجوع في العميل - لو مفيش تاريخ، روح الرئيسية
p = pathlib.Path("frontend/js/client-account.js")
t = p.read_text(encoding="utf-8")
old = "if(typeof CLIENT_TAB_HISTORY==='undefined'||!CLIENT_TAB_HISTORY.length)return false;"
new = "if(typeof CLIENT_TAB_HISTORY==='undefined'||!CLIENT_TAB_HISTORY.length){window.location.href='/';return true;}"
if old in t:
    t = t.replace(old, new)
    print("client goBack fixed")
else:
    print("client goBack pattern NOT found")
p.write_text(t, encoding="utf-8")
# 2. مقاس الليبل والحقل في new_gate زي الفني
g = pathlib.Path("new_gate.js")
s = g.read_text(encoding="utf-8")
s = s.replace("display:block;font-weight:800", "display:block;font-weight:800;font-size:15px")
s = s.replace('class="field"', 'class="field" style="height:52px!important;font-size:15px!important"')
g.write_text(s, encoding="utf-8")
print("label/field size fixed:", s.count("height:52px"))
