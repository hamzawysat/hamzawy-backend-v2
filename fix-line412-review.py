p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
old = "${`<style>.global-refresh.is-refreshing svg{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style>`:''}"
new = "${globalRefreshInProgress?`<style>.global-refresh.is-refreshing svg{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style>`:''}"
if old in t:
    t = t.replace(old, new, 1)
    print("✅ حطيت الشرط globalRefreshInProgress قبل الستايل")
else:
    print("❌ مش لاقي السطر البايظ")
open(p, "w", encoding="utf-8").write(t)
print("خلص")
