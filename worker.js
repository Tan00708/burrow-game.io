const enc = new TextEncoder();
const SHOP = {
  scoreX2:    { col: 'inv_x2',     price: 50,  minPts: 0 },
  wideTunnel: { col: 'inv_wide',   price: 100, minPts: 25000 },
  shield:     { col: 'inv_shield', price: 150, minPts: 50000 }
};
const BOOST = { price: 750, minPts: 50000 };

// Quêtes quotidiennes : mêmes définitions que dans le jeu (le serveur décide des récompenses)
const DAILY_QUESTS = {
  easy: [
    { type: 'distance', goals: [250, 350, 450], reward: 15 },
    { type: 'pickups',  goals: [2, 3, 4],       reward: 15 },
    { type: 'stage',    goals: [2, 3],          reward: 15 }
  ],
  medium: [
    { type: 'distance', goals: [700, 850, 1000], reward: 30 },
    { type: 'pickups',  goals: [5, 6, 7],        reward: 30 },
    { type: 'stage',    goals: [4, 5],           reward: 30 }
  ],
  hard: [
    { type: 'distance', goals: [1400, 1700, 2000], reward: 55 },
    { type: 'pickups',  goals: [9, 11, 13],        reward: 55 },
    { type: 'stage',    goals: [6, 7, 8],          reward: 55 }
  ]
};
const COLLECTION_BONUS = 100;

function questFor(level, offset, day){
  const seed = Math.floor(Date.parse(day + 'T00:00:00Z') / 864e5) + offset * 17;
  const pool = DAILY_QUESTS[level];
  const base = pool[seed % pool.length];
  return { type: base.type, reward: base.reward, goal: base.goals[Math.floor(seed / pool.length) % base.goals.length] };
}

function stageForMeters(m){
  if(m < 500) return 1; if(m < 1000) return 2; if(m < 1500) return 3; if(m < 2000) return 4;
  return 5 + Math.floor((m - 2000) / 1000);
}
// Distance maximale possible en `elapsed` secondes (vitesse du jeu, boost x1.6 en permanence)
function maxDist(elapsed){
  let m = 0;
  const n = Math.min(Math.floor(elapsed) + 2, 10800);
  for(let i = 0; i < n; i++){
    const sp = Math.min(480, 95 + 220 * (1 - Math.exp(-m / 500)) + m * 0.02);
    m += sp / 8 * 1.6;
  }
  return m;
}

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
const hkey = (secret, usage) => crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, [usage]);

async function signToken(env, id, ttl){
  const payload = b64u(enc.encode(JSON.stringify({ id, exp: Date.now() + ttl })));
  const sig = await crypto.subtle.sign('HMAC', await hkey(env.SESSION_SECRET, 'sign'), enc.encode(payload));
  return payload + '.' + b64u(sig);
}
const makeToken = (env, id) => signToken(env, id, 180 * 864e5);
const makeAdminToken = env => signToken(env, 'admin', 12 * 3600e3); // session admin : 12 h

async function readToken(env, req){
  const h = req.headers.get('Authorization') || '';
  const [payload, sig] = (h.startsWith('Bearer ') ? h.slice(7) : '').split('.');
  if(!payload || !sig) return null;
  try{
    const ok = await crypto.subtle.verify('HMAC', await hkey(env.SESSION_SECRET, 'verify'), unb64u(sig), enc.encode(payload));
    if(!ok) return null;
    const d = JSON.parse(new TextDecoder().decode(unb64u(payload)));
    return d.exp > Date.now() ? d.id : null;
  }catch(e){ return null; }
}

const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 20);
const profile = r => ({
  id: r.id, kind: r.kind, nickname: r.nickname, color: r.color,
  best: r.best, points: r.points, acorns: r.acorns,
  inv: { scoreX2: r.inv_x2, wideTunnel: r.inv_wide, shield: r.inv_shield },
  boost: !!r.boost
});
const getPlayer = (env, id) => env.DB.prepare('SELECT * FROM players WHERE id=?').bind(id).first();

// Tables créées automatiquement au premier usage (rien à lancer à la main)
let tablesReady = false;
async function ensureTables(env){
  if(tablesReady) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS daily (player_id TEXT NOT NULL, day TEXT NOT NULL, best INTEGER NOT NULL DEFAULT 0, stage INTEGER NOT NULL DEFAULT 1, pickups INTEGER NOT NULL DEFAULT 0, run_pickups INTEGER NOT NULL DEFAULT 0, claimed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player_id, day))')
  ]);
  tablesReady = true;
}

// Met à jour la progression du jour et crédite les glands des quêtes terminées
async function creditDaily(env, uid, now, dist, stages, body){
  await ensureTables(env);
  const day = new Date(now).toISOString().slice(0, 10);
  await env.DB.prepare('INSERT INTO daily(player_id, day) VALUES(?,?) ON CONFLICT(player_id, day) DO NOTHING').bind(uid, day).run();
  let d = await env.DB.prepare('SELECT * FROM daily WHERE player_id=? AND day=?').bind(uid, day).first();

  // Pouvoirs ramassés : plafonnés par ce qui est réellement possible (3 par porte de stage franchie)
  const pk = Math.max(0, Math.min(Math.floor(Number(body.pickups) || 0), 3 * stages));
  const newRunPk = Math.max(d.run_pickups, pk);
  await env.DB.prepare('UPDATE daily SET best=MAX(best,?), stage=MAX(stage,?) WHERE player_id=? AND day=?')
    .bind(dist, stageForMeters(dist), uid, day).run();
  if(newRunPk > d.run_pickups){
    await env.DB.prepare('UPDATE daily SET pickups=pickups+?, run_pickups=? WHERE player_id=? AND day=? AND run_pickups=?')
      .bind(newRunPk - d.run_pickups, newRunPk, uid, day, d.run_pickups).run();
  }
  d = await env.DB.prepare('SELECT * FROM daily WHERE player_id=? AND day=?').bind(uid, day).first();

  const quests = [questFor('easy', 0, day), questFor('medium', 1, day), questFor('hard', 2, day)];
  let claimed = d.claimed, credit = 0;
  const claim = async (bit, reward) => {
    const r = await env.DB.prepare('UPDATE daily SET claimed = claimed | ? WHERE player_id=? AND day=? AND (claimed & ?) = 0')
      .bind(bit, uid, day, bit).run();
    if(r.meta.changes === 1){ claimed |= bit; credit += reward; }
  };
  for(let i = 0; i < 3; i++){
    const q = quests[i], bit = 1 << i;
    const val = q.type === 'distance' ? d.best : (q.type === 'pickups' ? d.pickups : d.stage);
    if((claimed & bit) === 0 && val >= q.goal) await claim(bit, q.reward);
  }
  if((claimed & 7) === 7 && (claimed & 8) === 0 && body.collection === true) await claim(8, COLLECTION_BONUS);
  if(credit > 0){
    await env.DB.prepare('UPDATE players SET acorns=acorns+? WHERE id=?').bind(credit, uid).run();
  }
}

export default {
  async fetch(req, env, ctx){
    const origins = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const o = req.headers.get('Origin') || '';
    const H = {
      'Access-Control-Allow-Origin': origins.includes(o) ? o : (origins[0] || 'null'),
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Vary': 'Origin'
    };
    const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...H, 'Content-Type': 'application/json' } });
    if(req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
    if(o && !origins.includes(o)) return out({ error: 'origin' }, 403);

    const url = new URL(req.url);
    const path = url.pathname;
    const now = Date.now();

    try{
      // ---------- Public ----------
      if(req.method === 'GET' && path === '/leaderboard'){
        const cache = caches.default, key = new Request(url.origin + '/leaderboard');
        let hit = await cache.match(key);
        if(!hit){
          const { results } = await env.DB.prepare('SELECT nickname,color,best FROM players WHERE best>0 ORDER BY best DESC LIMIT 10').all();
          hit = new Response(JSON.stringify({ top: results }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' } });
          ctx.waitUntil(cache.put(key, hit.clone()));
        }
        return new Response(hit.body, { status: 200, headers: { ...H, 'Content-Type': 'application/json' } });
      }

      // ---------- Admin : connexion avec Discord ----------
      if(req.method === 'POST' && path === '/admin/login'){
        const b = await req.json().catch(() => ({}));
        const dt = String(b.token || '');
        let ok = false;
        if(dt && env.ADMIN_DISCORD_ID){
          const r = await fetch('https://discord.com/api/oauth2/@me', { headers: { Authorization: 'Bearer ' + dt } });
          if(r.ok){
            const d = await r.json();
            ok = !!(d.application && d.application.id === env.DISCORD_CLIENT_ID && d.user && d.user.id === String(env.ADMIN_DISCORD_ID).trim());
          }
        }
        if(!ok){
          await new Promise(res => setTimeout(res, 800));
          return out({ error: 'auth' }, 401);
        }
        return out({ token: await makeAdminToken(env) });
      }

      // ---------- Admin : statistiques ----------
      if(req.method === 'GET' && path === '/admin/stats'){
        if((await readToken(env, req)) !== 'admin') return out({ error: 'auth' }, 401);
        const agg = await env.DB.prepare('SELECT COUNT(*) n, COALESCE(MAX(best),0) b, COALESCE(SUM(acorns),0) a FROM players').first();
        let runs = [];
        try{
          const r = await env.DB.prepare('SELECT ts FROM runs WHERE ts>? ORDER BY ts DESC LIMIT 50000').bind(now - 366 * 864e5).all();
          runs = r.results.map(x => x.ts);
        }catch(e){}
        return out({ totalPlayers: agg.n, highScore: agg.b, totalAcorns: agg.a, runs });
      }

      if(req.method !== 'POST' && path !== '/me') return out({ error: 'not_found' }, 404);
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

      if(path === '/auth/discord'){
        const token = String(body.token || '');
        if(!token) return out({ error: 'bad_token' }, 400);
        const r = await fetch('https://discord.com/api/oauth2/@me', { headers: { Authorization: 'Bearer ' + token } });
        if(!r.ok) return out({ error: 'discord_refused' }, 401);
        const d = await r.json();
        if(!d.application || d.application.id !== env.DISCORD_CLIENT_ID || !d.user) return out({ error: 'wrong_app' }, 401);
        const id = 'd:' + d.user.id;
        const nick = cleanName(d.user.global_name || d.user.username) || 'Joueur';
        await env.DB.prepare('INSERT INTO players(id,kind,nickname,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname, updated_at=excluded.updated_at')
          .bind(id, 'discord', nick, now, now).run();
        return out({ token: await makeToken(env, id), profile: profile(await getPlayer(env, id)) });
      }

      if(path === '/auth/guest'){
        const nick = cleanName(body.nickname);
        if(nick.length < 3) return out({ error: 'bad_nickname' }, 400);
        const id = 'g:' + crypto.randomUUID();
        await env.DB.prepare('INSERT INTO players(id,kind,nickname,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id, 'guest', nick, now, now).run();
        return out({ token: await makeToken(env, id), profile: profile(await getPlayer(env, id)) });
      }

      // ---------- Connecté ----------
      const uid = await readToken(env, req);
      if(!uid || uid === 'admin') return out({ error: 'auth' }, 401);

      if(path === '/me'){
        const row = await getPlayer(env, uid);
        return row ? out({ profile: profile(row) }) : out({ error: 'auth' }, 401);
      }

      if(path === '/profile/color'){
        if(!/^#[0-9a-fA-F]{6}$/.test(String(body.color || ''))) return out({ error: 'bad_color' }, 400);
        await env.DB.prepare('UPDATE players SET color=?, updated_at=? WHERE id=?').bind(body.color, now, uid).run();
        return out({ profile: profile(await getPlayer(env, uid)) });
      }

      if(path === '/run/start'){
        await env.DB.prepare('UPDATE players SET run_start=?, run_dist=0, run_bonus=0, run_stages=0, run_x2=0, updated_at=? WHERE id=?').bind(now, now, uid).run();
        // Historique des parties (graphique admin) + remise à zéro du compteur de pouvoirs de la partie
        ctx.waitUntil((async () => {
          try{
            await ensureTables(env);
            const day = new Date(now).toISOString().slice(0, 10);
            await env.DB.batch([
              env.DB.prepare('INSERT INTO runs(ts) VALUES(?)').bind(now),
              env.DB.prepare('INSERT INTO daily(player_id, day) VALUES(?,?) ON CONFLICT(player_id, day) DO UPDATE SET run_pickups=0').bind(uid, day)
            ]);
          }catch(e){}
        })());
        return out({ ok: true });
      }

      if(path === '/run/end'){
        const row = await getPlayer(env, uid);
        if(!row || !row.run_start) return out({ error: 'no_run' }, 400);
        let dist = Math.floor(Number(body.dist));
        let bonus = Math.floor(Number(body.bonus) || 0);
        if(!Number.isFinite(dist) || dist < 0 || dist > 1e6) return out({ error: 'bad_dist' }, 400);
        const elapsed = (now - row.run_start) / 1000;
        if(dist > maxDist(elapsed) + 30) return out({ error: 'implausible', profile: profile(row) }, 400);
        if(dist < row.run_dist) dist = row.run_dist;
        const bonusCap = row.run_x2 > 0 ? Math.min(3 * dist, 3 * 96 * 30 * row.run_x2) : 0;
        bonus = Math.max(row.run_bonus, Math.min(bonus, Math.floor(bonusCap)));
        const stages = Math.max(row.run_stages, stageForMeters(dist) - 1);
        const dStages = stages - row.run_stages;
        const gainPts = (dist - row.run_dist) + (bonus - row.run_bonus) + 50 * dStages;
        const gainAcorns = 10 * dStages;
        const r = await env.DB.prepare('UPDATE players SET points=points+?, acorns=acorns+?, best=MAX(best,?), run_dist=?, run_bonus=?, run_stages=?, updated_at=? WHERE id=? AND run_dist=?')
          .bind(gainPts, gainAcorns, dist, dist, bonus, stages, now, uid, row.run_dist).run();
        if(r.meta.changes !== 1) return out({ error: 'retry' }, 409);
        try{ await creditDaily(env, uid, now, dist, stages, body); }catch(e){ console.error(e); }
        return out({ profile: profile(await getPlayer(env, uid)) });
      }

      if(path === '/power/use'){
        const col = { scoreX2: 'inv_x2', wideTunnel: 'inv_wide', shield: 'inv_shield' }[body.id];
        if(!col) return out({ error: 'bad_power' }, 400);
        const extra = body.id === 'scoreX2' ? ', run_x2=run_x2+1' : '';
        const r = await env.DB.prepare(`UPDATE players SET ${col}=${col}-1${extra}, updated_at=? WHERE id=? AND ${col}>0 AND run_start IS NOT NULL`).bind(now, uid).run();
        return out({ ok: r.meta.changes === 1, profile: profile(await getPlayer(env, uid)) });
      }

      if(path === '/shop/buy'){
        const it = SHOP[body.id];
        if(!it) return out({ error: 'bad_item' }, 400);
        const r = await env.DB.prepare(`UPDATE players SET acorns=acorns-?, ${it.col}=${it.col}+1, updated_at=? WHERE id=? AND acorns>=? AND points>=? AND ${it.col}<99`)
          .bind(it.price, now, uid, it.price, it.minPts).run();
        return out({ ok: r.meta.changes === 1, profile: profile(await getPlayer(env, uid)) }, r.meta.changes === 1 ? 200 : 400);
      }

      if(path === '/shop/boost'){
        const r = await env.DB.prepare('UPDATE players SET acorns=acorns-?, boost=1, updated_at=? WHERE id=? AND boost=0 AND acorns>=? AND points>=?')
          .bind(BOOST.price, now, uid, BOOST.price, BOOST.minPts).run();
        return out({ ok: r.meta.changes === 1, profile: profile(await getPlayer(env, uid)) }, r.meta.changes === 1 ? 200 : 400);
      }

      return out({ error: 'not_found' }, 404);
    }catch(e){
      console.error(e);
      return out({ error: 'server' }, 500);
    }
  }
};