import pathlib
p = pathlib.Path("frontend/css/ui-light-surfaces.css")
t = p.read_text(encoding="utf-8")
old = ":not(.client-home-hero){"
new = ":not(.client-home-hero):not(.client-home-referral){"
if old in t:
    t = t.replace(old, new, 1)
    print("referral exempted")
else:
    print("hero exempt pattern NOT found")
p.write_text(t, encoding="utf-8")
