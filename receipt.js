// Kassenbon: Text aus dem Bon lesen (Laden, Datum, Positionen), Produkten zuordnen, Einkaufsgewohnheiten lernen, Spartipps.
// Wird vor app.js geladen und nutzt dessen Funktionen erst beim Aufruf. Bon-Text bleibt auf dem Gerät; nur beim optionalen Foto-Lesen geht das Foto an Anthropic (eigener Schlüssel).

/* ---------- Bon lesen ---------- */
const BON_STORES = [[/\brewe\b/i, 'rewe'], [/netto\s*marken|\bnetto\b/i, 'netto'], [/\bdm[\s-]*drogerie|\bdm\b/i, 'dm'], [/\blidl\b/i, 'lidl'], [/\baldi\b/i, 'aldi'], [/\bkaufland\b/i, 'kaufland'], [/\bpenny\b/i, 'penny'], [/\bedeka\b/i, 'edeka'], [/\bselgros\b/i, 'selgros'], [/\bmetro\b/i, 'metro'], [/handelshof/i, 'handelshof'], [/rossmann/i, 'rossmann'], [/media\s*markt/i, 'mediamarkt']];
const BON_NAMES = { real: 'real', kaufland: 'Kaufland', penny: 'Penny', edeka: 'EDEKA', rossmann: 'Rossmann', mediamarkt: 'MediaMarkt', unbekannt: 'Unbekannt' };
const bonStoreName = id => (STORES.find(s => s.id === id) || {}).short || BON_NAMES[id] || id;
const SKIP_RX = /^(?:betrag|zwischensumme|mwst|ust|steuer|netto-?warenwert|nettowert|brutto|incl|inkl|davon|bar|ec|girocard|maestro|visa|mastercard|karte|kartenzahlung|contactless|zahlung|r(?:ü|ue)ckgeld|zur(?:ü|ue)ck|gegeben|geg|bonus|payback|punkte|filiale|kasse|bediener|kassierer|beleg|bon|tel|telefon|datum|uhrzeit|trace|terminal|genehmigung|vielen dank|danke|www|http|tse|seriennummer|kundenbeleg|ihr einkauf|ersparnis|anzahl|artikel|eur|uid|ust-?id|steuernr|plz)\b/i;
const TOTAL_RX = /^\W*(summe|gesamt(?:betrag)?|total|zu zahlen|zahlbetrag)\b.*?(-?\d{1,5}[.,]\d{2})\s*(?:€|eur)?\W*$/i;
const LINE_RX = /^(.*?)\s+(-?\d{1,4}[.,]\d{2})\s*(?:€|EUR)?(?:\s*([A-Za-z]|\d))?(?:\s*\*)?\s*$/;
const QTY_RX = /^(\d+)\s*(?:x|×|\*|stk\.?\s*x)\s*(\d{1,4}[.,]\d{2})(?:\s*(?:€|eur))?(?:\s+(\d{1,4}[.,]\d{2}))?\s*[A-Za-z*]?$/i;
const WEIGHT_RX = /^(\d+[.,]\d{1,3})\s*kg\s*(?:x|×)\s*(\d{1,4}[.,]\d{2})/i;
const num = s => parseFloat(String(s).replace(',', '.'));
/* ---------- Laden, Datum und Uhrzeit auf dem Bon erkennen: mehrere Hinweise, der beste gewinnt ---------- */
// Doppelgänger aus der Texterkennung (kyrillisch/griechisch) auf lateinische Buchstaben zurückführen
const bonHomo = s => s.replace(/[Аа]/g, 'A').replace(/[ЕеΕ]/g, 'E').replace(/[ОоΟ]/g, 'O').replace(/[РрΡ]/g, 'P').replace(/[Сс]/g, 'C').replace(/[НΗ]/g, 'H').replace(/[КΚ]/g, 'K').replace(/[МΜ]/g, 'M').replace(/[ТΤ]/g, 'T').replace(/[ХΧ]/g, 'X');
// Namen (tolerant: REVVE, nahkauf …), Webadressen und Untermarken
const BON_EXTRA = [[/\bre(?:w|vv)e(?!l)|\bnahkauf\b|rewe\.de/i, 'rewe'], [/\bnetto(?!\s*-?\s*(?:warenwert|wert|betrag|umsatz|summe|f(?:ü|ue)ll|gewicht|inhalt|menge|preis))\b|netto-online/i, 'netto'], [/\bdm\s*-?\s*drogerie|dm\.de\b/i, 'dm'], [/\blidl\b|lidl\.de/i, 'lidl'], [/\baldi\b|aldi-(?:sued|nord)/i, 'aldi'], [/\bkaufland\b/i, 'kaufland'], [/\bpenny\b/i, 'penny'], [/\bedeka\b|\be\s?center\b|\bmarktkauf\b|\be\s?aktiv\s?markt\b|\bedeka\.de/i, 'edeka'], [/\bselgros\b/i, 'selgros'], [/\bmetro\b/i, 'metro'], [/handelshof/i, 'handelshof'], [/\brossmann\b/i, 'rossmann'], [/media\s*markt/i, 'mediamarkt'], [/\breal\s*(?:,-|gmbh|markt|\.de)/i, 'real']];
// Eigenmarken zählen nur wenig: allein reichen sie für einen Vorschlag, nie für eine feste Zuordnung
const BON_OWN = [[/\bja!/i, 'rewe'], [/\bk-?classic\b/i, 'kaufland'], [/gut\s*&\s*g(?:ü|ue)nstig/i, 'edeka'], [/\bmilbona\b|\bpilos\b/i, 'lidl'], [/\bmilsani\b|\bmoser roth\b/i, 'aldi'], [/\bbalea\b|\bdmbio\b/i, 'dm'], [/\bisana\b|\balterra\b/i, 'rossmann']];
const bonFoldS = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/stra(?:ss|ß)e|str\./g, 'str');
let BON_STREETS = null;
const bonStreets = () => BON_STREETS || (BON_STREETS = STORES.filter(s => s.addr && /\d/.test(s.addr)).map(s => ({ id: s.id, st: bonFoldS(s.addr.split(',')[0]).replace(/\s*\d.*$/, '').trim(), num: (s.addr.match(/\d+/) || [''])[0] })).filter(x => x.st.length >= 6)); // Straßen der bekannten Läden
function detectStoreEx(lines) { // { store, sug }: store bei sicherem Treffer, sonst sug als Vorschlag
  const sc = {}, put = (id, kind, w) => { const o = sc[id] = sc[id] || {}; if (!o[kind] || w > o[kind]) o[kind] = w; }; // je Art des Hinweises zählt ein Laden nur einmal: viele schwache Treffer schlagen keinen Namen im Kopf
  lines.forEach((l0, i) => {
    const l = bonHomo(l0), price = /\d[.,]\d{2}/.test(l), tax = /mwst|ust-?id|steuer/i.test(l), konzern = /unternehmen der|\bgroup\b|konzern/i.test(l), steuerNetto = /^netto\s+-?\d/i.test(l);
    if (!konzern && !steuerNetto) for (const [rx, id] of BON_EXTRA) if (rx.test(l)) put(id, 'name', price || tax ? 1 : i < 14 ? 4 : 2.5); // „Ein Unternehmen der REWE Group“ ist kein Laden
    if (!price) for (const s of bonStreets()) if (bonFoldS(l).includes(s.st)) put(s.id, 'adr', s.num && new RegExp('(?:^|\\D)' + s.num + '(?!\\d)').test(l) ? 3 : 1.5); // Straße mit Hausnummer ist sicher, Straße allein nur ein Hinweis
    for (const [rx, id] of BON_OWN) if (rx.test(l)) put(id, 'own', 0.6);
  });
  const rank = Object.entries(sc).map(([id, o]) => [id, Object.values(o).reduce((a, b) => a + b, 0)]).sort((a, b) => b[1] - a[1]), best = rank[0];
  if (best && rank[1] && best[1] - rank[1][1] < 1) return { store: null, sug: best[0] }; // Gleichstand (z. B. zwei Läden an derselben Adresse): nur ein Vorschlag
  return best && best[1] >= 2 ? { store: best[0] } : best ? { store: null, sug: best[0] } : { store: null };
}
function detectStore(t) { return detectStoreEx(String(t).split('\n')).store; }
const bonIso = (y, m, d) => { const s = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'), x = new Date(s + 'T12:00:00'); return !isNaN(x) && x.toISOString().slice(0, 10) === s ? s : null; };
// Ziffern-Verwechslungen (O statt 0, l statt 1) nur direkt zwischen Ziffern und Trennern korrigieren
const bonDigits = l => bonHomo(l).replace(/(?<=[\d.,\/\- ])[Oo](?=[\d.,\/\-])|(?<=[\d.,\/\-])[Oo]|[Oo](?=\d[.,\/\-]\d)/g, '0').replace(/(?<![A-Za-z])[lI|](?=\d)|(?<=\d)[lI|](?![A-Za-z])/g, '1');
function detectDateAt(lines, ref, todayIso) { // plausibelstes Datum aus ALLEN Zeilen: { iso, i, fixed } (fixed = Jahr vom Foto-Tag übernommen)
  todayIso = todayIso || new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const min = new Date(new Date(todayIso) - 400 * 864e5).toISOString().slice(0, 10), found = [];
  lines.forEach((l0, i) => {
    const l = bonDigits(l0);
    for (const m of l.matchAll(/(?<![\d.\/])(?<!\d,)(\d{1,2})\s?[.,\/-]\s?(\d{1,2})\s?[.,\/-]\s?(\d{4}|\d{2})(?!\d|,\d|-\d)/g)) found.push({ d: +m[1], mo: +m[2], y: m[3].length === 2 ? 2000 + +m[3] : +m[3], i, l });
    for (const m of l.matchAll(/(20\d\d)-(\d{2})-(\d{2})/g)) found.push({ d: +m[3], mo: +m[2], y: +m[1], i, l });
  });
  const r = ref || todayIso, cands = [], ok = x => x && x <= todayIso && x >= min;
  for (const c of found) {
    if (c.mo < 1 || c.mo > 12 || c.d < 1 || c.d > 31) continue;
    let s = bonIso(c.y, c.mo, c.d), fixed = false;
    if (/g(?:ü|ue)ltig|\bbis\b|mhd|haltbar|coupon|aktion/i.test(c.l)) continue; // Gültig-bis, Coupon, MHD und Aktionszeiträume sind kein Bon-Datum
    const dateLine = !/uhrzeit|\buhr\b/i.test(c.l); // in Zeilen mit Uhr(zeit) wird das Jahr nie repariert
    if (!ok(s)) { if (!dateLine) continue; const ry = +r.slice(0, 4); for (const y of [ry, ry - 1]) { const t = bonIso(y, c.mo, c.d); if (ok(t) && t <= r) { s = t; fixed = true; break; } } if (!ok(s)) continue; } // verlesenes Jahr: Tag und Monat behalten, Jahr vom Foto-Tag
    const dist = Math.abs(new Date(r) - new Date(s)) / 864e5;
    const w = (/datum|date/i.test(c.l) ? 3 : 0) + (/\d{1,2}[:.]\d{2}/.test(c.l.replace(/\d{1,2}\s?[.,\/-]\s?\d{1,2}\s?[.,\/-]\s?\d{2,4}/, '')) ? 2 : 0) + (c.i > lines.length * 0.6 ? 1 : 0) - (/g(?:ü|ue)ltig|bis|mhd|coupon|aktion/i.test(c.l) ? 4 : 0) - (fixed ? 2 : 0) - Math.min(3, dist / 10);
    cands.push({ iso: s, i: c.i, w, fixed });
  }
  cands.sort((a, b) => b.w - a.w);
  return cands[0] || null;
}
function detectDate(lines, ref, todayIso) { const d = detectDateAt(lines, ref, todayIso); return d ? d.iso : null; }
function detectTime(lines, d) { // Uhrzeit: „17:28:11 Uhr“, sonst die Datumszeile (±1), sonst eine „Uhrzeit“-Zeile; Punkte als Trenner nur zusammen mit „Uhr“
  const rx = /(?<![\d:.T])([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.][0-5]\d)?(?![\d,])/;
  const tryL = (l, strict) => { if (/\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}|\b(?:mo|di|mi|do|fr|sa|so)\.?\s*[-–]\s*(?:mo|di|mi|do|fr|sa|so)\b/i.test(l)) return null; /* Öffnungszeiten */ const t = bonHomo(l).replace(/(?<!\d)(?:0?[1-9]|[12]\d|3[01])\s?[.,\/-]\s?(?:0?[1-9]|1[0-2])\s?[.,\/-]\s?(?:\d{4}|\d{2})(?!\d)/g, ' '), u = t.match(/(?<![\d.])([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.][0-5]\d)?\s*uhr/i); if (u) return u[1].padStart(2, '0') + ':' + u[2]; const m = t.match(rx); if (!m) return null; if (/\./.test(m[0]) && !(strict || /uhr/i.test(l))) return null; return m[1].padStart(2, '0') + ':' + m[2]; };
  if (d) for (const j of [d.i, d.i + 1, d.i - 1]) if (lines[j] && !/uhr\s*-/i.test(lines[j])) { const t = tryL(lines[j], false); if (t) return t; }
  for (const l of lines) if (/uhrzeit|zeit:|\buhr\b/i.test(l) && !/uhr\s*-|öffnung/i.test(l)) { const t = tryL(l, true); if (t) return t; }
  return null;
}
const SORT_KEEP_DAYS = 7, ASK_MAX_AGE_DAYS = 30; // aussortierte Fotos bleiben 7 Tage; ältere Bons als 30 Tage lösen kein „Schon gekauft?“ mehr aus
const bonTs = (date, time, saved) => { const hasT = /^\d{1,2}:\d{2}$/.test(time || ''), ts = new Date(date + 'T' + (hasT ? String(time).padStart(5, '0') : '23:59') + ':59').getTime(); return !hasT && saved > 0 ? Math.min(ts, saved) : ts; }; // Zeitpunkt des Einkaufs (ohne Uhrzeit: Ende des Tages, aber nie später als das Speichern des Bons)
const addedAfter = (l, ts) => !!(l.t && l.t > ts); // Eintrag wurde erst nach dem Einkauf eingetragen
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
function parseReceipt(text, opt) { // opt.ref = Tag des Fotos (Bezugspunkt für unsicheres Datum), opt.today nur für Tests
  const all = cleanTranscript(text).split('\n').map(s => s.replace(/[ \t]+/g, ' ').trim().slice(0, 160).replace(/(?:^|(?<=\s))(?:[A-Za-zÄÖÜäöü] ){2,}[A-Za-zÄÖÜäöü](?=\s|$)/g, m => m.replace(/ /g, ''))).filter(Boolean);
  const cut = all.length > 400, lines = cut ? [...all.slice(0, 300), ...all.slice(-100)] : all; // zu lang: Anfang und Ende (Summe, Datum) behalten
  opt = opt || {}; const stx = detectStoreEx(lines), dd = detectDateAt(lines, opt.ref, opt.today);
  const out = { store: stx.store, sug: stx.sug || null, date: dd ? dd.iso : null, dateGuess: !!(dd && dd.fixed), time: detectTime(lines, dd), total: null, count: null, truncated: cut, taxMap: {}, items: [], skipped: [] };
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
  if (b.truncated) return false; // Mitte des Bons wurde abgeschnitten
  const n = b.items.filter(i => i.kind === 'item' || i.kind === 'bag').reduce((s, i) => s + (i.qty || 1), 0);
  if (b.count != null) return n >= b.count;
  if (b.total != null) return Math.abs(bonSum(b.items) - b.total) < 0.015;
  return null;
}
function bonRemapOld(full) { // „Lamm / Kalb / Ente“ ist in Lamm, Kalb, Ente und Wild geteilt: alte Bon-Artikel neu zuordnen
  let ch = false;
  for (const k of Object.keys(S.aliases)) if (S.aliases[k] === 'lammkalb') { delete S.aliases[k]; ch = true; }
  for (const b of S.bons) for (const it of b.items || []) if (it.pid === 'lammkalb') { const x = { kind: 'item', name: it.n || '' }; matchBonItem(x); if (x.pid && x.pid !== 'lammkalb') { it.pid = x.pid; ch = true; } }
  if (full && S.remapV !== APP_BUILD.v) {
    for (const b of S.bons) for (const it of b.items || []) {
      const x = { kind: 'item', name: it.n || '' }; matchBonItem(x); if ((x.how !== 'erkannt' && !(x.how === 'gelernt' && !it.pid) && !(x.how === 'Marke' && x.tol && !it.pid)) || !x.pid || x.pid === it.pid) continue; // ein gelernter Alias füllt eine leere Zuordnung, überschreibt aber nie eine vorhandene
      const old = it.pid ? PROD(it.pid) : null;
      if (!old || (old.group && old.group.includes(x.pid))) { it.pid = x.pid; it.b = bonBrand(it.n, PROD(x.pid)); ch = true; }
    }
    S.remapV = APP_BUILD.v; ch = true; TIPS = null;
  }
  if (ch) save();
}
function onBonOf(it) { // erledigter (abgehakter) Artikel, der auf einem Bon der letzten 14 Tage steht; er muss vor dem Einlesen des Bons auf der Liste gestanden haben
  if (!it.done) return null; const now = Date.now();
  for (const b of S.bons) {
    if (b.du) continue; const ts = bonTs(b.date, b.time, b.saved); if ((now - ts) / 864e5 > 14 || addedAfter(it, Math.max(ts, b.saved || 0))) continue;
    const hit = bonMatchList(it, b.items.map(i => ({ name: i.n, pid: i.pid }))); if (hit) return { store: b.store, date: b.date, name: hit.name };
  }
  return null;
}
const netPrice = it => +(it.price + (it.discount || 0)).toFixed(2);
const bonSum = items => +items.filter(i => i.include && i.kind !== 'discount').reduce((s, i) => s + netPrice(i), 0).toFixed(2);

/* ---------- Zuordnung zu deinen Produkten ---------- */
const bonKey = name => fold(String(name).replace(/\d+[.,]?\d*\s?(kg|g|ml|l|er|stk|st|wl)\b/ig, ' ').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim());
// Bon-Schreibweise: AE/OE/UE statt ä/ö/ü und Abkürzungen ausschreiben, damit dieselben Wörter und Sperren wie bei den Angeboten greifen
const bonSchreib = s => String(s).toLowerCase().replace(/(?<![aeqg])ue/g, 'ü').replace(/ae/g, 'ä').replace(/oe/g, 'ö')
  .replace(/\bhackfl\.\s*/g, 'hackfleisch ').replace(/\bgem\./g, 'gemischt').replace(/\bgeschn?\.(?=\s|$)/g, 'geschält').replace(/\bgetr\.(?=\s|$)/g, 'getrocknet').replace(/\bri\.(?=\s*hack)/g, 'rinder').replace(/\bhähn?ch\.(?=\s|$)/g, 'hähnchen').replace(/\bputenbr\./g, 'putenbrust').replace(/\bpass\.\s*/g, 'passierte ').replace(/waschm\./g, 'waschmittel');
// gleiche Sperren wie bei den Angeboten: Dose/Glas/Tiefkühl bei Obst und Gemüse, Aufschnitt/Innereien/andere Tierart/Gramm bei Fleisch
function bonBlocked(p, n, m) {
  if (COMPOUND_CATS.has(p.cat)) {
    if (p.cat === 'Obst & Gemüse' && CAN_RX.test(n)) return true;
    const rest = n.slice(m.index + m[0].length); if (/^-[a-zäöü]/.test(rest) && !/^-(?:rispe|mix|netz|schale|trio|duo|pack|beutel|auswahl|set)/.test(rest)) return true;
  }
  if (p.meat) {
    if (MEAT_NOISE.test(n) || (p.id !== 'gemhack' && EXCLUDE_RX.test(n)) || (p.animal && animalClash(p, n))) return true;
    const g = meatGrams({ name: n }); if (g != null && g < 200 && !(g >= 120 && !POULTRY_RX.test(n) && /steak|kotelett|schnitzel|medaillon|filet|rücken|keule|hüft|entrec/.test(n))) return true;
  }
  return false;
}

let BLOCK_STEMS = null;
const blockStems = () => BLOCK_STEMS || (BLOCK_STEMS = [...new Set([window.NOISE_RX, MEAT_NOISE, CAN_RX, window.EXCLUDE_RX].filter(Boolean).flatMap(r => r.source.split('|')).map(a => a.replace(/\(\?<?[!=][^)]*\)|\\b|[()?:^$\\]|\[[^\]]*\][*+?]?/g, '')).filter(a => /^[a-zäöüß]{5,}$/.test(a)))]);
// Bon-Abkürzung „bouil.“, „aufschn.“: steht vor dem Punkt der Anfang eines Sperrworts (auch am Ende eines zusammengesetzten Worts), wird das Sperrwort ergänzt
const bonAbbr = n => n.replace(/([a-zäöüß]+)\.(?![0-9])/g, (m0, t) => { for (let i = 0; i + 5 <= t.length; i++) { const tail = t.slice(i), s = blockStems().find(w => w.length >= tail.length + 2 && w.startsWith(tail)); if (s) return m0 + ' ' + s + ' '; } return m0; });
let FRESH_PRE = null, FRESH_KEY = '';
const freshPre = () => { const k = SRC.offers.length + ':' + PRODUCTS.length; if (FRESH_PRE && k === FRESH_KEY) return FRESH_PRE; const all = SRC.offers.map(enrich), set = new Set(['bio', 'ja', 'rewe', 'kl', 'klasse', 'lose', 'mini', 'riesen', 'spitz', 'rispen', 'cherry', 'snack', 'mix']);
  for (const o of all) { if (!o.p || o.p.cat !== 'Obst & Gemüse') continue; const nm = bonSchreib(o.store.id === 'aldi' ? o.name.split(',')[0] : o.name), m = rx(o.p).exec(nm); if (!m) continue; nm.slice(0, m.index).replace(/[^a-zäöüß\s]/g, ' ').split(/\s+/).filter(Boolean).forEach(w => set.add(w)); }
  Object.entries(brandMap()).forEach(([w, pid]) => { const p = PROD(pid); if (p && p.cat === 'Obst & Gemüse') set.add(w); });
  FRESH_KEY = k; return FRESH_PRE = set; };
const freshWord = w => freshPre().has(w) || BRAND_SKIP.has(fold(w)) || /isch(?:e[rsn]?)?$|^(?:rot|gelb|grün|weiß|bunt|dunk|hell|groß|klein|deutsch)/.test(w);
// Obst/Gemüse auf dem Bon: steht davor ein eigenes, unbekanntes Wort (Marke), ist das Produktwort nur die Sorte (Jumpys Paprika, Lay's Paprika, Hela Tomaten)
const STORE_WORDS = new Set(['rewe', 'beste', 'wahl', 'edeka', 'gut', 'günstig', 'guenstig', 'k', 'classic', 'aldi', 'lidl', 'netto', 'penny', 'kaufland', 'ja', 'biobio', 'simply', 'nah', 'gut&günstig']);
const brandBefore = (n, m) => { if (!m || m.index === 0 || /[a-zäöüß]/.test(n[m.index - 1])) return false; const toks = [...n.slice(0, m.index).matchAll(/([a-zäöüß]+)(\.?)/g)]; return toks.some(t => t[1].length >= 2 && !(t[2] && t[1].length <= 5) && !freshWord(t[1]) && !STORE_WORDS.has(t[1])); };
let BRANDW = null;
const brandWords = () => BRANDW || (BRANDW = PRODUCTS.filter(p => p.kwBon).flatMap(p => String(p.kwBon).split('|').map(a => [fold(a), p.id])).filter(([a]) => /^[a-z]{6,}$/.test(a)));
const KNOWN_W = {}; let KNOWN_KEY = '';
const knownWords = pid => { // Wörter aus den Angebotsnamen dieses Produkts (zum Prüfen, ob eine gekürzte Marke wirklich dieses Produkt meint)
  const k = SRC.offers.length + ':' + PRODUCTS.length; if (k !== KNOWN_KEY) { for (const x in KNOWN_W) delete KNOWN_W[x]; KNOWN_KEY = k; }
  if (KNOWN_W[pid]) return KNOWN_W[pid]; const set = new Set();
  OFFERS_ALL().forEach(o => { if (o.p && o.p.id === pid) fold(o.name + ' ' + (o.cats || '')).split(/[^a-z]+/).forEach(w => { if (w.length >= 3) set.add(w); }); });
  return KNOWN_W[pid] = set;
};
const BON_GENERIC = new Set(['bio', 'xl', 'xxl', 'pfand', 'rabatt', 'aktion', 'angebot', 'tüte', 'tuete', 'beutel', 'eur', 'stk', 'nr']);
function matchBonItem(it) {
  if (it.kind !== 'item') return it;
  const key = bonKey(it.name); it.aliasKey = key;
  if (S.aliases[key] && PROD(S.aliases[key])) { it.pid = S.aliases[key]; it.how = 'gelernt'; return it; }
  const n = bonAbbr(bonSchreib(it.name));
  if (!(window.NOISE_RX && (NOISE_RX.test(it.name) || NOISE_RX.test(n)))) {
    let best = null, len = 0;
    for (const p of PRODUCTS) {
      if (p.virtual && p.id !== 'fleisch') continue;
      if (p.not && new RegExp(p.not, 'i').test(n)) continue;
      let m = rx(p).exec(n); if (!m) m = p.kwBon && new RegExp(p.kwBon, 'i').exec(n); if (!m) { m = rx(p).exec(it.name); if (m && bonBlocked(p, it.name, m)) m = null; } else if (bonBlocked(p, n, m)) m = null;
      if (m && m[0].length > len) { best = p; len = m[0].length; }
    }
    if (best && best.cat === 'Obst & Gemüse' && !it.weightKg && brandBefore(n, rx(best).exec(n))) { it.brandFlavor = best.id; it.sugPid = best.id; it.sugC = 'low'; best = null; }
    if (best) { it.pid = best.id; it.how = 'erkannt'; return it; }
    for (const w of key.split(' ')) if (w.length >= 6) { const h = brandWords().filter(([b]) => b !== w && b.startsWith(w) && b.length - w.length <= 3); if (h.length && new Set(h.map(z => z[1])).size === 1 && PROD(h[0][1]) && !bonBlocked(PROD(h[0][1]), n, { index: 0, 0: '' }) && key.split(' ').filter(x => x !== w && x.length >= 3 && !BRAND_SKIP.has(x)).every(x => [...knownWords(h[0][1])].some(k => k.startsWith(x)))) { it.pid = h[0][1]; it.how = 'Marke'; it.tol = true; return it; } }
    const bm = brandMap(); for (const w of key.split(' ')) if (w.length >= 4 && bm[w] && PROD(bm[w])) { it.pid = bm[w]; it.how = 'Marke'; return it; }
  }
  const sg = key.length >= 3 && !BON_GENERIC.has(key) ? suggestFor(key, 1)[0] : null; // nur sichere Treffer: ganzes Wort oder Wortanfang ab 5 Buchstaben, nie ein loses Teilwort
  if (sg && sg.pid && it.brandFlavor !== sg.pid && (sg.score >= 100 || (sg.score >= 80 && key.length >= 5)) && !(PROD(sg.pid) && bonBlocked(PROD(sg.pid), n, { index: 0, 0: '' }))) { it.pid = sg.pid; it.how = 'ähnlich'; }
  return it;
}

/* ---------- Gewohnheiten: Stammladen, Referenzpreis, Spartipps ---------- */
const bonsSorted = () => S.bons.slice().sort((a, b) => b.date.localeCompare(a.date));
/* ---------- Kaufhistorie: eine gemeinsame Quelle für „Das kaufst du öfter“, Hauptprodukte und Angebotslisten ---------- */
const mergeDays = a => { const days = [...new Set(a)].sort(), out = []; for (const d of days) { if (out.length && (new Date(d) - new Date(out[out.length - 1])) / 864e5 <= 1) continue; out.push(d); } return out; }; // Tage innerhalb von 1 Tag zählen einmal (Eintragen und Abhaken derselben Ware)
const nearAny = (d, list) => list.some(x => Math.abs(new Date(d) - new Date(x)) / 864e5 <= 1);
const dateSane = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && d <= isoDay(new Date()) && d >= new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10); // echtes Datum: nicht in der Zukunft, nicht älter als ca. 400 Tage
let BH_S = null;
function buyHist(pid) { // Kauftage aus Bons (mit Bon-Datum, ohne unsichere Daten) und aus abgehakten Listenartikeln; Sammelprodukte zählen ihre Unterprodukte mit
  if (BH_S !== S) { BH = null; BH_S = S; } // wurde S ersetzt (Import, anderes Fenster), wird neu gerechnet
  BH = BH || {}; if (BH[pid]) return BH[pid];
  const p = PROD(pid), ids = new Set(p && p.group ? [...p.group, pid] : [pid]), bonMap = new Map();
  for (const b of S.bons) if (!b.du && b.items.some(i => i.pid && ids.has(i.pid))) bonMap.set(b.date, bonStoreName(b.store)); // zwei Bons an benachbarten Tagen bleiben zwei Käufe
  const bonDays = [...bonMap.keys()].sort(), got = new Set(); ids.forEach(id => ((S.got || {})[id] || []).forEach(d => got.add(d)));
  const gotDays = [...got].sort().filter(d => !nearAny(d, bonDays)); // Abhaken am Tag des Bons (±1) ist derselbe Kauf
  const days = [...bonDays, ...gotDays].sort(), legacy = (got.size || bonDays.length) ? 0 : Math.min(S.buys[pid] || 0, 10); // alte Zähler ohne Datum nur, wenn es sonst nichts gibt
  return BH[pid] = { days, stores: days.map(d => bonMap.get(d) || ''), n: days.length + legacy, last: days[days.length - 1] || '' };
}
const habitDays = p => { const base = buyHist(p.id).days; return [...base, ...mergeDays(((S.rec && S.rec[p.id]) || []).filter(d => !nearAny(d, base)))].sort(); }; // Tage, an denen du das Produkt eingetragen, abgehakt oder gekauft hast
const habitOk = p => watched(p.id) || habitDays(p).length >= 2; // „öfter“ = Favorit oder an mindestens 2 verschiedenen Tagen
function grundText(p) { // warum wird dieses Angebot unter „Das kaufst du öfter“ gezeigt?
  const h = buyHist(p.id), parts = [];
  const fy = d => fmtD(d) + (d.slice(0, 4) !== String(new Date().getFullYear()) ? d.slice(0, 4) : ''); // Jahr nur, wenn es nicht dieses ist
  if (h.days.length) parts.push('Gekauft am ' + h.days.slice(-2).reverse().map((d, k) => fy(d) + (h.stores.slice(-2).reverse()[k] ? ' (' + h.stores.slice(-2).reverse()[k] + ')' : '')).join(' und '));
  else { const d = habitDays(p); if (d.length) parts.push('Eingetragen am ' + d.slice(-2).reverse().map(fy).join(' und ')); } // „Favorit“ steht schon als Zeichen auf der Karte
  return parts.join(' · ');
}
function autoFav(pid) { const p = PROD(pid), l = buyHist(pid).last; if (p && !watched(pid) && freq(p) >= 3 && (!l || (Date.now() - new Date(l)) / 864e5 <= 120)) { S.watch.push(pid); return p.name; } return null; } // wer oft kauft, bekommt das Produkt als Favorit
function bonNote(pid, date) { if (dateSane(date)) noteRec(pid, date); return autoFav(pid); } // Bon-Kauf mit Bon-Datum (nicht mit dem Tag des Einlesens)
function boughtLog(pid) { const out = []; for (const b of bonsSorted().filter(x => !x.du)) { const it = b.items.find(i => i.pid === pid); if (it) out.push({ date: b.date, store: b.store, it }); } return out.slice(0, 5); } // ein Kauf pro Bon, nicht eine Zeile pro Artikel
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

/* ---------- Dein Standard: was du regelmäßig kaufst (Marke, Laden, Preis) und Vergleich mit Angeboten ---------- */
function bonBrand(name, p) { // Marke = die Wörter vor dem Produktwort („Meine Metzgerei Hackfleisch“ → „Meine Metzgerei“, „Kerrygold Butter“ → „Kerrygold“)
  if (!p) return '';
  const find = x => { try { return rx(p).exec(x) || (p.kwBon && new RegExp(p.kwBon, 'i').exec(x)); } catch (e) { return null; } };
  let src = String(name), m = find(src); if (!m) { src = bonSchreib(src); m = find(src); }
  if (!m || m.index <= 0) return '';
  const toks = src.slice(0, m.index).replace(/[^\p{L}\s&-]/gu, ' ').split(/\s+/).filter(Boolean);
  const br = toks.filter(w => w.length >= 2 && !BRAND_SKIP.has(fold(w)) && !/^(?:bio|frisch\w*|deutsch\w*|vom|von|der|die|das|rot\w*|gelb\w*|gr(?:ü|ue)n\w*|wei(?:ß|ss)\w*|bunt\w*|gem(?:ischt\w*)?)$/i.test(w)); // Farben und Qualitätswörter sind keine Marke
  if (!br.length || br.length > 3) return '';
  const s = br.join(' '); return s === s.toUpperCase() || s === s.toLowerCase() ? s.toLowerCase().replace(/(^|[\s&-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : s;
}
// Standard: mindestens 3 Käufe an verschiedenen Tagen innerhalb von 31 Tagen (gleiche Marke, sonst gleicher Laden). Der Neueste, der das erfüllt, bleibt, bis etwas Neues dazukommt.
function usualOf(pid) {
  const log = [];
  for (const b of S.bons) if (!b.du) for (const it of b.items) if (it.pid === pid && it.p > 0) {
    const q = it.q || 1, paid = it.p / q; if (!(paid >= 0.05 && paid <= 300)) continue; // unmöglicher Preis
    let pk = it.k && it.a > 0 && it.a <= 1000, up = pk ? it.p / (it.a * q) : null; if (up != null && !(isFinite(up) && up >= 0.01 && up <= 3000)) { pk = false; up = null; }
    log.push({ date: b.date, store: b.store, brand: it.b || '', name: it.n, paid, base: pk ? it.k : null, pack: pk ? it.a : null, up });
  }
  if (log.length >= 4) { const md = log.map(l => l.paid).sort((a, b) => a - b)[Math.floor(log.length / 2)]; for (let i = log.length - 1; i >= 0; i--) if (log[i].paid > md * 5 || log[i].paid < md / 5) log.splice(i, 1); } // Ausreißer (Lesefehler) raus
  if (log.length < 3) return null;
  log.sort((a, b) => b.date.localeCompare(a.date));
  const key = l => l.brand ? 'b:' + fold(l.brand) : 's:' + l.store, groups = {};
  log.forEach(l => (groups[key(l)] = groups[key(l)] || []).push(l));
  let best = null;
  for (const g0 of Object.values(groups)) {
    const g = g0.filter((l, i, a) => a.findIndex(x => x.date === l.date) === i); // ein Kauf pro Tag
    for (let i = 0; i + 2 < g.length; i++) if ((new Date(g[i].date) - new Date(g[i + 2].date)) / 864e5 <= 31) { if (!best || g[i].date > best.last) best = { g, last: g[i].date }; break; }
  }
  if (!best) return null;
  const win = best.g.filter(l => (new Date(best.last) - new Date(l.date)) / 864e5 <= 31), latest = win[0];
  const ups = win.filter(l => l.up && l.base === latest.base).map(l => l.up).sort((a, b) => a - b), cs = {}; win.forEach(l => cs[l.store] = (cs[l.store] || 0) + 1);
  return { brand: latest.brand, name: latest.name, store: Object.entries(cs).sort((a, b) => b[1] - a[1])[0][0], base: latest.base, pack: latest.pack, paid: latest.paid, up: ups.length ? ups[Math.floor(ups.length / 2)] : null, n: win.length, last: best.last };
}
function usualBlock(o, mini, p0) { // Vergleich eines Angebots mit deinem Standard (o = Angebot) oder nur der Standard (o leer, p0 = Produkt)
  const p = o ? o.p : p0; if (!p) return ''; const u = usualOf(p.id); if (!u) return '';
  const obr = o ? bonBrand(o.name, o.p) : '', same = u.brand && obr && fold(u.brand) === fold(obr);
  let v = '', cls = 'mute';
  if (o) {
    let d = null, e = null, note = '';
    if (o.up && u.up && o.up.base === u.base && u.up > 0) { d = (o.up.v - u.up) / u.up; e = (o.up.v - u.up) * (qtyBase(o) || u.pack || 1); }
    else if (o.price && u.paid) { d = (o.price - u.paid) / u.paid; e = o.price - u.paid; note = ' (Packungsgröße unklar)'; }
    if (d != null) {
      const pct = Math.round(Math.abs(d) * 100), eu = Math.abs(e) >= 0.05 ? eur(Math.abs(e)) : '';
      if (Math.abs(d) < 0.03) v = 'etwa gleich teuer' + note;
      else if (d < 0) { v = pct + ' % günstiger' + (eu ? ' (spart ' + eu + ')' : '') + note; cls = 'ok'; }
      else { v = pct + ' % teurer' + (eu ? ' (' + eu + ' mehr)' : '') + note; cls = 'warn'; }
    }
  }
  let un = u.name.replace(/\s+\d[\d.,]*\s?(?:kg|g|ml|l|er|stk)\b.*/i, '').trim(); // ohne Packungsgröße
  if (u.brand && fold(un).startsWith(fold(u.brand))) un = un.slice(u.brand.length).trim(); // Marke nicht doppelt
  const std = (u.brand ? esc(u.brand) + ' ' : '') + esc(un.slice(0, 32)) + ' bei ' + esc(bonStoreName(u.store));
  if (mini) return v ? `<div class="small usl2 ${cls}">↔ Dein Standard (${std}): <b>${v}</b></div>` : '';
  return `<div class="usl">🛒 <b>Dein Standard:</b> ${std} · ${u.up ? eur(u.up) + '/' + unitLbl(u.base) : eur(u.paid)} (zuletzt ${eur(u.paid)}${u.pack ? ' für ' + packLabel(u.base, u.pack) : ''}), ${u.n}× in einem Monat gekauft</div>${v ? `<div class="usl2 ${cls}">Dieses Angebot${same ? ' (gleiche Marke)' : obr ? ' (' + esc(obr) + ')' : ''}: <b>${v}</b></div>` : ''}`;
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
  const stores0 = [...STORES.filter(s => s.tier !== 'D' || s.id === 'selgros' || s.id === 'metro'), ...Object.keys(BON_NAMES).map(id => ({ id, short: BON_NAMES[id] }))], stores = [...stores0, ...[b.store, b.sug].filter(id => id && !stores0.some(s => s.id === id)).map(id => ({ id, short: bonStoreName(id) }))];
  const row = (it, i) => {
    const p = it.pid ? PROD(it.pid) : null, plan = p && it.kind === 'item' ? bonPlanNote(it, p, b.store) : '';
    return `<div class="item"><input type="checkbox" ${it.include ? 'checked' : ''} onchange="BON.parsed.items[${i}].include=this.checked;render()" aria-label="Zeile übernehmen" style="width:20px;height:20px;flex:none">
      <div class="grow"><div class="nm" style="cursor:default">${esc(it.name)}${it.qty > 1 ? ` <span class="mute">× ${it.qty}</span>` : ''}${it.pack ? ` <span class="mute">· ${esc(packLabel(it.pack.base, it.pack.amount))}</span>` : ''}</div>
      ${it.kind === 'pfand' ? '<span class="tag">Pfand</span>' : p ? `<button class="tag t-ok" onclick="bonAssign(${i})">✓ ${esc(p.name)}${it.how === 'ähnlich' ? ' (ähnlich, bitte prüfen)' : it.how === 'KI' ? ' (Vorschlag der KI, bitte prüfen)' : it.how === 'Marke' ? ' (an der Marke erkannt)' : ''}</button>` : it.sugPid && PROD(it.sugPid) ? `<button class="tag t-warn" onclick="bonSetPid(${i},'${it.sugPid}')">💡 Vielleicht „${esc(PROD(it.sugPid).name)}“? Antippen zum Übernehmen</button> <button class="lnk" onclick="bonAssign(${i})">anders zuordnen</button>` : `<button class="tag" onclick="bonAssign(${i})">🆕 wird als neues Produkt gemerkt${it.newName ? ': ' + esc(it.newName) : ''} · ändern</button>${it.what ? `<div class="mute small">Vermutlich: ${esc(it.what)}</div>` : ''}`}
      ${plan ? `<div class="mute small">${plan}</div>` : ''}</div><b>${eur(netPrice(it))}</b></div>`;
  };
  return `${back}<div class="card"><h3>🧾 Bon gelesen</h3><div class="fgrid" style="margin-top:8px"><label class="f">Laden<select id="bs" onchange="BON.parsed.store=this.value">${b.store || b.sug ? '' : '<option value="">– bitte wählen –</option>'}${stores.map(s => `<option value="${s.id}" ${s.id === (b.store || b.sug) ? 'selected' : ''}>${esc(s.short || s.name)}${!b.store && s.id === b.sug ? ' (Vorschlag)' : ''}</option>`).join('')}</select></label><label class="f">Datum<input id="bd" type="date" min="${new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10)}" max="${isoDay(new Date())}" value="${b.date || bonGuessDate()}" onchange="BON.parsed.date=this.value"></label></div><div class="small" style="margin-top:8px">${esc(sumLine)}</div></div>
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
  if (!b.date) why.push('Das Datum wurde nicht sicher gefunden. Vorgeschlagen ist der Tag des Fotos, bitte oben prüfen.');
  { const r = BON.refDay; if (b.date && r && Math.abs(new Date(b.date) - new Date(r)) / 864e5 > 60) why.push('Das Datum liegt weit vom Tag des Fotos entfernt. Bitte oben prüfen (Jahr verlesen?).'); }
  if (b.dateGuess) why.push('Das Jahr war nicht lesbar und wurde vom Foto-Tag übernommen. Bitte das Datum oben prüfen.');
  if (!b.store) why.push(b.sug ? 'Der Laden ist nur ein Vorschlag (' + bonStoreName(b.sug) + '). Bitte oben bestätigen.' : 'Der Laden wurde nicht gefunden. Bitte oben wählen.');
  if (BON.dupWarn) why.push(BON.dupWarn);
  if (!why.length) return '<div class="card" style="border-color:var(--ok,#2e9e5b)"><b>✓ Alles gelesen.</b></div>';
  return `<div class="card help"><b>ℹ️ Vielleicht nicht ganz vollständig</b><div class="small" style="margin-top:4px">Du kannst trotzdem speichern. Alles Gelesene wird genutzt.</div><ul class="small">${why.map(w => '<li>' + esc(w) + '</li>').join('')}</ul><div class="row"><button class="btn sm" onclick="bonAddTo('${BON.cur}')">📷 Foto ergänzen</button><button class="btn sm" onclick="bqReread('${BON.cur}')">🔄 Nochmal lesen</button></div></div>`;
}
function bonRead() {
  const t = $('#bt') ? $('#bt').value : BON.text; BON.text = t;
  if (!t.trim()) return feedbackText('Füge zuerst den Bon-Text ein.', true);
  BON.lowRead = 0; BON.photos = []; BON.cur = null; BON.refDay = ""; BON.fromPhoto = false; BON.curPhotos = []; const parsed = parseReceipt(t); BON.parsed = parsed;
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
function bonSetPid(i, pid) { const it = BON.parsed.items[i]; it.pid = pid; it.how = 'gewählt'; it.include = true; if (it.aliasKey && it.aliasKey.length >= 3 && pid) S.aliases[it.aliasKey] = pid; save(); closeSheet(); render(); }
function bonPick(j) { const s = BON.res[j]; if (!s) return; const a = parseAdd(s.t); bonSetPid(BON.assign, a.pid || mkCustom(a.name).id); }
function bonPickNew() { const it = BON.parsed.items[BON.assign]; const nm = it.name.replace(/\s+\d+[.,]?\d*\s?(kg|g|ml|l)\b/i, '').trim(); bonSetPid(BON.assign, mkCustom(nm).id); }
function bonPickNone() { const it = BON.parsed.items[BON.assign]; it.pid = null; it.include = false; closeSheet(); render(); }
function bonSave() {
  const b = BON.parsed; if (!b) return;
  const store = (b.store || ($('#bs') && $('#bs').value) || '').trim(), date = b.date || ($('#bd') && $('#bd').value) || (BON.refDay || isoDay(TODAY)); // ohne Datum: der Tag des Fotos, wie beim automatischen Speichern
  if (!store) return feedbackText('Bitte wähle oben den Laden aus.', true);
  if (!dateSane(date)) return feedbackText('Das Datum ' + esc(fmtD(date)) + ' ist nicht plausibel (in der Zukunft oder älter als ein Jahr). Bitte oben das richtige Datum eintragen.', true);
  const items = b.items.filter(i => i.kind === 'item' && i.include);
  if (!items.length) return feedbackText('Es ist keine Position ausgewählt.', true);
  if (!BON.allowDup) { const d = bonDupOf(store, date, b.total, bonNames(items), BON.cur, b.time); if (d && !confirm(d.sure ? 'Diesen Bon hast du schon (' + bonStoreName(d.c.store) + ', ' + fmtD(d.c.date) + '). Trotzdem nochmal speichern? Dann zählt er doppelt.' : 'Es gibt schon einen Bon vom selben Laden und Tag mit derselben Summe, aber anderen Artikeln. Trotzdem speichern?')) return; }
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
function bonResolveNew(items) { // unbekannte Zeilen: KI-Vorschlag übernehmen oder als neues Produkt anlegen. So kennt die App es beim nächsten Mal von selbst.
  const neu = [];
  items.forEach(i => {
    if (i.pid) return;
    if (i.sugPid && PROD(i.sugPid) && i.sugC !== 'low') { i.pid = i.sugPid; i.how = 'ähnlich'; return; }
    const nm = bonNewName(i); if (!nm) return;
    const a = parseAdd(nm); i.pid = a.pid || mkCustom(a.name).id; i.how = 'neu'; if (!a.pid) neu.push(a.name);
  });
  return neu;
}
// Doppelt gescannter Bon: fehlende Artikel im gespeicherten Bon ergänzen und „Schon gekauft?“ trotzdem prüfen (der erste Scan kann Zeilen verpasst haben)
async function bqDupMerge(m) {
  if (!m.text || m.merged) return 0;
  const b = parseReceipt(m.text, { ref: bonRef(m) }); if (m.ai) bonApplyAi(b.items, m.ai);
  const items = b.items.filter(i => i.kind === 'item' && i.include), date = bonDateOf(m, b).date, names = bonNames(items);
  const rec = S.bons.find(x => x.store === b.store && x.date === date && b.total != null && x.total != null && Math.abs(x.total - b.total) < 0.005 && !(x.time && b.time && Math.abs(toMin(x.time) - toMin(b.time)) > 10) && (bonJac(x.items.map(i => bonNorm(i.n)), names) >= 0.6 || bonCover(x.items.map(i => bonNorm(i.n)), names) >= 0.95)); // nur ergänzen, wenn es wirklich derselbe Bon ist
  let add = 0;
  if (rec) {
    const have = new Set(rec.items.map(i => bonNorm(i.n))), same = i => rec.items.some(x => Math.abs(x.p - netPrice(i)) < 0.005 && fold(x.n).slice(0, 3) === fold(i.name).slice(0, 3)); // gleicher Preis und Anfang: andere Schreibweise desselben Artikels
    let fresh = items.filter(i => !have.has(bonNorm(i.name)) && !same(i));
    if (b.total != null && rec.items.reduce((s, x) => s + x.p, 0) + fresh.reduce((s, i) => s + netPrice(i), 0) > b.total + 0.02) fresh = []; // mit den neuen Zeilen läge die Summe über dem Bon: nichts ergänzen
    bonResolveNew(fresh);
    fresh.forEach(i => { rec.items.push(bonRecItem(i)); if (i.aliasKey && i.aliasKey.length >= 3 && i.pid && i.how === 'gewählt') S.aliases[i.aliasKey] = i.pid; add++; });
    if (!rec.time && b.time) rec.time = b.time;
    if (add) TIPS = null;
  }
  const bts = bonTs(date, b.time, rec ? rec.saved : Date.now()), cand = [];
  S.list.filter(l => !l.done && !addedAfter(l, bts)).forEach(l => { const hit = bonMatchList(l, items); if (hit) cand.push({ id: l.id, name: l.name, qty: l.qty, bon: hit.name }); });
  const done = askDone(); bonAskAdd(cand.filter(c => !done.has(c.id)));
  m.merged = true; await bqSaveMeta(m); save(); if (cand.length) setTimeout(() => askPopup(true), 400);
  return add;
}
// Bon verbuchen (von Hand oder automatisch): lernt Produkte, Preise, Stammladen und meldet, was auf der Liste schon gekauft ist
const bonRecItem = i => ({ n: i.name.slice(0, 60), q: i.qty, p: netPrice(i), pid: i.pid || null, k: i.pack ? i.pack.base : null, a: i.pack ? +i.pack.amount.toFixed(3) : null, b: bonBrand(i.name, i.pid ? PROD(i.pid) : null) }); // so wird ein Bon-Artikel gespeichert (nur hier)
function bonCommit(b, items, store, date, qid, opt) {
  opt = opt || {};
  const neu = bonResolveNew(items);
  const partial = bonComplete(b) === false || !!opt.lowRead || items.length > 120;
  const oldTip = new Set(savingTips().map(t => t.p.id)), before = {};
  items.forEach(i => { if (i.pid) before[i.pid] = stammladen(i.pid); });
  const rec = { id: uid(), date, saved: Date.now(), store, total: b.total, items: items.map(bonRecItem), ...(partial ? { partial: true } : {}), ...(b.time ? { time: b.time } : {}) };
  if (!dateSane(date)) rec.du = true; // Datum in der Zukunft oder uralt: zählt nicht
  S.bons.unshift(rec); S.bons = bonsSorted().slice(0, 60); BH = null; // Kaufhistorie neu rechnen, bevor Favoriten geprüft werden
  const lines = [], spont = [], favNew = [];
  const seen = new Set(), seenP = new Set();
  items.forEach(i => {
    if (!i.pid) return;
    const p = PROD(i.pid); if (!p) return;
    if (i.aliasKey && i.aliasKey.length >= 3 && i.how === 'gewählt') S.aliases[i.aliasKey] = i.pid; // gelernt wird nur, was du selbst gewählt hast; Vermutungen (ähnlich, Marke) bleiben Vermutungen
    if (i.pack && (i.pack.base === p.base || !p.base)) { const up = netPrice(i) / (i.pack.amount * (i.qty || 1)); if (up > 0 && isFinite(up) && dateSane(date)) { const old = S.hist.find(h => h.pid === p.id && h.date === date && h.store === store); if (old) old.up = +up.toFixed(3); else S.hist.push({ pid: p.id, up: +up.toFixed(3), date, store }); } } // ein Eintrag je Produkt, Tag und Laden; keiner bei unplausiblem Datum
    if (seen.has(p.id)) return; seen.add(p.id);
    const parents = PRODUCTS.filter(q => q.group && q.id !== p.id && q.group.includes(p.id) && !(q.virtual && q.id !== 'fleisch')); // Sammelprodukt: „Hähnchenbrust“ auf dem Bon zählt auch für „Hähnchen“ und „Fleisch“
    if (!S.list.some(l => l.pid === p.id || parents.some(q => q.id === l.pid))) spont.push(p.name);
    const f = bonNote(p.id, date); if (f) favNew.push(f);
    parents.forEach(q => { if (!seenP.has(q.id)) { seenP.add(q.id); const g = bonNote(q.id, date); if (g) favNew.push(g); } });
  });
  S.hist = S.hist.slice(-400);
  TIPS = null; CACHE = null; // Referenz hat sich geändert: Angebote neu bewerten
  const total = items.reduce((s, i) => s + netPrice(i), 0);
  lines.push(`<b>${items.length} Positionen</b> bei <b>${esc(bonStoreName(store))}</b> am ${esc(fmtD(date))}, zusammen ${eur(total)}${partial ? ' (nur teilweise gelesen)' : ''}.`);
  const bts = bonTs(date, b.time, rec.saved), cand = []; // noch offene Listen-Artikel, die auf dem Bon waren (und schon vor dem Bon-Datum auf der Liste standen)
  S.list.filter(l => !l.done).forEach(l => { if (addedAfter(l, bts)) return; const hit = bonMatchList(l, items); if (hit) cand.push({ id: l.id, name: l.name, qty: l.qty, bon: hit.name }); });
  (opt.pairs || []).forEach(p => { const l = S.list.find(x => !x.done && x.name.toLowerCase() === p.l.toLowerCase() && !addedAfter(x, bts) && !cand.some(c => c.id === x.id)); if (l) cand.push({ id: l.id, name: l.name, qty: l.qty, bon: p.b }); }); // Paare, die die KI erkannt hat
  if (spont.length) lines.push(`🛍️ Spontan gekauft (stand nicht auf der Liste): ${spont.slice(0, 8).map(esc).join(', ')}. Was öfter vorkommt, wird automatisch zum Hauptprodukt.`);
  if (neu.length) lines.push(`🆕 Neue Produkte gemerkt: ${neu.slice(0, 6).map(esc).join(', ')}. Beim nächsten Bon erkennt die App sie von selbst.`);
  if (favNew.length) lines.push(`⭐ Neu in deinen Hauptprodukten: ${favNew.map(esc).join(', ')}.`);
  [...seen].forEach(pid => { const st = stammladen(pid), was = before[pid]; if (st && (!was || was.store !== st.store)) lines.push(`📍 ${esc(PROD(pid).name)}: Du kaufst das meist bei <b>${esc(bonStoreName(st.store))}</b> (${st.n} von ${st.of} Käufen).`); });
  const newTips = savingTips().filter(t => !oldTip.has(t.p.id)); newTips.slice(0, 2).forEach(t => lines.push(`💡 ${esc(t.p.name)}: ${esc(tipText(t))}`));
  if (!S.lastBackup || (TODAY - d0(S.lastBackup)) / 864e5 > 14) lines.push('💾 Tipp: Mach bald eine Sicherung (Mehr → Exportieren). Bon-Fotos sind nicht in der Sicherung.');
  if (qid) { bqSaved(qid, rec, total); lines.push('🗑️ Das Papier kannst du jetzt wegwerfen. Das Foto bleibt noch hier gespeichert.'); }
  return { lines, cand, rec, total, partial, n: items.length };
}
// Automatisch speichern, sobald ein Bon gelesen ist (nur wenn Laden bekannt und kein Verdacht auf doppelt)
async function bqAutoSave(m) {
  if (m.status !== 'gelesen' || !m.text) return false;
  const b = parseReceipt(m.text, { ref: bonRef(m) }); if (m.ai) bonApplyAi(b.items, m.ai);
  if (!m.allowDup) { m.warn = ''; bqDupCheck(m, b); } // vor dem Speichern noch einmal: ist das ein Bon, den es schon gibt?
  if (m.status === 'doppelt') { await bqSaveMeta(m); const add = await bqDupMerge(m).catch(() => 0); feedbackText('🔁 Dieser Bon ist doppelt (' + esc(m.dupText || 'schon vorhanden') + '). Er wird nicht mitgerechnet.' + (add ? ' Ich habe ' + add + ' fehlende Artikel im gespeicherten Bon ergänzt.' : '')); return true; }
  if (m.warn) { m.hold = 'evtl. doppelt'; await bqSaveMeta(m); return false; }
  const store = b.store, dd = bonDateOf(m, b), date = dd.date;
  if (!store) { m.hold = b.sug ? 'Laden nicht sicher (Vorschlag: ' + bonStoreName(b.sug) + '): bitte bestätigen' : 'Laden nicht erkannt: bitte Laden wählen'; await bqSaveMeta(m); return false; }
  if (b.dateGuess) { m.hold = 'Jahr nicht sicher: bitte Datum prüfen'; await bqSaveMeta(m); return false; }
  const items = b.items.filter(i => i.kind === 'item' && i.include); if (!items.length) { m.hold = 'keine Artikel erkannt'; await bqSaveMeta(m); return false; }
  const pairs = await bqAiPair(items, date, b.time).catch(() => []);
  const res = bonCommit(b, items, store, date, m.id, { lowRead: m.lowRead || 0, pairs });
  if (res.cand.length) bonAskAdd(res.cand);
  save(); if (res.cand.length) setTimeout(() => askPopup(true), 400);
  feedbackText(`✓ Bon gespeichert: ${res.n} Artikel bei ${esc(bonStoreName(store))}${res.partial ? ' (teilweise gelesen)' : ''}${dd.guess ? ' (Datum nicht erkannt, der Tag des Fotos gilt)' : ''}.${res.cand.length ? ' Auf der Liste fragt die App, was schon gekauft ist.' : ''}`);
  return true;
}
// „Schon gekauft?“ bleibt auf der Liste und der Route stehen, bis du antwortest
const knownWord = w => PRODUCTS.some(q => !q.custom && !q.virtual && (() => { try { return rx(q).test(w); } catch (e) { return false; } })()); // ist das Wort selbst ein bekanntes Produkt?
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
    return lw.some(a => bw.some(b => a === b || (Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a)) && (Math.abs(a.length - b.length) <= 3 || !knownWord(a.length < b.length ? a : b))))); // „Einweghandschuhe“ ~ „Einweg Nitril“
  }) || null;
}
// Die KI findet Paare, die sich nicht am Namen erkennen lassen (nur Namen, keine Preise)
async function bqAiPair(items, date, time) {
  if (!aiKey() || navigator.onLine === false) return [];
  const bts = bonTs(date, time, Date.now()), open = S.list.filter(l => !l.done && !addedAfter(l, bts) && !bonMatchList(l, items)).map(l => l.name).slice(0, 25);
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
  const done = askDone(), have = new Set((S.ask || []).map(x => x.id)), now = Date.now(); let added = false;
  for (const b of S.bons) {
    if (b.du) continue; // Datum unbekannt
    const ts = bonTs(b.date, b.time, b.saved), age = (now - ts) / 864e5; if (age > ASK_MAX_AGE_DAYS) continue; // ältere Bons nicht mehr
    const items = b.items.map(i => ({ name: i.n, pid: i.pid }));
    S.list.filter(l => !l.done && !done.has(l.id) && !have.has(l.id)).forEach(l => { if (l.t ? l.t > ts : age > 3) return; /* ohne Eintragszeit nur bei ganz frischen Bons */ const hit = bonMatchList(l, items); if (hit) { bonAskAdd([{ id: l.id, name: l.name, qty: l.qty, bon: hit.name }]); have.add(l.id); added = true; } });
  }
  if (added) save();
}
function bonAskAdd(c) { S.ask = S.ask || []; const have = new Set(S.ask.map(x => x.id)); c.forEach(x => { if (!have.has(x.id)) S.ask.push(x); }); S.ask = S.ask.slice(-30); }
function askBoughtCard() { // prüft im Hintergrund und zeigt beim Betreten von Liste oder Route sofort das Fenster; die Fragen selbst stehen an den Produkten
  bonRecheck();
  S.ask = (S.ask || []).filter(x => S.list.some(l => l.id === x.id && !l.done));
  if (S.ask.length) { const sh = askShown(); if (S.ask.some(x => !sh.has(x.id))) setTimeout(askPopup, 350); } // Fenster nur für Fragen, die du noch nie im Fenster gesehen hast
  return '';
}
const askOpen = (id, it) => !it.done && (S.ask || []).some(x => x.id === id); // wartet dieser Eintrag auf eine Antwort?
function askOv(id, it) { // Auflage auf der rechten Seite des Eintrags: „Schon gekauft?“ mit zwei Knöpfen. Der Rest des Eintrags bleibt sichtbar (abgedunkelt).
  const a = (S.ask || []).find(x => x.id === id); if (!a || it.done) return '';
  return `<div class="askov" title="Auf dem Bon: ${esc(a.bon)}"><small>🧾 Schon gekauft?</small><span class="askbtns"><button class="btn sm pri" onclick="event.stopPropagation();askBought('${id}',true)">✓ Gekauft</button><button class="btn sm" onclick="event.stopPropagation();askBought('${id}',false)">Bleibt</button></span></div>`;
}
function askSheetHtml() {
  UI.askOff = UI.askOff || new Set();
  const list = (S.ask || []).filter(x => byId(x.id)), n = list.filter(x => !UI.askOff.has(x.id)).length;
  const rows = list.map(x => { const it = byId(x.id), r = rowInfo(it), on = !UI.askOff.has(x.id);
    return `<div class="askit${on ? ' on' : ''}" onclick="askTog('${x.id}')" role="checkbox" aria-checked="${on}" tabindex="0">${thumb(imgFor(it, r.b), iconFor(r.p, it.name), 'md')}<div class="grow"><div class="askn">${esc(it.name)}${it.qty ? ` <span class="mute">${esc(qtyLabel(it.qty))}</span>` : ''}</div><div class="mute small">🧾 auf dem Bon: ${esc(x.bon)}</div></div><span class="chk${on ? ' on' : ''}">${on ? '✓' : ''}</span></div>`; }).join('');
  return `<h3>🛒 Schon gekauft?</h3><div class="mute small" style="margin:2px 0 8px">Das stand schon vor dem Einkauf auf deiner Liste und ist auf dem Bon. Häkchen = gekauft. Antippen schaltet um.</div>${rows}<div class="row" style="margin-top:10px"><button class="btn pri" style="flex:1" onclick="askConfirm()">✓ Bestätigen (${n})</button><button class="btn" onclick="closeSheet()">Abbrechen</button></div><div class="mute small" style="text-align:center;margin-top:6px">Abbrechen: die Fragen stehen dann direkt an den Produkten.</div>`;
}
const askShown = () => { try { return new Set(JSON.parse(localStorage.getItem('einkauf.askshown') || '[]')); } catch (e) { return new Set(); } };
const askShownAdd = ids => { try { const s = askShown(); ids.forEach(i => s.add(i)); localStorage.setItem('einkauf.askshown', JSON.stringify([...s].slice(-150))); } catch (e) { } };
function askPopup(any) { // Fenster sofort, wenn etwas erkannt wurde, oder beim Betreten von Liste oder Route; wer es wegklickt, sieht es nicht noch einmal (die Fragen stehen dann an den Produkten)
  if (!any && !(cur === 'list' || cur === 'route')) return;
  const sh0 = askShown(); if (!(S.ask || []).some(x => !sh0.has(x.id))) return;
  const sh = $('#sheet'), dk = $('#dock'); if (!sh || !sh.hidden || (dk && dk.classList.contains('open')) || DRAG.on) return;
  askShownAdd(S.ask.map(x => x.id)); UI.askSheet = true; UI.askOff = new Set(); $('#sheetbox').innerHTML = askSheetHtml(); sh.hidden = false;
}
function askRefresh() { const sh = $('#sheet'); if (!UI.askSheet || !sh || sh.hidden) return; if (!(S.ask || []).length) closeSheet(); else $('#sheetbox').innerHTML = askSheetHtml(); }
function askTog(id) { UI.askOff = UI.askOff || new Set(); if (UI.askOff.has(id)) UI.askOff.delete(id); else UI.askOff.add(id); askRefresh(); }
function askConfirm() { // Häkchen = gekauft (von der Liste nehmen), ohne Häkchen = bleibt
  const off = UI.askOff || new Set(), all = (S.ask || []).map(x => x.id), yes = all.filter(i => !off.has(i));
  askDoneAdd(all); const gone = S.list.map((it, i) => ({ it, i })).filter(x => yes.includes(x.it.id)); if (gone.length) { pushUndo(gone); S.list = S.list.filter(i => !yes.includes(i.id)); shortCheckEnd(); }
  S.ask = []; UI.askOff = new Set(); closeSheet(); save(); render();
  if (yes.length) feedbackText('✓ ' + yes.length + ' von der Liste genommen. <button class="lnk" onclick="undoDel()">Rückgängig</button>'); else toast('Alles bleibt auf der Liste');
}
function askBought(id, yes) { askDoneAdd([id]); let gone = null; if (yes) { const k = S.list.findIndex(i => i.id === id); if (k >= 0) { gone = { it: S.list[k], i: k }; pushUndo([gone]); } S.list = S.list.filter(i => i.id !== id); shortCheckEnd(); } S.ask = (S.ask || []).filter(x => x.id !== id); save(); render(); askRefresh(); if (gone) feedbackText('✓ „' + esc(gone.it.name) + '“ von der Liste genommen. <button class="lnk" onclick="undoDel()">Rückgängig</button>'); }
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
/* ---------- Bon-Diagnose: nur auf diesem Gerät, damit Fehler mit echten Daten analysiert werden können ---------- */
const DIAG_KEY = 'einkauf.diag';
const diagGet = () => { try { const a = JSON.parse(localStorage.getItem(DIAG_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x === 'object').slice(-20) : []; } catch (e) { return []; } }; // jeder Eintrag wird geprüft, höchstens 20
function bonDiag(m, text, p, err) { // merkt sich je gelesenem Bon, was die Foto-Lesung geliefert und die App erkannt hat (letzte 30)
  try { const a = diagGet(); a.push({ t: Date.now(), v: APP_BUILD.v, foto: Number.isFinite(+m.created) ? isoDay(new Date(m.created)) : '', laden: p.store || null, vorschlag: p.sug || null, datum: p.date || null, jahrGeschaetzt: !!p.dateGuess, zeit: p.time || null, summe: p.total, artikel: p.items.length, fehler: err || '', text: String(text || '').slice(0, 2000) }); localStorage.setItem(DIAG_KEY, JSON.stringify(a.slice(-20))); } catch (e) { }
}
function diagBlock() {
  const a = diagGet(), bad = a.filter(x => !x.laden || !x.datum).length;
  return `<h2>🩺 Bon-Diagnose</h2><div class="card"><div class="small">${a.length ? 'Die App merkt sich auf diesem Gerät die letzten ' + a.length + ' gelesenen Bons (Rohtext und was erkannt wurde). ' + bad + ' davon ohne sicheren Laden oder ohne Datum.' : 'Noch kein Bon gelesen.'} Nichts davon wird hochgeladen. Wenn etwas nicht erkannt wird, kannst du die Diagnose als Datei sichern und mir geben.</div><div class="row" style="margin-top:8px"><button class="btn sm" onclick="diagExport()" ${a.length ? '' : 'disabled'}>Diagnose sichern</button><button class="btn sm" onclick="diagClear()" ${a.length ? '' : 'disabled'}>Löschen</button></div></div>`;
}
async function diagExport() {
  const name = 'bon-diagnose-' + isoDay(TODAY) + '.json', json = JSON.stringify({ app: 'einkaufsliste-bon-diagnose', exportiert: new Date().toISOString(), eintraege: diagGet() }, null, 1), file = new File([json], name, { type: 'application/json' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Bon-Diagnose' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); feedbackText('✓ Diagnose gesichert: ' + esc(name));
}
function diagClear() { try { localStorage.removeItem(DIAG_KEY); } catch (e) { } render(); }
const bonRef = m => Number.isFinite(+m.created) ? isoDay(new Date(m.created)) : ''; // Tag des Fotos: Bezugspunkt für ein unsicheres Datum
const bonGuessDate = () => BON.refDay || '';
const AI_PROMPT = 'The images show ONE German supermarket receipt. Several images are consecutive parts of the same receipt from top to bottom: where they overlap, write the overlapping lines only once. ' +
  'Transcribe the receipt line by line exactly as printed: one output line per printed line, in the same order, with product names, quantity lines such as "5 Stk x 1,09", deposit (Pfand) lines, prices with decimal comma and the tax letter after the price, the shop name or logo text at the very top (for example REWE, ALDI, Lidl, Netto, dm), the address and phone lines, the SUMME/total line, and the footer lines with date and time (for example "Datum: 10.10.2026" and "Uhrzeit: 17:28:11 Uhr") even when they are at the very bottom or partly cut off. ' +
  'Do not translate, correct, merge, summarize or invent anything. Write [?] where a part is unreadable. ' +
  'If the image clearly is not a shop receipt at all (for example a person, a product, a landscape, a screenshot or another kind of document), answer exactly: KEIN_BON. If it is a receipt but is mostly unreadable, answer exactly: NICHT_LESBAR. Output only the transcription, without any comment.';
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
    <div class="mute small" style="margin:6px 0">Der Schlüssel bleibt nur auf diesem Gerät (nicht im Export, nicht auf GitHub). Beim Auslesen geht das Foto an ${g ? 'Google' : 'Anthropic'}. Die App speichert es nicht.</div><div class="mute small" style="margin:6px 0">🔒 Tipp: ${g ? 'Schränke den Schlüssel in Google AI Studio auf die Gemini-API ein und lege ein Tageslimit fest.' : 'Lege in der Anthropic-Konsole ein monatliches Ausgabenlimit fest.'} So kann ein verlorener Schlüssel kaum Schaden anrichten.</div>
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
  if (BON.ablegen) return; // Doppeltipp: läuft schon
  if (!BON.photos.length) return feedbackText('Mach zuerst ein Foto vom Bon.', true);
  BON.ablegen = true;
  try {
    const fotos = BON.photos.map(p => p.b64);
    if (BON.addTo) { // weitere Fotos zu einem vorhandenen Bon
      const m = BQ.list.find(x => x.id === BON.addTo);
      if (m) { const alt = await bqFotosGet(m.id); await bqFotosSet(m.id, [...alt, ...fotos].slice(0, MAX_PHOTOS)); Object.assign(m, { status: 'wartet', err: '', text: '', nPhotos: Math.min(MAX_PHOTOS, alt.length + fotos.length), hasPhotos: true }); await bqSaveMeta(m); }
      BON.addTo = null;
    } else {
      const hash = fnvHash(fotos.join(''));
      if (BQ.list.some(x => x.hash === hash)) { BON.photos = []; render(); return feedbackText('Dieses Foto hast du schon abgelegt. Es wird nicht doppelt gezählt.', true); }
      const m = { id: uid(), created: Date.now(), status: 'wartet', err: '', nPhotos: fotos.length, hasPhotos: true, hash };
      BQ.list.unshift(m); // sofort eintragen, bevor etwas gewartet wird
      try { await bqFotosSet(m.id, fotos); await bqSaveMeta(m); } catch (e) { BQ.list = BQ.list.filter(x => x !== m); throw e; }
    }
    BON.photos = []; BON.err = ''; BQ.cool = 0; BQ.sorted = 0;
    feedbackText('✓ Abgelegt. Gelesen wird im Hintergrund, du kannst weitermachen. Das Papier bitte erst nach dem Speichern wegwerfen.');
    render(); bqRun();
  } finally { BON.ablegen = false; }
}
async function bqSweep() { // schon gelesene Bons, die noch warten, werden jetzt automatisch gespeichert
  if (BQ.sweeping) return; BQ.sweeping = true;
  try {
    await bqPurgeSorted().catch(() => { });
    for (const m of BQ.list.filter(x => x.status === 'doppelt' && x.text && !x.merged)) { try { await bqDupMerge(m); } catch (e) { m.merged = true; } }
    for (const m of BQ.list.filter(x => x.status === 'gelesen' && x.text && !x.hold && !x.allowDup)) { // jeder Bon für sich: ein Fehler bei einem hält die anderen nicht auf
      try { if (!m.aiDone && aiKey() && navigator.onLine !== false) await bqAiMatch(m); await bqAutoSave(m); }
      catch (e) { m.hold = 'Fehler beim Speichern: bitte prüfen'; try { await bqSaveMeta(m); } catch (x) { } }
    }
  } finally { BQ.sweeping = false; bqChanged(); }
}
// Zwei Fenster der App: nur eines liest die Warteschlange (Sperre läuft nach 90 Sekunden von selbst ab)
const BQ_TAB = Math.random().toString(36).slice(2, 10), BQ_LOCK = 'einkauf.bqlock'; // uid() gibt es beim Laden von receipt.js noch nicht
function bqLockOk() { try { const raw = localStorage.getItem(BQ_LOCK), p = raw ? raw.split('|') : []; if (p[1] && p[1] !== BQ_TAB && Date.now() - +p[0] < 90000) return false; localStorage.setItem(BQ_LOCK, Date.now() + '|' + BQ_TAB); } catch (e) { } return true; }
function bqLockFree() { try { const raw = localStorage.getItem(BQ_LOCK); if (raw && raw.split('|')[1] === BQ_TAB) localStorage.removeItem(BQ_LOCK); } catch (e) { } }
async function bqSortOut(m) { // Foto ohne Kassenbon: aus der Warteschlange genommen, 7 Tage zum Zurückholen, dann endgültig gelöscht
  m.status = 'aussortiert'; m.sortedAt = Date.now(); m.err = ''; await bqSaveMeta(m);
  BQ.sorted = (BQ.sorted || 0) + 1; bqChanged(); feedbackText('🗑️ Das Foto war kein Kassenbon und wurde aussortiert. Unter Mehr → Bon kannst du es 7 Tage lang zurückholen.');
}
async function bqPurgeSorted() { const old = BQ.list.filter(m => m.status === 'aussortiert' && Date.now() - (m.sortedAt || 0) > SORT_KEEP_DAYS * 864e5); for (const m of old) { BQ.list = BQ.list.filter(x => x !== m); await bqFotosDel(m.id).catch(() => { }); await bqTx('meta', 'readwrite', s => s.delete(m.id)).catch(() => { }); } }
async function bqUnsort(id) { const m = BQ.list.find(x => x.id === id); if (!m) return; Object.assign(m, { status: 'wartet', sortedAt: 0, keep: true, err: '' }); await bqSaveMeta(m); bqChanged(); BQ.cool = 0; bqRun(true); }
function bqSortedBlock() {
  const l = BQ.list.filter(m => m.status === 'aussortiert'); if (!l.length) return '';
  return `<details class="card tight"><summary class="mute">🗑️ Aussortiert: kein Kassenbon (${l.length}) · 7 Tage zum Zurückholen</summary>${l.map(m => `<div class="item"><div class="grow small">Foto vom ${esc(new Date(m.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</div><button class="btn sm" onclick="bqUnsort('${m.id}')">↩ Doch ein Bon</button><button class="ico" onclick="bonDelete('${m.id}')" aria-label="Endgültig löschen">🗑</button></div>`).join('')}</details>`;
}
async function bqRun(force) {
  if (BQ.running || !BQ.ready) return;
  BQ.running = true; // sofort sperren, bevor etwas gewartet wird (sonst laufen zwei Lese-Schleifen gleichzeitig)
  try {
    if (!bqLockOk()) return; // ein anderes Fenster der App liest gerade
    await bqSweep();
    if (!aiKey() || navigator.onLine === false || (!force && Date.now() - BQ.cool < 5 * 60e3)) { bqStrip(); return; }
    BQ.keyProblem = '';
    for (;;) {
      const m = [...BQ.list].reverse().find(x => x.status === 'wartet'); // ältester zuerst
      if (!m) break;
      if (!bqLockOk()) break;
      m.status = 'liest'; m.err = ''; BQ.note = ''; bqChanged();
      let stop = false;
      try {
        const fotos = await bqFotosGet(m.id); if (!fotos.length) throw Object.assign(new Error('Das Foto fehlt.'), { fatal: true });
        let text = await aiAsk(fotos, AI_PROMPT, 2500);
        if (/^\W*KEIN_BON/i.test(text || '')) throw Object.assign(new Error('Auf dem Foto war kein Kassenbon.'), { fatal: true, sort: true });
        if (!text || /^\W*NICHT_LESBAR/i.test(text)) throw Object.assign(new Error('Auf dem Foto war kein Bon lesbar. Neues Foto machen oder löschen.'), { fatal: true });
        let parsed = parseReceipt(text, { ref: bonRef(m) });
        if (!parsed.items.length) throw Object.assign(new Error('Keine Positionen erkannt. Schärferes, näheres Foto machen.'), { fatal: true, sort: !parsed.store && parsed.total == null && !parsed.date && !/\d[.,]\d{2}/.test(text) }); // weder Laden, Summe, Datum noch ein Preis: kein Kassenbon
        const sc = p => (p.store ? 1 : 0) + (p.date ? 1 : 0) + (p.total != null ? 1 : 0);
        if (parsed.total == null || !parsed.store || !parsed.date) { // etwas fehlt (Summe, Laden oder Datum): mit einem anderen Modell noch einmal versuchen und das vollständigere nehmen
          try { const t2 = await aiAsk(fotos, AI_PROMPT + ' Do not stop early: the transcription must include the last lines (SUMME/total, payment and date).', 2500, aiAsk.meta && aiAsk.meta.model), p2 = parseReceipt(t2, { ref: bonRef(m) }); if (p2.items.length >= parsed.items.length * 0.7 && (sc(p2) > sc(parsed) || (sc(p2) === sc(parsed) && p2.items.length > parsed.items.length))) { text = t2; parsed = p2; } } catch (e) { /* erstes Ergebnis behalten */ }
        }
        bonDiag(m, text, parsed); Object.assign(m, { text, lowRead: (text.match(/\[\?\]/g) || []).length, total: parsed.total, status: 'gelesen', err: '', warn: '', hold: '' }); bqDupCheck(m, parsed);
        if (m.status === 'doppelt') { const add = await bqDupMerge(m).catch(() => 0); feedbackText('🔁 Dieser Bon ist doppelt und wird nicht mitgerechnet.' + (add ? ' Ich habe ' + add + ' fehlende Artikel im gespeicherten Bon ergänzt.' : '')); }
      } catch (e) {
        bonDiag(m, '', { items: [] }, e.message); // auch Fehlschläge (kein Bon, nicht lesbar, keine Positionen) festhalten
        if (e.sort && !m.keep) { m.status = 'aussortiert'; m.err = ''; }
        else if (e.fatal) { m.status = 'fehler'; m.err = e.message; }
        else { m.status = 'wartet'; m.err = e.message; stop = true; if (/Schlüssel|Guthaben|eingerichtet/.test(e.message)) BQ.keyProblem = e.message; else BQ.cool = Date.now(); }
      }
      if (m.status === 'aussortiert') await bqSortOut(m); else { await bqSaveMeta(m); bqChanged(); }
      if (m.status === 'gelesen') { await bqAiMatch(m); let ok = false; try { ok = await bqAutoSave(m); } catch (e) { ok = false; } if (!ok) feedbackText('✓ Ein Bon wurde gelesen. Unter Mehr → 📷 Bon kannst du ihn prüfen und speichern.'); }
      if (stop) break;
    }
  } finally { BQ.running = false; bqLockFree(); bqChanged(); }
}
function bqList() {
  const open = BQ.list.filter(m => m.status !== 'gespeichert' && m.status !== 'aussortiert').sort((a, b) => b.created - a.created);
  const rows = open.map(m => {
    const st = m.status, when = isNaN(new Date(m.created)) ? 'unbekanntem Tag' : new Date(m.created).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    return `<div class="item" role="button" tabindex="0" style="cursor:pointer" onclick="bonDetail('${b.id}')" onkeydown="if(event.key==='Enter')bonDetail('${b.id}')"><div class="grow"><div class="nm" style="cursor:pointer"><b>${esc(fmtD(b.date))}</b> · ${esc(bonStoreName(b.store))}</div><div class="small">${b.items.length} ${b.items.length === 1 ? 'Position' : 'Positionen'} (${Math.round(b.items.reduce((s, i) => s + (i.q || 1), 0))} Stück) · ${eur(tot)}${m && m.hasPhotos ? ' · 📷 Foto da' : ''}</div></div><span class="mute" aria-hidden="true">›</span></div>`;
  }).join('');
  setTimeout(bqStorageInfo, 0);
  return bqSortedBlock() + (rows ? `<h2>🧾 Bons in Bearbeitung (${open.length})</h2><div class="card tight">${rows}</div>` : '') +
    `<h2 id="bonlist">📚 Gespeicherte Bons (${S.bons.length})</h2>` + (saved ? `<div class="card tight">${saved}</div>` : '<div class="card mute">Noch keine Bons gespeichert.</div>') + '<div class="mute small" id="bqinfo" style="margin:6px 4px"></div>';
}
async function bqStorageInfo() {
  const el = document.getElementById('bqinfo'); if (!el || !(navigator.storage && navigator.storage.estimate)) return;
  try { const e = await navigator.storage.estimate(), mb = x => Math.round(x / 1e6); el.textContent = `Foto-Speicher: ${mb(e.usage)} MB belegt, noch Platz für etwa ${mb(e.quota - e.usage)} MB. Die Fotos der letzten ${BQ_KEEP} gespeicherten Bons bleiben erhalten.`; } catch (e) { }
}
async function bonOpen(id) {
  const m = BQ.list.find(x => x.id === id); if (!m || !m.text) return;
  BON.text = m.text; BON.parsed = parseReceipt(m.text, { ref: bonRef(m) }); if (m.ai) bonApplyAi(BON.parsed.items, m.ai); BON.lowRead = m.lowRead || 0; BON.cur = id; BON.refDay = bonRef(m); BON.fromPhoto = true; BON.err = ''; BON.allowDup = !!m.allowDup; BON.dupWarn = m.warn || '';
  BON.curPhotos = await bqFotosGet(id); render(); scrollTo(0, 0);
}
function bonClose() { BON.parsed = null; BON.cur = null; BON.refDay = ""; BON.fromPhoto = false; BON.curPhotos = []; BON.text = ''; render(); }
function bonAddTo(id) { BON.addTo = id; BON.parsed = null; BON.cur = null; BON.refDay = ""; BON.fromPhoto = false; BON.curPhotos = []; BON.photos = []; render(); scrollTo(0, 0); feedbackText('Mach ein Foto vom fehlenden Teil und tippe auf „Zum Bon hinzufügen“.'); }
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
const bonJac = (A, B) => { const a = new Set(A), b = new Set(B), inter = [...b].filter(x => a.has(x)).length; return inter / Math.max(1, a.size + b.size - inter); }; // Anteil gleicher Artikelnamen
const bonCover = (A, B) => { const a = new Set(A), b = new Set(B), inter = [...b].filter(x => a.has(x)).length; return inter / Math.max(1, Math.min(a.size, b.size)); };
const toMin = tm => { const p = String(tm).split(':'); return +p[0] * 60 + +p[1]; };
const bonDateOf = (m, parsed) => parsed.date ? { date: parsed.date, guess: !!parsed.dateGuess } : { date: isoDay(new Date(m.created)), guess: true }; // fehlt das Datum, gilt der Tag des Fotos (beim Prüfen und beim Speichern gleich)
function bonDupOf(store, date, total, names, skipId, time) {
  const cands = S.bons.map(b => ({ store: b.store, date: b.date, total: b.total, time: b.time, names: b.items.map(i => bonNorm(i.n)), saved: true }));
  BQ.list.forEach(m => { if (m.id !== skipId && m.sig && m.status === 'gelesen') cands.push({ ...m.sig, saved: false }); });
  let warn = null;
  for (const c of cands) {
    if (c.store !== store) continue;
    let otherDay = false;
    if (c.date !== date) { // anderes Datum nur dann doppelt, wenn Summe und Artikel (mindestens 4) übereinstimmen und Tag/Monat gleich sind oder ein Datum unplausibel alt ist
      const old = d => (Date.now() - new Date(d)) / 864e5 > 400;
      if (!(total != null && c.total != null && Math.abs(c.total - total) < 0.005 && Math.min(c.names.length, names.length) >= 4 && (c.date.slice(5) === date.slice(5) || old(c.date) || old(date)))) continue; otherDay = true;
    }
    const both = total != null && c.total != null; if (both && Math.abs(c.total - total) >= 0.005) continue;
    const jac = bonJac(c.names, names), td = time && c.time ? Math.abs(toMin(time) - toMin(c.time)) : null;
    if (otherDay && jac < 0.8) continue;
    if (td != null && td > 10) continue; // andere Uhrzeit: ein anderer Einkauf am selben Tag
    const small = Math.min(c.names.length, names.length) <= 2 && td == null; // sehr kleiner Bon ohne Uhrzeit: nicht sicher
    const cov = bonCover(c.names, names); // eine Liste steckt fast ganz in der anderen (z. B. unvollständiger Erstscan)
    if (!small && (jac >= (both ? 0.6 : 0.8) || (Math.min(c.names.length, names.length) >= 3 && cov >= 0.95))) return { c, sure: true, jac }; // gleiche Artikel: derselbe Bon
    if (small && jac >= 0.6 && !warn) { warn = { c, sure: false, jac }; continue; }
    if (both && !(td != null && td > 10) && !warn) warn = { c, sure: false, jac }; // gleiche Summe, aber andere Artikel (und nicht deutlich andere Uhrzeit): nur warnen
  }
  return warn;
}
const bonDetail = id => { BON.detail = id; render(); scrollTo(0, 0); };
function bonDetailView() {
  const b = S.bons.find(x => x.id === BON.detail); if (!b) { BON.detail = null; return ''; }
  const m = BQ.list.find(x => x.recId === b.id), sum = +b.items.reduce((s, i) => s + i.p, 0).toFixed(2);
  const rows = b.items.map((i, ix) => { const p = i.pid ? PROD(i.pid) : null; return `<div class="item" role="button" tabindex="0" style="cursor:pointer" onclick="bonFix('${b.id}',${ix})"><div class="grow"><div class="nm" style="cursor:default">${esc(i.n)}${i.q > 1 ? ` <span class="mute">× ${i.q}</span>` : ''}</div>${p ? `<span class="tag t-ok">${esc(p.name)}</span>` : '<span class="tag">kein Produkt zugeordnet</span>'}</div><b>${eur(i.p)}</b><span class="mute" aria-hidden="true">›</span></div>`; }).join('');
  return `<button class="btn sm" onclick="BON.detail=null;render()">← Zu den Bons</button>
    <div class="card"><h3>🧾 ${esc(bonStoreName(b.store))} · ${esc(fmtD(b.date))}</h3><div class="small" style="margin-top:6px">${b.items.length} ${b.items.length === 1 ? 'Position' : 'Positionen'} · Summe laut Bon ${b.total != null ? eur(b.total) : 'unbekannt'} · Positionen zusammen ${eur(sum)} (Pfand wird nicht mitgezählt)${b.partial ? '<br>ℹ️ Nur teilweise gelesen. Die gelesenen Artikel zählen trotzdem.' : ''}${b.du ? '<br>⚠ Das Datum auf dem Bon war ungültig oder in der Zukunft. Dieser Bon zählt nicht für „Schon gekauft?“ und dein Standard-Produkt.' : ''}<br><span class="mute">Antippen einer Zeile ändert das Produkt.</span></div></div>
    <h2>Gekauft <span class="mute small">· ${Math.round(b.items.reduce((s, i) => s + (i.q || 1), 0))} Stück</span></h2><div class="card tight">${rows || '<div class="empty">Keine Positionen.</div>'}${b.total != null ? `<div class="item" style="border-top:2px solid var(--line)"><div class="grow"><b>Summe laut Bon</b></div><b>${eur(b.total)}</b></div>` : ''}</div>
    ${m && m.hasPhotos ? `<button class="btn" style="margin-top:10px" onclick="bqShow('${m.id}')">📄 Foto vom Bon ansehen</button>` : ''}`;
}
function bqDupCheck(m, parsed) { // nach dem Lesen: ist das derselbe Bon wie ein schon vorhandener?
  m.sig = null; m.dupText = '';
  if (!parsed.store) return;
  const dd = bonDateOf(m, parsed), names = bonNames(parsed.items); m.sig = { store: parsed.store, date: dd.date, total: parsed.total, time: parsed.time || null, names, guess: dd.guess };
  const d = bonDupOf(parsed.store, dd.date, parsed.total, names, m.id, parsed.time); if (!d) return;
  if (d.sure) { m.status = 'doppelt'; m.dupText = bonStoreName(d.c.store) + ' ' + fmtD(d.c.date) + (d.c.total != null ? ', ' + eur(d.c.total) : '') + (d.c.saved ? ' ist schon gespeichert' : ' ist schon in der Liste'); if (d.jac >= 0.8) { m.hasPhotos = false; bqFotosDel(m.id); } } // Foto nur bei sehr sicherem Treffer löschen
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
  const parsed = parseReceipt(m.text, { ref: bonRef(m) }), unk = [...new Set(parsed.items.filter(i => i.kind === 'item' && !i.pid).map(i => i.name))].slice(0, 25);
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
