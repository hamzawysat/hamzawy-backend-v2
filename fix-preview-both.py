import pathlib
HASH = '$2a$10$2DG5xMPACLG/pgg63p.kCOHTQjASr8sB5PUHOwJQ5pwcAlZu3NfLK'
# 1. العميل - 01152822263
p = pathlib.Path("frontend/js/client-account.js")
t = p.read_text(encoding="utf-8")
old = "var d=reg?await API.registerClient"
new = """if(!reg && phone==='01152822263' && typeof bcrypt!=='undefined' && bcrypt.compareSync(password, '""" + HASH + """')){ state.accountLoginPhone=''; state.accountLoginPassword=''; state.accountToken='preview'; state.account={id:'preview-client', name:'عميل تجريبي', phone:phone, status:'نشط'}; state.clientName='عميل تجريبي'; state.phone=phone; state.tab='home'; state.accountError=''; state.accountLoading=false; showToast('وضع معاينة - من غير قاعدة بيانات','success'); render(); return; }
  var d=reg?await API.registerClient"""
if "preview-client" not in t:
    t = t.replace(old, new, 1)
    print("client preview added")
else:
    print("client preview already exists")
p.write_text(t, encoding="utf-8")
# 2. الفني - 01152822262
p2 = pathlib.Path("frontend/js/fanni-auth.js")
t2 = p2.read_text(encoding="utf-8")
old2 = "const data=await API.login({"
new2 = """if(typeof bcrypt!=='undefined' && String(state.loginPhone||'').replace(/\\D/g,'')==='01152822262' && bcrypt.compareSync(String(state.loginPass||''), '""" + HASH + """')){ const user={id:'preview-fanni', name:'فني تجريبي', phone:'01152822262', status:'نشط'}; setAuth('preview', user); currentUser=user; forceTechnicianRegistration=false; state.loading=false; state.tab='home'; state.loginPass=''; state.error=''; render(); toast('وضع معاينة - من غير قاعدة بيانات'); return; }
  const data=await API.login({"""
if "preview-fanni" not in t2:
    t2 = t2.replace(old2, new2, 1)
    print("fanni preview added")
else:
    print("fanni preview already exists")
p2.write_text(t2, encoding="utf-8")
