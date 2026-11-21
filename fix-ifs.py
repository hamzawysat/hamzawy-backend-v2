import pathlib
p = pathlib.Path("new_gate.js")
a = p.read_text(encoding="utf-8").splitlines()
blocks = [(52,55),(56,59),(72,76),(77,79),(80,82),(88,91)]
for s,e in blocks:
    si = s-1
    ei = e-1
    a[si] = a[si].replace(")h+=", "){h+=", 1)
    a[ei] = a[ei] + "}"
p.write_text("\n".join(a) + "\n", encoding="utf-8")
print("fixed 6 blocks")
