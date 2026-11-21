import pathlib
p = pathlib.Path("frontend/js/client-render.js")
t = p.read_text(encoding="utf-8")
old = '<button type="button" onclick="setTab(\'new\')" class="client-home-hero">'
new = '<button type="button" onclick="setTab(\'new\')" class="client-home-hero" style="background:#092D9E;color:#FFFFFF">'
if old in t:
    t = t.replace(old, new, 1)
    print("hero inline blue added")
else:
    print("hero button pattern NOT found")
p.write_text(t, encoding="utf-8")
