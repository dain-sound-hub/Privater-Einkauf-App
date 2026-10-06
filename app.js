'use strict';
/* ================= State ================= */
const LS = 'einkauf.v2';
const DEF = { hideHelp: false, list: [], watch: ['paprika', 'butter', 'butterschmalz', 'rinderhack', 'farbfang', 'kuechenrolle'], custom: [], manual: [], hist: [], buys: {}, set: { hourly: 15, stockPct: 20, carMax: 25, lidl: 'auto' } };
let S;
try {
  const raw = localStorage.getItem(LS), old = localStorage.getItem('einkauf.v1');
  S = Object.assign({}, DEF, raw ? JSON.parse(raw) : {});
  if (!raw && old) { const o = JSON.parse(old); S.list = (o.list || []).map(x => ({ ...x, id: x.id || Math.random().toString(36).slice(2) })); S.watch = o.favs || S.watch; S.manual = o.manual || []; S.hist = o.hist || []; }
  S.set = Object.assign({}, DEF.set, S.set);
} catch (e) { S = JSON.parse(JSON.stringify(DEF)); }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { } };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => n == null || isNaN(n) ? '–' : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const d0 = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const TODAY = d0(new Date());
const fmtD = s => new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
const uid = () => Math.random().toString(36).slice(2, 10);
const translit = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-');
const STORE = id => STORES.find(s => s.id === id) || { id, name: id, short: id, tier: 'D', car: null };
const PROD = id => PRODUCTS.find(p => p.id === id);
const RXC = {}; const rx = p => RXC[p.id] || (RXC[p.id] = new RegExp(p.kw, 'i'));
const regCustom = c => { if (!PRODUCTS.some(p => p.id === c.id)) PRODUCTS.push({ id: c.id, cat: 'Eigene Produkte', name: c.name, kw: '(?<![a-zäöüß])' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (c.name.length <= 3 ? '(?![a-zäöüß])' : ''), base: null, custom: 1, q: [translit(c.name)] }); };
S.custom.forEach(regCustom);
const ICON = { 'Haushalt & Wäsche': '🧺', 'Milchprodukte': '🥛', 'Obst & Gemüse': '🥬', 'Öle & Grundnahrung': '🌿', 'Fleisch': '🥩', 'Getränke': '🥤', 'Eigene Produkte': '⭐' };
const PICON = { wm_dunkel: '🧺', wm_bunt: '🧺', wm_weiss: '🧺', wm_uni: '🧺', weichspueler: '🌸', farbfang: '🎨', kuechenrolle: '🧻', milch: '🥛', ayran: '🥛', buttermilch: '🥛', kefir: '🥛', butter: '🍞', butterschmalz: '🍳', tomaten: '🍅', gurken: '🥒', paprika: '🌶️', melone: '🍈', trauben: '🍇', heidelbeeren: '🍇', erdbeeren: '🍓', apfel: '🍎', ananas: '🍍', kiwi: '🥝', zwiebeln: '🧅', leinoel: '🌿', salatoel: '🌿', basmati: '🍚', buchweizen: '🌾', sonnenblumenkerne: '🌻', kuerbiskerne: '🎃', pinienkerne: '🌰', rinderhack: '🥩', gemhack: '🥩', haehnchen: '🍗', pute: '🍗', rind: '🥩', wasser: '💧', bitburger: '🍺' };
const GUESS = [[/kaffee|espresso|krönung/i, '☕'], [/pasta|nudel|spaghetti|barilla/i, '🍝'], [/lachs|fisch|thunfisch|garnele/i, '🐟'], [/käse|kaese|gouda|mozzarella/i, '🧀'], [/joghurt|quark|skyr/i, '🥣'], [/ei(er)?\b|eier/i, '🥚'], [/brot|toast|brötchen/i, '🍞'], [/schoko|keks|riegel|gummi|süß/i, '🍫'], [/saft|limo|cola|fanta|sprite|schorle/i, '🧃'], [/bier|pils/i, '🍺'], [/wein|sekt/i, '🍷'], [/waschmittel|persil|perwoll|weichspüler/i, '🧺'], [/reiniger|spül|geschirr/i, '🧽'], [/nuss|nüsse|kerne|mandel/i, '🥜'], [/honig/i, '🍯'], [/avocado/i, '🥑'], [/brokkoli|spinat|salat|gemüse|karotte|möhre/i, '🥦'], [/obst|beere|banane|orange|zitrone|mango/i, '🍊'], [/reis/i, '🍚'], [/öl\b|olivenöl/i, '🌿'], [/fleisch|steak|filet|braten|hack/i, '🥩'], [/pizza/i, '🍕'], [/eis\b|eiscreme/i, '🍨'], [/tee\b/i, '🍵']];
const iconFor = (p, name) => (p && (PICON[p.id] || (p.custom ? (GUESS.find(g => g[0].test(p.name)) || [])[1] : null))) || (GUESS.find(g => g[0].test(name || (p && p.name) || '')) || [])[1] || (p && ICON[p.cat]) || '🏷️';
// Produktfoto (kaufDA) mit Emoji als Rückfall, falls das Bild nicht lädt
const thumb = (img, emoji, cls = '') => `<div class="thumb ${cls}"><span class="em">${emoji}</span>${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>`;

/* ================= Angebote laden ================= */
let SRC = { fetched: null, offers: [], source: null, live: false, offline: false };
const OFFERS_KEY = 'einkauf.offers';
// Angebote: erst die aktuelle offers.json (Server oder Hosting), sonst die zuletzt gespeicherte Kopie (Offline im Laden), sonst Beispieldaten
async function loadOffers() {
  let j = null, offline = false;
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
function enrich(o) {
  const text = o.name + ' ' + (o.cats || ''), full = text + ' ' + (o.desc || '');
  let p = o.pidLocked && o.pid ? PROD(o.pid) : null;
  if (!p && !(window.NOISE_RX && NOISE_RX.test(text))) { let len = 0; for (const q of PRODUCTS) { const m = rx(q).exec(text); if (m && m[0].length > len) { p = q; len = m[0].length; } } }
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
  const offs = OFFERS_ALL().filter(o => o.p && o.p.id === p.id);
  const byBulk = (x, y) => (x.bulk - y.bulk) || rank(x, y);
  const now = offs.filter(o => o.state === 'now').sort(byBulk), next = offs.filter(o => o.state === 'next').sort(rank);
  const nearBest = now.find(isNear) || null;
  // Großmarkt (Tier D) ist nur eine Option unter „Wege" und nie der Standard-Vorschlag der Liste
  return { p, now, next, nearBest, best: now.find(o => o.store.tier !== 'D') || null, nextBest: next.find(o => o.store.tier !== 'D') || null };
}
function decision(info, item) {
  const { p, nearBest, best, nextBest } = info, b = nearBest || best;
  if (!b) return { tag: 'Kein Angebot', cls: '', why: 'Aktuell kein bekanntes Angebot. Normal in der Nah-Runde kaufen.' };
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
  const add = p && !onList(p.id) && !opt.noAdd ? `<button class="btn sm" onclick="addP('${p.id}')">+ Liste</button>` : '';
  const badge = o.pct != null ? `<span class="pct ${o.dubious ? 'dub' : ''}" ${o.dubious ? 'title="Vergleich mit Hersteller-UVP, vermutlich Schein-Rabatt"' : ''}>${o.dubious ? '≈ ' : ''}−${Math.round(o.pct * 100)} %</span>` : '';
  return `<div class="card offer"><div class="ohead">${thumb(o.img, iconFor(p, o.name))}
  <div class="grow"><div class="row sp nowrap"><h3 class="grow">${esc(o.name)}</h3>${badge}</div>
  ${o.desc ? `<div class="mute clamp">${esc(o.desc)}</div>` : ''}
  <div class="row" style="margin-top:2px"><span class="price">${eur(o.price)}</span>${o.regular ? `<span class="old">${eur(o.regular)}</span>` : ''}${o.up ? `<span class="mute">${eur(o.up.v)} / ${unitLbl(o.up.base)}</span>` : ''}</div></div></div>
  <div class="row" style="margin:8px 0 2px">${t.join('')}</div>
  ${o.pct != null ? `<div class="mute">Ersparnis ${o.regular ? eur(o.regular - o.price) + ' ' : ''}(${esc(o.kind)})</div>` : ''}${cmp ? `<div class="small" style="margin-top:3px"><b>${esc(cmp)}</b></div>` : ''}
  ${o.note ? `<div class="mute">${esc(o.note)}</div>` : ''}${o.incomplete ? `<div class="mute">⚠ ${esc(o.incomplete)}</div>` : ''}
  <div class="row sp" style="margin-top:8px"><span class="mute">gültig ${fmtD(o.valid[0])}–${fmtD(o.valid[1])}${o.src ? ` · <a href="${esc(o.src)}" target="_blank" rel="noopener">Quelle</a>` : ''}</span>${add}</div></div>`;
}

/* ================= Views ================= */
const V = {}; const UI = { qa: false, offers: 'week', wege: 'extra', open: new Set(), q: '', more: false };
function parseAdd(txt) {
  let qty = '', name = txt.trim();
  const m = name.match(/^(\d+(?:[.,]\d+)?\s?(?:x|×|kg|g|l|ml)?)\s+(.+)$/i) || name.match(/^(.+?)\s+(\d+\s?(?:x|×|kg|g|l|ml))$/i);
  if (m) { if (/^\d/.test(m[1])) { qty = m[1]; name = m[2]; } else { name = m[1]; qty = m[2]; } }
  let p = PRODUCTS.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!p) { let len = 0; for (const q of PRODUCTS) { const k = rx(q).exec(name); if (k && k[0].length > len) { p = q; len = k[0].length; } } }
  return { name, qty, pid: p ? p.id : null };
}

// Schnell hinzufügen: zuerst das, was du am häufigsten kaufst; mit dem Pfeil siehst du alle Optionen
const freq = p => S.buys[p.id] || 0;
const chipHtml = p => { const i = productInfo(p), b = i.nearBest || i.best; return `<button class="chip" onclick="addP('${p.id}')">${iconFor(p)} ${esc(p.name.split(' /')[0])}${freq(p) >= 2 ? ' <span title="kaufst du oft">🔁</span>' : ''}${b && b.pct != null && !b.dubious ? ` <b style="color:var(--acc)">−${Math.round(b.pct * 100)}%</b>` : ''}</button>`; };
function quickAdd() {
  const fav = PRODUCTS.filter(p => !onList(p.id) && (watched(p.id) || freq(p) >= 2)).sort((a, b) => freq(b) - freq(a) || watched(b.id) - watched(a.id));
  const rest = PRODUCTS.filter(p => !onList(p.id) && !fav.includes(p) && (!p.custom));
  const open = UI.qa, shown = open ? fav : fav.slice(0, 6);
  const toggle = `<button class="chip arrow" onclick="toggleQa()" aria-expanded="${open}">${open ? '▴ Weniger' : '▾ Mehr Optionen'}</button>`;
  if (!fav.length && !open) return `<div class="row sp" style="margin:2px 4px"><span class="mute">Schnell hinzufügen</span>${toggle}</div>`;
  let h = `<div class="row sp" style="margin:2px 4px"><span class="mute">Schnell hinzufügen · deine Favoriten</span>${toggle}</div><div class="chips">${shown.map(chipHtml).join('')}</div>`;
  if (open) {
    const cats = [...new Set(rest.map(p => p.cat))];
    h += `<div class="mute" style="margin:8px 4px 0">Die App ergänzt Favoriten automatisch: Was du 3-mal gekauft hast, wird dauerhaft beobachtet. 🔁 = kaufst du oft.</div>` + cats.map(c => `<div class="mute" style="margin:8px 4px 0">${ICON[c] || ''} ${c}</div><div class="chips">${rest.filter(p => p.cat === c).map(chipHtml).join('')}</div>`).join('');
  }
  return h;
}
function toggleQa() { const v = $('#ni') ? $('#ni').value : ''; UI.qa = !UI.qa; render(); if (v && $('#ni')) $('#ni').value = v; }
let SUGG = [];
const groupHead = k => {
  if (k === '_none') return '📍 Kein aktuelles Angebot <span class="tag">normal im City-Center kaufen</span>';
  const st = STORE(k);
  return { A: `🏠 ${esc(st.name)} <span class="tag t-ok">Haupteinkauf · City-Center</span>`, B: `🚶 ${esc(st.name)} <span class="tag t-warn">Spaziergang mit Rucksack · optional</span>`, C: `🚗 ${esc(st.name)} <span class="tag t-warn">Sonderfahrt · optional</span>`, D: `🏪 ${esc(st.name)} <span class="tag t-stock">optional</span>` }[st.tier];
};
V.list = () => {
  const rows = S.list.map((it, i) => { const p = it.pid ? PROD(it.pid) : null, info = p ? productInfo(p) : null; return { it, i, p, info, dec: info ? decision(info, it) : null, b: info && (info.nearBest || info.best) }; });
  const open = rows.filter(r => !r.it.done), done = rows.filter(r => r.it.done);
  const groups = {};
  open.forEach(r => { const k = r.b ? r.b.store.id : '_none'; (groups[k] = groups[k] || []).push(r); });
  const order = Object.keys(groups).sort((a, b) => (a === '_none') - (b === '_none') || 'ABCD'.indexOf(STORE(a).tier) - 'ABCD'.indexOf(STORE(b).tier));
  const row = r => {
    const id = r.it.id, o = UI.open.has(id);
    return `<div class="item ${r.it.done ? 'done' : ''}"><button class="chk ${r.it.done ? 'on' : ''}" onclick="tick('${id}')" aria-label="abhaken">${r.it.done ? '✓' : ''}</button>
    ${thumb(r.b && r.b.img, iconFor(r.p, r.it.name), 'sm')}
    <div class="grow"><div class="nm" onclick="toggleOpen('${id}')">${esc(r.it.name)}${r.it.qty ? ` <span class="mute">× ${esc(r.it.qty)}</span>` : ''}${r.it.urgent ? ' <span class="tag t-warn">dringend</span>' : ''}</div>
    ${r.b && !r.it.done ? `<div class="row small" style="margin-top:2px"><b>${eur(r.b.price)}</b><span class="mute">${esc(r.b.store.short)}${r.b.up ? ' · ' + eur(r.b.up.v) + '/' + unitLbl(r.b.up.base) : ''}</span>${r.b.pct != null ? `<span class="pct ${r.b.dubious ? 'dub' : ''}">−${Math.round(r.b.pct * 100)} %</span>` : ''}${r.dec && r.dec.cls ? `<span class="tag ${r.dec.cls}">${r.dec.tag}</span>` : ''}</div>${r.b.desc ? `<div class="mute clamp">${esc(r.b.name.slice(0, 40))} · ${esc(r.b.desc.slice(0, 40))}</div>` : ''}` : ''}
    ${o ? `<div class="detail">${r.dec ? `<div>${esc(r.dec.why)}</div>` : '<div>Noch kein Produkt zugeordnet. Mit 👁 wird es beobachtet und bei der nächsten Suche gefunden.</div>'}
      ${r.info && r.info.now.length ? `<table style="margin-top:6px">${r.info.now.slice(0, 5).map(x => `<tr><td><i class="dot t${x.store.tier}"></i>${esc(x.store.short)}</td><td class="mute">${esc(x.name.slice(0, 28))}</td><td>${eur(x.price)}${x.up ? ` <span class="mute">${eur(x.up.v)}/${unitLbl(x.up.base)}</span>` : ''}</td></tr>`).join('')}</table>` : ''}
      <div class="row" style="margin-top:6px"><label class="mute"><input type="checkbox" ${r.it.urgent ? 'checked' : ''} onchange="urgent('${id}')" style="width:auto"> dringend (nicht auf nächste Woche warten)</label><label class="mute"><input type="checkbox" ${itemHeavy(r.it, r.p) ? 'checked' : ''} onchange="toggleHeavy('${id}')" style="width:auto"> schwer/sperrig (zuletzt kaufen)</label></div></div>` : ''}</div>
    <button class="ico ${r.p && watched(r.p.id) ? 'on' : ''}" title="Beobachten" onclick="eye('${id}')">👁</button><button class="ico" onclick="del('${id}')" title="Entfernen">✕</button></div>`;
  };
  const qa = quickAdd();
  SUGG = Object.entries(S.buys).filter(([k, n]) => n >= 2 && (k.startsWith('n:') || !watched(k)) && !(k.startsWith('n:') && S.custom.some(c => c.name.toLowerCase() === k.slice(2)))).slice(0, 3);
  const help = S.hideHelp ? '' : `<div class="card help"><h3>👋 So funktioniert's</h3><ol>
    <li><b>Liste schreiben oder sprechen:</b> oben eintippen oder 🎤 einsprechen, z. B. „Milch, Butter und 2 Paprika".</li>
    <li><b>Angebote suchen:</b> holt die aktuellen Angebote. Die App sagt dir pro Produkt, wo es am besten ist. Dein <b>City-Center Chorweiler</b> steht immer an erster Stelle.</li>
    <li><b>👁 Beobachten:</b> Produkte, die du regelmäßig brauchst. Die App prüft sie bei jeder Suche, auch wenn sie gerade nicht auf der Liste stehen.</li>
    <li><b>Einkauf abschließen:</b> Hake ab, was im Wagen ist. Die App merkt sich, was du oft kaufst, und schlägt es dir zum Beobachten vor.</li></ol>
    <button class="btn sm" onclick="S.hideHelp=true;save();render()">Verstanden</button></div>`;
  return `${help}<div class="add"><input id="ni" list="pl" placeholder="Was brauchst du? z. B. 2 Milch" autocomplete="off" onkeydown="if(event.key==='Enter')addItem()"><datalist id="pl">${PRODUCTS.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist><button class="btn ${MIC ? 'danger' : ''}" onclick="mic()" title="Einsprechen">${MIC ? '⏹' : '🎤'}</button><button class="btn pri" onclick="addItem()" title="Hinzufügen">+</button></div>
  <div class="mute" style="margin:-4px 4px 8px">Tipp: mehrere Dinge auf einmal, z. B. „Milch, Butter und 2 Paprika", oder 🎤 einsprechen.</div>
  ${open.length ? `<button class="btn pri" style="width:100%;margin:0 0 12px" onclick="go('route')">🧭 Einkaufsroute ansehen (${open.length} Artikel)</button>` : ''}
  ${qa}
  ${SUGG.map(([k, n], i) => `<div class="banner info row sp"><span>Du kaufst <b>${esc(k.startsWith('n:') ? k.slice(2) : (PROD(k)?.name || k))}</b> oft (${n}×). Beobachten?</span><button class="btn sm" onclick="watchKey(${i})">👁 Ja</button></div>`).join('')}
  ${!SRC.live ? `<div class="banner">Noch keine echten Angebote geladen. Tippe oben auf <b>Angebote suchen</b>.</div>` : ''}
  ${open.length ? order.map(k => `<h2>${groupHead(k)}</h2><div class="card tight">${groups[k].map(row).join('')}</div>`).join('') : (done.length ? '' : empty('🛒', 'Deine Liste ist leer.<br>Tippe oben ein, was du brauchst.'))}
  ${done.length ? `<h2>🧺 Im Wagen</h2><div class="card tight">${done.map(row).join('')}</div><button class="btn pri" style="width:100%;margin-top:4px" onclick="finish()">✅ Einkauf abschließen (${done.length})</button>` : ''}
  ${topSummary()}`;
};
function offersFiltered() {
  const q = UI.q.toLowerCase().trim(); return OFFERS_ALL().filter(o => !q || (o.name + ' ' + (o.desc || '') + ' ' + o.store.short + ' ' + (o.p ? o.p.name : '')).toLowerCase().includes(q));
}
function offersBody() {
  const t = UI.offers, offs = offersFiltered(), byPct = (a, b) => (b.pct || 0) - (a.pct || 0), lim = (a, n) => UI.more ? a : a.slice(0, n);
  const more = (a, n) => !UI.more && a.length > n ? `<div style="text-align:center;margin:10px"><button class="btn" onclick="UI.more=true;renderOffers()">Alle ${a.length} anzeigen</button></div>` : '';
  if (t === 'lidl') return extraBody();
  if (t === 'gm') return woandersBody();
  if (t === 'week' || t === 'next') {
    const st = t === 'week' ? 'now' : 'next', m = offs.filter(o => o.state === st && o.p).sort(byPct);
    const a = m.filter(o => onList(o.p.id)), b = m.filter(o => !a.includes(o) && watched(o.p.id)), c = m.filter(o => !a.includes(o) && !b.includes(o));
    return `${t === 'next' && !m.length ? empty('🗓️', 'Noch keine Angebote für nächste Woche bekannt. Sie erscheinen meist ab Samstag.') : ''}
    ${a.length ? `<h2>Auf deiner Liste</h2>${grid(a.map(o => offerCard(o)).join(''))}` : ''}${b.length ? `<h2>👁 Beobachtet</h2>${grid(b.map(o => offerCard(o)).join(''))}` : ''}
    ${c.length ? `<h2>Weitere Treffer aus deiner Dauerliste</h2>${grid(lim(c, 24).map(o => offerCard(o)).join(''))}${more(c, 24)}` : ''}${t === 'week' && !m.length ? empty('🔎', SRC.live ? 'Keine Treffer. Passe die Suche an.' : 'Noch nichts geladen. Tippe oben auf „Angebote suchen".') : ''}`;
  }
  if (t === 'discover') {
    const d = offs.filter(o => !o.p && o.food && !o.dubious && o.pct != null && o.pct >= 0.25 && o.state === 'now').sort(byPct);
    return `<div class="banner info">Starke Angebote, die nicht in deiner Liste stehen, ohne Schwein, Wurst und Salami.</div>${d.length ? grid(lim(d, 24).map(o => offerCard(o)).join('')) + more(d, 24) : empty('✨', 'Noch nichts gefunden. Erst „Angebote suchen" tippen.')}`;
  }
  const meat = offs.filter(o => o.state === 'now' && o.p && o.p.meat).sort((a, b) => rank(a, b));
  const stock = offs.filter(o => o.state === 'now' && o.p && o.p.stock && !o.p.meat && o.pct != null && o.pct * 100 >= S.set.stockPct).sort(byPct);
  return `<h2>🥩 Fleisch, alle Angebote nach Preis</h2>${meat.length ? grid(lim(meat, 24).map(o => offerCard(o)).join('')) + more(meat, 24) : empty('🥩', 'Noch keine Fleischangebote geladen.')}
  <h2>Haltbares ab ${S.set.stockPct} % Ersparnis</h2>${stock.length ? grid(lim(stock, 24).map(o => offerCard(o)).join('')) : empty('📦', 'Aktuell nichts, das den Schwellwert erreicht.')}`;
}
const SEG = (cur, items, fn) => `<div class="seg">${items.map(([k, l]) => `<button class="${k === cur ? 'on' : ''}" onclick="${fn}('${k}')">${l}</button>`).join('')}</div>`;
V.offers = () => `${SEG(UI.offers, [['week', 'Diese Woche'], ['next', 'Nächste Woche'], ['discover', 'Entdecken'], ['stock', 'Vorrat & Fleisch'], ['lidl', 'Lidl-Spaziergang'], ['gm', 'Großmarkt']], 'setOff')}
  <div class="add"><input id="oq" placeholder="Angebote durchsuchen…" value="${esc(UI.q)}" oninput="UI.q=this.value;UI.more=false;renderOffers()"></div><div id="olist">${offersBody()}</div>`;
const renderOffers = () => { const e = $('#olist'); if (e) e.innerHTML = offersBody(); };
V.watch = () => {
  return `<div class="banner info">👁 <b>Was ist das?</b> Beobachtete Produkte sind deine Dauerprodukte. Die App prüft sie bei jeder Angebotssuche, auch wenn sie nicht auf deiner Liste stehen, und zeigt dir starke Angebote dafür auf der Startseite. Aktuell beobachtet: <b>${S.watch.length}</b></div>
  <div class="add"><input id="wn" placeholder="Eigenes Produkt beobachten, z. B. Lachs" onkeydown="if(event.key==='Enter')addCustom()"><button class="btn pri" onclick="addCustom()">+</button></div>
  <div class="add"><input placeholder="Produkte filtern…" value="${esc(UI.wq || '')}" oninput="UI.wq=this.value;$('#wl').innerHTML=watchBody()"></div><div id="wl">${watchBody()}</div>`;
};
function watchBody() { const qq = (UI.wq || '').toLowerCase(); return [...new Set(PRODUCTS.map(p => p.cat))].map(c => { const l = PRODUCTS.filter(p => p.cat === c && (!p.custom || watched(p.id) || onList(p.id)) && (!qq || p.name.toLowerCase().includes(qq))).sort((a, b) => watched(b.id) - watched(a.id)); const line = p => { const i = productInfo(p), b = i.nearBest || i.best; return `<div class="item"><button class="ico ${watched(p.id) ? 'on' : ''}" onclick="watchP('${p.id}')" title="${watched(p.id) ? 'Nicht mehr beobachten' : 'Beobachten'}">👁</button>${thumb(b && b.img, iconFor(p), 'sm')}<div class="grow"><div class="nm" style="cursor:default">${esc(p.name)}</div><div class="mute">${b ? `<b style="color:var(--ink)">${eur(b.price)}</b> ${esc(b.store.short)}${b.pct != null ? ` · −${Math.round(b.pct * 100)} %` : ''}` : 'Kein Angebot bekannt'}${p.note ? ' · ' + esc(p.note) : ''}</div></div><button class="btn sm" onclick="addP('${p.id}')">+ Liste</button></div>`; }; return l.length ? `<h2>${ICON[c] || ''} ${c}</h2><div class="card tight">${l.map(line).join('')}</div>` : ''; }).join(''); }
V.route = () => routeView();
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
V.more = () => `<h2>Datenstand</h2><div class="card"><div>${SRC.live ? `Letzte Suche: <b>${new Date(SRC.fetched).toLocaleString('de-DE')}</b><br><span class="mute">${SRC.offers.length} Angebote · ${esc(SRC.source)}</span>` : 'Noch keine Suche. Tippe oben auf „Angebote suchen".'}</div>
  <div class="mute" style="margin-top:8px">Wichtig: Die Angebote sind Händler-weit. Ob genau deine Filiale in Chorweiler mitmacht, wird nicht geprüft. <b>ALDI SÜD</b> liefert keine einzelnen Angebote an kaufDA, dafür bitte den Prospekt-Link bei „Läden" nutzen. Abgedeckt sind REWE, Netto, Lidl, METRO und teilweise dm. Penny ist bewusst nicht dabei.</div></div>
  <h2>Läden</h2>${['A', 'B', 'D'].map(t => `<div class="card"><h3><i class="dot t${t}"></i>${TIER_LABEL[t]}</h3>${STORES.filter(s => s.tier === t).map(s => `<details style="margin-top:8px"><summary><b>${esc(s.short)}</b> <span class="mute">${t === 'A' ? '3 Min zu Fuß' : t === 'B' ? s.walk + ' Min zu Fuß' : s.car ? 'ca. ' + s.car + ' Min Auto' : ''}</span></summary><div class="mute" style="padding:6px 0">${esc(s.addr)}<br>Öffnungszeiten: ${esc(s.hours)}${s.transit ? '<br>' + esc(s.transit) : ''}${s.note ? '<br>' + esc(s.note) : ''}</div><div class="row">${s.links.map(l => `<a href="${l[1]}" target="_blank" rel="noopener">${esc(l[0])}</a>`).join(' · ')}</div></details>`).join('')}</div>`).join('')}
  <h2>Angebot selbst eintragen</h2><div class="card"><div class="fgrid">
  <label class="f">Produkt<input id="mn" list="pl2"><datalist id="pl2">${PRODUCTS.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist></label>
  <label class="f">Laden<select id="ms">${STORES.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
  <label class="f">Preis €<input id="mp" type="number" step="0.01"></label><label class="f">Normalpreis €<input id="mr" type="number" step="0.01"></label>
  <label class="f">Menge<input id="ma" type="number" step="any"></label><label class="f">Einheit<select id="mu"><option value="">–</option><option>g</option><option>kg</option><option>ml</option><option>l</option><option value="st">Stück</option></select></label>
  <label class="f">gültig bis<input id="mv" type="date"></label></div><div class="row" style="margin-top:10px"><button class="btn pri" onclick="addOffer()">Speichern</button><span class="mute">Merkt sich den Preis auch als dein Referenzpreis.</span></div>
  ${S.manual.map((o, i) => `<div class="item"><div class="grow">${esc(o.name)} · ${eur(o.price)} · ${esc(STORE(o.store).short)}</div><button class="ico" onclick="delOffer(${i})">✕</button></div>`).join('')}</div>
  <h2>Einstellungen</h2><div class="card"><div class="fgrid"><label class="f">Wert deiner Zeit (€/Std.)<input type="number" id="sh" value="${S.set.hourly}"></label><label class="f">Vorrat ab … % Ersparnis<input type="number" id="sp" value="${S.set.stockPct}"></label><label class="f">Max. Autofahrt (Min)<input type="number" id="sc" value="${S.set.carMax}"></label></div><button class="btn" style="margin-top:10px" onclick="saveSet()">Speichern</button></div>
  <h2>Sicherung</h2><div class="card row"><button class="btn" onclick="exp()">Exportieren</button><button class="btn" onclick="$('#imp').click()">Importieren</button><input id="imp" type="file" accept=".json" hidden onchange="imp(this)"><button class="btn danger" onclick="if(confirm('Alle Daten dieser App löschen?')){localStorage.removeItem(LS);location.reload()}">Alles löschen</button></div>`;

/* ================= Aktionen ================= */
function toast(t) { let e = $('#toast'); if (!e) { e = document.createElement('div'); e.id = 'toast'; e.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#17211c;color:#fff;padding:10px 16px;border-radius:14px;z-index:20;font-size:14px;max-width:90%;box-shadow:0 4px 16px rgba(0,0,0,.3)'; document.body.appendChild(e); } e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', 2600); }
function addP(id) { const p = PROD(id); if (!onList(id)) S.list.push({ id: uid(), pid: id, name: p.name, qty: '', urgent: false, done: false }); save(); render(); toast(p.name + ' auf der Liste'); }
function addMany(txt) {
  const parts = txt.split(/,|;|\n|\s+und\s+|\s+sowie\s+|\s+plus\s+/i).map(s => s.trim()).filter(Boolean);
  parts.forEach(v => { const a = parseAdd(v); if (!a.pid && a.name.length >= 3) a.pid = mkCustom(a.name).id; /* frei eingetippte Artikel bekommen ein eigenes Produkt, damit Angebote gefunden werden */ if (!S.list.some(i => !i.done && i.name.toLowerCase() === a.name.toLowerCase())) S.list.push({ id: uid(), pid: a.pid, name: a.name, qty: a.qty, urgent: false, done: false }); });
  save(); render(); return parts.length;
}
function addItem() { const el = $('#ni'); if (!el || !el.value.trim()) return; addMany(el.value); const n = $('#ni'); if (n) n.focus(); }
let MIC = false, REC = null;
function mic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Spracheingabe geht in diesem Fenster nicht. Öffne die App in Chrome oder Edge: http://localhost:3456');
  if (MIC && REC) { REC.stop(); return; }
  REC = new SR(); REC.lang = 'de-DE'; REC.interimResults = false; REC.continuous = false;
  REC.onresult = e => { const t = e.results[0][0].transcript; const n = addMany(t); toast(n + ' hinzugefügt: ' + t); };
  REC.onerror = e => toast(e.error === 'not-allowed' ? 'Mikrofon nicht erlaubt. Erlaube den Zugriff im Browser.' : 'Spracheingabe: ' + e.error);
  REC.onend = () => { MIC = false; render(); };
  try { REC.start(); MIC = true; render(); toast('Ich höre zu… sprich deine Produkte.'); } catch (e) { toast('Spracheingabe konnte nicht starten.'); }
}
function topSummary() {
  const offs = OFFERS_ALL().filter(o => o.state === 'now' && o.price > 0);
  if (!offs.length) return '';
  const dedupe = a => { const s = new Set(); return a.filter(o => { const k = o.store.id + (o.p ? o.p.id : o.name); if (s.has(k)) return false; s.add(k); return true; }); };
  const score = o => (o.pct || 0) * (o.regularIsUvp ? 0.6 : 1);
  const byPct = (a, b) => score(b) - score(a);
  const food = o => o.p || o.food;
  const near = dedupe(offs.filter(o => o.store.tier === 'A' && food(o) && !o.dubious && o.pct != null && o.pct >= 0.15).sort(byPct)).slice(0, 8);
  const habit = dedupe(offs.filter(o => o.p && (S.buys[o.p.id] > 0 || watched(o.p.id)) && !onList(o.p.id) && o.store.tier !== 'D' && (o.store.tier === 'A' || o.store.tier === 'B' || (o.store.car || 99) <= S.set.carMax)).sort((a, b) => (isNear(b) - isNear(a)) || byPct(a, b))).slice(0, 8);
  const top = dedupe(offs.filter(o => o.store.tier !== 'D' && food(o) && !o.dubious && o.pct != null && o.pct >= 0.3 && !near.includes(o)).sort(byPct)).slice(0, 8);
  const sec = (title, sub, a) => a.length ? `<h2>${title}</h2><div class="mute" style="margin:-4px 4px 8px">${sub}</div><div class="hs">${a.map(o => offerCard(o)).join('')}</div>` : '';
  return sec('🔥 Top-Angebote im City-Center', 'Netto, REWE, dm: wenige Minuten zu Fuß', near) + sec('🔁 Das kaufst du öfter, jetzt im Angebot', 'Beobachtete und schon gekaufte Produkte, die nicht auf deiner Liste stehen. City-Center zuerst', habit) + sec('⭐ Allgemein starke Angebote', 'Ab 30 % Ersparnis, auch bei Lidl (Spaziergang)', top);
}
const byId = id => S.list.find(i => i.id === id);
const tick = id => { const i = byId(id); i.done = !i.done; save(); render(); };
const del = id => { S.list = S.list.filter(i => i.id !== id); save(); render(); };
const toggleHeavy = id => { const i = byId(id); i.heavy = !itemHeavy(i, i.pid ? PROD(i.pid) : null); save(); render(); };
const urgent = id => { const i = byId(id); i.urgent = !i.urgent; save(); render(); };
const toggleOpen = id => { UI.open.has(id) ? UI.open.delete(id) : UI.open.add(id); render(); };
function mkCustom(name) { let c = S.custom.find(x => x.name.toLowerCase() === name.toLowerCase()); if (!c) { c = { id: 'c_' + uid(), name }; S.custom.push(c); regCustom(c); CACHE = null; } return c; }
function eye(id) { const i = byId(id); if (!i.pid) { const c = mkCustom(i.name); i.pid = c.id; if (!watched(c.id)) S.watch.push(c.id); toast('„' + i.name + '" wird jetzt beobachtet. Bei der nächsten Suche werden Angebote gesucht.'); } else watchP(i.pid, true); save(); render(); }
function watchP(id, noRender) { S.watch = watched(id) ? S.watch.filter(x => x !== id) : [...S.watch, id]; save(); if (!noRender) { render(); } }
function addCustom() { const v = $('#wn').value.trim(); if (!v) return; const c = mkCustom(v); if (!watched(c.id)) S.watch.push(c.id); save(); render(); toast('„' + v + '" wird beobachtet. Tippe oben auf „Angebote suchen".'); }
function watchKey(i) { const k = SUGG[i][0]; if (k.startsWith('n:')) { const c = mkCustom(k.slice(2)); if (!watched(c.id)) S.watch.push(c.id); } else if (!watched(k)) S.watch.push(k); S.buys[k] = 0; save(); render(); }
function finish() { S.list.filter(i => i.done).forEach(i => { const k = i.pid || 'n:' + i.name.toLowerCase(); S.buys[k] = (S.buys[k] || 0) + 1; }); S.list = S.list.filter(i => !i.done);
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
function saveSet() { S.set = { ...S.set, hourly: +$('#sh').value || 15, stockPct: +$('#sp').value || 20, carMax: +$('#sc').value || 25 }; save(); render(); toast('Gespeichert'); }
function exp() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' })); a.download = 'einkauf-daten.json'; a.click(); }
function imp(el) { const f = el.files[0]; if (f) f.text().then(t => { try { S = Object.assign({}, DEF, JSON.parse(t)); S.custom.forEach(regCustom); CACHE = null; save(); render(); } catch (e) { alert('Ungültige Datei'); } }); }
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
const TABS = [['list', '🛒', 'Liste'], ['route', '🧭', 'Route'], ['offers', '🏷️', 'Angebote'], ['watch', '👁', 'Beobachten'], ['more', '⚙️', 'Mehr']];
let cur = (location.hash || '#list').slice(1);
function render() {
  if (!V[cur]) cur = 'list';
  const sy = scrollY, ae = document.activeElement && document.activeElement.id;
  $('#tabs').innerHTML = TABS.map(([k, i, l]) => `<button class="${k === cur ? 'on' : ''}" onclick="go('${k}')"><span>${i}</span>${l}</button>`).join('');
  $('#view').innerHTML = V[cur]();
  $('#sub').textContent = TODAY.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  rstat(); scrollTo(0, sy);
}
function go(k) { cur = k; location.hash = k; render(); scrollTo(0, 0); }
loadOffers().then(render); render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { }); // Offline-Speicher
