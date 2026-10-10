// Angebotssuche (kaufDA). Wird vom lokalen Server UND vom automatischen Aktualisieren (GitHub) benutzt.
const UA = 'Einkaufsliste-PrivateApp/1.0 (persoenlicher Preisvergleich, 1x taeglich, 2 Sekunden Pause zwischen Abfragen)';
const RETAILER = [[/netto marken/i, 'netto'], [/^rewe/i, 'rewe'], [/aldi s/i, 'aldi'], [/^dm/i, 'dm'], [/^lidl/i, 'lidl'], [/^metro/i, 'metro'], [/selgros/i, 'selgros'], [/handelshof/i, 'handelshof']]; // Penny bewusst nicht dabei
const kwRx = p => new RegExp('(?:' + p.kw + ')(?:e|en|n|s|es|er|ern|nen)?(?![a-zäöüß])', 'i'); // Stichwort mit Wortende, wie in der App (kein Treffer mitten im Wort)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const berlinDay = iso => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

async function fetchTerm(term, page) {
  const url = 'https://www.kaufda.de/Angebote/' + encodeURIComponent(term) + (page > 1 ? '?page=' + page : '');
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'de-DE,de;q=0.9' } });
  if (!r.ok) return { items: [], total: 0, url };
  const m = (await r.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { items: [], total: 0, url };
  const main = JSON.parse(m[1])?.props?.pageProps?.pageInformation?.offers?.main;
  return { items: main?.items || [], total: main?.totalItems || 0, url };
}
function parseUnit(pb) { // z. B. "(3.96 / kg)", "1 kg = 5.95", "EUR 99,5 / 1 l", "(1 kg = € 37.44)"
  if (!pb) return null;
  const nums = [...pb.matchAll(/\d+[.,]\d+|\d+/g)].map(x => x[0]);
  const dec = nums.find(n => /[.,]/.test(n)) || nums[nums.length - 1];
  let v = parseFloat(String(dec).replace(',', '.')); if (!isFinite(v)) return null;
  const base = /\bkg\b/i.test(pb) ? 'kg' : /\b(l|liter)\b/i.test(pb) ? 'l' : /stück|\bst\b/i.test(pb) ? 'st' : /\bg\b/i.test(pb) ? 'kg' : /\bml\b/i.test(pb) ? 'l' : null;
  if (!base) return null;
  if (/100\s?g\b/i.test(pb) || /100\s?ml\b/i.test(pb)) v *= 10;
  return { v, base };
}
function parseAmount(desc) {
  const nx = /(\d+)\s?[x×]\s?(\d+(?:[.,]\d+)?)[\s-]*(kg|g|ml|l)\b/i.exec(desc || ''); // „6 x 1,5 l“ sind 9 l
  if (nx) return { amount: +nx[1] * parseFloat(nx[2].replace(',', '.')), unit: nx[3].toLowerCase() };
  const all = [...(desc || '').matchAll(/(\d+(?:[.,]\d+)?)[\s-]?(kg|g|ml|l)\b/gi)];
  if (!all.length) return {};
  const m = all[all.length - 1];
  return { amount: parseFloat(m[1].replace(',', '.')), unit: m[2].toLowerCase() };
}
function parseCount(desc) { // Waschladungen, Rollen, Stück
  let m;
  if ((m = desc.match(/(\d+)[\s-]?(?:wl|waschl\w*|anw\w*|wäschen)/i))) return +m[1];
  if ((m = desc.match(/(\d+)\s*x\s*\d+[\s-]*blatt/i))) return +m[1];
  if ((m = desc.match(/(\d+)\s*(?:rollen|rolle)\b/i))) return +m[1];
  if ((m = desc.match(/(\d+)\s*(?:stück|st\.|stk|tücher)/i))) return +m[1];
  return null;
}
function normalize(it, products, exclude, noise, srcUrl) {
  const store = (RETAILER.find(([rx]) => rx.test(it.publisherName || '')) || [])[1];
  if (!store || !it.prices || !(it.prices.mainPrice > 0)) return null;
  const desc = it.description || '', name = [it.brand, it.title].filter(Boolean).join(' ').trim() || it.title;
  const text = [name, desc, ...(it.categories || [])].join(' ');
  let pid = null, len = 0;
  const isNoise = noise && new RegExp(noise, 'i').test(text);
  for (const p of isNoise ? [] : products) { const m = kwRx(p).exec(text); if (m && m[0].length > len) { pid = p.id; len = m[0].length; } }
  if (exclude && new RegExp(exclude, 'i').test(text)) return null; // Schwein/Wurst/Salami nie
  const pr = it.prices, up = parseUnit(pr.priceByBaseUnit), am = parseAmount(desc);
  const conds = (pr.conditions || []).map(c => c.other).filter(c => c && c.trim());
  const appReq = conds.some(c => /app|coupon|plus|karte/i.test(c));
  return {
    id: it.id, store, name, img: it.offerImages?.url?.thumbnail || undefined, desc, cats: (it.categories || []).join(' '), pid, food: (it.categoryPaths || []).some(p => /lebensmittel/i.test(p[0]?.name || '')) || undefined, price: pr.mainPrice,
    regular: pr.secondaryPrice > pr.mainPrice ? pr.secondaryPrice : null, regularIsUvp: !!pr.secondaryPriceIsUVP,
    ...am, count: parseCount(desc) || undefined, ...(up ? { unitPrice: up.v, base: up.base } : {}),
    valid: [it.validFrom ? berlinDay(it.validFrom) : '2000-01-01', it.validUntil ? berlinDay(it.validUntil) : '2999-01-01'], src: srcUrl,
    note: conds.filter(c => !/app|coupon|plus|karte/i.test(c)).join(', ') || undefined, appRequired: appReq || undefined
  };
}
// ---- ALDI SÜD (eigene Webseite, öffentliche Produktseiten; robots.txt erlaubt /produkte, wir bleiben ehrlich und langsam) ----
const ALDI = 'https://www.aldi-sued.de';
const decode = s => (s || '').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const eur = s => { const m = /(\d+)[.,](\d{2})/.exec(s || ''); return m ? Math.round(+m[1] * 100 + +m[2]) / 100 : null; };
async function aldiGet(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'de-DE,de;q=0.9' } });
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return r.text();
}
function parseAldiTiles(html, srcUrl, products, exclude, noise, opt = {}) { // opt: { valid:[von,bis], promo:true, suffix }
  const out = [];
  for (const tile of html.split('<div class="product-tile" ').slice(1)) {
    const code = (/href="\/produkt\/[^"]*?-(\d{6,})"/.exec(tile) || [])[1];
    const title = decode((/title="([^"]+)"/.exec(tile) || [])[1]);
    const brand = decode((/product-tile__brandname[^>]*><p[^>]*>([^<]*)/.exec(tile) || [])[1]);
    const size = decode((/product-tile__unit-of-measurement[^>]*><p>([^<]*)/.exec(tile) || [])[1]);
    const cmp = decode((/product-tile__comparison-price[^>]*><p>([^<]*)/.exec(tile) || [])[1]);
    const disc = /base-price__discounted"[^>]*>([^<]*)/.exec(tile), was = /<del[^>]*>([^<]*)/.exec(tile), reg = /base-price__regular"><span>([^<]*)/.exec(tile);
    const price = eur(disc ? disc[1] : reg && reg[1]); if (!code || !title || !(price > 0)) continue;
    const wasP = was ? eur(was[1]) : null;
    const name = (brand && !title.toLowerCase().startsWith(brand.toLowerCase()) ? brand + ' ' : '') + title;
    const text = name + ' ' + size;
    const isNoise = noise && new RegExp(noise, 'i').test(text);
    if (exclude && new RegExp(exclude, 'i').test(text)) continue;
    let pid = null, len = 0;
    for (const p of isNoise ? [] : products) { const m = kwRx(p).exec(text); if (m && m[0].length > len) { pid = p.id; len = m[0].length; } }
    const up = parseUnit(cmp), am = parseAmount(size);
    const img = (/<img[^>]* src="(https:\/\/dm\.emea\.cms\.aldi\.cx[^"]+)"/.exec(tile) || [])[1];
    out.push({
      id: 'aldi-' + code + (opt.suffix || ''), store: 'aldi', name, img, desc: size, cats: '', pid, price, regular: wasP > price ? wasP : null, regularIsUvp: false,
      ...am, count: parseCount(size) || undefined, ...(up ? { unitPrice: up.v, base: up.base } : {}),
      valid: opt.valid, src: srcUrl, note: opt.promo ? 'ALDI Wochenangebot' : wasP > price ? undefined : 'Dauerpreis (kein Wochenangebot)', code, found: ['aldi']
    });
  }
  return out;
}
const addDays = (day, n) => new Date(Date.parse(day + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const saturdayOf = day => { const wd = new Date(day + 'T12:00:00Z').getUTCDay(); return addDays(day, (6 - wd + 7) % 7); }; // ALDI-Wochenangebote gelten bis Samstag
// Fail-safe: bei Sperre/Fehler gibt es { ok:false, error } und der Rest der Aktualisierung läuft normal weiter.
// 1) Wochenangebote je Starttermin (/angebote/<Datum>, auch nächste Woche), 2) alle Kategorien als Normal-/Dauerpreise.
async function researchAldi(body, progress, budgetMs = 22 * 60 * 1000) {
  const t0 = Date.now(), products = body.products || [], today = berlinDay(new Date());
  const promo = new Map(), base = new Map(), info = { ok: false, count: 0, promos: 0, nextWeek: 0, pages: 0, error: null };
  const limit = () => { if (Date.now() - t0 > budgetMs) { info.error = 'Zeitlimit, Rest ausgelassen'; throw Object.assign(new Error('limit'), { soft: true }); } };
  const get = async url => { limit(); const h = await aldiGet(url); info.pages++; await sleep(2100); return h; };
  const walk = async (url, into, opt, label) => { // alle Seiten einer Liste (30 Kacheln pro Seite)
    for (let page = 1; page <= 8; page++) {
      let html; try { html = await get(url + (page > 1 ? '?page=' + page : '')); } catch (e) { if (e.soft || e.status === 403 || e.status === 429) throw e; break; }
      const items = parseAldiTiles(html, url, products, body.exclude || '', body.noise || '', opt);
      let fresh = 0; for (const o of items) if (!into.has(o.id)) { into.set(o.id, o); fresh++; }
      if (progress) progress(0, 1, 'ALDI ' + label, promo.size + base.size);
      if (items.length < 20 || !fresh) break; // letzte Seite
    }
  };
  try {
    const sm = await get(ALDI + '/sitemap_categories.xml');
    const cats = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()).filter(u => u.startsWith(ALDI + '/produkte/') && !u.includes('/wochenangebote'));
    if (!cats.length) throw new Error('Keine Kategorien gefunden');
    try { // Termine der Angebotswochen
      const page = await get(ALDI + '/produkte/wochenangebote/k/1588161426582123');
      const dates = [...new Set([...page.matchAll(/href="\/angebote\/(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1]))].filter(d => d >= addDays(today, -7)).sort().slice(0, 12);
      for (const d of dates) await walk(ALDI + '/angebote/' + d, promo, { promo: true, suffix: '-' + d, valid: [d, saturdayOf(d)] }, d);
    } catch (e) { if (e.soft || e.status === 403 || e.status === 429) throw e; info.error = 'Wochenangebote nicht lesbar (' + e.message + ')'; }
    for (let ci = 0; ci < cats.length; ci++) await walk(cats[ci], base, { valid: [today, addDays(today, 7)] }, cats[ci].split('/').slice(-3, -1).join('/')); // Normalpreise: nur 7 Tage gültig, falls die Aktualisierung einmal ausfällt
    info.ok = true;
  } catch (e) {
    if (e.soft) info.ok = promo.size + base.size > 0; else info.error = 'ALDI nicht erreichbar (' + e.message + ')';
  }
  const nowCodes = new Set([...promo.values()].filter(o => o.valid[0] <= today && o.valid[1] >= today).map(o => o.code));
  const offers = [...promo.values(), ...[...base.values()].filter(o => !nowCodes.has(o.code) && (o.pid || o.regular))]; // Wochenangebot ersetzt den Normalpreis-Eintrag
  offers.forEach(o => delete o.code);
  info.promos = promo.size; info.nextWeek = [...promo.values()].filter(o => o.valid[0] > today).length; info.count = offers.length;
  if (!offers.length) info.ok = false;
  return { offers, info };
}
// body: { products:[{id,kw,q}], exclude, noise, discover, discoverTerms }; progress(done,total,term,found) optional
async function research(body, progress) {
  const products = body.products || [], exclude = body.exclude || '', noise = body.noise || '';
  const terms = [...new Set([...products.flatMap(p => p.q || []), ...(body.discover ? body.discoverTerms || [] : [])])];
  const out = new Map(), errors = [];
  let idx = 0, done = 0;
  const worker = async () => {
    while (idx < terms.length) {
      const term = terms[idx++];
      try {
        let page = 1, got = 0, total = 0;
        do {
          const r = await fetchTerm(term, page); total = r.total; got += r.items.length;
          for (const it of r.items) {
            const o = normalize(it, products, exclude, noise, r.url.split('?')[0]); if (!o) continue;
            const prev = out.get(o.id); // gleiche Angebote aus mehreren Suchen: Suchbegriffe merken
            if (prev) { if (!prev.found.includes(term)) prev.found.push(term); } else { o.found = [term]; out.set(o.id, o); }
          }
          page++; await sleep(2100); // kaufDA verlangt laut robots.txt 2 Sekunden Pause
        } while (got < total && page <= 3 && got > 0);
      } catch (e) { errors.push(term + ': ' + e.message); }
      done++; if (progress) progress(done, terms.length, term, out.size);
    }
  };
  await worker(); // bewusst nur ein Zugriff nach dem anderen
  const offers = [...out.values()];
  if (!offers.length) throw new Error('Keine Angebote erhalten. Internetverbindung prüfen. ' + errors.slice(0, 2).join(' | '));
  let aldi = { ok: false, count: 0, error: 'nicht abgefragt' };
  if (body.aldi !== false) {
    try { const a = await researchAldi(body, progress); aldi = a.info; if (a.info.ok) offers.push(...a.offers); }
    catch (e) { aldi = { ok: false, count: 0, error: 'ALDI-Fehler: ' + e.message }; }
  }
  return { fetched: new Date().toISOString(), source: 'kaufDA (Händler-weite Prospekte, nicht filial-genau) + ALDI SÜD (Webseite)', terms: terms.length, errors, aldi, offers };
}
module.exports = { research, researchAldi };
