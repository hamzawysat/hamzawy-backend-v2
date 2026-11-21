import pathlib
p = pathlib.Path("frontend/js/client-account.js")
t = p.read_text(encoding="utf-8")
s = t.find("function renderAccountGate(){")
e = t.find("function renderPublicContent")
n = pathlib.Path("new_gate.js").read_text(encoding="utf-8")
print("start:", s, "end:", e, "new len:", len(n))
t2 = t[:s] + n + "\n" + t[e:]
p.write_text(t2, encoding="utf-8")
print("done")
