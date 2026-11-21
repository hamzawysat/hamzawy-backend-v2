import pathlib
p = pathlib.Path("frontend/password.html")
t = p.read_text(encoding="utf-8")
css = """<style>
.profile-wide-card{display:block;width:100%;margin:12px 0 0;text-align:center;padding:16px;border-radius:16px;background:#fff;border:1px solid #D5DDFE;box-shadow:0 2px 8px rgba(9,45,158,.08);color:#101F9B;font-size:17px;font-weight:700}
.profile-logout-card{color:#B91C1C;border-color:#FECACA}
#notice.success,.notice.success,.alert-success,.toast.success,.success-msg{background:#DBEAFE!important;color:#1E40AF!important;border:1px solid #93C5FD!important}
#notice.success *, .notice.success *{color:#1E40AF!important}
</style>
"""
if ".profile-wide-card{" not in t:
    t = t.replace("</head>", css + "</head>", 1)
    p.write_text(t, encoding="utf-8")
    print("css-added")
else:
    print("css-already-there")
