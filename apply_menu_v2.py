#!/usr/bin/env python3
"""Usage : python apply_menu_v2.py ton_fichier.html
Crée burrow-game-v2.html. Chaque étape est indépendante : si l'une ne
trouve pas son point d'ancrage (fichier modifié à la main), elle est
signalée et les autres s'appliquent quand même."""
import re, sys

src = sys.argv[1] if len(sys.argv) > 1 else "burrow-game-new.html"
html = open(src, encoding="utf-8").read().replace("\r\n", "\n")

if "/* NM-V2 */" in html:
    sys.exit("Ce fichier contient déjà la v2.")

CSS = """/* NM-V2 */
.nm-layout{ width:1200px; height:620px; max-height:none; flex:none; gap:28px;
  grid-template-columns:296px 1fr 296px;
  transform:translateY(20px) scale(var(--nm-s,1)); transform-origin:center center; }
.nm-stage{ padding:12px 24px 16px; }
.nm-colors{ width:160px; }
.nm-colors.customize-section{ max-width:160px; }
.nm-stage-mid .worm-container{ left:200px; right:0; width:auto; }
.top-bar-left{ transform:scale(var(--nm-t,1)); transform-origin:top left; }
.top-bar-right{ transform:scale(var(--nm-t,1)); transform-origin:top right; }
@media (max-width:820px){
  .nm-layout{ width:94vw; height:auto; grid-template-columns:1fr; gap:14px; transform:none; }
  .top-bar-left,.top-bar-right{ transform:none; }
  .nm-colors{ width:150px; }
  .nm-stage-mid .worm-container{ left:170px; }
}
"""

JS = """<script>
(function(){
  var DW = 1200, DH = 620;
  function fit(){
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    var s = 1, t = 1;
    if(vw > 820){
      s = Math.max(0.5, Math.min((vw - 48) / DW, (vh - 130) / DH, 2.5));
      t = Math.max(1, Math.min(s, 1.8));
    }
    s = Math.round(s * 100) / 100;
    var old = window.__nmScale || 1;
    document.documentElement.style.setProperty('--nm-s', s);
    document.documentElement.style.setProperty('--nm-t', t);
    window.__nmScale = s;
    if(s !== old) window.dispatchEvent(new Event('resize'));
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function(){ setTimeout(fit, 250); });
  fit();
})();
</script>
"""

def step(name, ok):
    print(("OK      " if ok else "IGNORÉ  ") + name)

# 1) CSS
if "</style>" in html:
    html = html.replace("</style>", CSS + "</style>", 1); step("CSS", True)
else:
    step("CSS (</style> introuvable)", False)

# 2) Script de mise à l'échelle
if "</body>" in html:
    html = html.replace("</body>", JS + "</body>", 1); step("Script d'échelle", True)
else:
    step("Script d'échelle (</body> introuvable)", False)

# 3) Canvas du ver : taille logique + netteté à l'échelle
def sub(name, pattern, repl):
    global html
    new, n = re.subn(pattern, repl, html, count=1)
    if n: html = new
    step(name, bool(n))

sub("taille du canvas",
    r"const rect = wormCanvas\.parentElement\.getBoundingClientRect\(\);",
    "const rect = { width: wormCanvas.parentElement.offsetWidth, height: wormCanvas.parentElement.offsetHeight }; const S = window.__nmScale || 1;")
sub("largeur canvas", r"wormCanvas\.width = rect\.width \* dpr;", "wormCanvas.width = rect.width * dpr * S;")
sub("hauteur canvas", r"wormCanvas\.height = rect\.height \* dpr;", "wormCanvas.height = rect.height * dpr * S;")
sub("transform canvas", r"wormCtx\.setTransform\(dpr, 0, 0, dpr, 0, 0\);", "wormCtx.setTransform(dpr * S, 0, 0, dpr * S, 0, 0);")
sub("largeur de dessin", r"const w = wormCanvas\.width / \(window\.devicePixelRatio \|\| 1\);",
    "const w = wormCanvas.width / ((window.devicePixelRatio || 1) * (window.__nmScale || 1));")
sub("hauteur de dessin", r"const h = wormCanvas\.height / \(window\.devicePixelRatio \|\| 1\);",
    "const h = wormCanvas.height / ((window.devicePixelRatio || 1) * (window.__nmScale || 1));")

# 4) Tête collée au corps + ver agrandi et centré
n = len(re.findall(r"-segmentCount \* segmentSpacing", html))
html = re.sub(r"-segmentCount \* segmentSpacing", "-segmentSpacing", html)
step("tête collée au corps (%d occurrences)" % n, n > 0)
sub("ver agrandi et centré", r"wormCtx\.translate\(centerX, centerY\);",
    "wormCtx.translate(centerX, centerY); wormCtx.scale(1.7, 1.7); wormCtx.translate(0, -65);")

open("burrow-game-v2.html", "w", encoding="utf-8").write(html)
print("-> burrow-game-v2.html")
