import os
# الصفحة الرئيسية غالبا index.html
for p in ["frontend/index.html", "index.html"]:
    if os.path.exists(p):
        print(f"لقيت الملف: {p}")
        t = open(p, encoding="utf-8").read()
        rule = "<style>.home-bold-btn,.home-bold-btn *{font-weight:800!important}button,a,p,span{font-weight:800!important}</style>"
        # هنحط قاعدة مخصوصة للرئيسية بس - كل الزرارين والوصف يبقوا bold
        if "home-bold" not in t:
            # نحط الستايل بعد <head>
            if "<head>" in t:
                t = t.replace("<head>", "<head>\n<style>/* home-bold */ main button, main a, main p{font-weight:800!important} main button, main a{font-weight:900!important}</style>", 1)
                print("✅ حطيت bold على كل زرارين ووصف الرئيسية")
            else:
                print("❌ مش لاقي <head>")
        open(p, "w", encoding="utf-8").write(t)
        break
else:
    print("❌ مش لاقي index.html - ابعتلي ls frontend/")
print("خلص - راجع الفرق تحت")
