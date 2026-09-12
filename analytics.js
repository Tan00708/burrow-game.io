/* Burrow.io anonymous analytics
   Add this AFTER your existing Firebase/app script in index.html:
   <script src="analytics.js"></script>
*/
(() => {
  "use strict";
  if (typeof firebase === "undefined") return;

  let db;
  try { db = firebase.database(); } catch (_) { return; }

  const VKEY = "burrowio_visitor_v1";
  const SKEY = "burrowio_session_v1";
  const SESSION_MS = 30 * 60 * 1000;
  const HEARTBEAT_MS = 20 * 1000;

  const id = () =>
    globalThis.crypto?.randomUUID?.() ||
    "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);

  const getStore = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const setStore = (k,v) => { try { localStorage.setItem(k,v); } catch (_) {} };

  let visitorId = getStore(VKEY);
  if (!visitorId) { visitorId = id(); setStore(VKEY, visitorId); }

  let session = null;
  try { session = JSON.parse(getStore(SKEY) || "null"); } catch (_) {}
  if (!session || !session.id || Date.now() - session.lastActivity > SESSION_MS) {
    session = { id: id(), lastActivity: Date.now() };
  } else {
    session.lastActivity = Date.now();
  }
  setStore(SKEY, JSON.stringify(session));

  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  const ua = navigator.userAgent || "";
  const device = /iPad|Tablet/i.test(ua) ? "Tablette" :
                 /Mobi|Android|iPhone|iPod/i.test(ua) ? "Mobile" : "Desktop";
  const browser = /Edg\//i.test(ua) ? "Edge" :
                  /OPR\//i.test(ua) ? "Opera" :
                  /Firefox\//i.test(ua) ? "Firefox" :
                  /Chrome\//i.test(ua) ? "Chrome" :
                  /Safari\//i.test(ua) ? "Safari" : "Autre";
  const os = /Windows/i.test(ua) ? "Windows" :
             /Android/i.test(ua) ? "Android" :
             /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
             /Mac OS X/i.test(ua) ? "macOS" :
             /Linux/i.test(ua) ? "Linux" : "Autre";

  let referrer = "Direct";
  try { if (document.referrer) referrer = new URL(document.referrer).origin; } catch (_) {}

  const visit = {
    visitorId, sessionId: session.id, timestamp: Date.now(),
    path: location.pathname || "/",
    referrer, device, browser, os,
    language: navigator.language || "unknown",
    screen: `${screen.width || 0}x${screen.height || 0}`
  };

  db.ref(`analytics/visits/${id()}`).set(visit).catch(() => {});
  db.ref(`analytics/daily/${day}/visits`)
    .transaction(v => (typeof v === "number" ? v : 0) + 1).catch(() => {});
  db.ref(`analytics/daily/${day}/visitors/${visitorId}`).set(true).catch(() => {});

  const presence = db.ref(`analytics/presence/${session.id}`);
  const heartbeat = () => presence.set({
    visitorId, sessionId: session.id, lastSeen: Date.now(),
    path: visit.path, device
  }).catch(() => {});

  presence.onDisconnect().remove().catch(() => {});
  heartbeat();
  const timer = setInterval(heartbeat, HEARTBEAT_MS);
  addEventListener("pagehide", () => {
    clearInterval(timer);
    presence.remove().catch(() => {});
  });
})();
