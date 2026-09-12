/* Burrow.io - anonymous analytics
   IMPORTANT: load this file AFTER the existing Firebase initialization in index.html.
*/
(() => {
  "use strict";

  if (typeof firebase === "undefined") {
    console.warn("[Burrow analytics] Firebase n'est pas disponible.");
    return;
  }

  let db;
  try {
    db = firebase.database();
  } catch (e) {
    console.warn("[Burrow analytics] Impossible d'accéder à Firebase.", e);
    return;
  }

  const VISITOR_KEY = "burrowio_analytics_visitor_v1";
  const SESSION_KEY = "burrowio_analytics_session_v1";
  const SESSION_TIMEOUT = 30 * 60 * 1000;
  const HEARTBEAT_MS = 20 * 1000;

  function randomId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return "v-" + Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2);
  }

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  let visitorId = safeStorageGet(VISITOR_KEY);
  if (!visitorId) {
    visitorId = randomId();
    safeStorageSet(VISITOR_KEY, visitorId);
  }

  let session;
  try {
    session = JSON.parse(safeStorageGet(SESSION_KEY) || "null");
  } catch (_) {
    session = null;
  }

  const now = Date.now();
  if (!session || !session.id || !session.lastActivity ||
      now - session.lastActivity > SESSION_TIMEOUT) {
    session = { id: randomId(), lastActivity: now };
  } else {
    session.lastActivity = now;
  }
  safeStorageSet(SESSION_KEY, JSON.stringify(session));

  function localDay(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getDevice() {
    const ua = navigator.userAgent || "";
    if (/iPad|Tablet/i.test(ua)) return "Tablette";
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "Mobile";
    return "Desktop";
  }

  function getBrowser() {
    const ua = navigator.userAgent || "";
    if (/Edg\//i.test(ua)) return "Edge";
    if (/OPR\//i.test(ua)) return "Opera";
    if (/Firefox\//i.test(ua)) return "Firefox";
    if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
    if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
    return "Autre";
  }

  function getOS() {
    const ua = navigator.userAgent || "";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
    if (/Mac OS X/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";
    return "Autre";
  }

  let referrer = "Direct";
  try {
    if (document.referrer) referrer = new URL(document.referrer).origin;
  } catch (_) {}

  const timestamp = Date.now();
  const day = localDay(timestamp);
  const path = location.pathname || "/";

  const visitId = randomId();
  const visit = {
    visitorId,
    sessionId: session.id,
    timestamp,
    path,
    referrer,
    device: getDevice(),
    browser: getBrowser(),
    os: getOS(),
    language: navigator.language || "unknown",
    screen: `${screen.width || 0}x${screen.height || 0}`
  };

  // Une visite = un chargement de page.
  // Les données sont anonymisées côté client : pas d'adresse IP ni de compte Discord.
  db.ref(`analytics/visits/${visitId}`).set(visit).catch(() => {});

  // Compteur journalier.
  db.ref(`analytics/daily/${day}/visits`)
    .transaction(v => (typeof v === "number" ? v : 0) + 1)
    .catch(() => {});

  // Visiteur unique du jour.
  db.ref(`analytics/daily/${day}/visitors/${visitorId}`)
    .set(true)
    .catch(() => {});

  const presenceRef = db.ref(`analytics/presence/${session.id}`);

  function updatePresence() {
    presenceRef.set({
      visitorId,
      sessionId: session.id,
      lastSeen: Date.now(),
      path,
      device: visit.device
    }).catch(() => {});
  }

  presenceRef.onDisconnect().remove().catch(() => {});
  updatePresence();

  const timer = setInterval(updatePresence, HEARTBEAT_MS);

  window.addEventListener("pagehide", () => {
    clearInterval(timer);
    // onDisconnect reste la protection principale.
    presenceRef.remove().catch(() => {});
  });
})();
