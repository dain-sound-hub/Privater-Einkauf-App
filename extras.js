// Zusatzfunktionen: Darstellung hell/dunkel, Artikel direkt in der Liste ergänzen (+), Artikel halten und in einen anderen Laden ziehen, Schnelleinkauf.
// Wird vor app.js geladen und nutzt dessen Funktionen erst beim Aufruf.

/* ---------- Darstellung: automatisch (wie das Handy), hell oder dunkel ---------- */
function applyTheme() {
  const t = (typeof S !== 'undefined' && S.set && S.set.theme) || 'auto', root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
  const m = document.querySelector('meta[name="color-scheme"]'); if (m) m.content = t === 'light' ? 'light' : t === 'dark' ? 'dark' : 'light dark';
}
function setTheme(k) { S.set.theme = ['light', 'dark'].includes(k) ? k : 'auto'; save(); applyTheme(); render(); }

/* ---------- Eine Zeile pro Artikel mit allem, was die Liste und die Kurzliste brauchen ---------- */
function rowInfo(it) {
  const p = it.pid ? PROD(it.pid) : null, info = p ? productInfo(p) : null;
  const b = info ? (it.store ? info.now.find(o => o.store.id === it.store) || null : (info.nearBest || info.best)) : null; // „heute bei …" zählt vor dem Standard
  const key = it.store || (b ? b.store.id : (prefOf(p, it.name) || { id: '_none' }).id);
  return { it, p, info, b, key, dec: info ? decision(info, it) : null };
}

/* ---------- Plus: Eingabefenster zum Ergänzen (Tippen oder Einsprechen) ---------- */
function iaOpen() { // Plus: Eingabefenster auf oder zu
  const d = $('#dock'); if (!d) return; if (d.classList.contains('open')) return dockClose();
  d.classList.add('open'); const f = $('#navfab'); if (f) f.classList.add('open'); dockPos(); const x = $('#ni'); if (x) { try { x.focus({ preventScroll: true }); } catch (e) { x.focus(); } } setTimeout(dockPos, 120); setTimeout(dockPos, 400);
}
let TT_T = 0;
function miniToast(t) { const el = $('#tt'); if (!el) return; el.textContent = t; el.classList.add('show'); clearTimeout(TT_T); TT_T = setTimeout(() => el.classList.remove('show'), 4500); }
function dockClose() { const d = $('#dock'); if (d) { d.classList.remove('open'); d.style.bottom = ''; d.classList.remove('kb'); } UI.recent = []; ['heard', 'recent'].forEach(i => { const x = $('#' + i); if (x) { x.hidden = true; x.innerHTML = ''; } }); const f = $('#navfab'); if (f) f.classList.remove('open'); if (typeof hideSug === 'function') hideSug(); if (typeof MIC !== 'undefined' && MIC) mic(); }
// Fenster sitzt fest direkt über der Tastatur (Seite dahinter bewegt sich nicht)
function dockPos() {
  const d = $('#dock'); if (!d) return; const v = window.visualViewport; let kb = 0;
  if (v && d.classList.contains('open')) kb = Math.max(0, innerHeight - (v.height + v.offsetTop));
  d.style.bottom = kb > 100 ? (kb + 10) + 'px' : ''; d.classList.toggle('kb', kb > 100);
}
if (window.visualViewport) { visualViewport.addEventListener('resize', dockPos); visualViewport.addEventListener('scroll', dockPos); }
const iaRow = () => '';
const plusBtn = () => '<div class="fabrow"><button class="plus2" onclick="iaOpen()" aria-label="Artikel hinzufügen" title="Artikel hinzufügen">+</button></div>';
function planKeys(all) { const pl = planRoute(all), m = {}; pl.stops.forEach(s => s.items.forEach(x => { m[x.it.id] = s.store.id; })); pl.favs.forEach(x => { m[x.it.id] = 'fav'; }); return m; } // in welchem Laden steht der Artikel (wie in der Route)
function listHead(title, sub) {
  const short = shortOn() ? '' : (S.list.filter(i => !i.done).length >= 2 ? '<button class="klnk" onclick="shortOpen()" aria-label="Schnelleinkauf starten" title="Schnelleinkauf: nur einen Teil der Liste zeigen">⚡ Schnelleinkauf</button>' : '');
  return `<div class="lhead"><b>${title}</b><span class="lact">${short}</span><span class="sub">${sub}</span></div>`;
}

/* ---------- Halten und ziehen: die Karte folgt dem Finger, Läden leuchten, Einfügemarke zeigt die Stelle ---------- */
const DRAG = { id: null, on: false, timer: 0, x: 0, y: 0, cx: 0, cy: 0, ox: 0, oy: 0, t: 0, over: null, from: null, idx: -1, scroller: 0 };
const dragPt = e => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
function dragStart(e) {
  if (DRAG.on || (e.type === 'mousedown' && e.button !== 0)) return;
  const row = e.target.closest && e.target.closest('.crow[data-id]:not(.asking)'); // Einträge mit offener Frage lassen sich nicht ziehen
  if (!row || row.classList.contains('done') || e.target.closest('button,a,input,label,[role=button]')) return;
  const pt = dragPt(e), r = row.getBoundingClientRect();
  Object.assign(DRAG, { trusted: e.isTrusted, id: row.dataset.id, x: pt.clientX, y: pt.clientY, cx: pt.clientX, cy: pt.clientY, ox: pt.clientX - r.left, oy: pt.clientY - r.top });
  clearTimeout(DRAG.timer); DRAG.timer = setTimeout(dragBegin, 450);
}
function dragBegin() {
  const it = byId(DRAG.id), row = document.getElementById('it-' + DRAG.id); if (!it || !row) return dragReset();
  DRAG.on = true; DRAG.over = null; DRAG.idx = -1; DRAG.from = planKeys()[DRAG.id] || rowInfo(it).key;
  try { if (DRAG.trusted && navigator.vibrate) navigator.vibrate(25); } catch (e) { }
  document.body.classList.add('dragmode');
  const r = row.getBoundingClientRect(), g = row.cloneNode(true); // die Karte hebt ab und folgt dem Finger
  g.id = 'dghost'; g.removeAttribute('data-id'); g.removeAttribute('onclick'); g.style.width = r.width + 'px'; document.body.appendChild(g);
  row.classList.add('dragging');
  const dz = document.createElement('div'); dz.id = 'dz';
  dz.innerHTML = `<div class="dzh">In einen Laden ziehen und loslassen:</div><div class="dzs">${['rewe', 'netto', 'aldi', 'dm', 'lidl'].map(s => `<div class="dzc" data-store="${s}" style="--sc:${storeColor(s)}">${esc(STORE(s).short)}</div>`).join('')}<div class="dzc" data-store="fav" style="--sc:#e8a317">★ Im Blick</div><div class="dzc" data-store="auto">Automatisch</div></div>`;
  document.body.appendChild(dz);
  dragPos(DRAG.cx, DRAG.cy); DRAG.scroller = setInterval(dragScroll, 16);
}
function dragPos(x, y) {
  DRAG.cx = x; DRAG.cy = y;
  const g = document.getElementById('dghost'); if (g) { g.style.left = (x - DRAG.ox) + 'px'; g.style.top = (y - DRAG.oy) + 'px'; }
  const el = document.elementFromPoint(x, y), tgt = el && el.closest ? el.closest('[data-store]') : null;
  DRAG.over = tgt ? tgt.dataset.store : null;
  document.querySelectorAll('.dropon').forEach(n => n.classList.remove('dropon'));
  document.querySelectorAll('#dz .dzc').forEach(c => c.classList.toggle('hot', c.dataset.store === DRAG.over));
  if (DRAG.over && DRAG.over !== 'auto') document.querySelectorAll('#view [data-store="' + DRAG.over + '"]').forEach(n => n.classList.add('dropon'));
  // im selben Laden: Einfügemarke zeigt, wo der Artikel landet
  let line = document.getElementById('dline'); DRAG.idx = -1;
  const card = DRAG.over && DRAG.over === DRAG.from ? document.querySelector('#view .card[data-store="' + DRAG.over + '"]') : null;
  if (card) {
    const rows = [...card.querySelectorAll('.crow[data-id]')].filter(n => n.dataset.id !== DRAG.id);
    DRAG.idx = rows.filter(n => { const b = n.getBoundingClientRect(); return b.top + b.height / 2 < y; }).length;
    const ref = rows[DRAG.idx] ? rows[DRAG.idx].getBoundingClientRect().top : (rows.length ? rows[rows.length - 1].getBoundingClientRect().bottom : null);
    if (ref != null) { if (!line) { line = document.createElement('div'); line.id = 'dline'; document.body.appendChild(line); } const cb = card.getBoundingClientRect(); line.style.top = (ref - 2) + 'px'; line.style.left = (cb.left + 8) + 'px'; line.style.width = (cb.width - 16) + 'px'; return; }
  }
  if (line) line.remove();
}
function dragScroll() { // am oberen oder unteren Rand weiterscrollen
  if (!DRAG.on) return; const y = DRAG.cy, H = innerHeight; let d = 0;
  if (y < 150) d = -Math.round((150 - Math.max(y, 0)) / 8) - 3; else if (y > H - 190) d = Math.round((y - (H - 190)) / 8) + 3;
  if (d) { scrollBy(0, d); dragPos(DRAG.cx, DRAG.cy); }
}
function dragMove(e) {
  const pt = dragPt(e);
  if (!DRAG.on) { if (DRAG.id && Math.hypot(pt.clientX - DRAG.x, pt.clientY - DRAG.y) > 9) dragReset(); return; } // Finger bewegt sich vor dem Halten = normales Scrollen
  if (e.cancelable) e.preventDefault(); dragPos(pt.clientX, pt.clientY);
}
function dragEnd() {
  clearTimeout(DRAG.timer); if (!DRAG.on) { DRAG.id = null; return; }
  const id = DRAG.id, to = DRAG.over, from = DRAG.from, idx = DRAG.idx; DRAG.t = Date.now(); dragReset();
  if (!to) return feedbackText('Zum Verschieben auf einen Laden ziehen und dort loslassen.');
  if (to === from) { if (idx >= 0) reorderItem(id, from, idx); return; }
  moveItem(id, to);
}
function dragReset() {
  clearTimeout(DRAG.timer); clearInterval(DRAG.scroller); DRAG.on = false; DRAG.id = null; DRAG.over = null; DRAG.idx = -1; document.body.classList.remove('dragmode');
  ['dz', 'dghost', 'dline'].forEach(i => { const e = document.getElementById(i); if (e) e.remove(); });
  document.querySelectorAll('.crow.dragging').forEach(r => r.classList.remove('dragging'));
  document.querySelectorAll('.dropon').forEach(n => n.classList.remove('dropon'));
}
const dragDone = () => { if (!S.set.noDragTip) { S.set.noDragTip = true; } };
function moveItem(id, store) { // in einen anderen Laden (nur heute); „auto“ hebt die Verschiebung auf
  const it = byId(id); if (!it) return;
  UI.undoMove = { prev: [{ id, store: it.store, pos: it.pos, fav: it.fav }] }; UI.open.delete(id);
  if (store === 'fav') { if (it.fav) return; it.fav = true; delete it.store; delete it.pos; } else if (store === 'auto') { delete it.store; delete it.fav; } else if (STORES.some(s => s.id === store)) { it.store = store; delete it.pos; delete it.fav; } else return;
  dragDone(); save(); render();
  feedbackText(store === 'fav' ? `„${esc(it.name)}“ ist jetzt <b>★ Im Blick</b>, ganz oben ohne Laden. <button class="lnk" onclick="undoMove()">Rückgängig</button>` : store === 'auto' ? `„${esc(it.name)}“ wird wieder automatisch einsortiert. <button class="lnk" onclick="undoMove()">Rückgängig</button>` : `„${esc(it.name)}“ kaufst du heute bei <b>${esc(STORE(store).short)}</b>. <button class="lnk" onclick="undoMove()">Rückgängig</button>`);
}
function reorderItem(id, key, idx) { // innerhalb desselben Ladens an eine andere Stelle
  const it = byId(id); if (!it) return;
  const ids = [...document.querySelectorAll('#view .card[data-store="' + key + '"] .crow[data-id]')].map(n => n.dataset.id).filter(x => x !== id);
  UI.undoMove = { prev: [id, ...ids].map(x => ({ id: x, store: (byId(x) || {}).store, pos: (byId(x) || {}).pos, fav: (byId(x) || {}).fav })) };
  UI.open.delete(id); ids.splice(Math.min(idx, ids.length), 0, id); ids.forEach((x, k) => { const t = byId(x); if (t) t.pos = k + 1; });
  dragDone(); save(); render(); feedbackText(`„${esc(it.name)}“ verschoben. <button class="lnk" onclick="undoMove()">Rückgängig</button>`);
}
function undoMove() {
  const u = UI.undoMove; if (!u) return; UI.undoMove = null;
  u.prev.forEach(p => { UI.open.delete(p.id); const t = byId(p.id); if (!t) return; if (p.store) t.store = p.store; else delete t.store; if (p.pos != null) t.pos = p.pos; else delete t.pos; if (p.fav) t.fav = true; else delete t.fav; });
  save(); render(); feedbackText('✓ Rückgängig gemacht.');
}
document.addEventListener('touchstart', dragStart, { passive: true });
document.addEventListener('touchmove', dragMove, { passive: false });
document.addEventListener('touchend', dragEnd);
document.addEventListener('touchcancel', dragReset);
document.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', dragMove);
document.addEventListener('mouseup', dragEnd);
document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.crow')) e.preventDefault(); });

/* ---------- Schnelleinkauf: eine Kurzliste neben der Hauptliste, hin- und herschaltbar ---------- */
// S.short = { on: Kurzliste gibt es, view: 'short' | 'all', later: Artikel, die NICHT in der Kurzliste sind, known: bekannte Artikel }
const shortOn = () => !!(S.short && S.short.on);
const hiddenShort = it => shortOn() && S.short.view !== 'all' && S.short.later.includes(it.id); // in der Kurzliste-Ansicht ausgeblendet
function shortSync() { // neue Artikel: in der Kurzliste-Ansicht gehören sie dazu, in der Gesamtansicht nicht
  if (!shortOn()) return; const k = new Set(S.short.known || []); let ch = false;
  S.list.forEach(i => { if (!k.has(i.id)) { if (S.short.view === 'all') S.short.later.push(i.id); k.add(i.id); ch = true; } });
  if (ch) { S.short.known = S.list.map(i => i.id); save(); }
}
const shortMembers = () => S.list.filter(i => !S.short.later.includes(i.id));
function shortSeg() {
  if (!shortOn()) return '';
  const act = S.short.view !== 'all', n = shortMembers().filter(i => !i.done).length, m = S.list.filter(i => !i.done).length;
  return `<div class="kseg" role="group" aria-label="Liste wählen"><button class="${act ? 'on' : ''}" onclick="shortView('short')">⚡ Kurzliste <small>${n}</small></button><button class="${act ? '' : 'on'}" onclick="shortView('all')">Alle <small>${m}</small></button></div><div class="kdel"><button onclick="shortDelete()">🗑 Kurzliste löschen</button></div>`;
}
function shortDelete() { if (confirm('Kurzliste löschen?\n\nAlle Artikel bleiben in der Hauptliste.')) shortEnd(); }
function shortView(v) { if (!shortOn()) return; S.short.view = v === 'all' ? 'all' : 'short'; save(); render(); }
function shortOpen() { UI.shortSel = new Set(); shortSheet(); }
function shortSheet() {
  const old = document.querySelector('#sheetbox .sbox'), sc = old ? old.scrollTop : 0;
  const pk = planKeys(true), rows = S.list.filter(i => !i.done).map(i => ({ ...rowInfo(i), key: pk[i.id] || '_none' })), sel = UI.shortSel || new Set();
  const keys = [...new Set(rows.map(r => r.key))].filter(k => k !== '_none');
  $('#sheetbox').innerHTML = `<div class="row sp"><h3>⚡ Schnelleinkauf</h3><button class="ico" onclick="closeSheet()" aria-label="Schließen">✕</button></div>
    <div class="mute small">Was brauchst du jetzt? Der Rest wartet in der Hauptliste, bis du fertig bist.</div>
    <div class="chips" style="margin:8px 0">${keys.map(k => `<button class="chip" onclick="shortStore('${k}')">Alles bei ${esc(STORE(k).short)} (${rows.filter(r => r.key === k).length})</button>`).join('')}<button class="chip" onclick="UI.shortSel=new Set(S.list.filter(i=>!i.done).map(i=>i.id));shortSheet()">Alle</button><button class="chip" onclick="UI.shortSel=new Set();shortSheet()">Keine</button></div>
    <div class="sbox" style="max-height:40vh;overflow:auto">${rows.map(r => `<label class="crow" style="cursor:pointer"><input type="checkbox" ${sel.has(r.it.id) ? 'checked' : ''} onchange="shortTog('${r.it.id}')" style="width:22px;height:22px;flex:none"><span class="em" aria-hidden="true">${iconFor(r.p, r.it.name)}</span><span class="nm">${esc(r.it.name)}</span><span class="mute small">${r.key === '_none' ? '' : esc(STORE(r.key).short)}</span></label>`).join('')}</div>
    <div class="row" style="margin-top:10px"><button class="btn pri" onclick="shortStart()">⚡ Kurzliste starten (${sel.size})</button></div>`;
  $('#sheet').hidden = false; const nb = document.querySelector('#sheetbox .sbox'); if (nb) nb.scrollTop = sc;
}
function shortTog(id) { const s = UI.shortSel = UI.shortSel || new Set(); s.has(id) ? s.delete(id) : s.add(id); shortSheet(); }
function shortStore(k) { const s = UI.shortSel = UI.shortSel || new Set(); const pk = planKeys(true); S.list.filter(i => !i.done && pk[i.id] === k).forEach(i => s.add(i.id)); shortSheet(); }
function shortStart() {
  const sel = UI.shortSel || new Set(); if (!sel.size) return feedbackText('Wähle zuerst aus, was du jetzt brauchst.', true);
  S.short = { on: true, view: 'short', later: S.list.filter(i => !i.done && !sel.has(i.id)).map(i => i.id), known: S.list.map(i => i.id) }; save(); closeSheet(); render();
  toast('⚡ Schnelleinkauf: ' + sel.size + ' Artikel. Der Rest wartet in der Hauptliste.');
}
function shortEnd() { S.short = { on: false, view: 'short', later: [], known: [] }; save(); render(); toast('Kurzliste gelöscht. Alles steht in der Hauptliste.'); }
function shortCheckEnd() { // alles Gewählte im Wagen oder gelöscht: Schnelleinkauf ist fertig
  if (shortOn() && !S.list.some(i => !i.done && !S.short.later.includes(i.id))) { S.short = { on: false, view: 'short', later: [], known: [] }; toast('⚡ Kurzliste erledigt. Alles steht wieder in der Hauptliste.'); } // erst wenn alles aus der Kurzliste erledigt ist
}

/* ---------- Löschen: erst nachfragen, danach mit Rückgängig ---------- */
function askDel(id) {
  const it = byId(id), sb = $('#sheetbox'), sh = $('#sheet'); if (!it || !sb || !sh) return;
  sb.innerHTML = `<h3 style="margin:0 0 4px">„${esc(it.name)}“ entfernen?</h3><div class="mute" style="margin-bottom:14px">Der Artikel verschwindet von deiner Liste.</div><div class="row" style="gap:10px"><button class="btn" style="flex:1" onclick="closeSheet()">Abbrechen</button><button class="btn pri" style="flex:1" onclick="closeSheet();delUndo('${id}')">Ja, entfernen</button></div>`;
  sh.hidden = false;
}
/* ---------- Löschen mit Rückgängig ---------- */
function delUndo(id) {
  const i = S.list.findIndex(x => x.id === id); if (i < 0) return;
  const it = S.list[i]; UI.undo = { it, i }; S.list.splice(i, 1); shortCheckEnd(); save(); render();
  feedbackText('„' + esc(it.name) + '“ entfernt. <button class="lnk" onclick="undoDel()">Rückgängig</button>');
}
function undoDel() { const u = UI.undo; if (!u) return; UI.undo = null; S.list.splice(Math.min(u.i, S.list.length), 0, u.it); save(); render(); feedbackText('✓ Wieder da.'); }

/* ---------- Zurück-Taste (Android): erst Fenster zu, dann ein Menü zurück, dann zur Liste, dann beenden ---------- */
let BACK_T = 0;
function backAction() { // true = etwas wurde zurückgenommen
  if (DRAG.on) { dragReset(); return true; }
  const sh = $('#sheet'); if (sh && !sh.hidden) { closeSheet(); return true; }
  const dk = $('#dock'); if (dk && dk.classList.contains('open')) { dockClose(); return true; }
  if (cur === 'bon') {
    if (BON.detail) { BON.detail = null; render(); return true; }
    if (BON.parsed) { if (BON.cur) bonClose(); else { BON.parsed = null; render(); } return true; }
    if (BON.addTo) { BON.addTo = null; BON.photos = []; render(); return true; }
    if (BON.done) { BON.done = null; render(); return true; }
  }
  if (cur === 'offers' && UI.store && UI.store !== 'all') { UI.store = 'all'; render(); return true; }
  while (NAV.length && NAV[NAV.length - 1] === cur) NAV.pop();
  if (NAV.length) { go(NAV.pop(), true); return true; } // zurück zu der Seite, auf der du vorher warst
  if (cur !== 'list') { go('list', true); return true; }
  return false;
}
function backInit() {
  try { history.replaceState({ einkauf: 0 }, '', location.href); history.pushState({ einkauf: 1 }, '', location.href); } catch (err) { return; }
  window.addEventListener('popstate', () => {
    if (backAction()) { history.pushState({ einkauf: 1 }, '', location.href); return; }
    if (Date.now() - BACK_T < 2500) { history.back(); return; } // zweites Mal kurz hintereinander: App verlassen
    BACK_T = Date.now(); miniToast('Noch einmal „Zurück“ zum Beenden'); history.pushState({ einkauf: 1 }, '', location.href);
  });
}
backInit();

/* ---------- Kassenbon-Knopf: schwebt rechts über der Menüleiste, nur bei Liste und Route ---------- */
function bonFabSync() { const f = document.getElementById('bonfab'); if (f) f.hidden = !(cur === 'list' || cur === 'route'); }
