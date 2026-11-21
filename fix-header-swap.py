import pathlib, re
def swap(path, label):
    p = pathlib.Path(path)
    t = p.read_text(encoding="utf-8")
    # الصف التاني: نجمع الجرس + الكارتين في مجموعة يمين، واللوحة في مجموعة شمال
    m = re.search(r'(<button type="button" onclick="toggleNotifications\(\)".*?</button>)(.*?<div class="flex items-center gap-1 min-w-0">.*?</div>)(.*?<div class="flex items-center gap-1\.5 shrink-0">.*?</div>)', t, re.DOTALL)
    assert m, f"row2 not found in {label}"
    bell, board, cards = m.group(1), m.group(2), m.group(3)
    new_row = f'<div class="flex items-center gap-1.5 shrink-0">{bell}{cards}</div>{board}'
    t = t[:m.start()] + new_row + t[m.end():]
    p.write_text(t, encoding="utf-8")
    print(label, "swapped: cards next to bell, board on left")
swap("frontend/js/client-render.js", "client")
swap("frontend/js/fanni-render.js", "fanni")
