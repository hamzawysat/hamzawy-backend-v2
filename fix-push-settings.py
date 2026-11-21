import pathlib
p = pathlib.Path("frontend/web-push.js")
t = p.read_text(encoding="utf-8")

# 1) دالة: احنا في الإعدادات ولا لأ؟
helper = """  function isSettingsPage(){
    const path=String(location.pathname||'').toLowerCase();
    if(path.includes('password')) return true;
    const active=document.querySelector('button.fanni-section-tab.is-active');
    if(active && String(active.getAttribute('onclick')||'').includes("'profile'")) return true;
    return false;
  }
"""
if "isSettingsPage" not in t:
    t = t.replace("  function mount(a){", helper + "  function mount(a){", 1)

# 2) لو مش في الإعدادات: شيل الزرار ومتظهروش
t = t.replace(
    "    const key=accountKey(a);\n    if(b&&b._sonaaKey!==key){b.remove();}",
    "    if(!isSettingsPage()){removeButton();return;}\n    const key=accountKey(a);\n    if(b&&b._sonaaKey!==key){b.remove();}",
    1
)

# 3) حط الزرار جوه قسم الإعدادات نفسه مش تحت الهيدر
old_insert = """    const app=document.getElementById('app');
    const shell=app?.querySelector('.dashboard-top-shell');
    if(app&&b.parentElement!==app){
      if(shell)shell.insertAdjacentElement('afterend',b);else app.prepend(b);
    }"""
new_insert = """    const settingsSlot=document.getElementById('profile')||[...document.querySelectorAll('section')].find(s=>s.textContent.includes('بيانات حسابي'));
    if(settingsSlot&&b.parentElement!==settingsSlot){settingsSlot.appendChild(b);b.style.width='100%';b.style.margin='12px 0 0';return;}
    const app=document.getElementById('app');
    const shell=app?.querySelector('.dashboard-top-shell');
    if(app&&b.parentElement!==app){
      if(shell)shell.insertAdjacentElement('afterend',b);else app.prepend(b);
    }"""
if old_insert in t:
    t = t.replace(old_insert, new_insert, 1)
    print("insert-patched")
else:
    print("insert-NOT-found")

p.write_text(t, encoding="utf-8")
print("done", "isSettingsPage" in t)
