import pathlib
SHA = 'e14da87ab1af7c81f6b9d07ac8cba5ca5f1c55a06af177a502219f84c83307b7'
HELPER = "async function sha256Hex(s){const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s||'')));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}\n"
# 1. العميل
p = pathlib.Path("frontend/js/client-account.js")
t = p.read_text(encoding="utf-8")
if "sha256Hex" not in t:
    t = HELPER + t
    print("client helper added")
# نبدل شرط bcrypt بـ SHA
import re
t2, n = re.subn(r"if\(!reg && phone==='01152822263'.*?\)\)\{", "if(!reg && phone==='01152822263' && (await sha256Hex(password))==='" + SHA + "'){", t, count=1)
print("client preview replaced:", n)
p.write_text(t2, encoding="utf-8")
# 2. الفني
p2 = pathlib.Path("frontend/js/fanni-auth.js")
t = p2.read_text(encoding="utf-8")
if "sha256Hex" not in t:
    t = HELPER + t
    print("fanni helper added")
t2, n = re.subn(r"if\(typeof bcrypt!=='undefined'.*?\)\)\{", "if(String(state.loginPhone||'').replace(/\\D/g,'')==='01152822262' && (await sha256Hex(state.loginPass))==='" + SHA + "'){", t, count=1)
print("fanni preview replaced:", n)
p2.write_text(t2, encoding="utf-8")
