import pathlib
tag = '<script src="https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js"></script>'
for fn in ["frontend/client.html", "frontend/fanni.html"]:
    p = pathlib.Path(fn)
    t = p.read_text(encoding="utf-8")
    if "bcrypt.min.js" in t:
        print(fn, "already has bcrypt")
    else:
        t = t.replace("</body>", tag + "\n</body>", 1)
        p.write_text(t, encoding="utf-8")
        print(fn, "bcrypt added")
