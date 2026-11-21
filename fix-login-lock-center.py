p = "frontend/js/fanni-render.js"
t = open(p, encoding="utf-8").read()
old_style = "<style>header.bg-white{display:none!important}nav.fanni-browser-bottom-nav{display:none!important}</style>"
new_style = "<style>header.bg-white{display:none!important}nav.fanni-browser-bottom-nav{display:none!important}html,body{overflow-x:hidden!important}main.fanni-browser-main{margin-inline:auto!important;max-width:440px!important;padding-inline:0!important;box-sizing:border-box!important}section.account-gate{margin-inline:auto!important;max-width:440px!important;width:100%!important;box-sizing:border-box!important;overflow-x:hidden!important}section.account-gate>div{margin-inline:auto!important;max-width:100%!important;box-sizing:border-box!important}section.account-gate .account-panel{margin-inline:auto!important;max-width:100%!important;box-sizing:border-box!important;transform:none!important}</style>"
assert old_style in t, "style مش لاقيه"
t = t.replace(old_style, new_style, 1)
open(p, "w", encoding="utf-8").write(t)
print("اتثبت: main و gate و panel بقوا 440px في النص بـ !important ومفيش overflow")
