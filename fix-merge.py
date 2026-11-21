import re, pathlib
p = pathlib.Path("frontend/js/client-account.js")
t = p.read_text(encoding="utf-8")
t = re.sub(r'<<<<<<< HEAD.*?=======\n(.*?)\n>>>>>>>[^\n]*\n', r'\1\n', t, flags=re.S)
p.write_text(t, encoding="utf-8")
print("resolved")
