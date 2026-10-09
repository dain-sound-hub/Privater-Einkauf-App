// Einkaufsroute: verteilt die Liste auf Läden. Leichte Sachen zuerst (Rucksack), schwere und sperrige zuletzt.
// Wird vor app.js geladen und nutzt dessen Funktionen erst beim Aufruf.
// Schwer oder sperrig = passt nicht in den Rucksack. Normale Packungen (Weichspüler, Waschmittel) zählen nicht. „Wasser“ allein heißt Sixer/Kasten, „kleine Flasche Wasser“ passt in den Rucksack.
const BULKY_RX = /klopapier|toilettenpapier|küchen(rolle|rollen|tuch|tücher|krepp)|haushaltstuch|haushaltstücher|servietten|windel|katzenstreu/i;
const DRINK_RX = /wasser|getränk|bier|cola|limo|saft|sprudel|schorle|kasten|kiste/i;
const BIG_RX = /xxl|groß|gross|kanister|karton|sixer|6er|12er|palette|vorrat|(^|\s)([3-9]|\d\d)\s?(kg|l)(\s|$)/i;
const SMALL_RX = /klein|mini|to go|einzel|0[,.][2-5]\s?l|\b(250|330|500)\s?ml|(1|eine?)\s?flasche(\s|$)/i;
function heavyKind(it, p) { // 'schwer' | 'sperrig' | null; deine Einstellung beim Artikel gilt immer
  const n = it.name || '';
  if (it.heavy !== undefined) return it.heavy ? (BULKY_RX.test(n) ? 'sperrig' : 'schwer') : null;
  if (BULKY_RX.test(n)) return SMALL_RX.test(n) ? null : 'sperrig';
  if (SMALL_RX.test(n)) return null;
  if (BIG_RX.test(n)) return 'schwer';
  if (DRINK_RX.test(n) || (p && /^(wasser|bitburger)$/.test(p.id))) return 'schwer';
  return null;
}
const itemHeavy = (it, p) => !!heavyKind(it, p);

function planRoute(all) { // all = auch Artikel, die in der Kurzliste-Ansicht ausgeblendet sind
  const mode = S.set.lidl || 'auto';
  const rows = S.list.filter(i => !i.done && (all || !hiddenShort(i))).map(it => {
    const p = it.pid ? PROD(it.pid) : null, info = p ? productInfo(p) : null, heavy = itemHeavy(it, p);
    let nowA = info ? info.now.filter(o => o.store.tier === 'A') : [];
    if (heavy) nowA = nowA.slice().sort(rank); // bei Schwerem sind Großpackungen (z. B. Kiste) okay
    const lidl = info && !heavy ? info.now.find(o => o.store.tier === 'B') || null : null;
    return { it, p, info, heavy, nowA, near: nowA[0] || null, lidl, pf: prefOf(p, it.name), offer: null, storeId: null, note: '', fixed: !!(it.store && STORES.some(s => s.id === it.store)) };
  });

  // 1) Standardwahl im City-Center (mit deinem Lieblingsladen, falls bekannt)
  for (const r of rows) {
    if (r.fixed) { r.storeId = r.it.store; r.offer = (r.info ? r.info.now.find(o => o.store.id === r.it.store) : null) || null; r.note = 'von dir so gewählt'; continue; } // „heute bei …" (Halten und Ziehen)
    const { nowA, pf } = r;
    const why = pf && pf.fb ? 'bei ' + STORE(pf.id).short + ', sonst ' + STORE(pf.fb).short : 'dein Standard';
    if (pf) { // Standardladen (z. B. dm für Waschmittel und Drogerie, REWE für Küchenrollen)
      const po = nowA.find(o => o.store.id === pf.id);
      const other = nowA.find(o => o.store.id !== pf.id);
      if (po && !(other && other.up && po.up && other.up.v < po.up.v * 0.9)) { r.offer = po; r.storeId = pf.id; r.note = why; }
      else if (other && other.pct != null && !other.dubious && other.pct >= 0.15) { r.offer = other; r.storeId = other.store.id; r.note = 'echtes Angebot'; }
      else { r.storeId = pf.id; r.note = pf.fb ? why : 'dein Standard (kein besseres Angebot bekannt)'; }
    } else if (r.near) { r.offer = r.near; r.storeId = r.near.store.id; }
  }
  // 2) Lidl-Spaziergang: nur Leichtes, nur wenn es sich lohnt (oder du es willst)
  let lidlSave = 0, lidlItems = [];
  if (mode !== 'nein') {
    for (const r of rows) {
      if (!r.lidl || r.fixed) continue;
      const n = r.near, l = r.lidl;
      const cheaper = !n ? true : (n.up && l.up && n.up.base === l.up.base && l.up.v < n.up.v * 0.9);
      if (!cheaper) continue;
      lidlItems.push(r);
      const q = qtyBase(l); if (n && n.up && l.up && q) lidlSave += Math.max(0, (n.up.v - l.up.v) * q);
    }
    const use = mode === 'ja' ? lidlItems.length > 0 : lidlSave >= 1.5;
    if (use) lidlItems.forEach(r => { r.offer = r.lidl; r.storeId = 'lidl'; r.note = ''; }); else lidlItems = [], lidlSave = 0;
  }
  // 3) Schwere Sachen auf einen Laden bündeln (der mit den meisten schweren Artikeln)
  const heavyRows = rows.filter(r => r.heavy && r.storeId && r.storeId !== 'lidl' && !r.fixed);
  const cnt = {}; heavyRows.forEach(r => cnt[r.storeId] = (cnt[r.storeId] || 0) + (r.pf ? 3 : 1)); // dein Standardladen (z. B. REWE für Küchenrollen) zählt dreifach
  const anchor = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || null;
  if (anchor) for (const r of heavyRows) {
    if (r.storeId === anchor || r.pf) continue;
    if (anchor === 'dm' && !(r.p && r.p.cat === 'Haushalt & Wäsche')) continue; // dm verkauft keine Getränke- oder Lebensmittel-Großpackungen
    const ao = r.nowA.find(o => o.store.id === anchor);
    if (ao && (!r.offer || !r.offer.up || !ao.up || ao.up.v <= r.offer.up.v * 1.15)) { r.offer = ao; r.storeId = anchor; r.note = 'mit dem Schweren zusammen'; }
    else if (!r.offer || r.offer.pct == null || r.offer.dubious || r.offer.pct < 0.15) { r.offer = null; r.storeId = anchor; r.note = 'normal, zusammen mit dem Schweren'; } // kleiner Rabatt lohnt keinen Umweg mit schwerer Tasche
  }
  // 4) Stopps bilden und ordnen: erst Lidl, dann City-Center-Läden mit wenig Schwerem, schwerster Laden zuletzt
  const byStore = {};
  const put = (r, id) => { r.storeId = id; (byStore[id] = byStore[id] || []).push(r); };
  rows.filter(r => r.storeId).forEach(r => put(r, r.storeId));
  let centerIds = Object.keys(byStore).filter(id => id !== 'lidl');
  // Gewicht je Artikel: Getränke am schwersten, Waschmittel & Co. mittel, Sperriges (Klopapier, Küchenrollen) leicht. Der Laden mit dem meisten Gewicht kommt zuletzt.
  const wt = r => !r.heavy ? 0 : /wasser|bier|getränk|kasten|kiste|cola|saft/i.test(r.it.name) ? 3 : /waschmittel|weichspüler|spülmittel|reiniger|mehl|zucker|katzenstreu/i.test(r.it.name) ? 2 : 1;
  const hv = id => byStore[id].reduce((s, r) => s + wt(r), 0);
  centerIds.sort((a, b) => hv(a) - hv(b) || byStore[b].length - byStore[a].length);
  // 5) Artikel ohne bekannten Laden: Leichtes beim ersten Stopp, Schweres beim letzten (sonst Standardladen)
  const lonely = rows.filter(r => !r.storeId);
  for (const r of lonely) {
    r.note = 'kein Angebot bekannt, normal mitkaufen';
    const cat = r.p && r.p.cat, def = (cat === 'Haushalt & Wäsche') ? 'dm' : null;
    let id;
    if (r.heavy) { let last = centerIds[centerIds.length - 1]; if (last === 'dm' && !(r.p && r.p.cat === 'Haushalt & Wäsche')) last = centerIds.filter(i => i !== 'dm').pop(); id = last || (r.pf && r.pf.id) || 'rewe'; }
    else id = def || centerIds[0] || 'netto';
    if (!byStore[id]) { byStore[id] = []; centerIds.push(id); centerIds.sort((a, b) => hv(a) - hv(b) || byStore[b].length - byStore[a].length); }
    put(r, id);
    centerIds.sort((a, b) => hv(a) - hv(b) || byStore[b].length - byStore[a].length);
  }
  const mk = id => { const items = byStore[id].slice().sort(aisleCmp); return { store: STORE(id), kind: id === 'lidl' ? 'lidl' : 'center', items, heavyCount: items.filter(x => x.heavy).length }; };
  const favs = rows.filter(r => r.it.fav && r.storeId).map(r => ({ ...r, recName: STORE(r.storeId).short })).sort(aisleCmp);
  Object.keys(byStore).forEach(id => { byStore[id] = byStore[id].filter(r => !r.it.fav); });
  centerIds = centerIds.filter(id => byStore[id] && byStore[id].length);
  const stops = [];
  if (byStore.lidl && byStore.lidl.length) stops.push(mk('lidl'));
  centerIds.forEach(id => byStore[id] && byStore[id].length && stops.push(mk(id)));
  const centerStops = stops.filter(s => s.kind === 'center').length;
  const mins = (stops[0] && stops[0].kind === 'lidl' ? 18 + 18 : 3) + Math.max(0, centerStops - 1) * 2 + 3; // Lidl hin, zurück ins City-Center, Wege zwischen Läden, nach Hause
  return { stops, favs, mins, lidlSave, lidlUsed: !!(byStore.lidl && byStore.lidl.length), lidlPossible: rows.some(r => r.lidl), count: rows.length };
}

function routeText(plan) {
  return 'Einkaufsroute\n' + plan.stops.map((s, i) => `${i + 1}. ${s.store.name}${s.kind === 'lidl' ? ' (Spaziergang, Rucksack)' : ''}:\n` + s.items.map(x => `   - ${x.it.name}${x.it.qty ? ' (' + x.it.qty + ')' : ''}${x.heavy ? ' (schwer)' : ''}`).join('\n')).join('\n') + '\nDanach nach Hause.';
}
function copyRoute() {
  const t = routeText(planRoute());
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Route kopiert'), () => { prompt('Route kopieren:', t); });
}
const setLidl = k => { S.set.lidl = k; save(); render(); };

function routeView() {
  askBoughtCard();
  const open = S.list.filter(i => !i.done && !hiddenShort(i));
  if (!open.length) return empty('🧭', 'Noch keine Route. Trag auf der Liste ein, was du brauchst.<br>Die App sagt dir dann, in welchem Laden du was kaufst und in welcher Reihenfolge.') + `<div style="text-align:center"><button class="btn pri" onclick="go('list')">Zur Liste</button></div>`;
  const plan = planRoute(), mode = S.set.lidl || 'auto';
  const row = x => cRow({ it: x.it, p: x.p, b: x.offer, info: x.info, note: x.note, heavy: x.heavy, ctx: 'route' });
  const last = plan.stops.length - 1;
  const favCard = plan.favs.length ? `<div class="card tight stop favc" data-store="fav" style="--sc:#e8a317"><div class="row sp nowrap" style="padding:8px 0 2px"><div class="row nowrap"><span class="num">★</span><h3>Im Blick</h3></div><span class="tag">ohne Laden</span></div><div class="mute small" style="margin:0 0 4px">Du entscheidest unterwegs, wo du es kaufst.</div>${plan.favs.map(x => cRow({ it: x.it, p: x.p, b: x.offer, info: x.info, note: x.note, heavy: x.heavy, ctx: 'route', rec: x.recName })).join('')}</div>` : '';
  const cards = plan.stops.map((s, i) => {
    let hint;
    if (s.kind === 'lidl') hint = `${s.store.walk} Min zu Fuß · nur Leichtes, passt in den Rucksack${plan.lidlSave > 0 ? ` · spart ca. ${eur(plan.lidlSave)}` : ''}`;
    else {
      hint = i === 0 ? '3 Min von zu Hause' : plan.stops[i - 1].kind === 'lidl' ? 'zurück im City-Center' : 'ca. 2 Min weiter';
      if (s.heavyCount) hint += i === last ? ' · Schweres zuletzt, danach nach Hause' : ' · enthält Schweres';
    }
    return `<div class="card tight stop" data-store="${s.store.id}" style="--sc:${storeColor(s.store.id)}"><div class="row sp nowrap" style="padding:8px 0 2px"><div class="row nowrap"><span class="num">${i + 1}</span><h3>${s.kind === 'lidl' ? '🚶' : '🏠'} ${esc(s.store.short)}</h3></div><span class="tag ${s.kind === 'lidl' ? 't-warn' : 't-ok'}">${s.kind === 'lidl' ? 'Spaziergang' : 'City-Center'}</span></div>
      <div class="mute small" style="margin:0 0 4px">${esc(hint)}</div>${s.items.map(row).join('')}</div>`;
  }).join('');
  return `<div class="lhead"><b>🧭 Einkaufsroute</b><span class="sub">${plan.count} Artikel · ${plan.stops.length} Stopp${plan.stops.length === 1 ? '' : 's'} · ca. ${plan.mins} Min${shortOn() && S.short.view !== 'all' ? ' · ⚡ Kurzliste' : ''}</span></div>${shortSeg()}
  ${favCard}${cards}
  <div class="mute small" style="text-align:center;margin:2px 0 10px">🏠 Danach nach Hause · ca. 3 Min · in jedem Laden: Obst &amp; Gemüse zuerst, Schweres zuletzt</div>
  
  <details class="card tight" style="margin-top:12px"><summary class="mute">Einstellungen &amp; Hinweise</summary>
    ${plan.lidlPossible || mode !== 'auto' ? SEG(mode, [['auto', 'Lidl: Automatisch'], ['ja', 'Lidl: Ja'], ['nein', 'Lidl: Nein']], 'setLidl') + `<div class="mute small" style="margin:-6px 4px 8px">${mode === 'auto' ? 'Lidl wird nur eingeplant, wenn du dort mindestens 1,50 € sparst.' : mode === 'ja' ? 'Lidl wird eingeplant, sobald es dort etwas Günstigeres für leichte Artikel gibt.' : 'Lidl wird nicht eingeplant.'}</div>` : ''}
    <div class="mute small" style="padding:4px 0 8px">Reihenfolge: Leichtes zuerst, Schweres und Sperriges (Wasser, Klopapier, Küchentücher, Waschmittel) zuletzt. Ob ein Artikel als „schwer“ gilt, änderst du beim Artikel nach dem Antippen.</div></details>`;
}
