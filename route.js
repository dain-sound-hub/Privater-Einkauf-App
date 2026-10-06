// Einkaufsroute: verteilt die Liste auf Läden. Leichte Sachen zuerst (Rucksack), schwere und sperrige zuletzt.
// Wird vor app.js geladen und nutzt dessen Funktionen erst beim Aufruf.
const HEAVY_RX = /wasser|kasten|kiste|getränk|bier|klopapier|toilettenpapier|küchen(rolle|tuch|tücher|krepp)|haushaltstuch|servietten|waschmittel|weichspüler|spülmittel|reiniger|katzenstreu|mehl\b|zucker\b|windel/i;
const itemHeavy = (it, p) => it.heavy !== undefined ? !!it.heavy : !!(p && p.heavy) || HEAVY_RX.test(it.name);

function planRoute() {
  const mode = S.set.lidl || 'auto';
  const rows = S.list.filter(i => !i.done).map(it => {
    const p = it.pid ? PROD(it.pid) : null, info = p ? productInfo(p) : null, heavy = itemHeavy(it, p);
    let nowA = info ? info.now.filter(o => o.store.tier === 'A') : [];
    if (heavy) nowA = nowA.slice().sort(rank); // bei Schwerem sind Großpackungen (z. B. Kiste) okay
    const lidl = info && !heavy ? info.now.find(o => o.store.tier === 'B') || null : null;
    return { it, p, info, heavy, nowA, near: nowA[0] || null, lidl, offer: null, storeId: null, note: '' };
  });

  // 1) Standardwahl im City-Center (mit deinem Lieblingsladen, falls bekannt)
  for (const r of rows) {
    const { p, nowA } = r;
    if (p && p.pref) {
      const po = nowA.find(o => o.store.id === p.pref);
      const other = nowA.find(o => o.store.id !== p.pref);
      if (po && !(other && other.up && po.up && other.up.v < po.up.v * 0.9)) { r.offer = po; r.storeId = p.pref; r.note = 'dein Standard'; }
      else if (other && other.pct != null && !other.dubious && other.pct >= 0.15) { r.offer = other; r.storeId = other.store.id; r.note = 'echtes Angebot'; }
      else { r.storeId = p.pref; r.note = 'dein Standard (kein besseres Angebot bekannt)'; }
    } else if (r.near) { r.offer = r.near; r.storeId = r.near.store.id; }
  }
  // 2) Lidl-Spaziergang: nur Leichtes, nur wenn es sich lohnt (oder du es willst)
  let lidlSave = 0, lidlItems = [];
  if (mode !== 'nein') {
    for (const r of rows) {
      if (!r.lidl) continue;
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
  const heavyRows = rows.filter(r => r.heavy && r.storeId && r.storeId !== 'lidl');
  const cnt = {}; heavyRows.forEach(r => cnt[r.storeId] = (cnt[r.storeId] || 0) + 1);
  const anchor = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || null;
  if (anchor) for (const r of heavyRows) {
    if (r.storeId === anchor || (r.p && r.p.pref)) continue;
    const ao = r.nowA.find(o => o.store.id === anchor);
    if (ao && (!r.offer || !r.offer.up || !ao.up || ao.up.v <= r.offer.up.v * 1.15)) { r.offer = ao; r.storeId = anchor; r.note = 'mit dem Schweren zusammen'; }
  }
  // 4) Stopps bilden und ordnen: erst Lidl, dann City-Center-Läden mit wenig Schwerem, schwerster Laden zuletzt
  const byStore = {};
  const put = (r, id) => { r.storeId = id; (byStore[id] = byStore[id] || []).push(r); };
  rows.filter(r => r.storeId).forEach(r => put(r, r.storeId));
  let centerIds = Object.keys(byStore).filter(id => id !== 'lidl');
  const hv = id => byStore[id].filter(r => r.heavy).length;
  centerIds.sort((a, b) => hv(a) - hv(b) || byStore[b].length - byStore[a].length);
  // 5) Artikel ohne bekannten Laden: Leichtes beim ersten Stopp, Schweres beim letzten (sonst Standardladen)
  const lonely = rows.filter(r => !r.storeId);
  for (const r of lonely) {
    r.note = 'kein Angebot bekannt, normal mitkaufen';
    const cat = r.p && r.p.cat, def = (cat === 'Haushalt & Wäsche') ? 'dm' : null;
    let id;
    if (r.heavy) id = centerIds[centerIds.length - 1] || (r.p && r.p.pref) || 'rewe';
    else id = def || centerIds[0] || 'netto';
    if (!byStore[id]) { byStore[id] = []; centerIds.push(id); centerIds.sort((a, b) => hv(a) - hv(b) || byStore[b].length - byStore[a].length); }
    put(r, id);
    centerIds.sort((a, b) => hv(a) - hv(b) || byStore[b].length - byStore[a].length);
  }
  const mk = id => { const items = byStore[id].slice().sort((a, b) => (a.heavy - b.heavy)); return { store: STORE(id), kind: id === 'lidl' ? 'lidl' : 'center', items, heavyCount: items.filter(x => x.heavy).length }; };
  const stops = [];
  if (byStore.lidl && byStore.lidl.length) stops.push(mk('lidl'));
  centerIds.forEach(id => byStore[id] && byStore[id].length && stops.push(mk(id)));
  const centerStops = stops.filter(s => s.kind === 'center').length;
  const mins = (stops[0] && stops[0].kind === 'lidl' ? 18 + 18 : 3) + Math.max(0, centerStops - 1) * 2 + 3; // Lidl hin, zurück ins City-Center, Wege zwischen Läden, nach Hause
  return { stops, mins, lidlSave, lidlUsed: !!(byStore.lidl && byStore.lidl.length), lidlPossible: rows.some(r => r.lidl), count: rows.length };
}

function routeText(plan) {
  return 'Einkaufsroute\n' + plan.stops.map((s, i) => `${i + 1}. ${s.store.name}${s.kind === 'lidl' ? ' (Spaziergang, Rucksack)' : ''}:\n` + s.items.map(x => `   - ${x.it.name}${x.it.qty ? ' ×' + x.it.qty : ''}${x.heavy ? ' (schwer)' : ''}`).join('\n')).join('\n') + '\nDanach nach Hause.';
}
function copyRoute() {
  const t = routeText(planRoute());
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Route kopiert'), () => { prompt('Route kopieren:', t); });
}
const setLidl = k => { S.set.lidl = k; save(); render(); };

function routeView() {
  const open = S.list.filter(i => !i.done);
  if (!open.length) return empty('🧭', 'Noch keine Route. Trag auf der Liste ein, was du brauchst.<br>Die App sagt dir dann, in welchem Laden du was kaufst und in welcher Reihenfolge.') + `<div style="text-align:center"><button class="btn pri" onclick="go('list')">Zur Liste</button></div>`;
  const plan = planRoute(), mode = S.set.lidl || 'auto';
  const stepLine = (s, i) => `<li><b>${esc(s.store.short)}</b>${s.kind === 'lidl' ? ' (Spaziergang)' : ''}: ${s.items.map(x => esc(x.it.name)).join(', ')}</li>`;
  const row = x => {
    const o = x.offer, id = x.it.id;
    return `<div class="item"><button class="chk" onclick="tick('${id}');" aria-label="abhaken"></button>${thumb(o && o.img, iconFor(x.p, x.it.name), 'sm')}
    <div class="grow"><div class="nm" style="cursor:default">${esc(x.it.name)}${x.it.qty ? ` <span class="mute">× ${esc(x.it.qty)}</span>` : ''}${x.heavy ? ' <span class="tag t-warn">🏋️ schwer</span>' : ''}</div>
    <div class="row small" style="margin-top:2px">${o ? `<b>${eur(o.price)}</b>${o.up ? `<span class="mute">${eur(o.up.v)}/${unitLbl(o.up.base)}</span>` : ''}${o.pct != null ? `<span class="pct ${o.dubious ? 'dub' : ''}">−${Math.round(o.pct * 100)} %</span>` : ''}` : `<span class="mute">${esc(x.note || 'normal kaufen')}</span>`}${o && x.note ? `<span class="mute">· ${esc(x.note)}</span>` : ''}</div>
    ${o ? `<div class="mute clamp">${esc(o.name.slice(0, 44))}${o.desc ? ' · ' + esc(o.desc.slice(0, 40)) : ''}</div>` : ''}</div></div>`;
  };
  const last = plan.stops.length - 1;
  const cards = plan.stops.map((s, i) => {
    let hint;
    if (s.kind === 'lidl') hint = `${s.store.walk} Min zu Fuß · nur Leichtes, passt in den Rucksack${plan.lidlSave > 0 ? ` · spart ca. ${eur(plan.lidlSave)}` : ''}`;
    else {
      hint = i === 0 ? '3 Min von zu Hause, im City-Center' : plan.stops[i - 1].kind === 'lidl' ? 'zurück im City-Center (ca. 18 Min vom Lidl)' : 'im City-Center, ca. 2 Min weiter';
      if (s.heavyCount) hint += i === last ? ' · Schweres zuletzt, danach direkt nach Hause' : ' · enthält Schweres (im Angebot, danach nur ca. 2 Min bis zum nächsten Laden)';
    }
    return `<div class="card stop"><div class="row sp nowrap"><div class="row nowrap"><span class="num">${i + 1}</span><h3>${s.kind === 'lidl' ? '🚶' : '🏠'} ${esc(s.store.name)}</h3></div><span class="tag ${s.kind === 'lidl' ? 't-warn' : 't-ok'}">${s.kind === 'lidl' ? 'Spaziergang' : 'City-Center'}</span></div>
      <div class="mute" style="margin:4px 0 2px">${esc(hint)}</div>${s.items.map(row).join('')}</div>`;
  }).join('');
  return `<div class="card help"><h3>🧭 Deine Einkaufsroute</h3>
    <div class="mute" style="margin:2px 0 8px">${plan.count} Artikel · ${plan.stops.length} Stopp${plan.stops.length === 1 ? '' : 's'} · ca. ${plan.mins} Min Laufweg (ohne Einkaufszeit, geschätzt)</div>
    <ol>${plan.stops.map(stepLine).join('')}<li>Danach nach Hause 🏠</li></ol>
    <div class="row"><button class="btn sm" onclick="copyRoute()">Route kopieren</button><button class="btn sm" onclick="go('list')">Liste ändern</button></div></div>
  ${plan.lidlPossible || mode !== 'auto' ? SEG(mode, [['auto', 'Lidl: Automatisch'], ['ja', 'Lidl: Ja'], ['nein', 'Lidl: Nein']], 'setLidl') + `<div class="mute" style="margin:-6px 4px 12px">${mode === 'auto' ? 'Lidl wird nur eingeplant, wenn du dort mindestens 1,50 € sparst.' : mode === 'ja' ? 'Lidl wird eingeplant, sobald es dort etwas Günstigeres für leichte Artikel gibt.' : 'Lidl wird nicht eingeplant.'}</div>` : ''}
  <div class="mute" style="margin:4px 4px 10px">Reihenfolge: Leichtes zuerst, Schweres und Sperriges (Wasser, Klopapier, Küchentücher, Waschmittel) zuletzt. Ob ein Artikel als „schwer" gilt, kannst du in der Liste beim Artikel ändern.</div>
  ${cards}
  <div class="card" style="text-align:center">🏠 <b>Fertig, nach Hause</b> <span class="mute">· ca. 3 Min</span></div>`;
}
