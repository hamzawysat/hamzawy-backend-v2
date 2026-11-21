import pathlib
p = pathlib.Path("frontend/index.html")
t = p.read_text(encoding="utf-8")
# 1. الوصف اللي فوق
t = t.replace('style="color:#5B6472;font-size:15px;line-height:1.8;margin:0">تركيب', 'style="color:#5B6472;font-size:15px;font-weight:800;line-height:1.8;margin:0">تركيب', 1)
# 2. وصف العميل
t = t.replace('style="color:#5B6472;font-size:14px;line-height:1.8;margin:0 0 14px">اطلب', 'style="color:#5B6472;font-size:14px;font-weight:800;line-height:1.8;margin:0 0 14px">اطلب', 1)
# 3. وصف الفني
t = t.replace('style="color:#5B6472;font-size:14px;line-height:1.8;margin:0 0 14px">استقبل', 'style="color:#5B6472;font-size:14px;font-weight:800;line-height:1.8;margin:0 0 14px">استقبل', 1)
# 4. السطر اللي تحت
t = t.replace('style="text-align:center;color:#8A93A6;font-size:13px;margin:20px 0 0"', 'style="text-align:center;color:#8A93A6;font-size:13px;font-weight:700;margin:20px 0 0"', 1)
p.write_text(t, encoding="utf-8")
print("✅ خليت الـ 4 نصوص تخينة")
