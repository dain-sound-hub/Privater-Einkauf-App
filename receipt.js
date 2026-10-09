// Kassenbon: Text aus dem Bon lesen (Laden, Datum, Positionen), Produkten zuordnen, Einkaufsgewohnheiten lernen, Spartipps.
// Wird vor app.js geladen und nutzt dessen Funktionen erst beim Aufruf. Bon-Text bleibt auf dem Gerät; nur beim optionalen Foto-Lesen geht das Foto an Anthropic (eigener Schlüssel).

/* ---------- Bon lesen ---------- */
const BON_STORES = [[/\brewe\b/i, 'rewe'], [/netto\s*marken|\bnetto\b/i, 'netto'], [/\bdm[\s-]*drogerie|\bdm\b/i, 'dm'], [/\blidl\b/i, 'lidl'], [/\baldi\b/i, 'aldi'], [/\bkaufland\b/i, 'kaufland'], [/\bpenny\b/i, 'penny'], [/\bedeka\b/i, 'edeka'], [/\bselgros\b/i, 'selgros'], [/\bmetro\b/i, 'metro'], [/handelshof/i, 'handelshof'], [/rossmann/i, 'rossmann'], [/media\s*markt/i, 'mediamarkt']];
const BON_NAMES = { kaufland: 'Kaufland', penny: 'Penny', edeka: 'EDEKA', rossmann: 'Rossmann', mediamarkt: 'MediaMarkt', unbekannt: 'Unbekannt' };
const bonStoreName = id => (STORES.find(s => s.id === id) || {}).short || BON_NAMES[id] || id;
const SKIP_RX = /^(?:betrag|zwischensumme|mwst|ust|steuer|netto-?warenwert|nettowert|brutto|incl|inkl|davon|bar|ec|girocard|maestro|visa|mastercard|karte|kartenzahlung|contactless|zahlung|r(?:ü|ue)ckgeld|zur(?:ü|ue)ck|gegeben|geg|bonus|payback|punkte|filiale|kasse|bediener|kassierer|beleg|bon|tel|telefon|datum|uhrzeit|trace|terminal|genehmigung|vielen dank|danke|www|http|tse|seriennummer|kundenbeleg|ihr einkauf|ersparnis|anzahl|artikel|eur|uid|ust-?id|steuernr|plz)\b/i;
const TOTAL_RX = /^\W*(summe|gesamt(?:betrag)?|total|zu zahlen|zahlbetrag)\b.*?(-?\d{1,5}[.,]\d{2})\s*(?:€|eur)?\W*$/i;
const LINE_RX = /^(.*?)\s+(-?\d{1,4}[.,]\d{2})\s*(?:€|EUR)?(?:\s*([A-Za-z]|\d))?(?:\s*\*)?\s*$/;
const QTY_RX = /^(\d+)\s*(?:x|×|\*|stk\.?\s*x)\s*(\d{1,4}[.,]\d{2})(?:\s*(?:€|eur))?(?:\s+(\d{1,4}[.,]\d{2}))?\s*[A-Za-z*]?$/i;
const WEIGHT_RX = /^(\d+[.,]\d{1,3})\s*kg\s*(?:x|×)\s*(\d{1,4}[.,]\d{2})/i;
const num = s => parseFloat(String(s).replace(',', '.'));
function detectStore(t) { const h = BON_STORES.find(([rx]) => rx.test(t)); return h ? h[1] : null; }
function detectDate(lines) {
  const cand = [...lines.filter(l => /datum|date/i.test(l)), ...lines];
  for (const l of cand) {
    let m = l.match(/(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})\b/);
    if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3], mo = +m[2], d = +m[1]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
    m = l.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  }
  return null;
}
function cleanBonName(s) {
  let n = String(s).replace(/^\d{5,}\s+/, '').replace(/\s+/g, ' ').trim();
  if (n && n === n.toUpperCase()) n = n.toLowerCase().replace(/(^|[\s\-/])([a-zäöüß])/g, (_, a, b) => a + b.toUpperCase());
  return n.slice(0, 70);
}
function packOf(name) { // Packungsgröße aus dem Namen: 1L, 500g, 6x1,5L, 8er, 8 Rollen, 20WL
  let m;
  if ((m = name.match(/(\d+)\s?[x×]\s?(\d+[.,]?\d*)\s?(ml|l|g|kg)\b/i))) { const a = num(m[2]) * +m[1], u = m[3].toLowerCase(); return u === 'l' ? { base: 'l', amount: a } : u === 'ml' ? { base: 'l', amount: a / 1000 } : u === 'g' ? { base: 'kg', amount: a / 1000 } : { base: 'kg', amount: a }; }
  if ((m = name.match(/(\d+[.,]?\d*)\s?(kg|g|ml|l)\b/i))) { const a = num(m[1]), u = m[2].toLowerCase(); return u === 'l' ? { base: 'l', amount: a } : u === 'ml' ? { base: 'l', amount: a / 1000 } : u === 'g' ? { base: 'kg', amount: a / 1000 } : { base: 'kg', amount: a }; }
  if ((m = name.match(/(\d+)\s?(?:er\b|rollen?\b|stk\b|st\b|stück\b|wl\b|tabs\b|beutel\b)/i))) return { base: 'st', amount: +m[1] };
  return null;
}
function classifyBon(name, price) {
  const pf = /pfand|leergut|(?:einweg|mehrweg)[\s-]*(?:flasche|dose|kasten|pfand)/i.test(name);
  if (price < 0 || /rabatt|coupon|gutschein|preisvorteil|aktionspreis|treue/i.test(name)) return pf ? 'pfand' : 'discount';
  if (pf) return 'pfand';
  if (/tragetasche|tragetüte|papiertüte|plastiktüte|einkaufstasche/i.test(name)) return 'bag';
  return 'item';
}
const cleanTranscript = s => String(s || '').replace(/\r/g, '').replace(/```[a-z]*/gi, '').replace(/\*\*|__/g, '').replace(/\|/g, ' ').replace(/^[ \t]*[-•]\s+/gm, '');
function parseReceipt(text) {
  const lines = cleanTranscript(text).split('\n').map(s => s.replace(/[ \t]+/g, ' ').trim().slice(0, 160).replace(/(?:^|(?<=\s))(?:[A-Za-zÄÖÜäöü] ){2,}[A-Za-zÄÖÜäöü](?=\s|$)/g, m => m.replace(/ /g, ''))).filter(Boolean).slice(0, 400);
  const out = { store: detectStore(lines.slice(0, 14).join('\n')) || detectStore(lines.join('\n')), date: detectDate(lines), total: null, count: null, taxMap: {}, items: [], skipped: [] };
  let pending = null, last = null;
  const push = (name, qty, price, unit, tax) => { const it = { raw: name, name: cleanBonName(name), qty, price, unit: unit || null, tax: tax && /[A-Za-z]/.test(tax) ? tax.toUpperCase() : null, kind: classifyBon(name, price), include: true, pid: null, how: '' }; it.pack = packOf(it.name); out.items.push(it); last = it; pending = null; };
  for (const L of lines) {
    const tm = L.match(TOTAL_RX);
    if (tm && !/zwischen/i.test(L)) { if (out.total == null) out.total = num(tm[2]); continue; }
    const tx = L.match(/^([A-E])\s+(\d{1,2})[.,]\d\s?%/); // „A 07,0% Netto 13,77 MwSt 0,96“: Steuerzeile, nie ein Artikel
    if (tx || (/\b(?:mwst|ust)\b/i.test(L) && /\d[.,]\d{2}/.test(L))) { if (tx) out.taxMap[tx[1]] = +tx[2]; out.skipped.push(L); pending = null; continue; }
    const cm = L.match(/^(\d{1,3})\s+(?:artikel|positionen)\b/i); if (cm) { out.count = +cm[1]; out.skipped.push(L); pending = null; continue; }
    if (/öffnungszeit|\buhr\b|^[*\-_=#.]{3,}|^\*\s|keine punkte|kein stress|gutes für alle|zum \w+ preis/i.test(L)) { out.skipped.push(L); pending = null; continue; }
    if (SKIP_RX.test(L)) { out.skipped.push(L); pending = null; continue; }
    const qm = L.match(QTY_RX);
    if (qm) {
      const q = +qm[1], unit = num(qm[2]), tot = qm[3] ? num(qm[3]) : +(q * unit).toFixed(2);
      if (pending) push(pending, q, tot, unit);
      else if (last && last.qty === 1 && Math.abs(last.price - tot) < 0.015) { last.qty = q; last.unit = unit; }
      else if (last && Math.abs(last.price - unit) < 0.015) { last.qty = q; last.unit = unit; last.price = tot; }
      continue;
    }
    const wm = L.match(WEIGHT_RX); if (wm) { if (last) { last.weightKg = num(wm[1]); last.pack = { base: 'kg', amount: num(wm[1]) }; } continue; }
    const m = L.match(LINE_RX);
    if (m) {
      const name = m[1].trim(), price = num(m[2]);
      if (name.length < 2 || !/[A-Za-zÄÖÜäöü]/.test(name)) { out.skipped.push(L); continue; }
      const kind = classifyBon(name, price);
      if (kind === 'discount') { if (last) last.discount = +((last.discount || 0) + price).toFixed(2); else out.skipped.push(L); continue; }
      push(name, 1, price, null, m[3]); continue;
    }
    if (/[A-Za-zÄÖÜäöü]{3,}/.test(L) && !/^\d/.test(L)) pending = L; else out.skipped.push(L);
  }
  const merged = [];
  for (const it of out.items) {
    const twin = it.kind === 'item' && !it.weightKg && !it.discount ? merged.find(x => x.kind === 'item' && !x.weightKg && !x.discount && x.name === it.name && Math.abs(x.price / x.qty - it.price / it.qty) < 0.005) : null;
    if (twin) { twin.qty += it.qty; twin.price = +(twin.price + it.price).toFixed(2); twin.unit = twin.unit || +(twin.price / twin.qty).toFixed(2); } else merged.push(it);
  }
  out.items = merged;
  out.items.forEach(it => { if (it.tax && out.taxMap[it.tax] != null) it.rate = out.taxMap[it.tax]; });
  out.items.forEach(matchBonItem);
  return out;
}
// true = vollständig gelesen, false = nur teilweise, null = nicht festzustellen (nur zur Information, nie eine Pflicht)
function bonComplete(b) {
  const n = b.items.filter(i => i.kind === 'item' || i.kind === 'bag').reduce((s, i) => s + (i.qty || 1), 0);
  if (b.count != null) return n >= b.count;
  if (b.total != null) return Math.abs(bonSum(b.items) - b.total) < 0.015;
  return null;
}
const netPrice = it => +(it.price + (it.discount || 0)).toFixed(2);
const bonSum = items => +items.filter(i => i.include && i.kind !== 'discount').reduce((s, i) => s + netPrice(i), 0).toFixed(2);

/* ---------- Zuordnung zu deinen Produkten ---------- */
const bonKey = name => fold(String(name).replace(/\d+[.,]?\d*\s?(kg|g|ml|l|er|stk|st|wl)\b/ig, ' ').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim());
function matchBonItem(it) {
  if (it.kind !== 'item') return it;
  const key = bonKey(it.name); it.aliasKey = key;
  if (S.aliases[key] && PROD(S.aliases[key])) { it.pid = S.aliases[key]; it.how = 'gelernt'; return it; }
  if (!(window.NOISE_RX && NOISE_RX.test(it.name))) {
    let best = null, len = 0;
    for (const p of PRODUCTS) { if (p.not && new RegExp(p.not, 'i').test(it.name)) continue; const m = rx(p).exec(it.name) || (p.kwBon && new RegExp(p.kwBon, 'i').exec(it.name)); if (m && m[0].length > len) { best = p; len = m[0].length; } }
    if (best) { it.pid = best.id; it.how = 'erkannt'; return it; }
    const bm = brandMap(); for (const w of key.split(' ')) if (w.length >= 4 && bm[w] && PROD(bm[w])) { it.pid = bm[w]; it.how = 'Marke'; return it; }
  }
  const sg = key.length >= 3 ? suggestFor(key, 1)[0] : null;
  if (sg && sg.pid && sg.score >= 72) { it.pid = sg.pid; it.how = 'ähnlich'; }
  return it;
}

/* ---------- Gewohnheiten: Stammladen, Referenzpreis, Spartipps ---------- */
const bonsSorted = () => S.bons.slice().sort((a, b) => b.date.localeCompare(a.date));
function boughtLog(pid) { const out = []; for (const b of bonsSorted()) for (const it of b.items) if (it.pid === pid) out.push({ date: b.date, store: b.store, it }); return out.slice(0, 5); }
// Stammladen: mindestens 3 Käufe, davon mindestens 2 von 3 im selben Laden (letzte 5 Käufe, unabhängig vom Zeitraum)
function stammladen(pid) {
  const log = boughtLog(pid); if (log.length < 3) return null;
  const c = {}; log.forEach(l => c[l.store] = (c[l.store] || 0) + 1);
  const [store, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return n >= Math.ceil(log.length * 2 / 3) ? { store, n, of: log.length } : null;
}
function refUnit(pid, store) { // dein üblicher Preis pro kg / Liter / Stück bei diesem Laden
  for (const l of boughtLog(pid)) if (l.store === store && l.it.k && l.it.a && l.it.p > 0) return { v: l.it.p / (l.it.a * (l.it.q || 1)), base: l.it.k, paid: l.it.p / (l.it.q || 1), packAmount: l.it.a, date: l.date };
  return null;
}
const packLabel = (base, amount) => base === 'st' ? `${amount} Stück` : base === 'kg' ? (amount < 1 ? Math.round(amount * 1000) + ' g' : String(amount).replace('.', ',') + ' kg') : String(amount).replace('.', ',') + ' l';
let TIPS = null;
function savingTips() {
  if (TIPS) return TIPS;
  const minPct = (S.set.tipPct || 20) / 100, tips = [];
  for (const p of PRODUCTS) {
    const st = stammladen(p.id); if (!st) continue;
    const ref = refUnit(p.id, st.store); if (!ref) continue;
    const info = productInfo(p);
    const cand = info.now.filter(o => o.store.id !== st.store && o.store.tier !== 'D' && o.up && o.up.base === ref.base && !o.dubious && !o.bulk).sort(rank);
    const best = cand[0]; if (!best) continue;
    const pct = (ref.v - best.up.v) / ref.v; if (pct < minPct) continue;
    const packs = qtyBase(best) ? Math.ceil(ref.packAmount / qtyBase(best)) : null;
    tips.push({ p, st, ref, best, pct, packs, sameQty: packs ? +(packs * best.price).toFixed(2) : null });
  }
  return TIPS = tips.sort((a, b) => b.pct - a.pct);
}
const tipFor = pid => savingTips().find(t => t.p.id === pid) || null;
function tipText(t) {
  const n = STORE(t.st.store).short;
  return `Du zahlst bei ${n} meist ${eur(t.ref.paid)} für ${packLabel(t.ref.base, t.ref.packAmount)} (${eur(t.ref.v)}/${unitLbl(t.ref.base)}). Diese Woche bei ${t.best.store.short}: ${eur(t.best.price)} (${eur(t.best.up.v)}/${unitLbl(t.best.up.base)}, −${Math.round(t.pct * 100)} %).` + (t.packs ? ` Für dieselbe Menge zahlst du dort ${eur(t.sameQty)} statt ${eur(t.ref.paid)}.` : '');
}
function tipsBlock() {
  const tips = savingTips().slice(0, 3); if (!tips.length) return '';
  return `<h2>💡 Spartipps aus deinen Käufen</h2><div class="card tight">${tips.map(t => `<div class="item">${thumb(t.best.img, iconFor(t.p), 'sm')}<div class="grow"><div class="nm" style="cursor:default">${esc(t.p.name)}</div><div class="small">${esc(tipText(t))}</div></div>${onList(t.p.id) ? '' : `<button class="btn sm pri" onclick="addP('${t.p.id}')">+ Liste</button>`}</div>`).join('')}</div>`;
}

/* ---------- Bildschirm „Bon einlesen" ---------- */
let BON = { text: '', parsed: null, done: null, assign: null, res: [], photos: [], busy: false, lowRead: 0, cur: null, fromPhoto: false, curPhotos: [], addTo: null, detail: null, allowDup: false, dupWarn: '' };
const BON_SAMPLE = `REWE Markt GmbH
Florenzer Str. 24-28
50765 Köln
EUR
BIO VOLLMILCH 1L 1,29 B
BUTTER 250G 1,99 B
KUECHENROLLE 8ER 3,99 A
BANANEN 1,99 B
0,980 kg x 1,99 EUR/kg
MINERALWASSER 1,5L 0,35 A
2 x 0,35
TOMATEN STRAUCH 2,49 B
COUPON -0,50
SUMME EUR 11,58
Geg. EC-Karte 11,58
Datum: 06.10.2026 11:24`;
function bonView() {
  const b = BON.parsed, d = BON.done;
  const back = `<button class="btn sm" onclick="go('list')">← Zur Liste</button>`;
  if (d) return bonDoneView(d, back);
  if (BON.detail && !b) return bonDetailView();
  if (!b) return `${back}<div class="card help"><h3>📷 Kassenbon ablegen</h3>
    <div class="small">Bon flach hinlegen, Licht von vorn, ganzer Bon im Bild. Ist er zu lang: erst das obere, dann das untere Stück (bis ${MAX_PHOTOS} Fotos). Dann auf <b>Ablegen</b> tippen. Gelesen wird im Hintergrund, du kannst gleich weitermachen.</div>
    ${BON.addTo ? `<div class="small" style="margin-top:8px;color:var(--warn)">Du ergänzt gerade einen vorhandenen Bon. <button class="lnk" onclick="BON.addTo=null;BON.photos=[];render()">Abbrechen</button></div>` : ''}
    ${BON.photos.length ? `<div class="row" style="flex-wrap:wrap;gap:10px;margin-top:10px">${BON.photos.map((p, i) => `<div style="position:relative"><img src="${p.url}" alt="Foto ${i + 1}" style="height:110px;border-radius:10px;display:block"><button class="ico" onclick="bonDropPhoto(${i})" aria-label="Foto ${i + 1} entfernen" style="position:absolute;top:2px;right:2px">✕</button><div class="tag ${p.warn ? 't-warn' : 't-ok'}" style="margin-top:4px">${p.warn ? '⚠ ' + esc(p.warn) : '✓ gut lesbar'}</div></div>`).join('')}</div>` : ''}
    <input id="bp1" type="file" accept="image/*" capture="environment" hidden onchange="bonAddPhotos(this.files);this.value=''">
    <input id="bp2" type="file" accept="image/*" multiple hidden onchange="bonAddPhotos(this.files);this.value=''">
    <div class="row" style="margin-top:10px"><button class="btn ${BON.photos.length ? '' : 'pri'}" onclick="$('#bp1').click()">📷 ${BON.photos.length ? 'Weiteres Foto' : 'Foto machen'}</button><button class="btn" onclick="$('#bp2').click()">🖼️ Aus Galerie</button></div>
    ${BON.photos.length ? `<button class="btn pri" style="margin-top:10px;width:100%" onclick="bonAblegen()">📥 ${BON.addTo ? 'Zum Bon hinzufügen' : 'Bon ablegen'}</button>` : ''}
    ${BON.err ? `<div class="small" style="color:var(--warn);margin-top:10px" role="alert">⚠ ${esc(BON.err)}</div>` : ''}
    <div class="mute small" style="margin-top:10px">${aiKey() ? '✓ Foto-Lesen ist eingerichtet. ' : 'Zum Lesen einmalig nötig (Ablegen geht auch ohne): '}<button class="lnk" onclick="aiSheet()">${aiKey() ? 'Einstellungen' : 'Foto-Lesen einrichten'}</button></div></div>
    ${bqList()}
    <details class="card tight"${BON.text ? ' open' : ''}><summary class="mute">Oder Bon-Text einfügen (z. B. aus Google Lens)</summary>
    <textarea id="bt" rows="8" maxlength="20000" oninput="BON.text=this.value" placeholder="Bon-Text hier einfügen …" style="width:100%;border-radius:16px;padding:12px;font:inherit;background:var(--card);color:var(--ink);border:2px solid var(--line);margin-top:8px">${esc(BON.text)}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn pri" onclick="bonRead()">Auslesen</button><button class="btn" onclick="BON.text=BON_SAMPLE;render()">Beispiel ausprobieren</button></div></details>`;
  const items = b.items.filter(i => i.kind === 'item' || i.kind === 'pfand');
  const sum = bonSum(b.items), diff = b.total != null ? +(sum - b.total).toFixed(2) : null;
  const sumLine = b.total == null ? '' : `Summe laut Bon ${eur(b.total)}${Math.abs(diff) < 0.015 ? ' ✓' : ''}`;
  const stores = [...STORES.filter(s => s.tier !== 'D' || s.id === 'selgros' || s.id === 'metro'), ...Object.keys(BON_NAMES).map(id => ({ id, short: BON_NAMES[id] }))];
  const row = (it, i) => {
    const p = it.pid ? PROD(it.pid) : null, plan = p && it.kind === 'item' ? bonPlanNote(it, p, b.store) : '';
    return `<div class="item"><input type="checkbox" ${it.include ? 'checked' : ''} onchange="BON.parsed.items[${i}].include=this.checked;render()" aria-label="Zeile übernehmen" style="width:20px;height:20px;flex:none">
      <div class="grow"><div class="nm" style="cursor:default">${esc(it.name)}${it.qty > 1 ? ` <span class="mute">× ${it.qty}</span>` : ''}${it.pack ? ` <span class="mute">· ${esc(packLabel(it.pack.base, it.pack.amount))}</span>` : ''}</div>
      ${it.kind === 'pfand' ? '<span class="tag">Pfand</span>' : p ? `<button class="tag t-ok" onclick="bonAssign(${i})">✓ ${esc(p.name)}${it.how === 'ähnlich' ? ' (ähnlich, bitte prüfen)' : it.how === 'KI' ? ' (Vorschlag der KI, bitte prüfen)' : it.how === 'Marke' ? ' (an der Marke erkannt)' : ''}</button>` : it.sugPid && PROD(it.sugPid) ? `<button class="tag t-warn" onclick="bonSetPid(${i},'${it.sugPid}')">💡 Vielleicht „${esc(PROD(it.sugPid).name)}“? Antippen zum Übernehmen</button> <button class="lnk" onclick="bonAssign(${i})">anders zuordnen</button>` : `<button class="tag" onclick="bonAssign(${i})">🆕 wird als neues Produkt gemerkt${it.newName ? ': ' + esc(it.newName) : ''} · ändern</button>${it.what ? `<div class="mute small">Vermutlich: ${esc(it.what)}</div>` : ''}`}
      ${plan ? `<div class="mute small">${plan}</div>` : ''}</div><b>${eur(netPrice(it))}</b></div>`;
  };
  return `${back}<div class="card"><h3>🧾 Bon gelesen</h3><div class="fgrid" style="margin-top:8px"><label class="f">Laden<select id="bs" onchange="BON.parsed.store=this.value">${b.store ? '' : '<option value="">– bitte wählen –</option>'}${stores.map(s => `<option value="${s.id}" ${s.id === b.store ? 'selected' : ''}>${esc(s.short || s.name)}</option>`).join('')}</select></label><label class="f">Datum<input id="bd" type="date" value="${b.date || ''}" onchange="BON.parsed.date=this.value"></label></div><div class="small" style="margin-top:8px">${esc(sumLine)}</div></div>
    ${bonCheck(b, diff)}${bonPhotosView()}
    <h2>Positionen (${items.length})</h2><div class="card tight">${items.map((it) => row(it, b.items.indexOf(it))).join('') || '<div class="empty">Keine Positionen erkannt. Prüfe den Text.</div>'}${b.total != null ? `<div class="item" style="border-top:2px solid var(--line)"><div class="grow"><b>Summe laut Bon</b></div><b>${eur(b.total)}</b></div>` : ''}</div>
    ${b.skipped.length ? `<details class="card tight"><summary class="mute">${b.skipped.length} Zeilen ignoriert (Adresse, Zahlung, Steuer …)</summary><div class="mute small" style="padding:6px 0">${b.skipped.map(esc).join('<br>')}</div></details>` : ''}
    <div class="row"><button class="btn pri" onclick="bonSave()">Speichern</button><button class="btn" onclick="bonClose()">${BON.cur ? '← Zur Bon-Liste' : 'Zurück zum Text'}</button></div>`;
}
// Vergleich mit dem Tipp der App: Laden und, wenn möglich, Preis
function bonPlanNote(it, p, store) {
  const info = productInfo(p), best = info.nearBest || info.best;
  if (!best || best.store.id === store) return '';
  let txt = `App-Tipp war: ${esc(best.store.short)} ${eur(best.price)}`;
  if (it.pack && best.up && best.up.base === it.pack.base) {
    const paid = netPrice(it) / (it.pack.amount * (it.qty || 1)), diff = (paid - best.up.v) * it.pack.amount * (it.qty || 1);
    if (diff > 0.05) txt += ` · hier ca. ${eur(diff)} mehr bezahlt`;
  }
  return txt;
}
function bonCheck(b, diff) { // nur ein Hinweis: gespeichert wird immer, gelesene Artikel zählen immer
  if (!BON.fromPhoto) return '';
  const comp = bonComplete(b), n = b.items.filter(i => i.kind === 'item' || i.kind === 'bag').reduce((s, i) => s + (i.qty || 1), 0), why = [];
  if (comp === false) why.push(b.count != null ? `Auf dem Bon stehen ${b.count} Artikel, gelesen wurden ${n}.` : `Summe laut Bon ${eur(b.total)}, gelesene Positionen ${eur(bonSum(b.items))}.`);
  if (BON.lowRead) why.push(`${BON.lowRead} Stelle(n) waren nicht lesbar (mit [?] markiert).`);
  if (!b.date) why.push('Das Datum wurde nicht gefunden. Es wird das heutige eingetragen, du kannst es oben ändern.');
  if (BON.dupWarn) why.push(BON.dupWarn);
  if (!why.length) return '<div class="card" style="border-color:var(--ok,#2e9e5b)"><b>✓ Alles gelesen.</b></div>';
  return `<div class="card help"><b>ℹ️ Vielleicht nicht ganz vollständig</b><div class="small" style="margin-top:4px">Du kannst trotzdem speichern. Alles Gelesene wird genutzt.</div><ul class="small">${why.map(w => '<li>' + esc(w) + '</li>').join('')}</ul><div class="row"><button class="btn sm" onclick="bonAddTo('${BON.cur}')">📷 Foto ergänzen</button><button class="btn sm" onclick="bqReread('${BON.cur}')">🔄 Nochmal lesen</button></div></div>`;
}
function bonRead() {
  const t = $('#bt') ? $('#bt').value : BON.text; BON.text = t;
  if (!t.trim()) return feedbackText('Füge zuerst den Bon-Text ein.', true);
  BON.lowRead = 0; BON.photos = []; BON.cur = null; BON.fromPhoto = false; BON.curPhotos = []; const parsed = parseReceipt(t); BON.parsed = parsed;
  if (!parsed.items.length) feedbackText('Ich konnte keine Positionen erkennen. Prüfe, ob der ganze Text eingefügt wurde.', true);
  render();
}
function bonAssign(i) {
  BON.assign = i; const it = BON.parsed.items[i];
  $('#sheetbox').innerHTML = `<div class="row sp"><h3>Welches Produkt ist das?</h3><button class="ico" onclick="closeSheet()" aria-label="Schließen">✕</button></div><div class="mute">Auf dem Bon: <b>${esc(it.name)}</b></div>
    <input id="ba" value="${esc(bonKey(it.name))}" oninput="bonAssignSearch()" style="width:100%;margin:10px 0" aria-label="Produkt suchen"><div id="bar"></div>
    <div class="row" style="margin-top:10px"><button class="btn sm" onclick="bonPickNew()">Als neues Produkt „${esc(it.name.slice(0, 24))}" anlegen</button><button class="btn sm" onclick="bonPickNone()">Nicht beachten</button></div>`;
  $('#sheet').hidden = false; bonAssignSearch(); setTimeout(() => { const e = $('#ba'); if (e) e.focus(); }, 50);
}
function bonAssignSearch() {
  const q = $('#ba') ? $('#ba').value : ''; BON.res = suggestFor(q, 6);
  $('#bar').innerHTML = BON.res.map((s, j) => `<button class="sugrow" onclick="bonPick(${j})"><span class="em">${iconFor(s.pid ? PROD(s.pid) : null, s.t)}</span><span class="grow"><b>${esc(s.t)}</b></span><span class="plus">✓</span></button>`).join('') || '<div class="mute">Nichts gefunden. Lege es als neues Produkt an.</div>';
}
function bonSetPid(i, pid) { const it = BON.parsed.items[i]; it.pid = pid; it.how = 'gewählt'; it.include = true; if (it.aliasKey && pid) S.aliases[it.aliasKey] = pid; save(); closeSheet(); render(); }
function bonPick(j) { const s = BON.res[j]; if (!s) return; const a = parseAdd(s.t); bonSetPid(BON.assign, a.pid || mkCustom(a.name).id); }
function bonPickNew() { const it = BON.parsed.items[BON.assign]; const nm = it.name.replace(/\s+\d+[.,]?\d*\s?(kg|g|ml|l)\b/i, '').trim(); bonSetPid(BON.assign, mkCustom(nm).id); }
function bonPickNone() { const it = BON.parsed.items[BON.assign]; it.pid = null; it.include = false; closeSheet(); render(); }
function bonSave() {
  const b = BON.parsed; if (!b) return;
  const store = (b.store || ($('#bs') && $('#bs').value) || '').trim(), date = b.date || ($('#bd') && $('#bd').value) || isoDay(TODAY);
  if (!store) return feedbackText('Bitte wähle oben den Laden aus.', true);
  const items = b.items.filter(i => i.kind === 'item' && i.include);
  if (!items.length) return feedbackText('Es ist keine Position ausgewählt.', true);
  if (!BON.allowDup) { const d = bonDupOf(store, date, b.total, bonNames(items), BON.cur); if (d && d.sure && !confirm('Diesen Bon hast du schon (' + bonStoreName(d.c.store) + ', ' + fmtD(d.c.date) + '). Trotzdem nochmal speichern? Dann zählt er doppelt.')) return; }
  const res = bonCommit(b, items, store, date, BON.cur, { lowRead: BON.lowRead });
  save(); BON = { text: '', parsed: null, done: { lines: res.lines, ask: res.cand }, assign: null, res: [], photos: [], busy: false, lowRead: 0, cur: null, fromPhoto: false, curPhotos: [], addTo: null, detail: null, allowDup: false, dupWarn: '' }; render();
}
// Name für ein neues Produkt aus einer unbekannten Bon-Zeile (KI-Name, sonst der aufgeräumte Bon-Name)
function bonNewName(i) {
  let n = String(i.newName || '').trim();
  if (!n) n = i.name.replace(/\b\d+[.,]?\d*\s?(?:kg|g|ml|l|er|stk|st|wl|x)\b/ig, ' ').replace(/\d+/g, ' ').replace(/[^\p{L}\s-]/gu, ' ').replace(/\b(?:nfp|altp)\b/ig, ' ').replace(/\s+/g, ' ').trim();
  if (!/\p{L}{3}/u.test(n)) return '';
  return n.charAt(0).toUpperCase() + n.slice(1, 40);
}
// Bon verbuchen (von Hand oder automatisch): lernt Produkte, Preise, Stammladen und meldet, was auf der Liste schon gekauft ist
function bonCommit(b, items, store, date, qid, opt) {
  opt = opt || {};
  const neu = [];
  items.forEach(i => { // unbekannte Zeilen: KI-Vorschlag übernehmen oder als neues Produkt anlegen. So kennt die App es beim nächsten Mal von selbst.
    if (i.pid) return;
    if (i.sugPid && PROD(i.sugPid) && i.sugC !== 'low') { i.pid = i.sugPid; i.how = 'ähnlich'; return; }
    const nm = bonNewName(i); if (!nm) return;
    const a = parseAdd(nm); i.pid = a.pid || mkCustom(a.name).id; i.how = 'neu'; if (!a.pid) neu.push(a.name);
  });
  const partial = bonComplete(b) === false || !!opt.lowRead;
  const oldTip = new Set(savingTips().map(t => t.p.id)), before = {};
  items.forEach(i => { if (i.pid) before[i.pid] = stammladen(i.pid); });
  const rec = { id: uid(), date, store, total: b.total, items: items.map(i => ({ n: i.name.slice(0, 60), q: i.qty, p: netPrice(i), pid: i.pid || null, k: i.pack ? i.pack.base : null, a: i.pack ? +i.pack.amount.toFixed(3) : null })), ...(partial ? { partial: true } : {}) };
  S.bons.unshift(rec); S.bons = bonsSorted().slice(0, 60);
  const lines = [], spont = [], favNew = [];
  const seen = new Set();
  items.forEach(i => {
    if (!i.pid) return;
    const p = PROD(i.pid); if (!p) return;
    if (i.aliasKey && i.how !== 'erkannt') S.aliases[i.aliasKey] = i.pid; // gelernt: diese Abkürzung gehört zu diesem Produkt
    if (i.pack && (i.pack.base === p.base || !p.base)) { const up = netPrice(i) / (i.pack.amount * (i.qty || 1)); if (up > 0 && isFinite(up)) S.hist.push({ pid: p.id, up: +up.toFixed(3), date, store }); }
    if (seen.has(p.id)) return; seen.add(p.id);
    if (!S.list.some(l => l.pid === p.id)) spont.push(p.name);
    const f = noteAdd(p.id); if (f) favNew.push(f);
  });
  S.hist = S.hist.slice(-400);
  TIPS = null;
  const total = items.reduce((s, i) => s + netPrice(i), 0);
  lines.push(`<b>${items.length} Positionen</b> bei <b>${esc(bonStoreName(store))}</b> am ${esc(fmtD(date))}, zusammen ${eur(total)}${partial ? ' (nur teilweise gelesen)' : ''}.`);
  const cand = []; // noch offene Listen-Artikel, die auf dem Bon waren (und schon vor dem Bon-Datum auf der Liste standen)
  S.list.filter(l => !l.done).forEach(l => { if (l.t && isoDay(new Date(l.t)) > date) return; const hit = bonMatchList(l, items); if (hit) cand.push({ id: l.id, name: l.name, qty: l.qty, bon: hit.name }); });
  (opt.pairs || []).forEach(p => { const l = S.list.find(x => !x.done && x.name.toLowerCase() === p.l.toLowerCase() && !(x.t && isoDay(new Date(x.t)) > date) && !cand.some(c => c.id === x.id)); if (l) cand.push({ id: l.id, name: l.name, qty: l.qty, bon: p.b }); }); // Paare, die die KI erkannt hat
  if (spont.length) lines.push(`🛍️ Spontan gekauft (stand nicht auf der Liste): ${spont.slice(0, 8).map(esc).join(', ')}. Was öfter vorkommt, wird automatisch zum Hauptprodukt.`);
  if (neu.length) lines.push(`🆕 Neue Produkte gemerkt: ${neu.slice(0, 6).map(esc).join(', ')}. Beim nächsten Bon erkennt die App sie von selbst.`);
  if (favNew.length) lines.push(`⭐ Neu in deinen Hauptprodukten: ${favNew.map(esc).join(', ')}.`);
  [...seen].forEach(pid => { const st = stammladen(pid), was = before[pid]; if (st && (!was || was.store !== st.store)) lines.push(`📍 ${esc(PROD(pid).name)}: Du kaufst das meist bei <b>${esc(bonStoreName(st.store))}</b> (${st.n} von ${st.of} Käufen).`); });
  const newTips = savingTips().filter(t => !oldTip.has(t.p.id)); newTips.slice(0, 2).forEach(t => lines.push(`💡 ${esc(t.p.name)}: ${esc(tipText(t))}`));
  if (qid) { bqSaved(qid, rec, total); lines.push('🗑️ Das Papier kannst du jetzt wegwerfen. Das Foto bleibt noch hier gespeichert.'); }
  return { lines, cand, rec, total, partial, n: items.length };
}
// Automatisch speichern, sobald ein Bon gelesen ist (nur wenn Laden bekannt und kein Verdacht auf doppelt)
async function bqAutoSave(m) {
  if (m.status !== 'gelesen' || !m.text) return false;
  const b = parseReceipt(m.text); if (m.ai) bonApplyAi(b.items, m.ai);
  if (!m.allowDup) { m.warn = ''; bqDupCheck(m, b); } // vor dem Speichern noch einmal: ist das ein Bon, den es schon gibt?
  if (m.status === 'doppelt') { await bqSaveMeta(m); feedbackText('🔁 Dieser Bon ist doppelt (' + esc(m.dupText || 'schon vorhanden') + '). Er wird nicht mitgerechnet.'); return true; }
  if (m.warn) { m.hold = 'evtl. doppelt'; await bqSaveMeta(m); return false; }
  const store = b.store, date = b.date || isoDay(new Date(m.created));
  if (!store) { m.hold = 'Laden nicht erkannt: bitte Laden wählen'; await bqSaveMeta(m); return false; }
  const items = b.items.filter(i => i.kind === 'item' && i.include); if (!items.length) { m.hold = 'keine Artikel erkannt'; await bqSaveMeta(m); return false; }
  const pairs = await bqAiPair(items, date).catch(() => []);
  const res = bonCommit(b, items, store, date, m.id, { lowRead: m.lowRead || 0, pairs });
  if (res.cand.length) bonAskAdd(res.cand);
  save();
  feedbackText(`✓ Bon gespeichert: ${res.n} Artikel bei ${esc(bonStoreName(store))}${res.partial ? ' (teilweise gelesen)' : ''}.${res.cand.length ? ' Auf der Liste fragt die App, was schon gekauft ist.' : ''}`);
  return true;
}
// „Schon gekauft?“ bleibt auf der Liste und der Route stehen, bis du antwortest
const bonWords = s => fold(String(s)).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !BRAND_SKIP.has(w) && !/^\d+$/.test(w));
function bonMatchList(l, items) { // passt ein Bon-Artikel zu diesem Listen-Eintrag?
  const lp = l.pid ? PROD(l.pid) : null, lw = bonWords(l.name);
  return items.find(i => {
    const ip = i.pid ? PROD(i.pid) : null;
    if (l.pid && i.pid === l.pid) return true;
    if (lp && lp.group && lp.group.includes(i.pid)) return true; // „Fleisch“ auf der Liste, „Hähnchen“ auf dem Bon
    if (!l.pid && bonNorm(i.name) === bonNorm(l.name)) return true;
    if (lp && ip && !lp.custom && !ip.custom && lp.id !== ip.id) return false; // zwei bekannte, verschiedene Produkte (Butter, Buttermilch)
    const bw = bonWords([i.name, i.newName || '', i.what || ''].join(' '));
    return lw.some(a => bw.some(b => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a))))); // „Einweghandschuhe“ ~ „Einweg Nitril“
  }) || null;
}
// Die KI findet Paare, die sich nicht am Namen erkennen lassen (nur Namen, keine Preise)
async function bqAiPair(items, date) {
  if (!aiKey() || navigator.onLine === false) return [];
  const open = S.list.filter(l => !l.done && !(l.t && isoDay(new Date(l.t)) > date) && !bonMatchList(l, items)).map(l => l.name).slice(0, 25);
  if (!open.length) return [];
  const names = [...new Set(items.map(i => i.newName ? i.name + ' (' + i.newName + ')' : i.name))].slice(0, 40);
  const prompt = `A German shopping list and a supermarket receipt. Which of the open list entries were bought according to the receipt? Only name a pair if you are sure it is the same kind of product (example: "Einweghandschuhe" = "Einweg Nitril 100"). Answer ONLY with a JSON array: [{"l":"<list entry exactly as given>","b":"<receipt name exactly as given>"}]. Use an empty array if there is none.\nList: ${JSON.stringify(open)}\nReceipt: ${JSON.stringify(names)}`;
  try { const out = await aiAsk([], prompt, 600), arr = JSON.parse((out.match(/\[[\s\S]*\]/) || ['[]'])[0]); return arr.filter(r => r && typeof r.l === 'string' && typeof r.b === 'string').slice(0, 10); } catch (e) { return []; }
}
const askDone = () => { try { return new Set(JSON.parse(localStorage.getItem('einkauf.askdone') || '[]')); } catch (e) { return new Set(); } };
const askDoneAdd = ids => { try { const s = askDone(); ids.forEach(i => s.add(i)); localStorage.setItem('einkauf.askdone', JSON.stringify([...s].slice(-150))); } catch (e) { } };
let RECHK = '';
function bonRecheck() { // schaut in die Bons der letzten 7 Tage: steht davon noch etwas offen auf der Liste?
  const key = S.bons.length + ':' + S.list.map(l => l.id + (l.done ? 'd' : '')).join(','); if (key === RECHK) return; RECHK = key;
  const done = askDone(), have = new Set((S.ask || []).map(x => x.id)), limit = isoDay(new Date(Date.now() - 7 * 864e5)); let added = false;
  for (const b of S.bons) {
    if (b.date < limit) continue;
    const items = b.items.map(i => ({ name: i.n, pid: i.pid }));
    S.list.filter(l => !l.done && !done.has(l.id) && !have.has(l.id)).forEach(l => { if (l.t && isoDay(new Date(l.t)) > b.date) return; const hit = bonMatchList(l, items); if (hit) { bonAskAdd([{ id: l.id, name: l.name, qty: l.qty, bon: hit.name }]); have.add(l.id); added = true; } });
  }
  if (added) save();
}
function bonAskAdd(c) { S.ask = S.ask || []; const have = new Set(S.ask.map(x => x.id)); c.forEach(x => { if (!have.has(x.id)) S.ask.push(x); }); S.ask = S.ask.slice(-30); }
function askBoughtCard(inSheet) {
  if (!inSheet) bonRecheck();
  S.ask = (S.ask || []).filter(x => S.list.some(l => l.id === x.id && !l.done));
  if (!S.ask.length) return '';
  if (!inSheet) { const k = S.ask.map(x => x.id).join(','); if (UI.askKey !== k) { UI.askKey = k; setTimeout(askPopup, 350); } } // beim Betreten der Seite sofort als Fenster zeigen
  return `<div class="card askc"><h3>🛒 Schon gekauft?</h3><div class="mute small" style="margin:4px 0 8px">Diese Artikel waren auf deinem letzten Bon:</div>${S.ask.map(x => `<div class="item"><div class="grow"><div class="nm" style="cursor:default">${esc(x.name)}${x.qty ? ` <span class="mute">${esc(qtyLabel(x.qty))}</span>` : ''}</div><div class="mute small">auf dem Bon: ${esc(x.bon)}</div></div><button class="btn sm pri" onclick="askBought('${x.id}',true)">✓ Gekauft</button><button class="btn sm" onclick="askBought('${x.id}',false)">Bleibt</button></div>`).join('')}<div class="row" style="margin-top:8px"><button class="btn pri sm" onclick="askBoughtAll(true)">Alle ✓ gekauft</button><button class="btn sm" onclick="askBoughtAll(false)">Alle bleiben</button></div></div>`;
}
function askPopup() { // Fenster „Schon gekauft?“, solange es etwas zu fragen gibt (auf Liste und Route)
  if (!(cur === 'list' || cur === 'route') || !(S.ask || []).length) return;
  const sh = $('#sheet'), dk = $('#dock'); if (!sh || !sh.hidden || (dk && dk.classList.contains('open')) || DRAG.on) return;
  UI.askSheet = true; $('#sheetbox').innerHTML = askBoughtCard(true) + '<div style="text-align:center;margin-top:8px"><button class="btn sm" onclick="closeSheet()">Später</button></div>'; sh.hidden = false;
}
function askRefresh() { const sh = $('#sheet'); if (!UI.askSheet || !sh || sh.hidden) return; if (!(S.ask || []).length) { closeSheet(); UI.askSheet = false; } else $('#sheetbox').innerHTML = askBoughtCard(true) + '<div style="text-align:center;margin-top:8px"><button class="btn sm" onclick="closeSheet()">Später</button></div>'; }
function askBought(id, yes) { askDoneAdd([id]); if (yes) { S.list = S.list.filter(i => i.id !== id); shortCheckEnd(); } S.ask = (S.ask || []).filter(x => x.id !== id); save(); render(); askRefresh(); }
function askBoughtAll(yes) { const ids = new Set((S.ask || []).map(x => x.id)); askDoneAdd([...ids]); if (yes) { S.list = S.list.filter(i => !ids.has(i.id)); shortCheckEnd(); } S.ask = []; save(); render(); askRefresh(); }
// Gespeicherte Bon-Zeile nachträglich einem anderen Produkt zuordnen (die App merkt es sich)
let FIX = null;
function bonFix(bid, i) {
  const b = S.bons.find(x => x.id === bid), it = b && b.items[i]; if (!it) return; FIX = { bid, i };
  $('#sheetbox').innerHTML = `<div class="row sp"><h3>Welches Produkt ist das?</h3><button class="ico" onclick="closeSheet()" aria-label="Schließen">✕</button></div><div class="mute">Auf dem Bon: <b>${esc(it.n)}</b></div><input id="bf" value="${esc(bonKey(it.n))}" oninput="bonFixSearch()" style="width:100%;margin:10px 0" aria-label="Produkt suchen"><div id="bfr"></div>`;
  $('#sheet').hidden = false; bonFixSearch();
}
function bonFixSearch() {
  const q = $('#bf') ? $('#bf').value : ''; BON.res = suggestFor(q, 6);
  $('#bfr').innerHTML = BON.res.map((s, j) => `<button class="sugrow" onclick="bonFixPick(${j})"><span class="em">${iconFor(s.pid ? PROD(s.pid) : null, s.t)}</span><span class="grow"><b>${esc(s.t)}</b></span><span class="plus">✓</span></button>`).join('') || '<div class="mute">Nichts gefunden.</div>';
}
function bonFixPick(j) {
  const s = BON.res[j]; if (!s || !FIX) return; const b = S.bons.find(x => x.id === FIX.bid), it = b && b.items[FIX.i]; if (!it) return;
  const a = parseAdd(s.t); it.pid = a.pid || mkCustom(a.name).id; S.aliases[bonKey(it.n)] = it.pid; TIPS = null; save(); closeSheet(); render(); feedbackText('✓ Geändert. Die App merkt sich das für die nächsten Bons.');
}

/* ---------- Foto lesen: Bon fotografieren, KI schreibt den Text ab, der Bon-Leser oben macht den Rest ---------- */
// Optional und nur mit deinem eigenen Schlüssel (liegt nur auf diesem Gerät, nie im Export und nie auf GitHub).
// Zwei Anbieter: Google Gemini (kostenlos, ohne Karte) oder Anthropic Claude (Karte nötig).
const AI_KEY_STORE = 'einkauf.ai.key', AI_PROV_STORE = 'einkauf.ai.prov', AI_MODELS_STORE = 'einkauf.ai.models', MAX_PHOTOS = 4;
const AI_URL = 'https://api.anthropic.com/v1/messages', AI_MODEL = 'claude-haiku-4-5-20251001', GEM_URL = 'https://generativelanguage.googleapis.com/v1beta';
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lsSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); return true; } catch (e) { return false; } };
const aiKey = () => lsGet(AI_KEY_STORE), aiProv = () => lsGet(AI_PROV_STORE) || 'gemini';
const AI_PROMPT = 'The images show ONE German supermarket receipt. Several images are consecutive parts of the same receipt from top to bottom: where they overlap, write the overlapping lines only once. ' +
  'Transcribe the receipt line by line exactly as printed: one output line per printed line, in the same order, with product names, quantity lines such as "5 Stk x 1,09", deposit (Pfand) lines, prices with decimal comma and the tax letter after the price, the SUMME/total line and the date line. ' +
  'Do not translate, correct, merge, summarize or invent anything. Write [?] where a part is unreadable. ' +
  'If the image is not a receipt or is mostly unreadable, answer exactly: NICHT_LESBAR. Output only the transcription, without any comment.';
// Schärfe und Helligkeit auf einem kleinen Graubild prüfen (Schwellen an echten Bon-Fotos kalibriert)
function bonQuality(g, w, h) {
  const n = w * h; let sum = 0, sq = 0, strong = 0;
  for (let i = 0; i < n; i++) { sum += g[i]; sq += g[i] * g[i]; }
  const mean = sum / n, std = Math.sqrt(Math.max(0, sq / n - mean * mean));
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + w] - g[i - w]) > 60) strong++; }
  const strongPct = 100 * strong / n;
  return { mean, std, strongPct, warn: mean < 55 ? 'zu dunkel' : strongPct < 0.8 ? 'unscharf oder kontrastarm' : '' };
}
async function bonLoadPhoto(file) {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) throw new Error('Das ist kein Bild.');
  if (file.size > 30e6) throw new Error('Das Bild ist zu groß (über 30 MB).');
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { throw new Error('Das Bild lässt sich nicht öffnen. Mach es bitte als normales Foto (JPG).'); }
  const sc = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const sw = 600, sh = Math.max(1, Math.round(h * sw / w)), s = document.createElement('canvas'); s.width = sw; s.height = sh;
  const sg = s.getContext('2d', { willReadFrequently: true }); sg.drawImage(bmp, 0, 0, sw, sh); if (bmp.close) bmp.close();
  const px = sg.getImageData(0, 0, sw, sh).data, gray = new Uint8ClampedArray(sw * sh);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const q = bonQuality(gray, sw, sh), url = c.toDataURL('image/jpeg', 0.85);
  return { url, b64: url.slice(url.indexOf(',') + 1), warn: q.warn };
}
async function bonAddPhotos(files) {
  const list = [...(files || [])]; if (!list.length) return;
  for (const f of list) {
    if (BON.photos.length >= MAX_PHOTOS) { feedbackText(`Mehr als ${MAX_PHOTOS} Fotos pro Bon gehen nicht.`, true); break; }
    try { BON.photos.push(await bonLoadPhoto(f)); } catch (e) { feedbackText(esc(e.message), true); }
  }
  BON.parsed = null; BON.err = ""; render();
  const bad = BON.photos.filter(p => p.warn).length; if (bad) feedbackText('⚠ Das Foto sieht ' + esc(BON.photos.find(p => p.warn).warn) + ' aus. Besser neu aufnehmen, sonst liest die KI vielleicht falsch.', true);
}
const bonDropPhoto = i => { BON.photos.splice(i, 1); BON.err = ""; render(); };
function aiFail(status, msg) { // verständliche Fehlermeldung, gleich für beide Anbieter
  msg = msg || '';
  if (status === 401 || status === 403 || (status === 400 && /api key|api_key/i.test(msg))) return new Error('Der Schlüssel wird abgelehnt. Prüfe ihn unter Mehr → Foto-Lesen.');
  if (status === 400 && /credit|balance/i.test(msg)) return new Error('Dein Guthaben ist aufgebraucht. Bitte aufladen.');
  if (status === 429) return new Error('Das Tageslimit oder die Anfragen pro Minute sind erreicht. Etwas später nochmal.');
  if (status === 404) return new Error('Das Lese-Modell gibt es nicht mehr. Bitte unter Mehr → Foto-Lesen neu speichern.');
  if (status >= 500) return new Error('Der Lese-Dienst ist gerade überlastet. Gleich nochmal versuchen.');
  return new Error('Das Auslesen hat nicht geklappt (Fehler ' + status + ').');
}
async function aiFetch(url, headers, body, timeoutMs) {
  if (navigator.onLine === false) throw new Error('Kein Internet. Zum Auslesen brauchst du kurz Netz.');
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs || 60000);
  let r; try { r = await fetch(url, { method: body ? 'POST' : 'GET', signal: ctl.signal, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? 'Das Auslesen hat zu lange gedauert. Bitte nochmal versuchen.' : 'Keine Verbindung zum Lese-Dienst. Internet prüfen.'); }
  finally { clearTimeout(timer); }
  let j = null; try { j = await r.json(); } catch (e) { }
  if (!r.ok) { const e = aiFail(r.status, (j && j.error && j.error.message) || ''); e.status = r.status; e.raw = String((j && j.error && j.error.message) || '').replace(/\s+/g, ' '); throw e; }
  return j || {};
}
const aiNote = t => { BON.status = t; bqNote(t); }; // Statuszeile am Knopf („neuer Versuch …“)
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
async function geminiModels(key) { // Flash-Modelle, die dein Schlüssel nutzen darf: neuestes zuerst, dann Flash-Lite (Namen ändern sich bei Google öfter)
  try { const s = JSON.parse(lsGet(AI_MODELS_STORE) || 'null'); if (Array.isArray(s) && s.length) return s; } catch (e) { }
  const j = await aiFetch(GEM_URL + '/models?pageSize=200', { 'x-goog-api-key': key });
  const ver = n => parseFloat((n.match(/[\d.]+/) || ['0'])[0]);
  const list = (j.models || []).filter(m => /^models\/gemini-[\d.]+-flash(-lite)?$/.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.slice(7))
    .sort((a, b) => ver(b) - ver(a) || (/lite/.test(a) ? 1 : 0) - (/lite/.test(b) ? 1 : 0)).slice(0, 6);
  if (!list.length) throw new Error('Für diesen Schlüssel habe ich kein passendes Lese-Modell gefunden.');
  lsSet(AI_MODELS_STORE, JSON.stringify(list)); return list;
}
async function aiAsk(images, text, maxTokens, avoid) { // images: Liste base64-JPEG; gibt den Antworttext zurück
  const key = aiKey(); if (!key) throw new Error('Foto-Lesen ist noch nicht eingerichtet.');
  if (aiProv() === 'anthropic') {
    const j = await aiFetch(AI_URL, { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      { model: AI_MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: [...images.map(d => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d } })), { type: 'text', text }] }] });
    return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
  }
  const models = await geminiModels(key), body = { contents: [{ role: 'user', parts: [...images.map(d => ({ inline_data: { mime_type: 'image/jpeg', data: d } })), { text }] }], generationConfig: { temperature: 0, maxOutputTokens: Math.max(maxTokens, 8192) } };
  // Reihenfolge: alle Modelle einmal, dann nach einer Pause die ersten beiden noch einmal (höchstens 8 Versuche)
  const ranked = [...models.filter(x => x !== avoid), ...models.filter(x => x === avoid)], order = [...ranked, ...ranked.slice(0, 2)].slice(0, 8), diag = []; let last = null;
  for (let i = 0; i < order.length; i++) {
    const model = order[i];
    if (i === models.length) { aiNote('Google ist ausgelastet. Kurze Pause, dann neuer Versuch …'); await sleepMs(8000); }
    aiNote(`Versuch ${i + 1} von ${order.length} (${model.replace('gemini-', '')}) …`);
    try {
      const j = await aiFetch(GEM_URL + '/models/' + model + ':generateContent', { 'x-goog-api-key': key }, body, 45000);
      const out = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map(p => p.text || '').join('\n').trim();
      if (!out && j.promptFeedback && j.promptFeedback.blockReason) throw new Error('Google hat das Bild abgelehnt. Mach bitte ein neues Foto.');
      if (!out) { const e = new Error('Google hat keine Antwort geliefert.'); e.status = 500; throw e; }
      if (j.candidates[0].finishReason === 'MAX_TOKENS') { const e = new Error('Die Abschrift wurde abgeschnitten.'); e.status = 500; throw e; }
      aiAsk.meta = { model }; return out;
    } catch (e) {
      last = e; diag.push(model.replace('gemini-', '') + ': ' + (e.status || 'Zeit') + (e.raw ? ' ' + e.raw.slice(0, 70) : ''));
      if (e.status === 404) { lsSet(AI_MODELS_STORE, ''); continue; } // Modell gibt es nicht mehr: beim nächsten Mal neu suchen
      if (e.status !== 429 && !(e.status >= 500) && !/zu lange gedauert/.test(e.message)) throw e; // Schlüssel, Bild usw.: nicht wiederholen
      await sleepMs(1500);
    }
  }
  const err = new Error((last ? last.message : 'Das Auslesen hat nicht geklappt.') + ' Versucht: ' + diag.join(' · ')); err.status = last && last.status; throw err;
}
// Einrichtung: Anbieter wählen, Schlüssel eintragen, testen, entfernen
let AI_SEL = null;
function aiSheet(prov) {
  const p = AI_SEL = prov || (aiKey() ? aiProv() : 'gemini'), g = p === 'gemini';
  $('#sheetbox').innerHTML = `<div class="row sp"><h3>📷 Foto-Lesen einrichten</h3><button class="ico" onclick="closeSheet()" aria-label="Schließen">✕</button></div>
    <div class="row" style="margin:8px 0"><button class="btn sm ${g ? 'pri' : ''}" onclick="aiSheet('gemini')">Google Gemini · kostenlos</button><button class="btn sm ${g ? '' : 'pri'}" onclick="aiSheet('anthropic')">Claude · Karte nötig</button></div>
    ${g ? `<ol class="small" style="padding-left:20px;margin:8px 0"><li>Im Browser <b>aistudio.google.com/apikey</b> öffnen und mit einem Google-Konto anmelden (machst du selbst, ab 18).</li><li>Auf <b>„Create API key“</b> tippen und den Schlüssel kopieren. Er beginnt mit „AQ.“ oder „AIza“. Dort das Kopier-Symbol neben „API-Schlüssel“ antippen.</li><li>Hier einfügen. Kostet nichts und braucht keine Karte.</li></ol>
      <div class="mute small">In Deutschland gelten für die Gratis-Nutzung die Datenschutz-Regeln der Bezahl-Variante: Google nutzt deine Fotos nicht zum Training. Es gibt ein Tageslimit, das für Bons reicht.</div>`
    : `<ol class="small" style="padding-left:20px;margin:8px 0"><li><b>console.anthropic.com</b> öffnen, Konto anlegen (machst du selbst).</li><li>Unter „Billing“ Guthaben aufladen (nur Visa/Mastercard, kein PayPal). Ein Bon kostet etwa 1 Cent.</li><li>Ausgabenlimit setzen, unter „API Keys“ einen Schlüssel erzeugen und hier einfügen („sk-ant-…“).</li></ol>`}
    <input id="aik" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${g ? 'AQ.… oder AIza…' : 'sk-ant-…'}" value="" style="width:100%;margin-top:8px" aria-label="API-Schlüssel">
    <div class="mute small" style="margin:6px 0">Der Schlüssel bleibt nur auf diesem Gerät (nicht im Export, nicht auf GitHub). Beim Auslesen geht das Foto an ${g ? 'Google' : 'Anthropic'}. Die App speichert es nicht.</div>
    <div class="row"><button class="btn pri sm" onclick="aiSave()">Speichern &amp; testen</button>${aiKey() ? '<button class="btn sm" onclick="aiRemove()">Schlüssel entfernen</button>' : ''}</div><div id="aimsg" class="small" style="margin-top:8px" role="status"></div>`;
  $('#sheet').hidden = false; setTimeout(() => { const e = $('#aik'); if (e) e.focus(); }, 50);
}
async function aiSave() {
  const k = ($('#aik').value || '').trim(), g = AI_SEL !== 'anthropic', msg = t => { const m = $('#aimsg'); if (m) m.innerHTML = t; };
  if (g ? !/^(AIza[\w-]{20,}|AQ\.[\w.-]{20,})$/.test(k) : !/^sk-ant-[\w-]{20,}$/.test(k)) return msg(`⚠ Das sieht nicht wie ein Schlüssel aus. Er beginnt mit „${g ? 'AQ.' : 'sk-ant-'}“${g ? ' oder „AIza“' : ''}.`);
  const old = [aiKey(), lsGet(AI_PROV_STORE), lsGet(AI_MODELS_STORE)]; lsSet(AI_KEY_STORE, k); lsSet(AI_PROV_STORE, g ? 'gemini' : 'anthropic'); lsSet(AI_MODELS_STORE, ''); msg('⏳ Teste Verbindung …');
  try { await aiAsk([], 'Antworte nur mit OK.', 8); msg('✓ Verbunden. Wartende Bons werden jetzt gelesen.'); render(); BQ.keyProblem = ''; bqRun(true); }
  catch (e) { lsSet(AI_KEY_STORE, old[0]); lsSet(AI_PROV_STORE, old[1]); lsSet(AI_MODELS_STORE, old[2]); msg('⚠ ' + esc(e.message)); }
}
function aiRemove() { lsSet(AI_KEY_STORE, ''); lsSet(AI_MODELS_STORE, ''); closeSheet(); render(); feedbackText('Schlüssel entfernt.'); }

/* ---------- Bon-Warteschlange: ablegen, im Hintergrund lesen, in der Liste prüfen, speichern ---------- */
// Fotos liegen im Browser-Speicher dieses Handys (IndexedDB), nie bei GitHub. Gelesen wird nacheinander, solange die App offen ist.
const BQ = { list: [], running: false, note: '', cool: 0, ready: false, noStore: false, keyProblem: '', memFotos: {} };
const BQ_KEEP = 30; // so viele Bons behalten ihr Foto nach dem Speichern
let BQ_DB = null;
function bqDb() {
  if (!BQ_DB) BQ_DB = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('kein Speicher'));
    const r = indexedDB.open('einkauf-bons', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('meta', { keyPath: 'id' }); r.result.createObjectStore('fotos', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blockiert'));
  });
  return BQ_DB;
}
const bqTx = (store, mode, fn) => bqDb().then(db => new Promise((res, rej) => { const t = db.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
function bqFail() { if (BQ.noStore) return; BQ.noStore = true; feedbackText('⚠ Der Browser-Speicher lässt das Ablegen nicht zu. Der Bon bleibt nur, solange die App offen ist.', true); }
const bqSaveMeta = m => bqTx('meta', 'readwrite', s => s.put(m)).catch(bqFail);
const bqFotosDel = id => { delete BQ.memFotos[id]; return bqTx('fotos', 'readwrite', s => s.delete(id)).catch(() => { }); };
async function bqFotosSet(id, list) { try { await bqTx('fotos', 'readwrite', s => s.put({ id, list })); delete BQ.memFotos[id]; } catch (e) { BQ.memFotos[id] = list; bqFail(); } }
async function bqFotosGet(id) { if (BQ.memFotos[id]) return BQ.memFotos[id]; try { const r = await bqTx('fotos', 'readonly', s => s.get(id)); return (r && r.list) || []; } catch (e) { return []; } }
async function bonQueueInit() {
  try { BQ.list = (await bqTx('meta', 'readonly', s => s.getAll())) || []; } catch (e) { BQ.noStore = true; BQ.list = []; }
  BQ.list.forEach(m => { if (m.status === 'liest') m.status = 'wartet'; }); // beim letzten Mal unterbrochen: später nochmal
  BQ.ready = true;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { } // Browser bitten, die Fotos nicht von selbst zu löschen
  bqChanged(); bqRun();
}
const bqNote = t => { BQ.note = t; if (BQ.running) bqStrip(); };
function bqChanged() { bqStrip(); if (typeof cur !== 'undefined' && cur === 'bon' && !BON.parsed && !BON.done) render(); }
function bqStrip() { // Statuszeile oben auf jeder Seite
  const el = document.getElementById('bqs'); if (!el) return;
  const n = s => BQ.list.filter(m => m.status === s).length, run = n('liest'), rdy = n('gelesen'), wait = n('wartet'), bad = n('fehler'), dup = n('doppelt'), parts = [];
  if (run) parts.push(`🔄 Bon wird gelesen … <span class="mute">${esc(BQ.note)}</span>`);
  if (rdy) parts.push(`✓ ${rdy} gelesen, bitte prüfen`);
  if (wait) parts.push(!aiKey() ? `⏳ ${wait} warten, Foto-Lesen einrichten` : BQ.keyProblem ? `⏳ ${wait} warten: ${esc(BQ.keyProblem)}` : run ? `⏳ ${wait} warten` : `⏳ ${wait} warten (Google gerade ausgelastet, später neu)`);
  if (dup) parts.push(`🔁 ${dup} doppelt`);
  if (bad) parts.push(`⚠ ${bad} nicht lesbar`);
  el.innerHTML = parts.length ? `<button class="bqs" onclick="go('bon')">${parts.join(' · ')}</button>` : '';
}
async function bonAblegen() {
  if (!BON.photos.length) return feedbackText('Mach zuerst ein Foto vom Bon.', true);
  const fotos = BON.photos.map(p => p.b64);
  if (BON.addTo) { // weitere Fotos zu einem vorhandenen Bon
    const m = BQ.list.find(x => x.id === BON.addTo);
    if (m) { const alt = await bqFotosGet(m.id); await bqFotosSet(m.id, [...alt, ...fotos].slice(0, MAX_PHOTOS)); Object.assign(m, { status: 'wartet', err: '', text: '', nPhotos: Math.min(MAX_PHOTOS, alt.length + fotos.length), hasPhotos: true }); await bqSaveMeta(m); }
    BON.addTo = null;
  } else {
    const hash = fnvHash(fotos.join(''));
    if (BQ.list.some(x => x.hash === hash)) { BON.photos = []; render(); return feedbackText('Dieses Foto hast du schon abgelegt. Es wird nicht doppelt gezählt.', true); }
    const m = { id: uid(), created: Date.now(), status: 'wartet', err: '', nPhotos: fotos.length, hasPhotos: true, hash };
    await bqFotosSet(m.id, fotos); BQ.list.unshift(m); await bqSaveMeta(m);
  }
  BON.photos = []; BON.err = ''; BQ.cool = 0;
  feedbackText('✓ Abgelegt. Gelesen wird im Hintergrund, du kannst weitermachen. Das Papier bitte erst nach dem Speichern wegwerfen.');
  render(); bqRun();
}
async function bqSweep() { // schon gelesene Bons, die noch warten, werden jetzt automatisch gespeichert
  if (BQ.sweeping) return; BQ.sweeping = true;
  try { for (const m of BQ.list.filter(x => x.status === 'gelesen' && x.text && !x.hold && !x.allowDup)) { if (!m.aiDone && aiKey() && navigator.onLine !== false) await bqAiMatch(m); await bqAutoSave(m); } } catch (e) { } finally { BQ.sweeping = false; bqChanged(); }
}
async function bqRun(force) {
  if (BQ.running || !BQ.ready) return;
  await bqSweep();
  if (!aiKey() || navigator.onLine === false || (!force && Date.now() - BQ.cool < 5 * 60e3)) { bqStrip(); return; }
  BQ.running = true; BQ.keyProblem = '';
  try {
    for (;;) {
      const m = [...BQ.list].reverse().find(x => x.status === 'wartet'); // ältester zuerst
      if (!m) break;
      m.status = 'liest'; m.err = ''; BQ.note = ''; bqChanged();
      let stop = false;
      try {
        const fotos = await bqFotosGet(m.id); if (!fotos.length) throw Object.assign(new Error('Das Foto fehlt.'), { fatal: true });
        let text = await aiAsk(fotos, AI_PROMPT, 2500);
        if (!text || /^\W*NICHT_LESBAR/i.test(text)) throw Object.assign(new Error('Auf dem Foto war kein Bon lesbar. Neues Foto machen oder löschen.'), { fatal: true });
        let parsed = parseReceipt(text);
        if (!parsed.items.length) throw Object.assign(new Error('Keine Positionen erkannt. Schärferes, näheres Foto machen.'), { fatal: true });
        if (parsed.total == null) { // unten fehlt etwas: mit einem anderen Modell noch einmal versuchen und das vollständigere nehmen
          try { const t2 = await aiAsk(fotos, AI_PROMPT + ' Do not stop early: the transcription must include the last lines (SUMME/total, payment and date).', 2500, aiAsk.meta && aiAsk.meta.model), p2 = parseReceipt(t2); if (p2.total != null || p2.items.length > parsed.items.length) { text = t2; parsed = p2; } } catch (e) { /* erstes Ergebnis behalten */ }
        }
        Object.assign(m, { text, lowRead: (text.match(/\[\?\]/g) || []).length, total: parsed.total, status: 'gelesen', err: '', warn: '', hold: '' }); bqDupCheck(m, parsed);
        if (m.status === 'doppelt') feedbackText('🔁 Dieser Bon ist doppelt und wird nicht mitgerechnet.');
      } catch (e) {
        if (e.fatal) { m.status = 'fehler'; m.err = e.message; }
        else { m.status = 'wartet'; m.err = e.message; stop = true; if (/Schlüssel|Guthaben|eingerichtet/.test(e.message)) BQ.keyProblem = e.message; else BQ.cool = Date.now(); }
      }
      await bqSaveMeta(m); bqChanged();
      if (m.status === 'gelesen') { await bqAiMatch(m); let ok = false; try { ok = await bqAutoSave(m); } catch (e) { ok = false; } if (!ok) feedbackText('✓ Ein Bon wurde gelesen. Unter Mehr → 📷 Bon kannst du ihn prüfen und speichern.'); }
      if (stop) break;
    }
  } finally { BQ.running = false; bqChanged(); }
}
function bqList() {
  const open = BQ.list.filter(m => m.status !== 'gespeichert').sort((a, b) => b.created - a.created);
  const rows = open.map(m => {
    const st = m.status, when = new Date(m.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const sub = st === 'gelesen' ? `✓ gelesen · ${esc(m.hold || 'bitte prüfen')}${m.total != null ? ' · ' + eur(m.total) : ''}${m.warn ? ' · ⚠ evtl. doppelt' : ''}` : st === 'liest' ? '🔄 wird gelesen …'
      : st === 'doppelt' ? '🔁 doppelt: ' + esc(m.dupText || 'schon vorhanden') + '. Wird nicht mitgerechnet.'
      : st === 'fehler' ? '⚠ ' + esc(m.err) : '⏳ wartet auf das Lesen' + (m.err ? ' (' + esc(m.err.slice(0, 80)) + ')' : '');
    const btn = st === 'gelesen' ? `<button class="btn sm pri" onclick="bonOpen('${m.id}')">Prüfen</button>`
      : st === 'doppelt' ? `<button class="btn sm" onclick="bqForce('${m.id}')">Trotzdem speichern</button>`
      : st === 'fehler' ? `<button class="btn sm" onclick="bonAddTo('${m.id}')">Foto ergänzen</button>`
      : st === 'wartet' ? `<button class="btn sm" onclick="BQ.cool=0;bqRun(true)">Jetzt lesen</button>` : '';
    return `<div class="item"><div class="grow"><div class="nm" style="cursor:default">Bon vom ${esc(when)} <span class="mute">· ${m.nPhotos || 1} Foto${(m.nPhotos || 1) > 1 ? 's' : ''}</span></div><div class="small">${sub}</div></div>${btn}<button class="ico" onclick="bonDelete('${m.id}')" aria-label="Bon löschen">🗑</button></div>`;
  }).join('');
  const saved = [...S.bons].sort((a, b) => b.date.localeCompare(a.date)).map(b => {
    const m = BQ.list.find(x => x.recId === b.id), tot = b.total != null ? b.total : +b.items.reduce((s, i) => s + i.p, 0).toFixed(2);
    return `<div class="item" role="button" tabindex="0" style="cursor:pointer" onclick="bonDetail('${b.id}')" onkeydown="if(event.key==='Enter')bonDetail('${b.id}')"><div class="grow"><div class="nm" style="cursor:pointer"><b>${esc(fmtD(b.date))}</b> · ${esc(bonStoreName(b.store))}</div><div class="small">${b.items.length} Positionen · ${eur(tot)}${m && m.hasPhotos ? ' · 📷 Foto da' : ''}</div></div><span class="mute" aria-hidden="true">›</span></div>`;
  }).join('');
  setTimeout(bqStorageInfo, 0);
  return (rows ? `<h2>🧾 Bons in Bearbeitung (${open.length})</h2><div class="card tight">${rows}</div>` : '') +
    `<h2 id="bonlist">📚 Gespeicherte Bons (${S.bons.length})</h2>` + (saved ? `<div class="card tight">${saved}</div>` : '<div class="card mute">Noch keine Bons gespeichert.</div>') + '<div class="mute small" id="bqinfo" style="margin:6px 4px"></div>';
}
async function bqStorageInfo() {
  const el = document.getElementById('bqinfo'); if (!el || !(navigator.storage && navigator.storage.estimate)) return;
  try { const e = await navigator.storage.estimate(), mb = x => Math.round(x / 1e6); el.textContent = `Foto-Speicher: ${mb(e.usage)} MB belegt, noch Platz für etwa ${mb(e.quota - e.usage)} MB. Die Fotos der letzten ${BQ_KEEP} gespeicherten Bons bleiben erhalten.`; } catch (e) { }
}
async function bonOpen(id) {
  const m = BQ.list.find(x => x.id === id); if (!m || !m.text) return;
  BON.text = m.text; BON.parsed = parseReceipt(m.text); if (m.ai) bonApplyAi(BON.parsed.items, m.ai); BON.lowRead = m.lowRead || 0; BON.cur = id; BON.fromPhoto = true; BON.err = ''; BON.allowDup = !!m.allowDup; BON.dupWarn = m.warn || '';
  BON.curPhotos = await bqFotosGet(id); render(); scrollTo(0, 0);
}
function bonClose() { BON.parsed = null; BON.cur = null; BON.fromPhoto = false; BON.curPhotos = []; BON.text = ''; render(); }
function bonAddTo(id) { BON.addTo = id; BON.parsed = null; BON.cur = null; BON.fromPhoto = false; BON.curPhotos = []; BON.photos = []; render(); scrollTo(0, 0); feedbackText('Mach ein Foto vom fehlenden Teil und tippe auf „Zum Bon hinzufügen“.'); }
function bonDetClose(e, d) { if (e.target.closest('summary')) return; d.open = false; d.scrollIntoView({ block: 'nearest' }); } // Tippen irgendwo im aufgeklappten Fenster macht es wieder klein
const bonTextView = () => BON.fromPhoto && BON.text ? `<details class="card tight" onclick="bonDetClose(event,this)"><summary class="mute">🔎 Was die KI gelesen hat (Text)</summary><pre class="small" style="white-space:pre-wrap;margin:8px 0 0">${esc(BON.text)}</pre></details>` : '';
const bonPhotosView = () => bonTextView() + (BON.curPhotos.length ? `<details class="card tight" onclick="bonDetClose(event,this)"><summary class="mute">📄 Foto vom Bon ansehen (${BON.curPhotos.length})</summary><div style="margin-top:8px">${BON.curPhotos.map((d, i) => `<img src="data:image/jpeg;base64,${d}" alt="Bon-Foto ${i + 1}" style="width:100%;border-radius:10px;margin-bottom:8px">`).join('')}</div></details>` : '');
async function bqShow(id) {
  const f = await bqFotosGet(id);
  $('#sheetbox').innerHTML = `<div class="row sp"><h3>Foto vom Bon</h3><button class="ico" onclick="closeSheet()" aria-label="Schließen">✕</button></div>${f.length ? f.map((d, i) => `<img src="data:image/jpeg;base64,${d}" alt="Bon-Foto ${i + 1}" style="width:100%;border-radius:10px;margin-top:8px">`).join('') : '<div class="mute">Das Foto ist nicht mehr gespeichert.</div>'}`;
  $('#sheet').hidden = false;
}
async function bonDelete(id) {
  const m = BQ.list.find(x => x.id === id); if (!m) return;
  if (m.status === 'liest') return feedbackText('Dieser Bon wird gerade gelesen. Versuch es gleich nochmal.');
  if (!confirm(m.status === 'gespeichert' ? 'Foto und Listeneintrag löschen? Die gespeicherten Einkaufsdaten bleiben.' : 'Diesen Bon samt Foto löschen? Er ist noch nicht gespeichert.')) return;
  BQ.list = BQ.list.filter(x => x !== m); await bqFotosDel(id); await bqTx('meta', 'readwrite', s => s.delete(id)).catch(() => { }); bqChanged();
}
async function bqSaved(id, rec, total) { // nach „Speichern“: Eintrag abschließen, alte Fotos aufräumen
  const m = BQ.list.find(x => x.id === id); if (!m) return;
  Object.assign(m, { status: 'gespeichert', recId: rec.id, store: rec.store, date: rec.date, sum: rec.total != null ? rec.total : total, n: rec.items.length, savedAt: Date.now(), text: '' });
  await bqSaveMeta(m);
  const saved = BQ.list.filter(x => x.status === 'gespeichert').sort((a, b) => b.savedAt - a.savedAt);
  for (const o of saved.slice(BQ_KEEP)) if (o.hasPhotos) { o.hasPhotos = false; await bqFotosDel(o.id); await bqSaveMeta(o); }
  for (const o of saved.slice(80)) { BQ.list = BQ.list.filter(x => x !== o); await bqTx('meta', 'readwrite', s => s.delete(o.id)).catch(() => { }); }
}
window.addEventListener('online', () => bqRun(true));
/* ---------- Doppelte Bons erkennen ---------- */
const bonNorm = n => fold(String(n)).replace(/[^a-z0-9]/g, '');
const bonNames = items => [...new Set(items.filter(i => !i.kind || i.kind === 'item').map(i => bonNorm(i.name || i.n)).filter(Boolean))];
const fnvHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36) + s.length; };
// Vergleicht Laden, Datum, Summe und Produktnamen mit gespeicherten und schon gelesenen Bons. sure = sicher derselbe Bon.
function bonDupOf(store, date, total, names, skipId) {
  const cands = S.bons.map(b => ({ store: b.store, date: b.date, total: b.total, names: b.items.map(i => bonNorm(i.n)), saved: true }));
  BQ.list.forEach(m => { if (m.id !== skipId && m.sig && m.status === 'gelesen') cands.push({ ...m.sig, saved: false }); });
  for (const c of cands) {
    if (c.store !== store || c.date !== date) continue;
    const both = total != null && c.total != null; if (both && Math.abs(c.total - total) >= 0.005) continue;
    const A = new Set(c.names), B = new Set(names), inter = [...B].filter(x => A.has(x)).length, jac = inter / Math.max(1, A.size + B.size - inter);
    if (jac >= (both ? 0.6 : 0.8)) return { c, sure: true };
    if (both) return { c, sure: true }; // gleicher Laden, gleiches Datum, gleiche Summe auf den Cent: derselbe Bon
  }
  return null;
}
const bonDetail = id => { BON.detail = id; render(); scrollTo(0, 0); };
function bonDetailView() {
  const b = S.bons.find(x => x.id === BON.detail); if (!b) { BON.detail = null; return ''; }
  const m = BQ.list.find(x => x.recId === b.id), sum = +b.items.reduce((s, i) => s + i.p, 0).toFixed(2);
  const rows = b.items.map((i, ix) => { const p = i.pid ? PROD(i.pid) : null; return `<div class="item" role="button" tabindex="0" style="cursor:pointer" onclick="bonFix('${b.id}',${ix})"><div class="grow"><div class="nm" style="cursor:default">${esc(i.n)}${i.q > 1 ? ` <span class="mute">× ${i.q}</span>` : ''}</div>${p ? `<span class="tag t-ok">${esc(p.name)}</span>` : '<span class="tag">kein Produkt zugeordnet</span>'}</div><b>${eur(i.p)}</b><span class="mute" aria-hidden="true">›</span></div>`; }).join('');
  return `<button class="btn sm" onclick="BON.detail=null;render()">← Zu den Bons</button>
    <div class="card"><h3>🧾 ${esc(bonStoreName(b.store))} · ${esc(fmtD(b.date))}</h3><div class="small" style="margin-top:6px">${b.items.length} Positionen · Summe laut Bon ${b.total != null ? eur(b.total) : 'unbekannt'} · Positionen zusammen ${eur(sum)} (Pfand wird nicht mitgezählt)${b.partial ? '<br>ℹ️ Nur teilweise gelesen. Die gelesenen Artikel zählen trotzdem.' : ''}<br><span class="mute">Antippen einer Zeile ändert das Produkt.</span></div></div>
    <h2>Gekauft</h2><div class="card tight">${rows || '<div class="empty">Keine Positionen.</div>'}${b.total != null ? `<div class="item" style="border-top:2px solid var(--line)"><div class="grow"><b>Summe laut Bon</b></div><b>${eur(b.total)}</b></div>` : ''}</div>
    ${m && m.hasPhotos ? `<button class="btn" style="margin-top:10px" onclick="bqShow('${m.id}')">📄 Foto vom Bon ansehen</button>` : ''}`;
}
function bqDupCheck(m, parsed) { // nach dem Lesen: ist das derselbe Bon wie ein schon vorhandener?
  m.sig = null; m.dupText = '';
  if (!parsed.store || !parsed.date) return;
  const names = bonNames(parsed.items); m.sig = { store: parsed.store, date: parsed.date, total: parsed.total, names };
  const d = bonDupOf(parsed.store, parsed.date, parsed.total, names, m.id); if (!d) return;
  if (d.sure) { m.status = 'doppelt'; m.dupText = bonStoreName(d.c.store) + ' ' + fmtD(d.c.date) + (d.c.total != null ? ', ' + eur(d.c.total) : '') + (d.c.saved ? ' ist schon gespeichert' : ' ist schon in der Liste'); m.hasPhotos = false; bqFotosDel(m.id); }
  else m.warn = 'Gleicher Laden, gleiches Datum und gleiche Summe wie ein anderer Bon, aber andere Produkte. Prüfe, ob es derselbe ist.';
}
async function bqForce(id) { const m = BQ.list.find(x => x.id === id); if (!m || !m.text) return; m.status = 'gelesen'; m.allowDup = true; m.warn = ''; await bqSaveMeta(m); bonOpen(id); }
function bonList() { go('bon'); setTimeout(() => { const e = document.getElementById('bonlist'); if (e) e.scrollIntoView(); }, 120); }
async function bqReread(id) { const m = BQ.list.find(x => x.id === id); if (!m) return; const f = await bqFotosGet(id); if (!f.length) return feedbackText('Das Foto ist nicht mehr da. Mach ein neues Foto.', true); Object.assign(m, { status: 'wartet', text: '', warn: '', hold: '', err: '', ai: null, aiDone: false }); await bqSaveMeta(m); bonClose(); feedbackText('Der Bon wird nochmal gelesen.'); BQ.cool = 0; bqRun(true); }

/* ---------- Unbekannte Bon-Namen (Marken) erkennen: Marken-Wörterbuch aus den Angeboten + KI-Vorschlag ---------- */
const BRAND_SKIP = new Set(['bio', 'frische', 'frisch', 'deutsche', 'deutscher', 'deutsches', 'premium', 'aktion', 'angebot', 'neu', 'original', 'classic', 'natur', 'fein', 'vegan', 'regional', 'gold', 'plus', 'extra', 'mini', 'maxi', 'super', 'mega', 'gutes']);
let BRANDMAP = null, BRANDKEY = '';
function brandMap() { // „Vittel → Stilles Wasser": lernt jeden Tag aus den Angeboten, welche Marke zu welchem Produkt gehört
  const all = OFFERS_ALL(), key = String(SRC.fetched || '') + ':' + all.length + ':' + PRODUCTS.length; if (BRANDMAP && key === BRANDKEY) return BRANDMAP;
  const cnt = {};
  for (const o of all) {
    if (!o.p) continue; const w = bonKey(o.name).split(' ')[0];
    if (!w || w.length < 4 || BRAND_SKIP.has(w) || rx(o.p).test(w)) continue; // Produktwörter selbst sind keine Marke
    const c = cnt[w] = cnt[w] || {}; c[o.p.id] = (c[o.p.id] || 0) + 1;
  }
  const map = {};
  for (const [w, c] of Object.entries(cnt)) { const tot = Object.values(c).reduce((a, b) => a + b, 0), top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; if (tot >= 2 && top[1] / tot >= 0.8) map[w] = top[0]; }
  BRANDKEY = key; return BRANDMAP = map;
}
function bonApplyAi(items, ai) { // KI-Vorschläge auf noch unbekannte Zeilen anwenden: sicher = zuordnen, sonst nur vorschlagen
  items.forEach(it => {
    if (it.kind !== 'item' || it.pid) return; const a = ai[bonKey(it.name)]; if (!a) return;
    const p = a.pid ? PROD(a.pid) : null;
    if (p && a.c === 'high') { it.pid = p.id; it.how = 'KI'; } else if (p) { it.sugPid = p.id; it.sugC = a.c; } else if (a.g) it.newName = a.g;
    if (a.w) it.what = a.w;
  });
}
async function bqAiMatch(m) { // fragt die KI (nur Namen, keine Preise, kein Foto) nach den unbekannten Zeilen
  if (m.aiDone || !m.text) return;
  const parsed = parseReceipt(m.text), unk = [...new Set(parsed.items.filter(i => i.kind === 'item' && !i.pid).map(i => i.name))].slice(0, 25);
  if (!unk.length) { m.aiDone = true; return; }
  const prompt = `German supermarket receipt, store: ${bonStoreName(parsed.store || 'unbekannt')}. The names on the receipt are abbreviated and may be only a brand name. Our product list: ${PRODUCTS.filter(p => !p.custom).map(p => p.name).join('; ')}.\n` +
    `For each receipt name decide which product from the list it is. If it is none of them, set "p" to null and give in "g" a short generic German product name (1 to 3 words, no brand, no size, e.g. "Hähnchenflügel", "Flüssigseife", "Einmalhandschuhe"). Answer ONLY with a JSON array, no other text: [{"n":"<name exactly as given>","p":"<exact product name from the list or null>","c":"high|medium|low","w":"<what it is in German, max 5 words>","g":"<generic name or empty>"}].\nNames: ${JSON.stringify(unk)}`;
  try {
    const out = await aiAsk([], prompt, 1500), arr = JSON.parse((out.match(/\[[\s\S]*\]/) || ['[]'])[0]); m.ai = m.ai || {};
    arr.forEach(r => {
      if (!r || typeof r.n !== 'string') return;
      const p = typeof r.p === 'string' ? PRODUCTS.find(x => x.name.toLowerCase() === r.p.toLowerCase()) : null;
      m.ai[bonKey(r.n)] = { pid: p ? p.id : null, c: ['high', 'medium', 'low'].includes(r.c) ? r.c : 'low', w: String(r.w || '').slice(0, 40), g: p ? '' : String(r.g || '').replace(/[^\p{L}\s-]/gu, '').trim().slice(0, 30) };
    });
    m.aiDone = true; await bqSaveMeta(m); bqChanged();
  } catch (e) { /* Vorschlag ist nur ein Zusatz: bei Fehler bleibt es beim manuellen Zuordnen */ }
}

function bonDoneView(d, back) {
  const ask = d.ask || [];
  const askCard = ask.length ? `<div class="card"><h3>🛒 Schon gekauft?</h3><div class="mute small" style="margin:4px 0 8px">Diese Artikel stehen noch offen auf deiner Liste und waren auf dem Bon:</div>${ask.map(x => `<div class="item"><div class="grow"><div class="nm" style="cursor:default">${esc(x.name)}${x.qty ? ` <span class="mute">${esc(qtyLabel(x.qty))}</span>` : ''}</div><div class="mute small">auf dem Bon: ${esc(x.bon)}</div></div><button class="btn sm pri" onclick="bonAsk('${x.id}',true)">✓ Gekauft</button><button class="btn sm" onclick="bonAsk('${x.id}',false)">Bleibt</button></div>`).join('')}<div class="row" style="margin-top:8px"><button class="btn pri sm" onclick="bonAskAll(true)">Alle ✓ gekauft</button><button class="btn sm" onclick="bonAskAll(false)">Alle bleiben</button></div></div>` : '';
  return `${back}<div class="card help"><h3>✓ Bon gespeichert</h3><ul>${d.lines.map(l => `<li>${l}</li>`).join('')}</ul><div class="row"><button class="btn pri sm" onclick="BON.done=null;go('list')">Zur Liste</button><button class="btn sm" onclick="BON.done=null;render()">Weiteren Bon einlesen</button></div></div>${askCard}`;
}
function bonAsk(id, yes) { if (!BON.done) return; if (yes) { S.list = S.list.filter(i => i.id !== id); shortCheckEnd(); save(); } BON.done.ask = (BON.done.ask || []).filter(x => x.id !== id); render(); }
function bonAskAll(yes) { if (!BON.done) return; (BON.done.ask || []).slice().forEach(x => { if (yes) S.list = S.list.filter(i => i.id !== x.id); }); BON.done.ask = []; if (yes) { shortCheckEnd(); save(); } render(); }
