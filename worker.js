// Cloudflare Worker — connexion Discord vérifiée côté serveur pour Burrow.io
// Secrets : DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, ADMIN_DISCORD_ID,
//           FB_CLIENT_EMAIL, FB_PRIVATE_KEY
const ALLOWED_ORIGIN = "https://tan00708.github.io";
const ALLOWED_REDIRECT_PREFIX = ALLOWED_ORIGIN + "/burrow-game.io/";

const b64u = buf =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = s => b64u(new TextEncoder().encode(s));

async function firebaseToken(env, uid, claims) {
  const now = Math.floor(Date.now() / 1000);
  const head = enc(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = enc(JSON.stringify({
    iss: env.FB_CLIENT_EMAIL,
    sub: env.FB_CLIENT_EMAIL,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
    claims
  }));
  const pem = env.FB_PRIVATE_KEY
    .replace(/\\n/g, "\n")
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s+/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + body)
  );
  return head + "." + body + "." + b64u(sig);
}

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), {
        status, headers: { ...cors, "Content-Type": "application/json" }
      });

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/auth") return json({ error: "not_found" }, 404);
    if (req.headers.get("Origin") !== ALLOWED_ORIGIN) return json({ error: "forbidden" }, 403);

    try {
      const { code, redirect_uri } = await req.json();
      if (typeof code !== "string" || typeof redirect_uri !== "string" ||
          !redirect_uri.startsWith(ALLOWED_REDIRECT_PREFIX)) {
        return json({ error: "bad_request" }, 400);
      }

      // 1) Discord : échange du code (le secret reste ici, jamais dans le navigateur)
      const tokRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri
        })
      });
      if (!tokRes.ok) return json({ error: "discord_exchange_failed" }, 401);
      const { access_token } = await tokRes.json();

      // 2) Identité réelle lue directement chez Discord
      const meRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: "Bearer " + access_token }
      });
      if (!meRes.ok) return json({ error: "discord_user_failed" }, 401);
      const me = await meRes.json();
      if (!/^\d{5,25}$/.test(me.id || "")) return json({ error: "discord_user_failed" }, 401);

      // 3) Token Firebase : l'identité (uid) ne peut être obtenue que par ce chemin
      const name = String(me.global_name || me.username || "Joueur").slice(0, 20);
      const claims = { discord: true, dname: name };
      if (me.id === env.ADMIN_DISCORD_ID) claims.admin = true;

      return json({
        token: await firebaseToken(env, "discord_" + me.id, claims),
        user: { id: me.id, username: name, avatar: me.avatar || null }
      });
    } catch (e) {
      return json({ error: "server_error" }, 500);
    }
  }
};
