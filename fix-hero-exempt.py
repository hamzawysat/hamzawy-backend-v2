import pathlib
p = pathlib.Path("frontend/css/ui-light-surfaces.css")
t = p.read_text(encoding="utf-8")
old = "):not(.danger):not(.success):not(.btn-danger):not(.btn-success){"
new = "):not(.danger):not(.success):not(.btn-danger):not(.btn-success):not(.client-home-hero){"
if old in t:
    t = t.replace(old, new, 1)
    print("hero exempted from light rule")
else:
    print("pattern NOT found")
p.write_text(t, encoding="utf-8")
