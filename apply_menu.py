#!/usr/bin/env python3
"""Usage : python apply_menu.py ton_fichier.html
Place menu-patch.md dans le même dossier. Crée burrow-game-new.html."""
import re, sys

src = sys.argv[1] if len(sys.argv) > 1 else "index.html"
html = open(src, encoding="utf-8").read().replace("\r\n", "\n")
md = open("menu-patch.md", encoding="utf-8").read()
blocks = re.findall(r"```(?:css|html|js)\n(.*?)```", md, re.S)
css, menu, old_js, new_js, funcs = [b.strip("\n") for b in blocks[:5]]

def must(cond, msg):
    if not cond:
        sys.exit("ECHEC : " + msg)

# 1) CSS
must("</style>" in html, "</style> introuvable")
html = html.replace("</style>", css + "\n</style>", 1)

# 2) Bloc HTML du menu
m = re.search(r'<div class="main-menu" id="mainMenu">.*?(?=<canvas id="game">)', html, re.S)
must(m, "bloc main-menu introuvable")
html = html[:m.start()] + menu + "\n\n" + html[m.end():]

# 3a) Fond du ver transparent
pat = re.compile(r"wormCtx\.fillStyle\s*=\s*'rgba\(20, 25, 50, 0\.3\)';\s*wormCtx\.fillRect\(0, 0, w, h\);")
must(pat.search(html), "fond du ver introuvable")
html = pat.sub(new_js.strip(), html, count=1)

# 3b) Appel de renderNewMenu
pat = re.compile(r"(if\(acornsEl\) acornsEl\.textContent = totalAcorns;\s*updateRankUI\(\);)")
must(pat.search(html), "fin de renderMenuRecords introuvable")
html = pat.sub(r"\1\n    renderNewMenu();", html, count=1)

# 3c) Compteur de bonus
must("function applyPowerup(kind){" in html, "applyPowerup introuvable")
html = html.replace("function applyPowerup(kind){", "function applyPowerup(kind){\n    bumpPickups();", 1)

# 3d) Nouvelles fonctions
must("function adjustBrightness(" in html, "adjustBrightness introuvable")
html = html.replace("function adjustBrightness(", funcs + "\n\n  function adjustBrightness(", 1)

open("burrow-game-new.html", "w", encoding="utf-8").write(html)
print("OK -> burrow-game-new.html")
