import pathlib
p = pathlib.Path("frontend/js/client-account.js")
t = p.read_text(encoding="utf-8")
start = t.find("function renderAccountGate(){")
end = t.find("function renderPublicContent")
print("start:", start, "end:", end)
if start == -1 or end == -1 or end <= start:
    print("❌ مش لاقي الحدود - ابعتلي:")
    print(t[start:start+200] if start!=-1 else "no start")
else:
    new_fn = open("new_gate.js", encoding="utf-8").read() if pathlib.Path("new_gate.js").exists() else None
    print("جاهز للبدل - ابعتلي new_gate موجود ولا لأ:", new_fn is not None)
