// Angebotssuche (kaufDA). Wird vom lokalen Server UND vom automatischen Aktualisieren (GitHub) benutzt.
const UA = 'Einkaufsliste-PrivateApp/1.0 (persoenlicher Preisvergleich, 1x taeglich, 2 Sekunden Pause zwischen Abfragen)';
const RETAILER = [[/netto marken/i, 'netto'], [/^rewe/i, 'rewe'], [/aldi s/i, 'aldi'], [/^dm/i, 'dm'], [/^lidl/i, 'lidl'], [/^metro/i, 'metro'], [/selgros/i, 'selgros'], [/handelshof/i, 'handelshof']]; // Penny bewusst nicht dabei
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
  const all = [...(desc || '').matchAll(/(\d+(?:[.,]\d+)?)[\s-]?(kg|g|ml|l)\b/gi)];
  if (!all.length) return {};
  const m = all[all.length - 1];
  return { amount: parseFloat(m[1].replace(',', '.')), unit: m[2].toLowerCase() };
}
function parseCount(desc) { // Waschladungen, Rollen, Stück
  let m;
  if ((m = desc.match(/(\d+)\s?(?:wl|waschl\w*|anw\w*|wäschen)/i))) return +m[1];
  if ((m = desc.match(/(\d+)\s*x\s*\d+\s*blatt/i))) return +m[1];
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
  for (const p of isNoise ? [] : products) { const m = new RegExp(p.kw, 'i').exec(text); if (m && m[0].length > len) { pid = p.id; len = m[0].length; } }
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
  return { fetched: new Date().toISOString(), source: 'kaufDA (Händler-weite Prospekte, nicht filial-genau)', terms: terms.length, errors, offers };
}
module.exports = { research };
