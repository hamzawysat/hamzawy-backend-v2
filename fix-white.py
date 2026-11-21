import pathlib
p = pathlib.Path("new_gate.js")
t = p.read_text(encoding="utf-8")
t = t.replace(
  "background:#101F9B!important;color:#FFFFFF!important",
  "background:#101F9B!important;color:#FFFFFF!important;-webkit-text-fill-color:#FFFFFF!important"
)
t = t.replace(
  "background:#EEF2FF!important;color:#101F9B!important",
  "background:#EEF2FF!important;color:#101F9B!important;-webkit-text-fill-color:#101F9B!important"
)
p.write_text(t, encoding="utf-8")
print("white fix done:", t.count("-webkit-text-fill-color"))
