import pathlib
p = pathlib.Path("frontend/css/client-layout.css")
t = p.read_text(encoding="utf-8")
old = ".global-refresh-float{"
new = ".global-refresh-float{display:none !important;"
if old in t and "global-refresh-float{display:none" not in t:
    t = t.replace(old, new, 1)
    print("refresh float hidden")
else:
    print("already hidden or pattern not found")
p.write_text(t, encoding="utf-8")
