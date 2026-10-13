// Prüfskript: lässt den Test-Katalog gegen die echte Zuordnungslogik der App laufen (ohne Browser, ohne Agenten).
// Aufruf:  node tests/pruefen.js            (Katalog + privater Katalog, falls vorhanden)
//          node tests/pruefen.js --alle     (zusätzlich: alle echten Angebote aus offers.json auflisten, die keinem Produkt zugeordnet sind – nur zur Ansicht)
// Nur für die Entwicklung. Wird nicht ins App-Hosting hochgeladen.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

// Ein „alles-schluckendes“ Platzhalter-Objekt für Browser-Teile (document, window.addEventListener …), damit app.js ohne Browser laden kann
const stub = () => new Proxy(function () { }, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === 'length' ? 0 : k === Symbol.iterator ? function* () { } : stub(),
  apply: () => stub(), construct: () => stub(), set: () => true
});
const mem = new Map();
const sb = {
  console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => { }, Date, Math, JSON, Promise, Intl, URL, Set, Map, RegExp, Array, Object, String, Number, Boolean, Error, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  document: stub(), navigator: { onLine: true, language: 'de-DE', userAgent: 'node' }, history: { replaceState() { }, state: null }, innerHeight: 800, innerWidth: 375, scrollY: 0, scrollX: 0, pageYOffset: 0, devicePixelRatio: 1,
  location: { protocol: 'http:', hash: '', href: 'http://localhost/', origin: 'http://localhost', pathname: '/' },
  localStorage: { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) },
  fetch: async u => { const f = path.join(root, String(u).split('?')[0]); if (!fs.existsSync(f)) return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; const t = fs.readFileSync(f, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t }; },
  addEventListener() { }, removeEventListener() { }, requestAnimationFrame: f => 0, scrollTo() { }, scrollBy() { }, getSelection: stub, matchMedia: () => ({ matches: false, addEventListener() { } }), alert() { }, confirm: () => false, prompt: () => null
};
sb.window = sb; sb.self = sb; sb.globalThis = sb;
vm.createContext(sb);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
let loadErr = null;
for (const f of ['data.js', 'route.js', 'receipt.js', 'extras.js', 'app.js']) { try { load(f); } catch (e) { loadErr = f + ': ' + e.message; break; } }
if (loadErr) { console.error('FEHLER beim Laden der App-Dateien:', loadErr); process.exit(2); }

(async () => {
  await new Promise(r => setTimeout(r, 400)); // Angebote werden asynchron geladen
  const run = c => vm.runInContext(c, sb);
  sb.__t = {};
  const withOwn = (c, f) => { sb.__t.own = c.eigene || []; if (!sb.__t.own.length) return f(); run('__t.ids = __t.own.map(n => { const x = { id: "eigen:" + n, name: n }; regCustom(x); return x.id; }); CACHE = null;'); try { return f(); } finally { run('for (let i = PRODUCTS.length - 1; i >= 0; i--) if (__t.ids.includes(PRODUCTS[i].id)) PRODUCTS.splice(i, 1); __t.ids.forEach(id => delete RXC[id]); CACHE = null;'); } }; // "eigene": Namen eigener Produkte, die für diesen Fall angelegt werden
  const offerCase = c => { sb.__t.h = (c.historie || []).map(h => ({ pid: c.erwartet, ...h })); run('S.hist = __t.h'); sb.__t.o = { store: c.laden || 'aldi', name: c.name, desc: c.desc || '', cats: c.cats || '', price: c.preis || 2, valid: ['2026-10-05', '2999-01-01'], ...(c.menge ? { amount: c.menge, unit: c.einheit } : {}), ...(c.grundpreis ? { unitPrice: c.grundpreis, base: c.basis } : {}), ...(c.hinweis ? { note: c.hinweis } : {}), ...(c.quelle ? { src: c.quelle } : {}), ...(c.lebensmittel ? { food: true } : {}) }; return run('(() => { const e = enrich(__t.o); return { pid: e.p ? e.p.id : null, up: e.up ? +e.up.v.toFixed(2) + "/" + e.up.base : null, price: e.price, count: e.count || null, pct: e.pct == null ? null : Math.round(e.pct * 100) }; })()'); };
  const bonCase = c => { sb.__t.b = c.zeile; return run('(() => { S.aliases = {}; const x = { kind: "item", name: __t.b, price: 1, qty: 1 }; matchBonItem(x); return { pid: x.pid || null }; })()'); };
  const bonTextCase = c => { sb.__t.bt = c.bon_text; sb.__t.op = { ref: c.foto_tag, today: c.heute }; return run('(() => { const p = parseReceipt(__t.bt, __t.op); return { pid: p.store || null, sug: p.sug || null, date: p.date || null, time: p.time || null, guess: !!p.dateGuess }; })()'); };
  const inputCase = c => { sb.__t.i = c.text; return run('(() => { const a = parseAdd(__t.i); return { pid: a.pid || null, name: a.name, qty: a.qty }; })()'); };

  const files = [path.join(__dirname, 'katalog.json')];
  const priv = path.join(__dirname, 'privat'); if (fs.existsSync(priv)) fs.readdirSync(priv).filter(f => f.endsWith('.json')).forEach(f => files.push(path.join(priv, f)));
  let ok = 0, bad = 0; const fails = [], openN = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue; const cat = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const [kind, fn] of [['angebote', offerCase], ['bons', bonCase], ['eingaben', inputCase], ['bon_texte', bonTextCase]]) for (const c of cat[kind] || []) {
      let r; try { r = withOwn(c, () => fn(c)); } catch (e) { r = { pid: 'FEHLER ' + e.message }; }
      const exp = kind === 'bon_texte' ? (c.laden === undefined ? null : c.laden) : (c.erwartet === undefined ? null : c.erwartet), gotOk = r.pid === exp && (c.datum === undefined || r.date === c.datum) && (c.zeit === undefined || r.time === c.zeit) && (c.vorschlag === undefined || r.sug === c.vorschlag) && (c.grundpreis_erwartet === undefined || r.up === c.grundpreis_erwartet) && (c.menge_erwartet === undefined || r.qty === c.menge_erwartet) && (c.preis_erwartet === undefined || r.price === c.preis_erwartet) && (c.stueck_erwartet === undefined || r.count === c.stueck_erwartet) && (c.pct_erwartet === undefined || r.pct === c.pct_erwartet);
      if (c.offen) { openN.push(`${c.name || c.zeile || c.text || (c.bon_text || '').slice(0, 40).replace(/\n/g, ' / ')}: ${gotOk ? 'JETZT RICHTIG (Eintrag "offen" entfernen)' : 'noch offen'}`); continue; } if (gotOk) ok++; else { bad++; fails.push(`${path.basename(f)} [${kind}] „${c.name || c.zeile || c.text || (c.bon_text || '').slice(0, 40).replace(/\n/g, ' / ')}“ → erhalten ${JSON.stringify(r)}, erwartet ${JSON.stringify({ pid: exp, ...(c.grundpreis_erwartet !== undefined ? { up: c.grundpreis_erwartet } : {}), ...(c.preis_erwartet !== undefined ? { price: c.preis_erwartet } : {}), ...(c.stueck_erwartet !== undefined ? { count: c.stueck_erwartet } : {}), ...(c.menge_erwartet !== undefined ? { qty: c.menge_erwartet } : {}) })}${c.grund ? ' (' + c.grund + ')' : ''}`); }
    }
  }
  console.log(`${ok} von ${ok + bad} Fällen richtig.`);
  fails.forEach(x => console.log('  ✗ ' + x));
  if (openN.length) { console.log('Bekannt offen:'); openN.forEach(x => console.log('  · ' + x)); }
  const bi = process.argv.indexOf('--bon');
  if (bi > 0) { // Bon-Text aus Datei einlesen und anzeigen, was die App daraus macht (Laden, Datum, Artikel, Zuordnung)
    sb.__t.txt = fs.readFileSync(process.argv[bi + 1], 'utf8');
    const out = run('(() => { S.aliases = {}; const b = parseReceipt(__t.txt); return { store: b.store, date: b.date, time: b.time, total: b.total, sum: bonSum(b.items.map(i => ({ ...i, include: true }))), items: b.items.map(i => [i.kind, i.name, i.qty, i.price, i.pid || "-", i.how || ""].join(" | ")), skipped: b.skipped }; })()');
    console.log('\nBon:', out.store, out.date, out.time, 'Summe laut Bon', out.total, 'Positionen zusammen', out.sum); out.items.forEach(x => console.log('  ' + x)); if (out.skipped.length) console.log('  übersprungen:', out.skipped.join(' / '));
  }
  const ei = process.argv.indexOf('--export');
  if (ei > 0) { // Exportdatei der App (Mehr → Sichern) laden und zeigen: Bons mit unsicherem Datum, Neu-Zuordnung alter Bons, Doppelte
    sb.__t.exp = JSON.parse(fs.readFileSync(process.argv[ei + 1], 'utf8')).daten;
    const out = run('(() => { S = sanitize(__t.exp); S.custom.forEach(regCustom); const before = S.bons.map(b => b.items.map(i => i.pid)); S.remapV = 0; bonRemapOld(true); return { bons: S.bons.map((b, k) => ({ date: b.date, store: b.store, du: !!b.du, n: b.items.length, geaendert: b.items.map((i, j) => before[k][j] !== i.pid ? i.n + ": " + before[k][j] + " -> " + i.pid : null).filter(Boolean) })), hist: S.hist.length }; })()');
    console.log('\nExport: ' + out.bons.length + ' Bons, Historie ' + out.hist + ' Einträge'); out.bons.forEach(b => console.log('  ' + b.date + ' ' + b.store + (b.du ? ' (Datum unplausibel → zählt nicht)' : '') + ', ' + b.n + ' Artikel' + (b.geaendert.length ? ', neu zugeordnet: ' + b.geaendert.join('; ') : '')));
  }
  const di = process.argv.indexOf('--dump');
  if (di > 0) { // Zuordnung aller aktuellen Angebote in eine Datei schreiben (zum Vergleichen vorher/nachher mit einem Diff)
    const rows = run('SRC.offers.map(enrich).map(o => o.store.short + " | " + o.name + " | " + (o.p ? o.p.id : "-") + " | " + (o.up ? o.up.v.toFixed(2) + "/" + o.up.base : "-"))');
    fs.writeFileSync(process.argv[di + 1], rows.join('\n') + '\n'); console.log('Zuordnung von ' + rows.length + ' Angeboten gespeichert: ' + process.argv[di + 1]);
  }
  const ji = process.argv.indexOf('--js');
  if (ji > 0) { // beliebigen Auswertungs-Code gegen die App-Logik laufen lassen (optional mit --export <Datei> als Datenstand); Ergebnis wird als JSON ausgegeben
    const ex = process.argv.indexOf('--export');
    if (ex > 0) { sb.__t.exp = JSON.parse(fs.readFileSync(process.argv[ex + 1], 'utf8')).daten; run('S = sanitize(__t.exp); S.custom.forEach(regCustom); CACHE = null; S.remapV = 0; bonRemapOld(true); BH = null;'); }
    console.log(JSON.stringify(run(fs.readFileSync(process.argv[ji + 1], 'utf8')), null, 1));
  }
  const hi = process.argv.indexOf('--habit');
  if (hi > 0) { // Warum erscheint ein Angebot unter „Das kaufst du öfter, jetzt im Angebot“? Zeigt Produkt und Grund (Favorit oder Kauf-/Eintragshäufigkeit) mit den Daten einer Exportdatei
    sb.__t.exp = JSON.parse(fs.readFileSync(process.argv[hi + 1], 'utf8')).daten;
    const out = run('(() => { S = sanitize(__t.exp); S.custom.forEach(regCustom); CACHE = null; S.remapV = 0; bonRemapOld(true); BH = null; const offs = OFFERS_ALL(); const why = p => (watched(p.id) ? "Favorit" : "") + (freq(p) > 0 ? " Häufigkeit " + freq(p) + " (eingetragen " + (S.adds[p.id] || 0) + "x, gekauft " + (S.buys[p.id] || 0) + "x)" : ""); return { habit: offs.filter(o => o.p && habitOk(o.p) && !onList(o.p.id) && o.state === "now").map(o => o.store.short + " | " + o.name + " | Produkt: " + o.p.name + " (" + o.p.id + ") | Grund: " + grundText(o.p)), match: offs.filter(o => /erdbeer/i.test(o.name + " " + (o.cats || ""))).map(o => o.store.short + " | " + o.name + " | Produkt: " + (o.p ? o.p.name + " (" + o.p.id + ")" : "-")) }; })()');
    console.log('\nVorschläge "Das kaufst du öfter":'); out.habit.slice(0, 60).forEach(x => console.log('  ' + x));
    console.log('\nAlle Angebote mit "Erdbeer" im Namen:'); out.match.forEach(x => console.log('  ' + x));
  }
  if (process.argv.includes('--alle')) {
    const list = run('SRC.offers.map(enrich).filter(o => !o.p && o.state !== "expired" && !o.excluded && o.pct != null && o.pct >= 0.25 && o.food).map(o => o.store.short + " | " + o.name + " | -" + Math.round(o.pct * 100) + " %")');
    console.log(`\nStarke Angebote ohne Produkt (Ansicht, kein Fehler): ${list.length}`); list.slice(0, 40).forEach(x => console.log('  · ' + x));
  }
  process.exit(bad ? 1 : 0);
})();
