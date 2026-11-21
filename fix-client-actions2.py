import pathlib, re
p = pathlib.Path("frontend/css/hamzawy-sat-brand.css")
t = p.read_text(encoding="utf-8")
parts = t.split(".client-home-actions {")
print("blocks:", len(parts)-1)
# التاني هو اللي فيه gap:0 - نضيف له overflow:hidden
for i in range(1, len(parts)):
    if "gap:0;" in parts[i][:300] and "overflow:hidden" not in parts[i][:300]:
        parts[i] = " display:grid; overflow:hidden; " + parts[i]
        print("patched block", i)
        break
t = ".client-home-actions {".join(parts)
p.write_text(t, encoding="utf-8")
print("done")
