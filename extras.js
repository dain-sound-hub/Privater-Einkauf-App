// Zusatzfunktionen: Darstellung hell/dunkel, Artikel direkt in der Liste ergänzen (+), Artikel halten und in einen anderen Laden ziehen, Kurzeinkauf.
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

/* ---------- Plus: neuen Artikel direkt in der Liste eintippen ---------- */
function iaOpen() { UI.adding = true; render(); const e = $('#ia'); if (e) e.focus(); }
function iaClose() { UI.adding = false; render(); }
function iaSubmit() { const e = $('#ia'), v = e ? e.value.trim() : ''; if (!v) return iaClose(); addMany(v); const e2 = $('#ia'); if (e2) e2.focus(); }
const iaRow = () => UI.adding ? `<div class="card tight main addrow"><div class="crow add"><span class="em" aria-hidden="true">✍️</span><input id="ia" class="iain" type="text" enterkeyhint="done" autocomplete="off" autocapitalize="sentences" placeholder="Neuer Artikel, z. B. 2 Milch" aria-label="Neuer Artikel" onkeydown="if(event.key==='Enter'){event.preventDefault();iaSubmit()}"><button class="chk ok" onclick="iaSubmit()" aria-label="Hinzufügen">✓</button></div><div class="mute small" style="padding:0 2px 8px">Mehrere mit Komma. Die App sortiert es in den passenden Laden ein. <button class="lnk" onclick="iaClose()">Schließen</button></div></div>` : '';
function listHead(title, sub) {
  const short = shortOn() ? '' : (S.list.filter(i => !i.done).length >= 2 ? '<button class="klnk" onclick="shortOpen()" aria-label="Kurzeinkauf starten" title="Kurzeinkauf: nur einen Teil der Liste zeigen">⚡ Kurz</button>' : '');
  return `<div class="lhead"><b>${title}</b><span class="lact">${short}<button class="plus" onclick="iaOpen()" aria-label="Artikel hinzufügen">+</button></span><span class="sub">${sub}</span></div>`;
}

/* ---------- Halten und ziehen: Artikel heute in einem anderen Laden kaufen ---------- */
const DRAG = { id: null, on: false, timer: 0, x: 0, y: 0, t: 0, over: null };
const dragPt = e => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
function dragStart(e) {
  if (DRAG.on || (e.type === 'mousedown' && e.button !== 0)) return;
  const row = e.target.closest && e.target.closest('.crow[data-id]');
  if (!row || e.target.closest('button,a,input,label,[role=button]')) return;
  const pt = dragPt(e); Object.assign(DRAG, { id: row.dataset.id, x: pt.clientX, y: pt.clientY });
  clearTimeout(DRAG.timer); DRAG.timer = setTimeout(dragBegin, 450);
}
function dragBegin() {
  const it = byId(DRAG.id); if (!it) return dragReset();
  DRAG.on = true; DRAG.over = null; try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(25); } catch (e) { }
  document.body.classList.add('dragmode');
  const row = document.getElementById('it-' + DRAG.id); if (row) row.classList.add('dragging');
  const dz = document.createElement('div'); dz.id = 'dz';
  dz.innerHTML = `<div class="dzh">„${esc(it.name)}“ heute kaufen bei … (loslassen)</div><div class="dzs">${['rewe', 'netto', 'aldi', 'dm', 'lidl'].map(s => `<div class="dzc" data-store="${s}" style="--sc:${storeColor(s)}">${esc(STORE(s).short)}</div>`).join('')}<div class="dzc" data-store="auto">Automatisch</div></div>`;
  document.body.appendChild(dz);
  const g = document.createElement('div'); g.id = 'dg'; g.textContent = it.name; document.body.appendChild(g); dragPos(DRAG.x, DRAG.y);
}
function dragPos(x, y) {
  const g = document.getElementById('dg'); if (g) { g.style.left = x + 'px'; g.style.top = y + 'px'; }
  const el = document.elementFromPoint(x, y), tgt = el && el.closest ? el.closest('[data-store]') : null;
  DRAG.over = tgt ? tgt.dataset.store : null;
  document.querySelectorAll('#dz .dzc').forEach(c => c.classList.toggle('hot', c.dataset.store === DRAG.over));
}
function dragMove(e) {
  const pt = dragPt(e);
  if (!DRAG.on) { if (DRAG.id && Math.hypot(pt.clientX - DRAG.x, pt.clientY - DRAG.y) > 9) dragReset(); return; } // Finger bewegt sich vor dem Halten = normales Scrollen
  if (e.cancelable) e.preventDefault(); dragPos(pt.clientX, pt.clientY);
}
function dragEnd() {
  clearTimeout(DRAG.timer); if (!DRAG.on) { DRAG.id = null; return; }
  const id = DRAG.id, to = DRAG.over; DRAG.t = Date.now(); dragReset(); if (to) moveItem(id, to);
}
function dragReset() {
  clearTimeout(DRAG.timer); DRAG.on = false; DRAG.id = null; DRAG.over = null; document.body.classList.remove('dragmode');
  ['dz', 'dg'].forEach(i => { const e = document.getElementById(i); if (e) e.remove(); });
  document.querySelectorAll('.crow.dragging').forEach(r => r.classList.remove('dragging'));
}
function moveItem(id, store) {
  const it = byId(id); if (!it) return;
  if (store === 'auto') delete it.store; else if (STORES.some(s => s.id === store)) it.store = store; else return;
  save(); render(); toast(store === 'auto' ? `„${it.name}“ wird wieder automatisch einsortiert.` : `„${it.name}“ kaufst du heute bei ${STORE(store).short}.`);
}
document.addEventListener('touchstart', dragStart, { passive: true });
document.addEventListener('touchmove', dragMove, { passive: false });
document.addEventListener('touchend', dragEnd);
document.addEventListener('touchcancel', dragReset);
document.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', dragMove);
document.addEventListener('mouseup', dragEnd);
document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.crow')) e.preventDefault(); });

/* ---------- Kurzeinkauf: nur einen Teil der Liste zeigen, bis er erledigt ist ---------- */
const shortOn = () => !!(S.short && S.short.on);
const hiddenShort = it => shortOn() && S.short.later.includes(it.id);
function shortOpen() { UI.shortSel = new Set(); shortSheet(); }
function shortSheet() {
  const old = document.querySelector('#sheetbox .sbox'), sc = old ? old.scrollTop : 0;
  const rows = S.list.filter(i => !i.done).map(rowInfo), sel = UI.shortSel || new Set();
  const keys = [...new Set(rows.map(r => r.key))].filter(k => k !== '_none');
  $('#sheetbox').innerHTML = `<div class="row sp"><h3>⚡ Kurzeinkauf</h3><button class="ico" onclick="closeSheet()" aria-label="Schließen">✕</button></div>
    <div class="mute small">Was brauchst du jetzt? Der Rest wartet in der Hauptliste, bis du fertig bist.</div>
    <div class="chips" style="margin:8px 0">${keys.map(k => `<button class="chip" onclick="shortStore('${k}')">Alles bei ${esc(STORE(k).short)} (${rows.filter(r => r.key === k).length})</button>`).join('')}<button class="chip" onclick="UI.shortSel=new Set(S.list.filter(i=>!i.done).map(i=>i.id));shortSheet()">Alle</button><button class="chip" onclick="UI.shortSel=new Set();shortSheet()">Keine</button></div>
    <div class="sbox" style="max-height:40vh;overflow:auto">${rows.map(r => `<label class="crow" style="cursor:pointer"><input type="checkbox" ${sel.has(r.it.id) ? 'checked' : ''} onchange="shortTog('${r.it.id}')" style="width:22px;height:22px;flex:none"><span class="em" aria-hidden="true">${iconFor(r.p, r.it.name)}</span><span class="nm">${esc(r.it.name)}</span><span class="mute small">${r.key === '_none' ? '' : esc(STORE(r.key).short)}</span></label>`).join('')}</div>
    <div class="row" style="margin-top:10px"><button class="btn pri" onclick="shortStart()">⚡ Kurzliste starten (${sel.size})</button></div>`;
  $('#sheet').hidden = false; const nb = document.querySelector('#sheetbox .sbox'); if (nb) nb.scrollTop = sc;
}
function shortTog(id) { const s = UI.shortSel = UI.shortSel || new Set(); s.has(id) ? s.delete(id) : s.add(id); shortSheet(); }
function shortStore(k) { const s = UI.shortSel = UI.shortSel || new Set(); S.list.filter(i => !i.done && rowInfo(i).key === k).forEach(i => s.add(i.id)); shortSheet(); }
function shortStart() {
  const sel = UI.shortSel || new Set(); if (!sel.size) return feedbackText('Wähle zuerst aus, was du jetzt brauchst.', true);
  S.short = { on: true, later: S.list.filter(i => !i.done && !sel.has(i.id)).map(i => i.id) }; save(); closeSheet(); render();
  toast('⚡ Kurzeinkauf: ' + sel.size + ' Artikel. Der Rest wartet in der Hauptliste.');
}
function shortEnd() { S.short = { on: false, later: [] }; save(); render(); }
function shortCheckEnd() { // alles Gewählte im Wagen oder gelöscht: Kurzeinkauf ist fertig
  if (shortOn() && !S.list.some(i => !i.done && !hiddenShort(i))) { S.short = { on: false, later: [] }; toast('⚡ Kurzeinkauf fertig. Die übrigen Artikel sind wieder in der Liste.'); }
}

/* ---------- Löschen mit Rückgängig ---------- */
function delUndo(id) {
  const i = S.list.findIndex(x => x.id === id); if (i < 0) return;
  const it = S.list[i]; UI.undo = { it, i }; S.list.splice(i, 1); shortCheckEnd(); save(); render();
  feedbackText('„' + esc(it.name) + '“ entfernt. <button class="lnk" onclick="undoDel()">Rückgängig</button>');
}
function undoDel() { const u = UI.undo; if (!u) return; UI.undo = null; S.list.splice(Math.min(u.i, S.list.length), 0, u.it); save(); render(); feedbackText('✓ Wieder da.'); }
