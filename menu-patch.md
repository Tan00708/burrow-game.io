# Patch menu principal – Burrow-game.fun

## 1) CSS : à coller juste avant `</style>`

```css
/* ===== NOUVEAU MENU ===== */
.main-menu{ padding-top:64px; }
.top-bar-left{ max-width:none; height:auto; gap:14px; }
.nm-logo{ margin:0; font-family:'Fredoka',sans-serif; font-size:28px; font-weight:800; color:var(--ink); line-height:38px; }
.nm-logo span{ color:var(--accent-primary); }
.nm-layout{
  position:relative; z-index:1; display:grid;
  grid-template-columns:minmax(200px,260px) minmax(300px,1fr) minmax(200px,260px);
  gap:18px; width:min(1040px,94vw); height:calc(100vh - 96px); max-height:600px;
}
.nm-col{ display:flex; flex-direction:column; gap:14px; min-height:0; }
.nm-card{ background:rgba(27,36,73,0.6); border:2px solid rgba(255,107,53,0.3); border-radius:16px; padding:14px; backdrop-filter:blur(10px); text-align:left; color:var(--ink); }
.nm-card h3{ margin:0 0 12px; font-family:'Fredoka',sans-serif; font-size:16px; font-weight:700; }
.nm-grow{ flex:1; min-height:0; overflow:auto; }
.nm-chal{ margin-bottom:14px; }
.nm-chal-t{ font-size:12px; font-weight:600; margin-bottom:5px; }
.nm-bar{ height:7px; border-radius:4px; background:rgba(255,255,255,0.15); overflow:hidden; }
.nm-bar i{ display:block; height:100%; width:0; background:linear-gradient(90deg,var(--accent-primary),var(--accent-secondary)); border-radius:4px; }
.nm-chal-s{ font-size:11px; color:var(--ink-dim); margin-top:5px; }
.nm-streak b{ display:block; font-family:'Fredoka',sans-serif; font-size:14px; }
.nm-streak span{ font-size:11px; color:var(--ink-dim); }
button.nm-rank{ width:100%; font-family:inherit; cursor:pointer; transition:all .2s ease; }
button.nm-rank:hover{ border-color:var(--accent-primary); transform:translateY(-2px); }
.nm-rank .nm-bar{ margin:10px 0 8px; }
.nm-rank-hint{ font-size:11px; color:var(--ink-dim); }
.nm-stage{ display:flex; flex-direction:column; align-items:center; gap:12px; min-height:0; border:1px solid rgba(255,107,53,0.35); border-radius:6px; padding:8px 16px 12px; }
.nm-stage-label{ font-size:12px; font-weight:600; color:var(--ink-dim); }
.nm-stage-mid{ position:relative; flex:1; width:100%; min-height:0; }
.nm-colors{ position:absolute; left:0; top:6px; width:150px; z-index:2; max-height:100%; overflow:auto; }
.nm-colors.customize-section{ max-width:150px; padding:10px; }
.nm-colors .color-grid{ gap:8px; }
.nm-stage-mid .worm-container{ position:absolute; top:0; bottom:0; right:0; width:62%; max-width:none; }
.nm-play{ width:min(100%,360px); min-width:0; font-size:22px; padding:18px 24px; color:#0A0E27; }
.nm-record{ font-size:11px; color:var(--ink-dim); }
.nm-record b{ color:var(--accent-primary); }
.nm-mini-top .mini-row{ font-size:13px; padding:5px 0; }
@media (max-width:820px){
  .nm-layout{ grid-template-columns:1fr; height:auto; max-height:none; }
  .nm-stage-mid{ height:380px; flex:none; }
  .nm-col .nm-grow{ overflow:visible; }
  .nm-logo{ font-size:20px; line-height:32px; }
}
```

## 2) HTML : remplacer tout le bloc `<div class="main-menu" id="mainMenu"> … </div>` (juste avant `<canvas id="game">`)

```html
<div class="main-menu" id="mainMenu">
  <div class="menu-bg"><canvas id="bgCanvas"></canvas></div>

  <div class="top-bar-left">
    <h1 class="nm-logo" id="gameTitle">BURROW-game<span>.fun</span></h1>
    <div class="auth-widget" id="authWidget" title="Compte"></div>
  </div>

  <div class="top-bar-right">
    <button class="shop-widget" id="shopBtn" type="button" title="Boutique">
      🛒 <span id="acornsVal">0</span> 🌰
    </button>
    <select class="lang-select-widget" id="langSelect">
      <option value="fr">🇫🇷 FR</option>
      <option value="en">🇬🇧 EN</option>
      <option value="es">🇪🇸 ES</option>
      <option value="de">🇩🇪 DE</option>
    </select>
    <button class="audio-widget" id="audioToggleBtn" type="button" title="Activer/Désactiver le son">🔊 Son</button>
  </div>

  <p class="sr-only">Burrow.io est un jeu de tunnel (.io) multijoueur gratuit, jouable directement dans le navigateur sans téléchargement ni installation. Creuse à travers des cavernes générées aléatoirement à travers 8 décors différents (grotte, volcan, glacier, lune...), évite les obstacles, ramasse des bonus (boost de vitesse, bouclier, réduction de taille) et va le plus loin possible pour grimper dans le classement mondial des meilleurs scores.</p>

  <div class="nm-layout">
    <!-- GAUCHE -->
    <div class="nm-col">
      <div class="nm-card nm-grow">
        <h3>Défis du jour</h3>
        <div class="nm-chal"><div class="nm-chal-t">Atteindre 500 m</div><div class="nm-bar"><i id="ch1Bar"></i></div><div class="nm-chal-s" id="ch1Txt"></div></div>
        <div class="nm-chal"><div class="nm-chal-t">Ramasser 3 bonus</div><div class="nm-bar"><i id="ch2Bar"></i></div><div class="nm-chal-s" id="ch2Txt"></div></div>
        <div class="nm-chal"><div class="nm-chal-t">Passer le stage 3</div><div class="nm-bar"><i id="ch3Bar"></i></div><div class="nm-chal-s" id="ch3Txt"></div></div>
      </div>
      <div class="nm-card nm-streak"><b id="streakTitle">Série : 1 jour</b><span>Reviens demain pour continuer ta série</span></div>
    </div>

    <!-- CENTRE -->
    <div class="nm-stage">
      <div class="nm-stage-label">Ton ver · Rang <span id="wormRankEmojiDisplay">🥉</span> <span id="wormRankName"></span></div>
      <div class="nm-stage-mid">
        <div class="customize-section nm-colors">
          <h3 data-i18n="color">🎨 Couleur</h3>
          <div class="color-grid">
            <div class="color-option color-option-plus" id="wormCustomizeBtn" title="Personnaliser">+</div>
            <div class="color-option" data-color="#6BA3C4" style="background:linear-gradient(135deg, #6BA3C4, #5A92B3);" title="Bleu"></div>
            <div class="color-option" data-color="#78D4A8" style="background:linear-gradient(135deg, #78D4A8, #67C397);" title="Vert"></div>
            <div class="color-option selected" data-color="#FF6FA5" style="background:linear-gradient(135deg, #FF6FA5, #E8578F);" title="Rose"></div>
            <div class="color-option" data-color="#D97B5A" style="background:linear-gradient(135deg, #D97B5A, #C86A49);" title="Orange"></div>
            <div class="color-option" data-color="#B383B8" style="background:linear-gradient(135deg, #B383B8, #A272A7);" title="Violet"></div>
          </div>
        </div>
        <div class="worm-container"><canvas id="wormCanvas3D"></canvas></div>
      </div>
      <button class="menu-btn btn-play nm-play" id="menuStartBtn" data-i18n="play">▶ Jouer</button>
      <div class="nm-record">Record : <b id="personalBestVal">0 m</b> · Touche Entrée pour lancer</div>
      <a class="privacy-link-inline" href="confidentialite.html" target="_blank" rel="noopener" data-i18n="privacy">Confidentialité</a>
    </div>

    <!-- DROITE -->
    <div class="nm-col">
      <button class="nm-card nm-rank" id="openRankModalBtn" type="button" title="Voir les rangs">
        <h3 id="menuRankName" style="margin:0">Rang</h3>
        <div class="nm-bar"><i id="widgetRankFill"></i></div>
        <div class="nm-rank-hint" id="menuRankHint"></div>
      </button>
      <div class="nm-card nm-grow nm-mini-top">
        <h3 data-i18n="topScores">🏆 Meilleurs scores</h3>
        <div id="globalScoresList"><div class="mini-empty" data-i18n="loading">Chargement...</div></div>
      </div>
    </div>
  </div>
</div>
```

## 3) JS

**a)** Supprimer la tache bleue autour du ver : dans `draw3DWorm()`, remplacer

```js
wormCtx.fillStyle = 'rgba(20, 25, 50, 0.3)';
wormCtx.fillRect(0, 0, w, h);
```
par
```js
wormCtx.clearRect(0, 0, w, h);
```

**b)** À la fin de `renderMenuRecords()`, juste après `updateRankUI();`, ajouter `renderNewMenu();`

**c)** Dans `applyPowerup(kind)`, ajouter en première ligne : `bumpPickups();`

**d)** Coller ces fonctions juste avant `renderMenuRecords();` (l'appel isolé, après le listener de `shopCloseBtn`) :

```js
function todayStr(){ return new Date().toISOString().slice(0,10); }
function bumpPickups(){
  let d = {};
  try{ d = JSON.parse(localStorage.getItem('burrowio_daily') || '{}'); }catch(e){}
  if(d.date !== todayStr()) d = { date: todayStr(), pickups: 0 };
  d.pickups++;
  try{ localStorage.setItem('burrowio_daily', JSON.stringify(d)); }catch(e){}
}
function getStreak(){
  let s = {};
  try{ s = JSON.parse(localStorage.getItem('burrowio_streak') || '{}'); }catch(e){}
  if(s.last !== todayStr()){
    const y = new Date(Date.now() - 864e5).toISOString().slice(0,10);
    s.n = (s.last === y ? (s.n || 0) : 0) + 1;
    s.last = todayStr();
    try{ localStorage.setItem('burrowio_streak', JSON.stringify(s)); }catch(e){}
  }
  return s.n || 1;
}
function setChal(id, val, goal){
  const p = Math.min(1, val / goal);
  const bar = document.getElementById(id + 'Bar'), txt = document.getElementById(id + 'Txt');
  if(bar) bar.style.width = (p * 100) + '%';
  if(txt) txt.textContent = p >= 1 ? 'Terminé' : (id === 'ch1' ? Math.floor(val) + ' / ' + goal + ' m' : (id === 'ch2' ? val + ' / ' + goal : 'Pas encore'));
}
function renderNewMenu(){
  const info = getRankForScore(totalPoints);
  const n = document.getElementById('menuRankName');
  if(n) n.textContent = 'Rang ' + info.current.name;
  const nm = document.getElementById('wormRankName');
  if(nm) nm.textContent = info.current.name;
  const h = document.getElementById('menuRankHint');
  if(h) h.textContent = info.next ? (info.next.minScore - totalPoints).toLocaleString() + ' pts avant ' + info.next.name : 'Rang maximum';
  let d = {};
  try{ d = JSON.parse(localStorage.getItem('burrowio_daily') || '{}'); }catch(e){}
  const pk = d.date === todayStr() ? (d.pickups || 0) : 0;
  setChal('ch1', currentBestDist, 500);
  setChal('ch2', Math.min(pk, 3), 3);
  setChal('ch3', stageForMeters(currentBestDist), 3);
  const st = getStreak();
  const t = document.getElementById('streakTitle');
  if(t) t.textContent = 'Série : ' + st + ' jour' + (st > 1 ? 's' : '');
}

window.addEventListener('keydown', (e)=>{
  if(e.key !== 'Enter') return;
  if(mainMenu.classList.contains('hidden')) return;
  if(document.querySelector('.overlay.show')) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if(tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  menuStartBtn.click();
});
```

Remarque : `renderNewMenu` utilise `stageForMeters`, déclarée plus bas dans le même scope, donc sans problème (hoisting).
