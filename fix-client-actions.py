import pathlib
p = pathlib.Path("frontend/css/hamzawy-sat-brand.css")
t = p.read_text(encoding="utf-8")
old = "html[data-sonaa-theme=\"client\"] body #app .client-home-actions {                                              gap:0;"
new = "html[data-sonaa-theme=\"client\"] body #app .client-home-actions {                                              display:grid; overflow:hidden; gap:0;"
assert old in t, "second actions block not found"
t = t.replace(old, new, 1)
p.write_text(t, encoding="utf-8")
print("actions card closed")
