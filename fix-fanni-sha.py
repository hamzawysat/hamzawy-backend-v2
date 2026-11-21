import pathlib
p = pathlib.Path("frontend/js/fanni-auth.js")
t = p.read_text(encoding="utf-8")
if "async function sha256Hex" not in t:
    t = "async function sha256Hex(s){const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s||'')));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}\n" + t
    p.write_text(t, encoding="utf-8")
    print("sha256Hex added to fanni")
else:
    print("already defined")
