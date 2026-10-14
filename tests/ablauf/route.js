// Ablaufprüfung Route und Wartehinweise (Regeln 50 ff.). Aufruf: node tests/pruefen.js --js tests/ablauf/route.js
(() => {
const R = {}, iso = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const off = (id, store, name, price, up, extra = {}) => ({ id, store, name, desc: '1 l', cats: 'Milch', price, valid: [iso(-2), iso(5)], amount: 1, unit: 'l', unitPrice: up, base: 'l', ...extra });
const setup = (offers, pfStore) => { SRC.offers = offers; CACHE = null; S = sanitize({}); S.list = [{ id: 'i1', name: 'Milch', pid: 'milch', done: false }]; S.set.lidl = 'ja'; S.prefs = pfStore ? { milch: pfStore } : {}; };
// D-a: heute Lidl 1 €, City-Center (Netto) 2 €, nächste Woche REWE 1,50 €. Bei Lidl gewählt darf nicht „warten“ kommen.
setup([off('a', 'lidl', 'Frische Vollmilch', 1.0, 1.0, { regular: 1.3 }), off('b', 'netto', 'Frische Vollmilch', 2.0, 2.0, { regular: 2.2 }), off('c', 'rewe', 'Frische Vollmilch', 1.5, 1.5, { valid: [iso(3), iso(9)] })]);
{ const plan = planRoute(), row = plan.stops.flatMap(s => s.items).find(x => x.it.id === 'i1'); const dec = decision(row.info, row.it, row.offer);
  R.Da = { gewaehlt: row.offer && row.offer.store.id, tag: dec.tag, hinweisWarten: nextHint(row.info, row.offer) ? 'ja' : 'nein' }; }
// D-b: Standardladen REWE 1,20 €/l und Netto 1 €/l, beide ohne Prozent: der Preis des Standardladens bleibt stehen
setup([off('d', 'rewe', 'Frische Vollmilch', 1.2, 1.2), off('e', 'netto', 'Frische Vollmilch', 1.0, 1.0)], 'rewe');
{ S.set.lidl = 'nein'; const plan = planRoute(), row = plan.stops.flatMap(s => s.items).find(x => x.it.id === 'i1'); R.Db = { laden: row.storeId, angebot: row.offer ? row.offer.price : null, hinweis: row.note }; }
// D-c: Rucola ist nicht schwer, Wasser schon
R.Dc = { rucola: heavyKind({ name: 'Rucola' }, null), bierschinken: heavyKind({ name: 'Bierschinken' }, null), wasser: heavyKind({ name: 'Wasser' }, null) };
return R;
})()
