'use strict';
// Fehlerschutz: ein unerwarteter Fehler zeigt eine ruhige Meldung statt einer leeren Seite; deine Daten bleiben gespeichert
window.addEventListener('error', () => { try { feedbackText('⚠ Etwas ist schiefgelaufen. Lade die App neu. Deine Liste bleibt gespeichert.', true); } catch (e) { } });
window.addEventListener('unhandledrejection', () => { try { feedbackText('⚠ Etwas ist schiefgelaufen. Lade die App neu. Deine Liste bleibt gespeichert.', true); } catch (e) { } });
const APP_VERSION = '1.0 · 06.10.2026';
/* ================= State ================= */
const LS = 'einkauf.v2';
const DEF = { hideHelp: false, list: [], later: [], prefs: {}, adds: {}, addDay: {}, rec: {}, bons: [], aliases: {}, lastBackup: '', watch: ['paprika', 'butter', 'butterschmalz', 'rinderhack', 'farbfang', 'kuechenrolle'], custom: [], manual: [], hist: [], buys: {}, set: { hourly: 15, stockPct: 20, carMax: 25, lidl: 'auto', tipPct: 20 } };
let S;
// Gespeicherten Stand prüfen und reparieren: eine beschädigte Sicherung oder ein Fehler darf die App nie lahmlegen
function sanitize(x) {
  const o = (x && typeof x === 'object' && !Array.isArray(x)) ? x : {};
  const arr = v => Array.isArray(v) ? v : [];
  const idOk = v => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);
  const num = (v, d) => Number.isFinite(+v) && +v > 0 ? +v : d;
  const dateOk = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const set = (o.set && typeof o.set === 'object') ? o.set : {};
  return {
    hideHelp: !!o.hideHelp,
    list: arr(o.list).filter(i => i && typeof i === 'object').map(i => ({ id: idOk(i.id) ? i.id : Math.random().toString(36).slice(2, 10), pid: idOk(i.pid) ? i.pid : null, name: String(i.name ?? '').slice(0, 80), qty: String(i.qty ?? '').slice(0, 20), urgent: !!i.urgent, done: !!i.done, ...(i.heavy !== undefined ? { heavy: !!i.heavy } : {}) })).filter(i => i.name.trim()),
    bons: arr(o.bons).filter(b => b && typeof b === 'object' && dateOk(b.date) && typeof b.store === 'string' && Array.isArray(b.items)).slice(0, 60).map(b => ({ id: idOk(b.id) ? b.id : Math.random().toString(36).slice(2, 10), date: b.date, store: String(b.store).slice(0, 20), total: Number.isFinite(+b.total) ? +b.total : null, items: b.items.filter(i => i && typeof i === 'object').slice(0, 120).map(i => ({ n: String(i.n ?? '').slice(0, 60), q: num(i.q, 1), p: Number.isFinite(+i.p) ? +i.p : 0, pid: idOk(i.pid) ? i.pid : null, k: ['kg', 'l', 'st'].includes(i.k) ? i.k : null, a: num(i.a, null) })) })),
    aliases: Object.fromEntries(Object.entries(o.aliases && typeof o.aliases === 'object' && !Array.isArray(o.aliases) ? o.aliases : {}).filter(([k, v]) => k.length <= 60 && idOk(v)).slice(0, 400)),
    lastBackup: dateOk(o.lastBackup) ? o.lastBackup : '', rec: Object.fromEntries(Object.entries(o.rec && typeof o.rec === 'object' && !Array.isArray(o.rec) ? o.rec : {}).filter(([k, v]) => idOk(k) && Array.isArray(v)).map(([k, v]) => [k, v.filter(dateOk).slice(-8)])),
    adds: Object.fromEntries(Object.entries(o.adds && typeof o.adds === 'object' && !Array.isArray(o.adds) ? o.adds : {}).filter(([k, n]) => idOk(k) && Number.isFinite(+n) && +n >= 0).map(([k, n]) => [k, Math.min(+n, 9999)])),
    addDay: Object.fromEntries(Object.entries(o.addDay && typeof o.addDay === 'object' && !Array.isArray(o.addDay) ? o.addDay : {}).filter(([k, v]) => idOk(k) && dateOk(v))),
    prefs: Object.fromEntries(Object.entries(o.prefs && typeof o.prefs === 'object' && !Array.isArray(o.prefs) ? o.prefs : {}).filter(([k, v]) => idOk(k) && STORES.some(s => s.id === v))),
    later: arr(o.later).filter(l => l && idOk(l.id) && idOk(l.pid) && dateOk(l.from)).map(l => ({ id: l.id, pid: l.pid, name: String(l.name ?? '').slice(0, 80), qty: String(l.qty ?? '').slice(0, 20), from: l.from })),
    watch: Array.isArray(o.watch) ? o.watch.filter(idOk) : DEF.watch.slice(),
    custom: arr(o.custom).filter(c => c && idOk(c.id) && typeof c.name === 'string' && c.name.trim()).map(c => ({ id: c.id, name: c.name.slice(0, 80) })),
    manual: arr(o.manual).filter(m => m && typeof m === 'object' && typeof m.name === 'string' && Number(m.price) > 0 && STORES.some(s => s.id === m.store) && Array.isArray(m.valid) && dateOk(m.valid[0]) && dateOk(m.valid[1])).map(m => ({ id: String(m.id ?? 'm' + Date.now()).slice(0, 40), store: m.store, name: m.name.slice(0, 80), price: Number(m.price), regular: num(m.regular, null), amount: num(m.amount, null), unit: ['g', 'kg', 'ml', 'l', 'st'].includes(m.unit) ? m.unit : null, valid: [m.valid[0], m.valid[1]], manual: true })),
    hist: arr(o.hist).filter(h => h && idOk(h.pid) && Number.isFinite(+h.up) && +h.up > 0).map(h => ({ pid: h.pid, up: +h.up, date: dateOk(h.date) ? h.date : '', store: typeof h.store === 'string' ? h.store.slice(0, 20) : '' })),
    buys: Object.fromEntries(Object.entries(o.buys && typeof o.buys === 'object' && !Array.isArray(o.buys) ? o.buys : {}).filter(([k, n]) => k.length <= 90 && Number.isFinite(+n) && +n >= 0).map(([k, n]) => [k, +n])),
    set: { hourly: num(set.hourly, 15), stockPct: num(set.stockPct, 20), carMax: num(set.carMax, 25), lidl: ['auto', 'ja', 'nein'].includes(set.lidl) ? set.lidl : 'auto', tipPct: num(set.tipPct, 20) }
  };
}
const mkRx = src => { try { return new RegExp(src, 'i'); } catch (e) { try { return new RegExp(src.replace(/\(\?<!\[[^\]]*\]\)/g, ''), 'i'); } catch (e2) { return /$^/; } } }; // ältere Browser ohne Lookbehind
try {
  const raw = localStorage.getItem(LS), old = localStorage.getItem('einkauf.v1');
  S = Object.assign({}, DEF, raw ? JSON.parse(raw) : {});
  if (!raw && old) { const o = JSON.parse(old); S.list = (o.list || []).map(x => ({ ...x, id: x.id || Math.random().toString(36).slice(2) })); S.watch = o.favs || S.watch; S.manual = o.manual || []; S.hist = o.hist || []; }
  S = sanitize(S);
} catch (e) { S = sanitize({}); }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { } };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => n == null || isNaN(n) ? '–' : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const d0 = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
let TODAY = d0(new Date());
const fmtD = s => new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
const uid = () => Math.random().toString(36).slice(2, 10);
const translit = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-');
const STORE = id => STORES.find(s => s.id === id) || { id, name: id, short: id, tier: 'D', car: null };
const PROD = id => PRODUCTS.find(p => p.id === id);
const RXC = {}; const rx = p => RXC[p.id] || (RXC[p.id] = mkRx(p.kw));
const regCustom = c => { if (!PRODUCTS.some(p => p.id === c.id)) PRODUCTS.push({ id: c.id, cat: 'Eigene Produkte', name: c.name, kw: '(?<![a-zäöüß])' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (c.name.length <= 3 ? '(?![a-zäöüß])' : ''), base: null, custom: 1, q: [translit(c.name)] }); };
S.custom.forEach(regCustom);
// Verweise auf Produkte, die es nicht (mehr) gibt (z. B. nach dem Einspielen einer unvollständigen Sicherung), reparieren statt abstürzen
function repairRefs() {
  S.list.forEach(i => { if (i.pid && !PROD(i.pid)) i.pid = i.name.trim().length >= 3 ? mkCustom(i.name.trim()).id : null; });
  S.watch = S.watch.filter(id => PROD(id)); S.later = S.later.filter(l => PROD(l.pid));
  for (const k of Object.keys(S.prefs)) if (!PROD(k)) delete S.prefs[k];
  for (const k of Object.keys(S.adds)) if (!PROD(k)) { delete S.adds[k]; delete S.addDay[k]; }
}
const SC = { rewe: '#cc071e', netto: '#f2c200', aldi: '#1a73c9', dm: '#e8590c', lidl: '#0b3c91' }; // Ladenfarben wie im Prospekt
const storeColor = id => SC[id] || '#8a9a92';
const ICON = { 'Haushalt & Wäsche': '🧺', 'Milchprodukte': '🥛', 'Obst & Gemüse': '🥬', 'Öle & Grundnahrung': '🌿', 'Fleisch': '🥩', 'Getränke': '🥤', 'Eigene Produkte': '⭐', 'Drogerie & Gesundheit': '🧴' };
const PICON = { wm_dunkel: '🧺', wm_bunt: '🧺', wm_weiss: '🧺', wm_uni: '🧺', weichspueler: '🌸', farbfang: '🎨', kuechenrolle: '🧻', milch: '🥛', ayran: '🥛', buttermilch: '🥛', kefir: '🥛', butter: '🍞', butterschmalz: '🍳', tomaten: '🍅', gurken: '🥒', paprika: '🌶️', melone: '🍈', trauben: '🍇', heidelbeeren: '🍇', erdbeeren: '🍓', apfel: '🍎', ananas: '🍍', kiwi: '🥝', zwiebeln: '🧅', leinoel: '🌿', salatoel: '🌿', basmati: '🍚', buchweizen: '🌾', sonnenblumenkerne: '🌻', kuerbiskerne: '🎃', pinienkerne: '🌰', rinderhack: '🥩', gemhack: '🥩', haehnchen: '🍗', pute: '🍗', rind: '🥩', wasser: '💧', bitburger: '🍺', vitamine: '💊', zahnpasta: '🦷', zahnseide: '🦷', zahnbuerste: '🦷', handcreme: '🧴', duschgel: '🚿', shampoo: '🧴', deo: '🧴' };
const GUESS = [[/kaffee|espresso|krönung/i, '☕'], [/pasta|nudel|spaghetti|barilla/i, '🍝'], [/lachs|fisch|thunfisch|garnele/i, '🐟'], [/käse|kaese|gouda|mozzarella/i, '🧀'], [/joghurt|quark|skyr/i, '🥣'], [/ei(er)?\b|eier/i, '🥚'], [/brot|toast|brötchen/i, '🍞'], [/schoko|keks|riegel|gummi|süß/i, '🍫'], [/saft|limo|cola|fanta|sprite|schorle/i, '🧃'], [/bier|pils/i, '🍺'], [/wein|sekt/i, '🍷'], [/waschmittel|persil|perwoll|weichspüler/i, '🧺'], [/reiniger|spül|geschirr/i, '🧽'], [/nuss|nüsse|kerne|mandel/i, '🥜'], [/honig/i, '🍯'], [/avocado/i, '🥑'], [/brokkoli|spinat|salat|gemüse|karotte|möhre/i, '🥦'], [/obst|beere|banane|orange|zitrone|mango/i, '🍊'], [/reis/i, '🍚'], [/öl\b|olivenöl/i, '🌿'], [/fleisch|steak|filet|braten|hack/i, '🥩'], [/pizza/i, '🍕'], [/eis\b|eiscreme/i, '🍨'], [/tee\b/i, '🍵']];
const iconFor = (p, name) => (p && (PICON[p.id] || (p.custom ? (GUESS.find(g => g[0].test(p.name)) || [])[1] : null))) || (GUESS.find(g => g[0].test(name || (p && p.name) || '')) || [])[1] || (p && ICON[p.cat]) || '🏷️';
const prefOf = (p, name) => { // 1. deine eigene Wahl, 2. Standardladen des Produkts, 3. Wortliste, 4. Stichwörter (Drogerie -> dm)
  if (p && S.prefs[p.id]) return { id: S.prefs[p.id], fb: null };
  if (p) { const st = stammladen(p.id); if (st && STORES.some(s => s.id === st.store && s.tier !== 'D')) return { id: st.store, fb: null }; } // aus deinen Kassenbons gelernt
  if (p && p.pref) return { id: p.pref, fb: p.fb || null };
  const nm = name || (p && p.name) || '';
  const ex = (window.EXTRA_SHOP || {})[nm.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')]; if (ex) return ex;
  const h = (window.SHOP_HINTS || []).find(([x]) => x.test(nm)); return h ? { id: h[1], fb: h[2] } : null;
};
const prefNote = pf => `Kein Angebot bekannt · normal bei ${STORE(pf.id).short}${pf.fb ? ', sonst ' + STORE(pf.fb).short : ''}`;
// Produktfoto (kaufDA) mit Emoji als Rückfall, falls das Bild nicht lädt
const thumb = (img, emoji, cls = '') => `<div class="thumb ${cls}"><span class="em">${emoji}</span>${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>`;

/* ================= Angebote laden ================= */
let SRC = { fetched: null, offers: [], source: null, live: false, offline: false };
const OFFERS_KEY = 'einkauf.offers';
// Angebote: erst die aktuelle offers.json (Server oder Hosting), sonst die zuletzt gespeicherte Kopie (Offline im Laden), sonst Beispieldaten
let LAST_LOAD = 0;
async function loadOffers() {
  let j = null, offline = false; LAST_LOAD = Date.now();
  if (location.protocol.startsWith('http')) {
    try { const r = await fetch('offers.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) j = await r.json(); } catch (e) { }
  }
  if (j && j.offers && j.offers.length) { try { localStorage.setItem(OFFERS_KEY, JSON.stringify(j)); } catch (e) { } }
  else { try { const c = JSON.parse(localStorage.getItem(OFFERS_KEY) || 'null'); if (c && c.offers && c.offers.length) { j = c; offline = true; } } catch (e) { } }
  if (j && j.offers && j.offers.length) {
    SRC = { ...j, offers: j.offers.filter(o => STORES.some(s => s.id === o.store)).map(o => ({ ...o, pid: null })), live: true, offline }; // Penny ist für dich nicht relevant
  } else SRC = { fetched: window.OFFERS_META.fetched, offers: window.OFFERS.map(o => ({ ...o, pidLocked: !!o.pid })), source: 'Beispieldaten', live: false, offline: false };
  CACHE = null;
}

/* ================= Angebotslogik ================= */
let CACHE = null;
function unitPrice(o, p) {
  if (p && p.base === 'st') { // Waschladung, Rolle, Stück: nur echte Stückzahl zählt
    const n = o.count || (o.unit === 'st' && o.amount) || null;
    return n ? { v: o.price / n, base: 'st' } : null;
  }
  const base = o.base || (p && p.base) || null;
  if (o.unitPrice) return { v: o.unitPrice, base: base || 'kg' };
  if (!o.amount || !o.unit) return null;
  const a = o.amount, u = o.unit;
  if (u === 'g') return { v: o.price / (a / 1000), base: 'kg' };
  if (u === 'kg') return { v: o.price / a, base: 'kg' };
  if (u === 'ml') return { v: o.price / (a / 1000), base: 'l' };
  if (u === 'l') return { v: o.price / a, base: 'l' };
  return { v: o.price / a, base: 'st' };
}
const qtyBase = o => o.p && o.p.base === 'st' ? (o.count || (o.unit === 'st' && o.amount) || null) : !o.amount || !o.unit ? null : ({ g: o.amount / 1000, ml: o.amount / 1000 }[o.unit] ?? o.amount);
function refPrice(p) {
  if (!p) return null;
  const h = S.hist.filter(x => x.pid === p.id && x.up).map(x => x.up).sort((a, b) => a - b);
  if (h.length >= 2) return { v: h[Math.floor(h.length / 2)], note: 'dein Mittelwert aus ' + h.length + ' Einträgen' };
  return p.ref ? { v: p.ref, note: p.refNote || 'historische Referenz' } : null;
}
const HEAD_CATS = new Set(['Obst & Gemüse', 'Milchprodukte', 'Öle & Grundnahrung', 'Getränke']);
function enrich(o) {
  const text = o.name + ' ' + (o.cats || ''), full = text + ' ' + (o.desc || '');
  const head = o.store === 'aldi' ? o.name.split(',')[0] + ' ' + (o.cats || '') : text; // ALDI schreibt die Sorte hinter das Komma („Pringles 200g, Sweet Paprika"): für frische Produkte zählt nur der Teil davor
  let p = o.pidLocked && o.pid ? PROD(o.pid) : null;
  if (!p && !(window.NOISE_RX && NOISE_RX.test(text))) { let len = 0; for (const q of PRODUCTS) { const m = rx(q).exec(HEAD_CATS.has(q.cat) ? head : text); if (m && m[0].length > len) { p = q; len = m[0].length; } } }
  // Eigene Produkte: Treffer der Suchseite (z. B. „Gummibärchen" findet „Goldbären") nutzen, wenn der Name nicht passt
  if (!p && o.found) p = PRODUCTS.find(q => q.custom && q.q && o.found.some(f => f.toLowerCase() === q.q[0])) || null;
  let store = STORE(o.store), up = unitPrice(o, p);
  if (p && p.base && p.base !== 'st' && up && up.base === 'st' && !o.pidLocked) { p = null; up = unitPrice(o, null); }
  else if (p && up && (p.base === 'l' || p.base === 'kg') && up.base !== p.base && up.base !== 'st') up = { v: up.v, base: p.base }; // Dichte ≈ 1 (Kefir in g, Milch in l)
  let pct = null, kind = null;
  if (o.regular && o.regular > o.price) { pct = (o.regular - o.price) / o.regular; kind = o.regularIsUvp ? 'UVP' : 'Normalpreis'; }
  else if (up && p && p.base && up.base === p.base) { const r = refPrice(p); if (r && r.v > up.v) { pct = (r.v - up.v) / r.v; kind = 'Referenz: ' + r.note; } }
  if (pct != null && pct > 0.9) pct = null;
  const dubious = pct != null && ((o.regularIsUvp && pct > 0.5) || pct > 0.7); // UVP-Rabatte über 50 % sind meist Schein-Rabatte
  const from = d0(o.valid?.[0] || TODAY), to = d0(o.valid?.[1] || '2999-01-01');
  const state = to < TODAY ? 'expired' : from > TODAY ? 'next' : 'now';
  const qty = up && p && p.base !== 'st' && up.v > 0 ? o.price / up.v : null, bulk = qty != null && qty > 3; // z. B. 12 x 1 l
  const excluded = !(p && p.id === 'gemhack') && EXCLUDE_RX.test(full);
  return { ...o, p, store, up, pct, kind, dubious, bulk, state, daysLeft: Math.round((to - TODAY) / 864e5), excluded };
}
const OFFERS_ALL = () => CACHE || (CACHE = [...SRC.offers, ...S.manual].map(enrich).filter(o => o.state !== 'expired' && !o.excluded));
const rank = (a, b) => (a.up && b.up && a.up.base === b.up.base) ? a.up.v - b.up.v : (!!b.up - !!a.up) || a.price - b.price;
const isNear = o => o.store.tier === 'A';
function productInfo(p) {
  if (!p) return { p, now: [], next: [], nearBest: null, best: null, nextBest: null };
  const offs = OFFERS_ALL().filter(o => o.p && o.p.id === p.id);
  const byBulk = (x, y) => (x.bulk - y.bulk) || rank(x, y);
  const now = offs.filter(o => o.state === 'now').sort(byBulk), next = offs.filter(o => o.state === 'next').sort(rank);
  const nearBest = now.find(isNear) || null;
  // Großmarkt (Tier D) ist nur eine Option unter „Wege" und nie der Standard-Vorschlag der Liste
  return { p, now, next, nearBest, best: now.find(o => o.store.tier !== 'D') || null, nextBest: next.find(o => o.store.tier !== 'D') || null };
}
function decision(info, item) {
  const { p, nearBest, best, nextBest } = info, b = nearBest || best;
  if (!b) { const pf = prefOf(p, item && item.name); return { tag: 'Kein Angebot', cls: '', why: pf ? prefNote(pf) + '.' : 'Aktuell kein bekanntes Angebot. Normal in der Nah-Runde kaufen.' }; }
  if (nextBest && b.up && nextBest.up && nextBest.up.base === b.up.base && nextBest.up.v < b.up.v * 0.9 && !(item && item.urgent))
    return { tag: 'Lohnt sich warten', cls: 't-warn', why: `Nächste Woche ${eur(nextBest.price)} bei ${nextBest.store.short} (ab ${fmtD(nextBest.valid[0])}), deutlich günstiger.` };
  if (p.stock && b.pct != null && !b.dubious && b.pct * 100 >= S.set.stockPct) return { tag: 'Vorratskauf', cls: 't-stock', why: `${Math.round(b.pct * 100)} % Ersparnis (${b.kind}). ${p.meat ? 'Portionsweise einfrieren.' : 'Haltbar, auf Vorrat sinnvoll.'}` };
  const ends = b.daysLeft <= 1;
  return { tag: ends ? 'Heute kaufen' : 'Diese Woche', cls: 't-ok', why: (ends ? 'Angebot endet bald. ' : '') + (p.perish ? 'Schnell verderblich, nicht auf Vorrat kaufen.' : 'Kein Zeitdruck.') };
}
const watched = id => S.watch.includes(id);
const onList = id => S.list.some(i => i.pid === id && !i.done);

/* ================= Darstellung ================= */
const unitLbl = b => b === 'st' ? 'Stück' : b;
const grid = h => h ? `<div class="grid">${h}</div>` : '';
const empty = (i, t) => `<div class="empty"><big>${i}</big>${t}</div>`;
function offerCard(o, opt = {}) {
  const p = o.p, near = p ? productInfo(p).nearBest : null;
  let cmp = '';
  if (!isNear(o) && near && near.up && o.up && near.up.base === o.up.base) {
    const diff = near.up.v - o.up.v;
    cmp = diff > 0.004 ? `${eur(diff)}/${unitLbl(o.up.base)} günstiger als ${near.store.short} im City-Center (${eur(near.up.v)})` : `Nähe gewinnt: ${near.store.short} im City-Center ${diff > -0.004 ? 'ist gleich teuer' : 'ist ' + eur(-diff) + '/' + unitLbl(o.up.base) + ' günstiger'}.`;
  }
  const t = [`<span class="tag t-tier"><i class="dot t${o.store.tier}"></i>${esc(o.store.short)} · ${TIER_SHORT[o.store.tier] || ''}</span>`];
  if (!p) t.push('<span class="tag t-new">Nicht in deiner Liste</span>');
  if (p && onList(p.id)) t.push('<span class="tag t-ok">Auf Liste</span>');
  if (p && watched(p.id)) t.push('<span class="tag t-watch">👁 Beobachtet</span>');
  if (p && p.stock && !o.dubious && o.pct != null && o.pct * 100 >= S.set.stockPct) t.push('<span class="tag t-stock">Vorrat</span>');
  if (o.state === 'next') t.push('<span class="tag t-warn">ab ' + fmtD(o.valid[0]) + '</span>');
  if (o.appRequired) t.push('<span class="tag t-warn">nur mit App/Coupon</span>');
  const nh = p && o.state === 'now' ? nextHint(productInfo(p)) : null;
  const laterBtn = !opt.noAdd && (o.state === 'next' || nh) ? `<button class="btn sm" onclick="rememberOffer('${esc(o.id)}')">📌 Merken</button>` : '';
  const add = opt.noAdd || o.state === 'next' || (p && onList(p.id)) ? '' : p ? `<button class="btn sm" onclick="addP('${p.id}')">+ Liste</button>` : `<button class="btn sm" onclick="addOfferItem('${esc(o.id)}')">+ Liste</button>`; // auch Neues, das du sonst nie kaufst
  const badge = o.pct != null ? `<span class="pct ${o.dubious ? 'dub' : ''}" ${o.dubious ? 'title="Vergleich mit Hersteller-UVP, vermutlich Schein-Rabatt"' : ''}>${o.dubious ? '≈ ' : ''}−${Math.round(o.pct * 100)} %</span>` : '';
  return `<div class="card offer" style="--sc:${storeColor(o.store.id)}"><div class="ohead">${thumb(o.img, iconFor(p, o.name))}
  <div class="grow"><div class="row sp nowrap"><h3 class="grow">${esc(o.name)}</h3>${badge}</div>
  ${o.desc ? `<div class="mute clamp">${esc(o.desc)}</div>` : ''}
  <div class="row" style="margin-top:2px"><span class="price">${eur(o.price)}</span>${o.regular ? `<span class="old">${eur(o.regular)}</span>` : ''}${o.up ? `<span class="mute">${eur(o.up.v)} / ${unitLbl(o.up.base)}</span>` : ''}${p ? `<button class="info" onclick="compare('${p.id}')" title="Preisvergleich" aria-label="Preisvergleich">i</button>` : ''}</div></div></div>
  <div class="row" style="margin:8px 0 2px">${t.join('')}</div>
  ${o.pct != null ? `<div class="mute">Ersparnis ${o.regular ? eur(o.regular - o.price) + ' ' : ''}(${esc(o.kind)})</div>` : ''}${cmp ? `<div class="small" style="margin-top:3px"><b>${esc(cmp)}</b></div>` : ''}${nextLine(nh)}
  ${o.note ? `<div class="mute">${esc(o.note)}</div>` : ''}${o.incomplete ? `<div class="mute">⚠ ${esc(o.incomplete)}</div>` : ''}
  <div class="row sp" style="margin-top:8px"><span class="mute">gültig ${fmtD(o.valid[0])}–${fmtD(o.valid[1])}${o.src ? ` · <a href="${esc(o.src)}" target="_blank" rel="noopener">Quelle</a>` : ''}</span><span class="row" style="gap:6px">${laterBtn}${add}</span></div></div>`;
}

/* ================= Views ================= */
const V = {}; const UI = { where: 'local', qa: false, offers: 'week', wege: 'extra', open: new Set(), q: '', more: false };
// Menge + Produkt aus einem Satz lesen: „2 Milch", „Milch 2x", „zweimal Honigmelone", „Honigmelone 2", „1 kg Hackfleisch",
// „Hackfleisch 1 kg", „ein Kilo Hackfleisch", „ein halbes Kilo Butter", „drei Packungen Nudeln", „500 g Reis"
const NUMW = { ein: 1, eine: 1, einen: 1, einem: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12 };
const UNITW = { kilo: 'kg', kilogramm: 'kg', kg: 'kg', gramm: 'g', g: 'g', pfund: 'Pfd', liter: 'l', l: 'l', ml: 'ml', packung: 'Pck', packungen: 'Pck', pck: 'Pck', pack: 'Pck', packs: 'Pck', stück: 'Stk', stk: 'Stk', flasche: 'Fl', flaschen: 'Fl', dose: 'Dose', dosen: 'Dosen', becher: 'Becher', kasten: 'Kasten', kisten: 'Kisten', kiste: 'Kiste', beutel: 'Beutel', bund: 'Bund', glas: 'Glas', gläser: 'Gläser', tüte: 'Tüte', tüten: 'Tüten', netz: 'Netz', rolle: 'Rollen', rollen: 'Rollen' };
const NUMRX = '(\\d+(?:[.,]\\d+)?|' + Object.keys(NUMW).join('|') + ')';
const UNITRX = '(' + Object.keys(UNITW).sort((a, b) => b.length - a.length).join('|') + ')';
const numVal = t => /^\d/.test(t) ? t.replace('.', ',') : String(NUMW[t.toLowerCase()]);
function mkQty(num, unit) { // „1" ohne Einheit = keine Menge; „1 kg" bleibt
  const n = numVal(num), u = unit ? UNITW[unit.toLowerCase()] : '';
  if (!u) return n === '1' ? '' : n;
  return (n === '1' && !['kg', 'g', 'l', 'ml', 'Pfd'].includes(u) ? '' : n + ' ' + u);
}
function parseAdd(txt) {
  let qty = '', name = txt.trim().replace(/\s+/g, ' '), m;
  if ((m = name.match(/^(?:ein\s+)?halbe[sn]?\s+(kilo|pfund|liter)\s+(?:von\s+)?(.+)$/i))) { qty = m[1].toLowerCase() === 'pfund' ? '250 g' : '0,5 ' + UNITW[m[1].toLowerCase()]; name = m[2]; }
  else if ((m = name.match(new RegExp('^' + NUMRX + '\\s*(?:x|×|mal)\\s+(.+)$', 'i')))) { qty = mkQty(m[1]); name = m[2]; }          // 2x Milch, 2 mal Milch
  else if ((m = name.match(new RegExp('^' + NUMRX + 'mal\\s+(.+)$', 'i')))) { qty = mkQty(m[1]); name = m[2]; }                         // zweimal Honigmelone
  else if ((m = name.match(new RegExp('^' + NUMRX + '\\s*' + UNITRX + '\\b\\s*(?:von\\s+)?(.+)$', 'i')))) { qty = mkQty(m[1], m[2]); name = m[3]; } // 1 kg Hackfleisch, ein Kilo Hack
  else if ((m = name.match(/^(?:ein|eine|einen|einem)\s+(.+)$/i))) { name = m[1]; }                                                  // ein Ei -> Ei
  else if ((m = name.match(new RegExp('^(\\d+(?:[.,]\\d+)?|' + Object.keys(NUMW).filter(w => !/^ein/.test(w)).join('|') + ')\\s+(.+)$', 'i')))) { qty = mkQty(m[1]); name = m[2]; } // 2 Milch, zwei Milch
  else if ((m = name.match(new RegExp('^(.+?)\\s+' + NUMRX + '\\s*' + UNITRX + '$', 'i')))) { qty = mkQty(m[2], m[3]); name = m[1]; }       // Hackfleisch 1 kg
  else if ((m = name.match(new RegExp('^(.+?)\\s+([1-9]|1\\d|20|zwei|zwo|drei|vier|fünf|sechs|sieben|acht|neun|zehn|zwölf)\\s*(?:x|×|mal)?$', 'i')))) { qty = mkQty(m[2]); name = m[1]; } // Honigmelone 2, Milch 2x
  name = name.replace(/\s+/g, ' ').trim() || txt.trim();
  let p = PRODUCTS.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!p) { let len = 0; for (const q of PRODUCTS) { const k = rx(q).exec(name); if (k && k[0].length > len) { p = q; len = k[0].length; } } }
  return { name, qty, pid: p ? p.id : null };
}
// Mengen-Anzeige: „× 2" bei Stückzahl, „1 kg" bei Gewicht/Einheit
const qtyLabel = q => !q ? '' : (/[a-zäöü]/i.test(q) ? q : '× ' + q);

// Hauptprodukte: Was du immer wieder in die Liste einträgst oder kaufst, erkennt die App selbst und zeigt es ganz oben bei „Schnell hinzufügen"
const freq = p => Math.max(S.adds[p.id] || 0, S.buys[p.id] || 0);
function noteAdd(pid) { // zählt höchstens einmal pro Tag und Produkt; ab 3 Tagen wird es automatisch ein Favorit
  const p = pid ? PROD(pid) : null; if (!p) return null;
  const day = isoDay(TODAY);
  if (S.addDay[pid] !== day) { S.addDay[pid] = day; S.adds[pid] = (S.adds[pid] || 0) + 1; noteRec(pid, day); }
  if (freq(p) >= 3 && !watched(pid)) { S.watch.push(pid); return p.name; }
  return null;
}
function noteRec(pid, day) { const r = (S.rec = S.rec || {})[pid] = S.rec[pid] || []; if (r[r.length - 1] !== day) r.push(day); if (r.length > 8) r.shift(); } // die letzten Kauf-/Eintragstage
const recScore = p => { const d = (S.rec && S.rec[p.id]) || []; let s = 0; d.forEach(x => { s += Math.pow(0.5, Math.max(0, (+TODAY - +d0(x)) / 864e5) / 30); }); return s + Math.max(0, freq(p) - d.length) * 0.25; }; // jüngere Tage zählen mehr (Halbwertszeit 30 Tage)
const mainProducts = () => PRODUCTS.filter(p => freq(p) >= 2).sort((a, b) => recScore(b) - recScore(a) || a.name.localeCompare(b.name, 'de'));
const chipHtml = p => {
  const on = onList(p.id), i = productInfo(p), b = i.nearBest || i.best;
  return `<button class="chip ${on ? 'on' : ''} ${freq(p) >= 2 ? 'main' : ''}" onclick="toggleP('${p.id}')" aria-pressed="${on}">${on ? '✓' : iconFor(p)} ${esc(p.name.split(' /')[0])}${!on && b && b.pct != null && !b.dubious ? ` <b style="color:var(--acc)">−${Math.round(b.pct * 100)}%</b>` : ''}</button>`;
};
function toggleP(id) { if (onList(id)) { S.list = S.list.filter(i => !(i.pid === id && !i.done)); save(); render(); } else addP(id); }
function quickAdd() {
  const due = laterDue(), main = mainProducts(), open = UI.qa;
  const others = PRODUCTS.filter(p => !main.includes(p) && watched(p.id));
  const rest = PRODUCTS.filter(p => !main.includes(p) && !others.includes(p) && !p.custom);
  const shown = open ? main : main.slice(0, 18);
  const fill = open ? [] : others.slice(0, Math.max(0, 10 - shown.length)); // solange die App noch lernt: deine Standard-Favoriten
  const dueChips = due.map(x => `<button class="chip due" onclick="laterToList('${x.id}')" title="Von dir gemerkt, jetzt günstiger">📌 ${esc(x.name)}</button>`).join('');
  const toggle = `<button class="chip arrow" onclick="toggleQa()" aria-expanded="${open}">${open ? '▴ Weniger' : '▾ Mehr'}</button>`;
  const title = main.length ? '⭐ Deine Hauptprodukte' : 'Schnell hinzufügen';
  if (!shown.length && !fill.length && !due.length && !open) return `<div class="qa"><div class="row sp qh"><span class="mute">Schnell hinzufügen</span>${toggle}</div></div>`;
  let h = `<div class="qa"><div class="row sp qh"><span class="mute">${title}${due.length ? ' · 📌 jetzt günstiger' : ''}</span>${toggle}</div><div class="chips">${dueChips}${shown.map(chipHtml).join('')}${fill.map(chipHtml).join('')}</div>`;
  if (open) {
    const cats = [...new Set(rest.map(p => p.cat))];
    h += (others.length ? `<div class="mute qh" style="margin-top:8px">Weitere Favoriten</div><div class="chips">${others.map(chipHtml).join('')}</div>` : '') +
      `<div class="mute small qh" style="margin-top:8px">Die App lernt mit: Was du in letzter Zeit oft brauchst, steht vorne. Ab 2 Einkaufstagen wird ein Produkt zum Hauptprodukt, ab 3 zum Favoriten.</div>` +
      cats.map(c => `<div class="mute qh" style="margin-top:8px">${ICON[c] || ''} ${c}</div><div class="chips">${rest.filter(p => p.cat === c).map(chipHtml).join('')}</div>`).join('');
  }
  return h + '</div>';
}
function toggleQa() { const v = $('#ni') ? $('#ni').value : ''; UI.qa = !UI.qa; render(); if (v && $('#ni')) $('#ni').value = v; }
let SUGG = [];
const groupHead = k => {
  if (k === '_none') return '📍 Ohne Angebot <span class="tag">normal im City-Center kaufen</span>';
  const st = STORE(k);
  return { A: `🏠 ${esc(st.short)}`, B: `🚶 ${esc(st.short)} <span class="tag t-warn">Spaziergang · optional</span>`, C: `🚗 ${esc(st.short)} <span class="tag t-warn">Sonderfahrt · optional</span>`, D: `🏪 ${esc(st.short)} <span class="tag t-stock">optional</span>` }[st.tier];
};
// Reihenfolge im Laden: Obst & Gemüse zuerst, dann Brot, Fleisch, Kühlregal, Tiefkühl, Vorräte, Getränke, Drogerie und Haushalt. Schweres zuletzt.
const AISLE = { 'Obst & Gemüse': 1, 'Backwaren': 2, 'Fleisch': 3, 'Milchprodukte': 4, 'Tiefkühl': 5, 'Öle & Grundnahrung': 6, 'Eigene Produkte': 7, 'Getränke': 8, 'Drogerie & Gesundheit': 9, 'Haushalt & Wäsche': 10 };
const AISLE_GUESS = [
  [/obst|gemüse|salat|tomate|gurke|paprika|banane|apfel|äpfel|birne|zitrone|orange|kartoffel|zwiebel|karotte|möhre|pilz|champignon|beere|traube|melone|avocado|knoblauch|kräuter|petersilie|ingwer|zucchini|brokkoli|spinat/i, 1],
  [/brot|brötchen|toast|baguette|kuchen|croissant|semmel|laugen|bagel/i, 2],
  [/fleisch|hack|hähnchen|hühn|steak|schnitzel|filet|lachs|fisch|garnele|wurst|schinken|speck|salami|gulasch/i, 3],
  [/milch|joghurt|quark|käse|butter|sahne|(^|\s)eier?(\s|$)|margarine|skyr|kefir|frischkäse|pudding/i, 4],
  [/tiefkühl|tk-|pizza|(^|\s)eis(\s|$)|pommes|eiscreme/i, 5],
  [/nudel|reis|mehl|zucker|öl(\s|$)|essig|soße|sauce|konserve|dose|müsli|haferflocken|cornflakes|kaffee|tee(\s|$)|salz|gewürz|honig|marmelade|nutella|schokolade|chips|nüsse|kekse|süß|linsen|bohnen|suppe|ketchup|senf|mayo/i, 6],
  [/wasser|saft|cola|limo|bier|wein|sprudel|getränk|sekt|schorle/i, 8],
  [/zahn|shampoo|duschgel|deo(\s|$)|seife|creme|vitamin|tablette|pflaster|rasier|tampon|binden|windel|b12|magnesium/i, 9],
  [/waschmittel|weichspüler|spülmittel|reiniger|müllbeutel|küchen(rolle|tuch|tücher)|toilettenpapier|klopapier|servietten|alufolie|backpapier|batterie|glühbirne|schwamm/i, 10]
];
function aisleOf(it, p) {
  let a = p && p.cat !== 'Eigene Produkte' ? AISLE[p.cat] : null;
  if (!a) { const g = AISLE_GUESS.find(([r]) => r.test(it.name)); a = g ? g[1] : 7; }
  return (itemHeavy(it, p) ? 50 : 0) + a; // Schweres (Wasser, Klopapier, Waschmittel) zuletzt
}
const aisleCmp = (a, b) => aisleOf(a.it, a.p) - aisleOf(b.it, b.p) || a.it.name.localeCompare(b.it.name, 'de');

// Kompakte Zeile: Haken, Symbol, Name, Preis. Antippen klappt die Einzelheiten auf (gilt für Liste und Route).
function cRow(c) {
  const it = c.it, id = it.id, p = c.p, b = c.b, open = UI.open.has(id), heavy = c.heavy !== undefined ? c.heavy : itemHeavy(it, p), route = c.ctx === 'route';
  const right = b && !it.done ? `<b>${eur(b.price)}</b><small>${route ? '' : esc(b.store.short)}${b.pct != null ? (route ? '' : ' · ') + `<span class="pc${b.dubious ? ' dub' : ''}">−${Math.round(b.pct * 100)} %</span>` : ''}</small>` : '';
  return `<div class="crow${it.done ? ' done' : ''}${open ? ' open' : ''}${UI.flash && UI.flash.has(id) ? ' flash' : ''}" id="it-${id}" onclick="toggleOpen('${id}')">
    <button class="chk ${it.done ? 'on' : ''}" onclick="event.stopPropagation();tick('${id}')" aria-label="${it.done ? 'wieder offen' : 'abhaken'}">${it.done ? '✓' : ''}</button>
    <span class="em" aria-hidden="true">${iconFor(p, it.name)}</span>
    <span class="nm">${esc(it.name)}${it.qty ? ` <span class="mute">${esc(qtyLabel(it.qty))}</span>` : ''}${it.urgent ? ' <span class="tag t-warn">dringend</span>' : ''}${route && heavy ? (heavyKind(it, p) === 'sperrig' ? ' <span title="sperrig">📦</span>' : ' <span title="schwer">🏋️</span>') : ''}</span>
    <span class="pr${b && !it.done && b.pct != null && !b.dubious && b.pct >= 0.1 ? ' sale' : ''}">${right}</span><button class="chev" aria-expanded="${open}" aria-label="Einzelheiten ${open ? 'zuklappen' : 'aufklappen'}" onclick="event.stopPropagation();toggleOpen('${id}')">▾</button></div>${open ? cDetail(c) : ''}`;
}
function cDetail(c) {
  const it = c.it, id = it.id, p = c.p, b = c.b, info = c.info !== undefined ? c.info : (p ? productInfo(p) : null), dec = c.dec !== undefined ? c.dec : (info ? decision(info, it) : null), pf = prefOf(p, it.name);
  const tip = !it.done && p ? tipFor(p.id) : null;
  return `<div class="cdet"><div class="row nowrap" style="gap:10px">${thumb(b && b.img, iconFor(p, it.name), 'sm')}<div class="grow small">${b
    ? `<b>${eur(b.price)}</b> bei <b>${esc(b.store.short)}</b>${b.up ? ` · ${eur(b.up.v)}/${unitLbl(b.up.base)}` : ''}${b.pct != null ? ` <span class="pct ${b.dubious ? 'dub' : ''}">−${Math.round(b.pct * 100)} %</span>` : ''}${p ? ` <button class="info" onclick="compare('${p.id}')" title="Preisvergleich" aria-label="Preisvergleich">i</button>` : ''}${dec && dec.cls ? ` <span class="tag ${dec.cls}">${dec.tag}</span>` : ''}<div class="mute">${esc(b.name.slice(0, 44))}${b.desc ? ' · ' + esc(b.desc.slice(0, 40)) : ''}</div>`
    : `<span class="mute">${esc(c.note || (pf ? prefNote(pf) : 'Kein aktuelles Angebot bekannt. Normal im City-Center kaufen.'))}</span>`}${c.note && b ? `<div class="mute">${esc(c.note)}</div>` : ''}</div></div>
    ${dec ? `<div class="small" style="margin-top:6px">${esc(dec.why)}</div>` : !p ? '<div class="small mute" style="margin-top:6px">Noch kein Produkt zugeordnet. Mit 👁 wird es beobachtet und bei der nächsten Suche gefunden.</div>' : ''}
    ${tip ? `<div class="small nxt">💡 ${esc(tipText(tip))}</div>` : ''}
    ${!it.done ? nextLine(info ? nextHint(info) : null, `<button class="lnk" onclick="rememberItem('${id}')">📌 für nächste Woche merken</button>`) : ''}
    ${info && info.now.length ? `<table style="margin-top:6px">${info.now.slice(0, 5).map(x => `<tr><td><i class="dot t${x.store.tier}"></i>${esc(x.store.short)}</td><td class="mute">${esc(x.name.slice(0, 28))}</td><td>${eur(x.price)}${x.up ? ` <span class="mute">${eur(x.up.v)}/${unitLbl(x.up.base)}</span>` : ''}</td></tr>`).join('')}</table>` : ''}
    <div class="row" style="margin-top:8px"><label class="mute"><input type="checkbox" ${it.urgent ? 'checked' : ''} onchange="urgent('${id}')" style="width:auto"> dringend</label><label class="mute"><input type="checkbox" ${itemHeavy(it, p) ? 'checked' : ''} onchange="toggleHeavy('${id}')" style="width:auto"> schwer/sperrig (zuletzt)</label></div>
    ${it.pid ? `<div class="mute" style="margin-top:8px">Wo kaufst du das normalerweise?</div><div class="chips">${['dm', 'rewe', 'netto', 'aldi', 'lidl'].map(s => `<button class="chip ${(S.prefs[it.pid] || (pf || {}).id) === s ? 'on' : ''}" onclick="setPref('${it.pid}','${s}')">${STORE(s).short}</button>`).join('')}<button class="chip" onclick="setPref('${it.pid}','')">Egal</button></div>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn sm" onclick="eye('${id}')">👁 ${p && watched(p.id) ? 'Beobachtet' : 'Beobachten'}</button><button class="btn sm" onclick="rememberItem('${id}')">📌 Nächste Woche</button><button class="btn sm" onclick="del('${id}')">✕ Entfernen</button></div></div>`;
}
V.list = () => {
  const rows = S.list.map((it, i) => { const p = it.pid ? PROD(it.pid) : null, info = p ? productInfo(p) : null; return { it, i, p, info, dec: info ? decision(info, it) : null, b: info && (info.nearBest || info.best) }; });
  const open = rows.filter(r => !r.it.done), done = rows.filter(r => r.it.done);
  const groups = {};
  open.forEach(r => { const k = r.b ? r.b.store.id : (prefOf(r.p, r.it.name) || { id: '_none' }).id; (groups[k] = groups[k] || []).push(r); });
  const order = Object.keys(groups).sort((a, b) => (a === '_none') - (b === '_none') || 'ABCD'.indexOf(STORE(a).tier) - 'ABCD'.indexOf(STORE(b).tier));
  order.forEach(k => groups[k].sort(aisleCmp)); // Reihenfolge wie im Laden
  const row = r => cRow({ it: r.it, p: r.p, b: r.b, info: r.info, dec: r.dec });
  const qa = quickAdd();
  SUGG = Object.entries(S.buys).filter(([k, n]) => n >= 2 && (k.startsWith('n:') || !watched(k)) && !(k.startsWith('n:') && S.custom.some(c => c.name.toLowerCase() === k.slice(2)))).slice(0, 3);
  const help = S.hideHelp ? '' : `<div class="card help"><h3>👋 So funktioniert's</h3><ol>
    <li><b>Liste schreiben oder sprechen:</b> unten eintippen oder 🎤 einsprechen, z. B. „Milch, Butter und 2 Paprika".</li>
    <li><b>Angebote suchen:</b> holt die aktuellen Angebote. Die App sagt dir pro Produkt, wo es am besten ist. Dein <b>City-Center Chorweiler</b> steht immer an erster Stelle.</li>
    <li><b>Produkt antippen:</b> zeigt Preis, Laden und weitere Möglichkeiten.</li>
    <li><b>Einkauf abschließen:</b> Hake ab, was im Wagen ist. Die App merkt sich, was du oft kaufst.</li></ol>
    <button class="btn sm" onclick="S.hideHelp=true;save();render()">Verstanden</button></div>`;
  const bkDays = S.lastBackup ? Math.round((TODAY - d0(S.lastBackup)) / 864e5) : 999;
  const backupBanner = (S.bons.length + Object.keys(S.adds).length >= 5 && bkDays > 30 && !UI.hideBk) ? `<div class="banner info row sp"><span>💾 Deine Daten liegen nur auf diesem Gerät. ${S.lastBackup ? 'Letzte Sicherung vor ' + bkDays + ' Tagen.' : 'Noch keine Sicherung.'}</span><span class="row" style="gap:6px"><button class="btn sm" onclick="exp()">Jetzt sichern</button><button class="ico" onclick="UI.hideBk=true;render()" aria-label="Später">✕</button></span></div>` : '';
  const sugg = SUGG.map(([k, n], i) => `<div class="banner info row sp"><span>Du kaufst <b>${esc(k.startsWith('n:') ? k.slice(2) : (PROD(k)?.name || k))}</b> oft (${n}×). Beobachten?</span><button class="btn sm" onclick="watchKey(${i})">👁 Ja</button></div>`).join('');
  const main = open.length
    ? `<div class="lhead"><b>🛒 Meine Liste</b><span>${open.length} ${open.length === 1 ? 'Artikel' : 'Artikel'} offen · Reihenfolge wie im Laden</span></div>` + order.map(k => `<h2 class="sh" style="--sc:${storeColor(k)}">${groupHead(k)}</h2><div class="card tight main">${groups[k].map(row).join('')}</div>`).join('')
    : (done.length ? '' : empty('🛒', 'Deine Liste ist leer.<br>Tippe unten ein, was du brauchst, oder wähle ein Hauptprodukt.'));
  const wagen = done.length ? `<h2 class="sh">🧺 Im Wagen</h2><div class="card tight">${done.map(row).join('')}</div><button class="btn pri" style="width:100%;margin-top:4px" onclick="finish()">✅ Einkauf abschließen (${done.length})</button>` : '';
  const live = !SRC.live ? `<div class="banner">Noch keine echten Angebote geladen. Tippe oben auf <b>Angebote suchen</b>.</div>` : '';
  // Liste zuerst. Ist sie leer, kommen Anleitung und Schnell-Hinzufügen nach oben, sonst darunter.
  return open.length
    ? `${main}${wagen}${qa}${sugg}${laterBlock()}${live}${help}${backupBanner}<div style="text-align:center;margin:12px 0"><button class="btn" onclick="go('bon')">🧾 Kassenbon einlesen</button></div>${topSummary()}`
    : `${help}${backupBanner}${qa}${sugg}${laterBlock()}${live}${main}${wagen}<div style="text-align:center;margin:12px 0"><button class="btn" onclick="go('bon')">🧾 Kassenbon einlesen</button></div>${topSummary()}`;
};
function offersFiltered() {
  const q = UI.q.toLowerCase().trim(); return OFFERS_ALL().filter(o => !q || (o.name + ' ' + (o.desc || '') + ' ' + o.store.short + ' ' + (o.p ? o.p.name : '')).toLowerCase().includes(q));
}
// Angebote nach Entfernung getrennt: Vor Ort (City-Center) · Spaziergang (Lidl) · Mit dem Auto (Großmarkt)
const WHERE = { local: ['A'], walk: ['B'], car: ['C', 'D'] };
const whereCount = k => OFFERS_ALL().filter(o => o.state === 'now' && WHERE[k].includes(o.store.tier)).length;
function offersBody() {
  const w = UI.where || 'local', tiers = WHERE[w], t = UI.offers;
  const offs = offersFiltered().filter(o => tiers.includes(o.store.tier)), byPct = (a, b) => (b.pct || 0) - (a.pct || 0), lim = (a, n) => UI.more ? a : a.slice(0, n);
  const more = (a, n) => !UI.more && a.length > n ? `<div style="text-align:center;margin:10px"><button class="btn" onclick="UI.more=true;renderOffers()">Alle ${a.length} anzeigen</button></div>` : '';
  const intro = w === 'walk' ? (t === 'week' ? extraBody() : '') : w === 'car' ? `<div class="banner info">🚗 Hier fährst du extra hin (Großmarkt, Selgros, METRO, Handelshof). Das ist nur eine Option, wenn du Zeit und Lust hast. Eine Route dafür plant die App nicht. METRO-Preise gelten für Gewerbekunden.</div>` : '';
  const none = w === 'local' ? 'Keine Treffer. Tippe oben auf „Angebote suchen" oder „Neueste Angebote".' : w === 'walk' ? 'Aktuell keine Lidl-Angebote zu deinen Produkten.' : 'Aktuell keine Großmarkt-Angebote zu deinen Produkten.';
  if (t === 'week' || t === 'next') {
    const st = t === 'week' ? 'now' : 'next', m = offs.filter(o => o.state === st && o.p).sort(byPct);
    const a = m.filter(o => onList(o.p.id)), b = m.filter(o => !a.includes(o) && watched(o.p.id)), c = m.filter(o => !a.includes(o) && !b.includes(o));
    return `${intro}${t === 'next' ? nextStatusLine() + '<div class="banner info">📌 Tippe bei einem Angebot auf „Merken“. Das Produkt erscheint dann in der Woche, in der es günstiger ist, oben bei „Schnell hinzufügen“ und in deiner Liste.</div>' : ''}${t === 'next' && !m.length ? empty('🗓️', 'Noch keine Angebote für nächste Woche bekannt. Sie erscheinen meist ab Samstag.') : ''}
    ${a.length ? `<h2>Auf deiner Liste</h2>${grid(a.map(o => offerCard(o)).join(''))}` : ''}${b.length ? `<h2>👁 Beobachtet</h2>${grid(b.map(o => offerCard(o)).join(''))}` : ''}
    ${c.length ? `<h2>Weitere Treffer aus deiner Dauerliste</h2>${grid(lim(c, 24).map(o => offerCard(o)).join(''))}${more(c, 24)}` : ''}${t === 'week' && !m.length && w !== 'walk' ? empty('🔎', SRC.live ? none : 'Noch nichts geladen. Tippe oben auf „Angebote suchen".') : ''}`;
  }
  if (t === 'discover') {
    const d = offs.filter(o => !o.p && o.food && !o.dubious && o.pct != null && o.pct >= 0.25 && o.state === 'now').sort(byPct);
    return `${intro}<div class="banner info">Starke Angebote, die nicht in deiner Liste stehen, ohne Schwein, Wurst und Salami.</div>${d.length ? grid(lim(d, 24).map(o => offerCard(o)).join('')) + more(d, 24) : empty('✨', 'Hier gibt es gerade nichts Starkes ab 25 % Ersparnis.')}`;
  }
  const meat = offs.filter(o => o.state === 'now' && o.p && o.p.meat).sort((a, b) => rank(a, b));
  const stock = offs.filter(o => o.state === 'now' && o.p && o.p.stock && !o.p.meat && o.pct != null && o.pct * 100 >= S.set.stockPct).sort(byPct);
  return `${intro}<h2>🥩 Fleisch, alle Angebote nach Preis</h2>${meat.length ? grid(lim(meat, 24).map(o => offerCard(o)).join('')) + more(meat, 24) : empty('🥩', 'Hier gibt es gerade kein Fleischangebot.')}
  <h2>Haltbares ab ${S.set.stockPct} % Ersparnis</h2>${stock.length ? grid(lim(stock, 24).map(o => offerCard(o)).join('')) : empty('📦', 'Aktuell nichts, das den Schwellwert erreicht.')}`;
}
const SEG = (cur, items, fn, cls = '') => `<div class="seg ${cls}">${items.map(([k, l]) => `<button class="${k === cur ? 'on' : ''}" onclick="${fn}('${k}')">${l}</button>`).join('')}</div>`;
V.offers = () => `${SEG(UI.where || 'local', [['local', `🏠 Vor Ort <small>${whereCount('local')}</small>`], ['walk', `🚶 Spazieren <small>${whereCount('walk')}</small>`], ['car', `🚗 Auto <small>${whereCount('car')}</small>`]], 'setWhere', 'seg3')}
  <div class="chips scroll" style="margin:0 0 10px">${[['week', 'Diese Woche'], ['next', `Nächste Woche <small>${nextBadge()}</small>`], ['discover', 'Entdecken'], ['stock', 'Vorrat & Fleisch']].map(([k, l]) => `<button class="chip ${k === UI.offers ? 'on' : ''}" onclick="setOff('${k}')">${l}</button>`).join('')}</div>
  <div class="add"><input id="oq" placeholder="Angebote durchsuchen…" value="${esc(UI.q)}" oninput="UI.q=this.value;UI.more=false;renderOffers()"></div><div id="olist">${offersBody()}</div>`;
const setWhere = k => { UI.where = k; UI.more = false; render(); };
const renderOffers = () => { const e = $('#olist'); if (e) e.innerHTML = offersBody(); };
V.watch = () => {
  return `<div class="banner info">👁 <b>Was ist das?</b> Beobachtete Produkte sind deine Dauerprodukte. Die App prüft sie bei jeder Angebotssuche, auch wenn sie nicht auf deiner Liste stehen, und zeigt dir starke Angebote dafür auf der Startseite. Aktuell beobachtet: <b>${S.watch.length}</b></div>
  <div class="add"><input id="wn" placeholder="Eigenes Produkt beobachten, z. B. Lachs" onkeydown="if(event.key==='Enter')addCustom()"><button class="btn pri" onclick="addCustom()">+</button></div>
  <div class="add"><input placeholder="Produkte filtern…" value="${esc(UI.wq || '')}" oninput="UI.wq=this.value;$('#wl').innerHTML=watchBody()"></div><div id="wl">${watchBody()}</div>`;
};
function watchBody() { const qq = (UI.wq || '').toLowerCase(); return [...new Set(PRODUCTS.map(p => p.cat))].map(c => { const l = PRODUCTS.filter(p => p.cat === c && (!p.custom || watched(p.id) || onList(p.id)) && (!qq || p.name.toLowerCase().includes(qq))).sort((a, b) => watched(b.id) - watched(a.id)); const line = p => { const i = productInfo(p), b = i.nearBest || i.best; return `<div class="item"><button class="ico ${watched(p.id) ? 'on' : ''}" onclick="watchP('${p.id}')" title="${watched(p.id) ? 'Nicht mehr beobachten' : 'Beobachten'}">👁</button>${thumb(b && b.img, iconFor(p), 'sm')}<div class="grow"><div class="nm" style="cursor:default">${esc(p.name)}</div><div class="mute">${b ? `<b style="color:var(--ink)">${eur(b.price)}</b> ${esc(b.store.short)}${b.pct != null ? ` · −${Math.round(b.pct * 100)} %` : ''}` : 'Kein Angebot bekannt'}${p.note ? ' · ' + esc(p.note) : ''}</div></div><button class="btn sm" onclick="addP('${p.id}')">+ Liste</button></div>`; }; return l.length ? `<h2>${ICON[c] || ''} ${c}</h2><div class="card tight">${l.map(line).join('')}</div>` : ''; }).join(''); }
V.route = () => routeView();
V.bon = () => bonView();
function extraBody() {
  const offs = OFFERS_ALL().filter(o => o.state === 'now' && o.p && !o.bulk && o.store.tier === 'B');
  if (!offs.length) return empty('🚶', 'Keine Angebote bei Lidl für deine Produkte bekannt.');
  const by = {}; offs.forEach(o => (by[o.store.id] = by[o.store.id] || []).push(o));
  return `<div class="banner info">Dein Hauptbereich ist das City-Center Chorweiler. Hier siehst du, ob sich ein Abstecher woanders lohnt. Rechnung: Ersparnis gegenüber dem City-Center-Angebot (oder Referenz) minus Zeit für Hin- und Rückweg. „Lohnt sich" ab ${S.set.hourly} € pro Extra-Stunde (Einstellung, meine Annahme). <b>Lidl</b> ist dein Spaziergang-Ziel: Wenn du eh dort spazierst, lohnt jede Ersparnis.</div>` + Object.entries(by).map(([id, list]) => {
    const st = STORE(id), mins = (st.tier === 'B' ? st.walk : st.car) * 2, tooFar = st.tier === 'C' && st.car > S.set.carMax;
    let sum = 0, unk = 0;
    const rows = list.sort((a, b) => (b.pct || 0) - (a.pct || 0)).slice(0, 12).map(o => {
      const near = productInfo(o.p).nearBest, q = qtyBase(o); let sav = null, basis = '';
      if (o.up && q) { if (near && near.up && near.up.base === o.up.base) { sav = (near.up.v - o.up.v) * q; basis = 'vs. ' + near.store.short; } else { const r = refPrice(o.p); if (r && o.up.base === o.p.base) { sav = (r.v - o.up.v) * q; basis = 'vs. Referenz'; } } }
      if (sav == null) unk++; else if (sav > 0) sum += sav;
      return `<tr><td>${esc(o.name.slice(0, 30))}</td><td>${eur(o.price)}</td><td>${sav == null ? '<span class="mute">kein Vergleich</span>' : `${sav < 0 ? '−' : ''}${eur(Math.abs(sav))} <span class="mute">${basis}</span>`}</td></tr>`;
    }).join('');
    const perH = mins ? sum / (mins / 60) : 0, walkTrip = st.tier === 'B', ok = sum > 0 && (walkTrip || perH >= S.set.hourly) && !tooFar;
    return `<div class="card"><div class="row sp"><h3><i class="dot t${st.tier}"></i>${walkTrip ? '🚶 ' : '🚗 '}${esc(st.name)}</h3><span class="tag ${ok ? 't-ok' : 't-warn'}">${ok ? (walkTrip ? 'Mit Spaziergang verbinden' : 'Lohnt sich') : tooFar ? 'Zu weit' : sum > 0 ? 'Eher nicht' : 'Kein belegter Vorteil'}</span></div>
    <div class="mute">${st.tier === 'B' ? st.walk + ' Min zu Fuß' : 'ca. ' + st.car + ' Min Auto'} · ca. ${mins} Min Extraweg hin und zurück</div><table>${rows}</table>
    <div class="small" style="margin-top:6px"><b>Du sparst ca. ${eur(sum)}</b>, dafür ca. ${mins} Min Extraweg${sum > 0 ? ` (= ${eur(perH)}/Std.)` : ''}.${unk ? ` ${unk} ohne Vergleich (Packungsgröße oder Nah-Preis fehlt).` : ''}</div></div>`;
  }).join('');
}
function woandersBody() {
  const offs = OFFERS_ALL().filter(o => o.store.tier === 'D' && o.state === 'now').sort((a, b) => (b.pct || 0) - (a.pct || 0));
  return `<div class="banner info">Optional, wenn du Zeit und Lust hast: Großmarkt (Selgros Köln-Am Butzweilerhof, METRO, Handelshof) oder Bestellung. Das gehört nicht zur normalen Einkaufsliste. METRO-Preise gelten für Gewerbekunden. Orte und Öffnungszeiten findest du unter Mehr → Läden.</div>` + (offs.length ? grid(offs.map(o => offerCard(o)).join('')) : empty('🏪', 'Aktuell keine Großmarkt-Angebote bekannt. Eigene Funde (z. B. aus dem Selgros-Prospekt) trägst du unter Mehr ein.'));
}
// Prospekte: je Laden Zugang zu den Aktionsseiten, mit Stand aus den geladenen Daten
V.pro = () => {
  const all = OFFERS_ALL(), cnt = (id, st) => all.filter(o => o.store.id === id && o.state === st).length;
  const aldiNext = all.filter(o => o.store.id === 'aldi' && o.state === 'next').map(o => o.valid[0]).sort()[0];
  const card = s => {
    const now = cnt(s.id, 'now'), next = cnt(s.id, 'next'), canNext = NEXT_STORES.includes(s.id);
    const links = s.id === 'aldi' ? [['Diese Woche', s.links[0][1]], ['Nächste Woche', aldiNext ? 'https://www.aldi-sued.de/angebote/' + aldiNext : s.links[0][1]], ...s.links.slice(1)] : s.links;
    return `<div class="card"><div class="row sp"><b>${esc(s.short)}</b><span class="mute">${now ? '✓ ' + now + ' Angebote in der App' : 'keine Preise in der App'}</span></div>
      ${canNext ? `<div class="mute" style="margin-top:2px">Nächste Woche: ${next ? '✓ ' + next + ' Angebote da' : '⏳ noch nicht veröffentlicht'}</div>` : ''}
      <div class="row" style="margin-top:8px;flex-wrap:wrap;gap:8px">${links.map(l => `<a class="btn" href="${l[1]}" target="_blank" rel="noopener">${esc(l[0])}</a>`).join('')}</div></div>`;
  };
  return `<h2>📰 Prospekte</h2><div class="mute" style="margin:0 4px 8px">Die Seiten öffnen sich in deinem Browser. Der Stand zeigt, was die App von dort schon geladen hat.</div>` +
    ['A', 'B', 'D'].map(t => `<h3 style="margin:14px 4px 6px"><i class="dot t${t}"></i> ${TIER_LABEL[t]}</h3>` + STORES.filter(s => s.tier === t && s.links.length).map(card).join('')).join('');
};
V.more = () => `<h2>🧾 Kassenbon</h2><div class="card row sp"><div class="grow">Bon fotografieren: Die App liest ihn, lernt, wo du was kaufst, und findet Spartipps.<div class="mute"><button class="lnk" onclick="bonList()">${S.bons.length} Bons gespeichert, ansehen</button> · 📷 Foto-Lesen: ${aiKey() ? '✓ eingerichtet' : 'noch nicht eingerichtet'} <button class="lnk" onclick="aiSheet()">${aiKey() ? 'ändern' : 'einrichten'}</button></div></div><button class="btn pri sm" onclick="go('bon')">📷 Bon</button></div>
  <h2>💾 Sichern &amp; umziehen</h2><div class="card"><div class="small">Speichert <b>alle deine Daten</b> in einer Datei: Liste, Favoriten, gespeicherte Bons, Einstellungen. Für ein neues Handy oder nach einer Neuinstallation: Datei dorthin schicken und dort <b>Importieren</b>. Bon-Fotos und dein Google-Schlüssel sind nicht dabei.</div><div class="row" style="margin-top:10px"><button class="btn pri" onclick="exp()">⬆ Exportieren</button><button class="btn" onclick="$('#imp').click()">⬇ Importieren</button><input id="imp" type="file" accept=".json,application/json" hidden onchange="imp(this)"></div><div class="mute small" style="margin-top:6px">${S.lastBackup ? 'Letzte Sicherung: ' + esc(fmtD(S.lastBackup)) : 'Noch keine Sicherung gemacht.'}</div></div>
  <h2>Datenstand</h2><div class="card"><div>${SRC.live ? `Letzte Suche: <b>${new Date(SRC.fetched).toLocaleString('de-DE')}</b><br><span class="mute">${SRC.offers.length} Angebote · ${esc(SRC.source)}</span>` : 'Noch keine Suche. Tippe oben auf „Angebote suchen".'}</div>
  <div class="mute" style="margin-top:8px">Wichtig: Die Angebote sind Händler-weit. Ob genau deine Filiale in Chorweiler mitmacht, wird nicht geprüft. <b>ALDI SÜD</b> kommt direkt von der ALDI-Webseite: ${SRC.aldi && SRC.aldi.ok ? '✓ ' + SRC.aldi.count + ' Produkte geladen' : '⚠ aktuell nicht geladen' + (SRC.aldi && SRC.aldi.error ? ' (' + esc(SRC.aldi.error) + ')' : '') + ', bitte Prospekt-Link bei Läden nutzen'}. Abgedeckt sind REWE, Netto, Lidl, METRO, ALDI und teilweise dm. Penny ist bewusst nicht dabei.</div></div>
  <h2>Läden</h2>${['A', 'B', 'D'].map(t => `<div class="card"><h3><i class="dot t${t}"></i>${TIER_LABEL[t]}</h3>${STORES.filter(s => s.tier === t).map(s => `<details style="margin-top:8px"><summary><b>${esc(s.short)}</b> <span class="mute">${t === 'A' ? '3 Min zu Fuß' : t === 'B' ? s.walk + ' Min zu Fuß' : s.car ? 'ca. ' + s.car + ' Min Auto' : ''}</span></summary><div class="mute" style="padding:6px 0">${esc(s.addr)}<br>Öffnungszeiten: ${esc(s.hours)}${s.transit ? '<br>' + esc(s.transit) : ''}${s.note ? '<br>' + esc(s.note) : ''}</div><div class="row">${s.links.map(l => `<a href="${l[1]}" target="_blank" rel="noopener">${esc(l[0])}</a>`).join(' · ')}</div></details>`).join('')}</div>`).join('')}
  <h2>Angebot selbst eintragen</h2><div class="card"><div class="fgrid">
  <label class="f">Produkt<input id="mn" list="pl2"><datalist id="pl2">${PRODUCTS.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist></label>
  <label class="f">Laden<select id="ms">${STORES.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
  <label class="f">Preis €<input id="mp" type="number" step="0.01"></label><label class="f">Normalpreis €<input id="mr" type="number" step="0.01"></label>
  <label class="f">Menge<input id="ma" type="number" step="any"></label><label class="f">Einheit<select id="mu"><option value="">–</option><option>g</option><option>kg</option><option>ml</option><option>l</option><option value="st">Stück</option></select></label>
  <label class="f">gültig bis<input id="mv" type="date"></label></div><div class="row" style="margin-top:10px"><button class="btn pri" onclick="addOffer()">Speichern</button><span class="mute">Merkt sich den Preis auch als dein Referenzpreis.</span></div>
  ${S.manual.map((o, i) => `<div class="item"><div class="grow">${esc(o.name)} · ${eur(o.price)} · ${esc(STORE(o.store).short)}</div><button class="ico" onclick="delOffer(${i})">✕</button></div>`).join('')}</div>
  <h2>Einstellungen</h2><div class="card"><div class="fgrid"><label class="f">Wert deiner Zeit (€/Std.)<input type="number" id="sh" value="${S.set.hourly}"></label><label class="f">Vorrat ab … % Ersparnis<input type="number" id="sp" value="${S.set.stockPct}"></label><label class="f">Max. Autofahrt (Min)<input type="number" id="sc" value="${S.set.carMax}"></label><label class="f">Spartipp ab … % günstiger<input type="number" id="st" value="${S.set.tipPct}"></label></div><button class="btn" style="margin-top:10px" onclick="saveSet()">Speichern</button></div>
  <h2>Zurücksetzen</h2><div class="card row"><button class="btn danger" onclick="if(confirm('Alle Daten dieser App löschen? Mach vorher eine Sicherung.')){localStorage.removeItem(LS);location.reload()}">Alles löschen</button></div>`;

/* ================= Aktionen ================= */
function toast(t) { feedbackText(esc(t)); } // alle Meldungen erscheinen in der festen Leiste über dem Menü
function addP(id) { const p = PROD(id); if (!p) return; let fav = null; if (!onList(id)) { S.list.push({ id: uid(), pid: id, name: p.name, qty: '', urgent: false, done: false }); fav = noteAdd(id); } save(); render(); toast(p.name + ' auf der Liste' + (fav ? ' · ⭐ neu in deinen Hauptprodukten' : '')); }
// Angebot ohne bekanntes Produkt (z. B. Whisky, Feinkost) direkt auf die Liste setzen: es wird als eigenes Produkt angelegt
function addOfferItem(id) {
  const o = OFFERS_ALL().find(x => String(x.id) === String(id)); if (!o) return;
  if (o.p) return addP(o.p.id);
  const name = o.name.length > 48 ? o.name.slice(0, 48).replace(/\s+\S*$/, '') : o.name;
  const c = mkCustom(name);
  if (!S.list.some(i => !i.done && i.pid === c.id)) { S.list.push({ id: uid(), pid: c.id, name, qty: '', urgent: false, done: false }); noteAdd(c.id); }
  CACHE = null; save(); render(); toast(name + ' steht auf deiner Liste');
}
// ---- Vorschläge beim Tippen (gegen Tippfehler) ----
const f1 = s => String(s).toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
const fold = s => f1(s).replace(/ae|oe|ue/g, m => m[0]); // „Kaese" und „Käse" sehen gleich aus
const niceTerm = t => t.replace(/Ae/g, 'Ä').replace(/Oe/g, 'Ö').replace(/Ue/g, 'Ü').replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü').replace(/-/g, ' ');
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) { const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); cur.push(v); if (v < rowMin) rowMin = v; }
    if (rowMin > max) return max + 1; prev = cur;
  }
  return prev[b.length];
}
let VOC = null, VOC_SIG = '';
function vocab() {
  const sig = [S.custom.length, SRC.offers.length, PRODUCTS.length, Object.keys(S.buys).length].join('|');
  if (VOC && sig === VOC_SIG) return VOC;
  const map = new Map();
  const add = (t, w, pid) => { t = String(t).trim(); if (t.length < 2 || t.length > 44) return; const f = fold(t), old = map.get(f); if (!old || old.w < w) map.set(f, { t, f, w, pid: pid || (old && old.pid) || null }); };
  PRODUCTS.forEach(p => {
    if (p.custom) { add(p.name, 1.25, p.id); return; }
    p.name.split(' / ').forEach(n => add(n, 1.1, p.id));
    (p.q || []).forEach(q => add(niceTerm(q), 0.95, p.id));
  });
  (window.DISCOVER_TERMS || []).forEach(t => add(niceTerm(t), 0.9));
  Object.keys(window.EXTRA_WORDS || {}).forEach(k => EXTRA_WORDS[k].split(',').forEach(w => add(w, 0.85)));
  Object.keys(S.buys).forEach(k => { if (k.startsWith('n:')) add(k.slice(2), 1.1); });
  SRC.offers.forEach(o => { if (o.name && o.name.length <= 40) add(o.name, 0.5); });
  VOC = [...map.values()]; VOC_SIG = sig; return VOC;
}
function suggestFor(query, max = 6) {
  const q = fold(query).trim(); if (q.length < 2) return [];
  const res = [];
  for (const v of vocab()) {
    let s = 0;
    if (v.f === q) s = 100;
    else if (v.f.startsWith(q)) s = 90 - (v.f.length - q.length) * 0.4;
    else {
      const words = v.f.split(/[\s\-\/]+/);
      if (words.some(w => w.startsWith(q))) s = 72;
      else if (q.length >= 3 && v.f.includes(q)) s = 50;
      else if (q.length >= 4) { // Tippfehler: ähnliche Wörter (1 Fehler, ab 7 Buchstaben 2)
        const mx = q.length >= 7 ? 2 : 1; let best = mx + 1;
        for (const w of words) { if (w.length >= 3) { const d = Math.min(lev(q, w, mx), lev(q, w.slice(0, q.length), mx)); if (d < best) best = d; } }
        const dd = lev(q, v.f.slice(0, q.length), mx); if (dd < best) best = dd;
        if (best <= mx) s = 46 - best * 7;
      }
    }
    if (s) res.push({ v, s: s * v.w });
  }
  return res.sort((a, b) => b.s - a.s || a.v.t.length - b.v.t.length).slice(0, max).map(x => ({ ...x.v, score: x.s }));
}
let SUG = [], GUESSES = {};
function currentSegment(text) { const parts = text.split(SPLIT); const last = parts[parts.length - 1]; return { parts, last, multi: parts.filter(s => s.trim()).length > 1 }; }
function suggest() {
  const el = $('#ni'), box = $('#sug'); if (!el || !box) return;
  const text = el.value;
  if (!text.trim() || /[,;]\s*$/.test(text) || /\s(und|punkt|komma)\s*$/i.test(text)) return hideSug();
  const { last } = currentSegment(text);
  const q = parseAdd(last.trim()).name;
  SUG = suggestFor(q).filter(s => fold(s.t) !== fold(q) || s.pid || true).slice(0, 5);
  if (!SUG.length) return hideSug();
  box.innerHTML = SUG.map((s, i) => { const p = s.pid ? PROD(s.pid) : null, pf = prefOf(p, s.t); const hint = p ? (pf ? 'bei ' + STORE(pf.id).short : 'bekanntes Produkt') : (EXTRA_SHOP[f1(s.t)] ? 'bei ' + STORE(EXTRA_SHOP[f1(s.t)].id).short : ''); return `<button class="sugrow" onpointerdown="event.preventDefault()" onclick="pickSug(${i})"><span class="em">${iconFor(p, s.t)}</span><span class="grow"><b>${esc(s.t)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span><span class="plus">+</span></button>`; }).join('');
  box.hidden = false; $('#dock').classList.add('sugon');
}
function hideSug() { const b = $('#sug'); if (b) { b.hidden = true; b.innerHTML = ''; } const d = $('#dock'); if (d) d.classList.remove('sugon'); SUG = []; }
function pickSug(i) {
  const s = SUG[i]; if (!s) return;
  const el = $('#ni'), text = el.value, { last, multi } = currentSegment(text);
  const qty = parseAdd(last.trim()).qty, item = (qty ? qty + ' ' : '') + s.t;
  if (!multi) { addMany(item); el.value = ''; }
  else { const lead = last.match(/^\s*/)[0]; el.value = text.slice(0, text.lastIndexOf(last)) + (lead || ' ') + item + ', '; }
  hideSug(); el.focus();
}
// Unbekanntes Wort mit ähnlichem bekannten Wort: „Meintest du …?"
function guessFor(name) {
  const q = fold(name); if (q.length < 4) return null;
  const list = suggestFor(name, 3);
  const top = list.find(s => s.score >= 28 && s.score < 90 && fold(s.t) !== q);
  if (!top || list.some(s => fold(s.t) === q)) return null;
  return top.t;
}
// Tippfehler-Produkte, die nirgends mehr gebraucht werden, wieder entfernen
function dropCustomIfUnused(pid) {
  if (!pid || !S.custom.some(c => c.id === pid)) return;
  const used = S.list.some(i => i.pid === pid) || S.later.some(l => l.pid === pid) || S.watch.includes(pid) || S.buys[pid] > 0;
  if (used) return;
  S.custom = S.custom.filter(c => c.id !== pid); const i = PRODUCTS.findIndex(p => p.id === pid); if (i >= 0) PRODUCTS.splice(i, 1); delete RXC[pid]; CACHE = null; VOC = null;
}
function fixItem(id) {
  const it = byId(id), label = GUESSES[id]; if (!it || !label) return;
  const old = it.pid, a = parseAdd(label); it.name = a.name; it.pid = a.pid || mkCustom(a.name).id;
  dropCustomIfUnused(old);
  save(); render(); toast('✓ Korrigiert zu „' + a.name + '"');
}
// Wo kaufst du das normalerweise? (eigene Wahl pro Produkt, merkt sich die App)
function setPref(pid, store) {
  const p = PROD(pid); if (!p) return;
  if (store) S.prefs[pid] = store; else delete S.prefs[pid];
  save(); render(); toast(store ? p.name + ': ab jetzt bei ' + STORE(store).short : p.name + ': kein fester Laden');
}
// ---- Eingabeleiste (immer sichtbar) und Rückmeldung ----
let FB_T;
function feedbackText(html, warn) {
  const f = $('#fb'); if (!f) return;
  f.innerHTML = html; f.className = 'fb' + (warn ? ' warn' : ''); f.hidden = false;
  clearTimeout(FB_T); FB_T = setTimeout(() => { if (!MIC) f.hidden = true; }, warn ? 10000 : 7000);
}
function jumpToItem(id) { go('list'); setTimeout(() => { const e = document.getElementById('it-' + id); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80); }
function showFeedback(added, dup, favNew = []) {
  if (!added.length && !dup.length) return;
  const shown = added.slice(0, 3), restN = added.length - shown.length;
  const items = shown.map(x => `${x.qty ? esc(qtyLabel(x.qty)) + ' ' : ''}<b>${esc(x.name)}</b>${x.known ? '' : ' <i>(neu)</i>'}`).join(' · ') + (restN > 0 ? ` · +${restN} weitere` : '');
  const first = added[0], gx = added.find(x => x.guess);
  feedbackText((added.length ? `✓ ${added.length === 1 ? 'Eingetragen' : added.length + ' Produkte eingetragen'}: ${items}` : '') + (dup.length ? `${added.length ? ' · ' : ''}schon auf der Liste: ${dup.map(esc).join(', ')}` : '') + (first ? ` <button class="lnk" onclick="jumpToItem('${first.id}')">anzeigen</button>` : '') + (favNew.length ? `<br>⭐ Neu in deinen Hauptprodukten: <b>${favNew.map(esc).join(', ')}</b>` : '') + (gx ? `<br>Meintest du <b>${esc(gx.guess)}</b> statt „${esc(gx.name)}"? <button class="lnk" onclick="fixItem('${gx.id}')">Ja, korrigieren</button>` : ''), false);
}
const SPLIT = /(?<!\d),|,(?!\d)|;|\n|\.(?:\s+|$)|\s+(?:und|sowie|plus|punkt|komma|weiter|nächstes)\s+|\s+(?:punkt|komma)$/i;
function addMany(txt) {
  const parts = txt.split(SPLIT).map(s => s.trim()).filter(Boolean);
  const added = [], dup = [], favNew = [];
  parts.forEach(v => {
    const a = parseAdd(v);
    const g0 = !a.pid && a.name.length >= 3 ? guessFor(a.name) : null; // Meintest-du-Prüfung bevor das Wort als neues Produkt angelegt wird
    if (!a.pid && a.name.length >= 3) a.pid = mkCustom(a.name).id; // frei eingetippte Artikel bekommen ein eigenes Produkt, damit Angebote gefunden werden
    if (S.list.some(i => !i.done && i.name.toLowerCase() === a.name.toLowerCase())) { dup.push(a.name); return; }
    const id = uid(); S.list.push({ id, pid: a.pid, name: a.name, qty: a.qty, urgent: false, done: false });
    const p = a.pid ? PROD(a.pid) : null;
    const known = !!(p && !p.custom), g = known ? null : g0; if (g) GUESSES[id] = g;
    added.push({ id, name: a.name, qty: a.qty, known, guess: g });
    const fv = noteAdd(a.pid); if (fv) favNew.push(fv);
  });
  UI.flash = new Set(added.map(x => x.id)); save(); hideSug(); render(); showFeedback(added, dup, favNew); return added.length;
}
function addItem() { const el = $('#ni'); if (!el || !el.value.trim()) return; addMany(el.value); el.value = ''; el.focus(); }
let MIC = false, REC = null, MIC_STOP = false, MIC_IDLE = 0;
function micUi() {
  const b = $('#micb'); if (b) { b.textContent = MIC ? '⏹' : '🎤'; b.classList.toggle('danger', MIC); }
  const el = $('#ni'); if (el) el.placeholder = MIC ? 'Ich höre zu … „Punkt" trennt Produkte' : 'Was brauchst du? z. B. 2 Milch';
}
function mic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return feedbackText('Spracheingabe geht hier nicht. Nutze das Mikrofon auf deiner Handy-Tastatur.', true);
  if (MIC) { MIC_STOP = true; try { REC.stop(); } catch (e) { } return; }
  MIC_STOP = false; MIC_IDLE = 0; startRec(SR);
}
function startRec(SR) {
  REC = new SR(); REC.lang = 'de-DE'; REC.interimResults = true; REC.continuous = true;
  REC.onresult = e => {
    MIC_IDLE = 0; let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) addMany(r[0].transcript); else interim += r[0].transcript; }
    const el = $('#ni'); if (el) el.value = interim; // du siehst live, was erkannt wird
  };
  REC.onerror = e => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    MIC_STOP = true;
    feedbackText(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Mikrofon nicht erlaubt. Prüfe: Einstellungen → Apps → Google bzw. Chrome → Berechtigungen → Mikrofon.' : 'Spracheingabe: ' + e.error, true);
  };
  REC.onend = () => {
    if (!MIC_STOP && ++MIC_IDLE <= 6) { try { startRec(SR); return; } catch (e) { } } // Android beendet die Erkennung bei Pausen: neu starten, bis du auf Stopp tippst
    MIC = false; micUi();
  };
  try { REC.start(); MIC = true; micUi(); feedbackText('🎤 Ich höre zu … sag deine Produkte, „Punkt" trennt sie. Zum Beenden auf ⏹ tippen.'); } catch (e) { feedbackText('Spracheingabe konnte nicht starten.', true); }
}
// ---- Für später merken: „nächste Woche ist es günstiger" ----
const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const nextMonday = () => { const d = new Date(TODAY); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return isoDay(d); };
// Gibt es nächste Woche ein deutlich besseres Angebot (mindestens 10 % günstiger) oder überhaupt erst dann eines?
function nextHint(info) {
  const nb = info && info.nextBest; if (!nb) return null;
  const b = info.nearBest || info.best;
  if (!b) return { o: nb, why: 'Nächste Woche im Angebot' };
  const cheaper = (nb.up && b.up && nb.up.base === b.up.base) ? nb.up.v < b.up.v * 0.9 : nb.price < b.price * 0.9;
  return cheaper ? { o: nb, why: 'Nächste Woche günstiger' } : null;
}
const nextLine = (nh, extra = '') => nh ? `<div class="small nxt">📅 ${esc(nh.why)}: <b>${eur(nh.o.price)}</b> bei ${esc(nh.o.store.short)} (ab ${fmtD(nh.o.valid[0])}) ${extra}</div>` : '';
const NEXT_STORES = ['netto', 'rewe', 'lidl', 'aldi']; // Läden, die überhaupt Prospektdaten liefern
function nextStatus() { const all = OFFERS_ALL(); return NEXT_STORES.map(id => ({ s: STORE(id), n: all.filter(o => o.store.id === id && o.state === 'next').length })); }
const nextBadge = () => { const st = nextStatus(); return st.filter(x => x.n > 0).length + '/' + st.length; };
function nextStatusLine() { const st = nextStatus(), ok = st.filter(x => x.n > 0), wait = st.filter(x => !x.n); return `<div class="nstat">📅 Nächste Woche: ${ok.length ? '✓ ' + ok.map(x => esc(x.s.short)).join(', ') + ' schon da' : 'noch kein Laden hat sie veröffentlicht'}${wait.length ? ' · ⏳ ' + wait.map(x => esc(x.s.short)).join(', ') + ' noch nicht' : ''}<span class="mute"> · dm liefert keine Prospektpreise</span></div>`; }
function addLater(p, from, qty, name) {
  if (S.later.some(x => x.pid === p.id)) return false;
  S.later.push({ id: uid(), pid: p.id, name: (name || p.name).slice(0, 80), qty: qty || '', from: from || nextMonday() });
  return true;
}
function rememberItem(id) { // der Artikel bleibt auf der Liste (z. B. diese Woche wenig kaufen) und wird zusätzlich für die günstigere Woche gemerkt
  const it = byId(id); if (!it) return;
  if (!it.pid) it.pid = mkCustom(it.name).id;
  const p = PROD(it.pid); if (!p) return;
  const nb = productInfo(p).nextBest, from = nb ? nb.valid[0] : null;
  const q = prompt('Wie viel von „' + it.name + '" willst du nächste Woche kaufen? (z. B. 4 oder 2 kg. Leer lassen = Menge wie jetzt)', '');
  if (q === null) return;
  const added = addLater(p, from, q.trim() || it.qty, it.name);
  save(); render();
  toast(added ? '📌 ' + it.name + ' bleibt auf der Liste und ist für ' + fmtD(from || nextMonday()) + ' gemerkt' : it.name + ' ist schon gemerkt');
}
function rememberOffer(oid) {
  const o = OFFERS_ALL().find(x => String(x.id) === String(oid)); if (!o) return;
  const nm = o.name.length > 48 ? o.name.slice(0, 48).replace(/\s+\S*$/, '') : o.name;
  const p = o.p || PROD(mkCustom(nm).id);
  const nb = productInfo(p).nextBest;
  const from = o.state === 'next' ? o.valid[0] : (nb ? nb.valid[0] : null);
  const added = addLater(p, from, '', o.p ? p.name : nm);
  save(); render(); toast(added ? `📌 ${p.name} gemerkt für ${fmtD(from || nextMonday())}` : `${p.name} ist schon gemerkt`);
}
function laterToList(id) {
  const l = S.later.find(x => x.id === id); if (!l) return;
  S.later = S.later.filter(x => x.id !== id);
  const ex = S.list.find(i => !i.done && i.pid === l.pid);
  if (ex) { if (l.qty) ex.qty = l.qty; } else { S.list.push({ id: uid(), pid: l.pid, name: l.name, qty: l.qty, urgent: false, done: false }); noteAdd(l.pid); }
  save(); render(); toast(ex ? `${l.name}: Menge auf der Liste angepasst` : `${l.name} steht auf deiner Liste`);
}
const laterDel = id => { S.later = S.later.filter(x => x.id !== id); save(); render(); };
const laterDue = () => S.later.filter(x => d0(x.from) <= TODAY);
function laterBlock() {
  if (!S.later.length) return '';
  const due = laterDue(), wait = S.later.filter(x => !due.includes(x));
  const line = (x, isDue) => {
    const p = PROD(x.pid), info = p ? productInfo(p) : null, b = info && (info.nearBest || info.best);
    return `<div class="item">${thumb(b && b.img, iconFor(p, x.name), 'sm')}<div class="grow"><div class="nm" style="cursor:default">${esc(x.name)}${x.qty ? ` <span class="mute">${esc(qtyLabel(x.qty))}</span>` : ''}</div><div class="mute">${isDue ? (b ? `jetzt ${eur(b.price)} bei ${esc(b.store.short)}` : 'jetzt dran') : 'ab ' + fmtD(x.from)}</div></div>${isDue ? `<button class="btn sm pri" onclick="laterToList('${x.id}')">+ Liste</button>` : `<button class="btn sm" onclick="laterToList('${x.id}')">Doch jetzt</button>`}<button class="ico" onclick="laterDel('${x.id}')" title="Entfernen">✕</button></div>`;
  };
  return (due.length ? `<h2>📌 Jetzt dran (von dir gemerkt)</h2><div class="card tight">${due.map(x => line(x, true)).join('')}</div>` : '') +
    (wait.length ? `<details class="card tight later"><summary>📌 Für später gemerkt (${wait.length})</summary>${wait.map(x => line(x, false)).join('')}</details>` : '');
}

// ---- ⓘ Preisvergleich: alle Läden für ein Produkt, diese und nächste Woche ----
function closeSheet() { const s = $('#sheet'); if (s) s.hidden = true; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
function compare(pid) {
  const p = PROD(pid); if (!p) return;
  const info = productInfo(p);
  const mk = (list, label, nextMode) => {
    const shown = STORES.filter(s => s.tier !== 'D' || list.some(o => o.store.id === s.id));
    const rows = shown.map(s => ({ s, o: list.find(o => o.store.id === s.id) }));
    let best = null;
    rows.filter(r => r.o).forEach(r => { if (!best || ((r.o.up && best.o.up && r.o.up.base === best.o.up.base) ? r.o.up.v < best.o.up.v : r.o.price < best.o.price)) best = r; });
    const cell = r => r.o
      ? `<td><b>${eur(r.o.price)}</b>${r.o.regular ? ` <s class="mute">${eur(r.o.regular)}</s>` : ''}<div class="mute clamp">${esc(r.o.name.slice(0, 40))}</div></td><td>${r.o.up ? eur(r.o.up.v) + '/' + unitLbl(r.o.up.base) : ''}${r.o.pct != null && !r.o.dubious ? `<div><span class="pct">−${Math.round(r.o.pct * 100)} %</span></div>` : ''}</td>`
            : `<td colspan="2" class="mute">${nextMode && NEXT_STORES.includes(r.s.id) && !OFFERS_ALL().some(o => o.store.id === r.s.id && o.state === 'next') ? '⏳ Prospekt für nächste Woche noch nicht veröffentlicht' : 'kein Angebot bekannt' + (r.s.id === 'dm' ? ' (hat selten Prospektpreise)' : '')}</td>`;
    return `<h4>${label}</h4><table class="cmp">${rows.map(r => `<tr class="${best && r === best ? 'win' : ''}"><td><i class="dot t${r.s.tier}"></i>${esc(r.s.short)}${best && r === best ? ' ✓' : ''}</td>${cell(r)}</tr>`).join('')}</table>${best ? `<div class="small">✓ Am günstigsten: <b>${esc(best.s.name)}</b></div>` : ''}`;
  };
  const nh = nextHint(info);
  $('#sheetbox').innerHTML = `<div class="row sp"><h3>${iconFor(p)} ${esc(p.name)}</h3><button class="ico" onclick="closeSheet()" aria-label="Schließen">✕</button></div>
    ${p.pref ? `<div class="mute">Dein Standardladen: <b>${esc(STORE(p.pref).name)}</b></div>` : ''}
    ${nextLine(nh)}${mk(info.now, 'Diese Woche')}${info.next.length ? mk(info.next, 'Nächste Woche', true) : nextStatusLine()}
    <div class="mute" style="margin-top:10px">Preise aus Händler-Prospekten, ohne Gewähr. Regalpreise vor Ort können abweichen.</div>
    <div class="row" style="margin-top:10px">${onList(p.id) ? '' : `<button class="btn pri sm" onclick="addP('${p.id}');closeSheet()">+ Liste</button>`}<button class="btn sm" onclick="closeSheet()">Schließen</button></div>`;
  $('#sheet').hidden = false;
}
function topSummary() {
  const offs = OFFERS_ALL().filter(o => o.state === 'now' && o.price > 0);
  if (!offs.length) return tipsBlock();
  const dedupe = a => { const s = new Set(); return a.filter(o => { const k = o.store.id + (o.p ? o.p.id : o.name); if (s.has(k)) return false; s.add(k); return true; }); };
  const score = o => (o.pct || 0) * (o.regularIsUvp ? 0.6 : 1);
  const byPct = (a, b) => score(b) - score(a);
  const food = o => o.p || o.food;
  const near = dedupe(offs.filter(o => o.store.tier === 'A' && food(o) && !o.dubious && o.pct != null && o.pct >= 0.15).sort(byPct)).slice(0, 8);
  const habit = dedupe(offs.filter(o => o.p && (freq(o.p) > 0 || watched(o.p.id)) && !onList(o.p.id) && o.store.tier !== 'D' && (o.store.tier === 'A' || o.store.tier === 'B' || (o.store.car || 99) <= S.set.carMax)).sort((a, b) => (isNear(b) - isNear(a)) || byPct(a, b))).slice(0, 8);
  const top = dedupe(offs.filter(o => o.store.tier !== 'D' && food(o) && !o.dubious && o.pct != null && o.pct >= 0.3 && !near.includes(o)).sort(byPct)).slice(0, 8);
  const sec = (title, sub, a) => a.length ? `<h2>${title}</h2><div class="mute" style="margin:-4px 4px 8px">${sub}</div><div class="hs">${a.map(o => offerCard(o)).join('')}</div>` : '';
  return tipsBlock() + sec('🔥 Top-Angebote im City-Center', 'Netto, REWE, dm: wenige Minuten zu Fuß', near) + sec('🔁 Das kaufst du öfter, jetzt im Angebot', 'Beobachtete und schon gekaufte Produkte, die nicht auf deiner Liste stehen. City-Center zuerst', habit) + sec('⭐ Allgemein starke Angebote', 'Ab 30 % Ersparnis, auch bei Lidl (Spaziergang)', top);
}
const byId = id => S.list.find(i => i.id === id);
const tick = id => { const i = byId(id); if (!i) return; i.done = !i.done; save(); render(); };
const del = id => { S.list = S.list.filter(i => i.id !== id); save(); render(); };
const toggleHeavy = id => { const i = byId(id); if (!i) return; i.heavy = !itemHeavy(i, i.pid ? PROD(i.pid) : null); save(); render(); };
const urgent = id => { const i = byId(id); if (!i) return; i.urgent = !i.urgent; save(); render(); };
const toggleOpen = id => { UI.open.has(id) ? UI.open.delete(id) : UI.open.add(id); render(); };
function mkCustom(name) { let c = S.custom.find(x => x.name.toLowerCase() === name.toLowerCase()); if (!c) { c = { id: 'c_' + uid(), name }; S.custom.push(c); regCustom(c); CACHE = null; } return c; }
function eye(id) { const i = byId(id); if (!i) return; if (!i.pid) { const c = mkCustom(i.name); i.pid = c.id; if (!watched(c.id)) S.watch.push(c.id); toast('„' + i.name + '" wird jetzt beobachtet. Bei der nächsten Suche werden Angebote gesucht.'); } else watchP(i.pid, true); save(); render(); }
function watchP(id, noRender) { S.watch = watched(id) ? S.watch.filter(x => x !== id) : [...S.watch, id]; save(); if (!noRender) { render(); } }
function addCustom() { const v = $('#wn').value.trim(); if (!v) return; const c = mkCustom(v); if (!watched(c.id)) S.watch.push(c.id); save(); render(); toast('„' + v + '" wird beobachtet. Tippe oben auf „Angebote suchen".'); }
function watchKey(i) { const k = SUGG[i][0]; if (k.startsWith('n:')) { const c = mkCustom(k.slice(2)); if (!watched(c.id)) S.watch.push(c.id); } else if (!watched(k)) S.watch.push(k); S.buys[k] = 0; save(); render(); }
function finish() { S.list.filter(i => i.done).forEach(i => { const k = i.pid || 'n:' + i.name.toLowerCase(); S.buys[k] = (S.buys[k] || 0) + 1; if (i.pid) noteRec(i.pid, isoDay(TODAY)); }); S.list = S.list.filter(i => !i.done);
  const auto = [];
  Object.entries(S.buys).forEach(([k, n]) => { // was du oft kaufst, wird automatisch dauerhaft beobachtet
    if (n < 3) return; let id = k;
    if (k.startsWith('n:')) { id = mkCustom(k.slice(2)).id; S.buys[id] = n; delete S.buys[k]; }
    if (!watched(id)) { S.watch.push(id); const p = PROD(id); if (p) auto.push(p.name); }
  });
  save(); render(); toast(auto.length ? 'Einkauf gespeichert. Neu im Beobachten: ' + auto.join(', ') : 'Einkauf gespeichert. Die App lernt daraus.'); }
function addOffer() {
  const name = $('#mn').value.trim(), price = parseFloat($('#mp').value); if (!name || !(price > 0)) return alert('Produkt und Preis nötig.');
  const o = { id: 'm' + Date.now(), store: $('#ms').value, name, price, regular: parseFloat($('#mr').value) || null, amount: parseFloat($('#ma').value) || null, unit: $('#mu').value || null, valid: [new Date().toISOString().slice(0, 10), $('#mv').value || '2999-01-01'], manual: true };
  const e = enrich(o); if (e.up && e.p) S.hist.push({ pid: e.p.id, up: +e.up.v.toFixed(3), date: o.valid[0], store: o.store });
  S.manual.push(o); CACHE = null; save(); render(); toast('Angebot gespeichert');
}
const delOffer = i => { S.manual.splice(i, 1); CACHE = null; save(); render(); };
function saveSet() { S.set = { ...S.set, hourly: +$('#sh').value || 15, stockPct: +$('#sp').value || 20, carMax: +$('#sc').value || 25, tipPct: +$('#st').value || 20 }; save(); render(); toast('Gespeichert'); }
async function exp() { // alle Daten in eine Datei: teilen (z. B. an ein anderes Handy) oder herunterladen
  const name = 'einkauf-daten-' + isoDay(TODAY) + '.json', json = JSON.stringify({ app: 'intelligente-einkaufsliste', exportiert: new Date().toISOString(), daten: S }, null, 1);
  const file = new File([json], name, { type: 'application/json' });
  const done = () => { S.lastBackup = isoDay(TODAY); save(); render(); feedbackText('✓ Daten exportiert: ' + esc(name)); };
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Einkaufsliste Sicherung' }); return done(); } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); done();
}
function imp(el) {
  const f = el.files[0]; el.value = ''; if (!f) return;
  f.text().then(t => {
    let j; try { j = JSON.parse(t); } catch (e) { return alert('Das ist keine gültige Sicherungsdatei.'); }
    const n = sanitize(j && j.app === 'intelligente-einkaufsliste' && j.daten ? j.daten : j);
    if (!n.list.length && !n.bons.length && !Object.keys(n.adds).length && !n.custom.length) return alert('In dieser Datei habe ich keine Einkaufsdaten gefunden.');
    if (!confirm(`Diese Daten übernehmen?\n\n${n.list.length} Artikel auf der Liste\n${n.bons.length} gespeicherte Bons\n${n.watch.length} beobachtete Produkte\n\nDas ersetzt die Daten auf diesem Gerät.`)) return;
    S = n; S.custom.forEach(regCustom); repairRefs(); CACHE = null; save(); render(); feedbackText('✓ Daten importiert.');
  }).catch(() => alert('Die Datei konnte nicht gelesen werden.'));
}
const setOff = k => { UI.offers = k; UI.more = false; render(); };
const setWege = k => { UI.wege = k; render(); };

/* ================= Recherche-Button ================= */
let R = { running: false };
let MODE = 'unknown'; // 'server' = eigener Server (start.bat) kann selbst suchen · 'static' = Hosting: Angebote kommen automatisch aus offers.json
fetch('/api/status').then(r => { MODE = r.ok ? 'server' : 'static'; rstat(); }).catch(() => { MODE = 'static'; rstat(); });
function rstat() {
  const b = $('#rbtn'), s = $('#rstat'); if (!b) return;
  b.disabled = R.running; b.textContent = R.running ? 'Suche läuft…' : MODE === 'static' ? 'Neueste Angebote' : 'Angebote suchen';
  const when = SRC.fetched ? new Date(SRC.fetched).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  if (R.running) s.innerHTML = `Suche: ${esc(R.current || '…')} (${R.done}/${R.total}) · ${R.found} Angebote<div class="bar"><i style="width:${R.total ? Math.round(R.done / R.total * 100) : 0}%"></i></div>`;
  else if (R.error) s.textContent = '⚠ ' + R.error;
  else if (SRC.live) s.textContent = `Stand: ${when} · ${SRC.offers.length} Angebote${SRC.offline ? ' · gespeichert (offline)' : MODE === 'static' ? ' · wird täglich automatisch aktualisiert' : ''}`;
  else s.textContent = location.protocol === 'file:' ? 'Datei-Modus: für die Suche bitte start.bat öffnen.' : 'Noch keine Angebote geladen.';
}
async function startResearch() {
  if (location.protocol === 'file:') return alert('Für die Angebotssuche bitte die App über „start.bat" starten (Doppelklick). Dann öffnet sie sich unter http://localhost:3456.');
  if (MODE === 'static') { // Hosting ohne eigenen Server: neueste vorbereitete Angebote holen
    R = { running: true, done: 0, total: 1, found: 0, current: 'Angebote laden' }; rstat();
    await loadOffers(); R = { running: false, error: SRC.live ? null : 'Keine Angebote gefunden. Bist du online?' }; render();
    if (SRC.live) { toast(SRC.offline ? 'Offline: zeige die zuletzt gespeicherten Angebote' : 'Neueste Angebote geladen: ' + SRC.offers.length); go('route'); }
    return;
  }
  const body = { products: PRODUCTS.map(p => ({ id: p.id, kw: p.kw, q: p.q || [] })), exclude: EXCLUDE_RX.source, noise: NOISE_RX.source, discover: true, discoverTerms: DISCOVER_TERMS };
  R = { running: true, done: 0, total: 1, found: 0, current: 'Start' }; rstat();
  try {
    await fetch('/api/research', { method: 'POST', body: JSON.stringify(body) });
    for (; ;) { await new Promise(r => setTimeout(r, 800)); const st = await (await fetch('/api/status', { cache: 'no-store' })).json(); R = st; rstat(); if (!st.running) break; }
  } catch (e) { R = { running: false, error: 'Server nicht erreichbar. Läuft start.bat noch?' }; rstat(); return; }
  await loadOffers(); const err = R.error; R = { running: false, error: err }; render();
  if (!err) { toast(SRC.offers.length + ' Angebote gefunden. Hier ist deine Route.'); go('route'); }
}

/* ================= Shell ================= */
const TABS = [['list', '🛒', 'Liste'], ['route', '🧭', 'Route'], ['offers', '🏷️', 'Angebote'], ['watch', '👁', 'Beobachten'], ['pro', '📰', 'Prospekte'], ['more', '⚙️', 'Mehr']];
let cur = (location.hash || '#list').slice(1);
function render() {
  TIPS = null;
  if (!V[cur]) cur = 'list';
  const sy = scrollY, ae = document.activeElement && document.activeElement.id;
  const nOpen = S.list.filter(i => !i.done).length;
  $('#tabs').innerHTML = TABS.map(([k, i, l]) => `<button class="${k === cur ? 'on' : ''}" onclick="go('${k}')"><span>${i}${k === 'list' && nOpen ? `<b class="bdg">${nOpen}</b>` : ''}</span>${l}</button>`).join('');
  const pl = $('#pl'); if (pl) pl.innerHTML = PRODUCTS.filter(p => !p.custom).map(p => `<option value="${esc(p.name)}">`).join('');
  $('#view').innerHTML = V[cur](); UI.flash = null;
  $('#sub').textContent = TODAY.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  rstat(); bqStrip(); scrollTo(0, sy);
}
function go(k) { cur = k; location.hash = k; render(); scrollTo(0, 0); }
repairRefs();
loadOffers().then(render); render(); bonQueueInit();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { }); // Offline-Speicher
  navigator.serviceWorker.addEventListener('message', e => { if (e.data === 'update') feedbackText('🔄 Neue Version der App geladen. <button class="lnk" onclick="location.reload()">Jetzt neu laden</button>'); });
}

// Beim Zurückkehren in die App (z. B. am nächsten Tag oder im Laden): Datum aktualisieren, Angebote neu laden, wenn der Stand älter als 3 Stunden ist
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  bqRun();
  const n = d0(new Date()); if (+n !== +TODAY) { TODAY = n; CACHE = null; }
  if (MODE !== 'server' && Date.now() - LAST_LOAD > 3 * 3600e3) loadOffers().then(render); else render();
});
