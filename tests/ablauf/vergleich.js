// Preisvergleich-Fenster: „Das kaufst du sonst“ steht oben mit Preis, auch ohne Rabatt. Aufruf: node tests/pruefen.js --js tests/ablauf/vergleich.js
(() => {
const iso = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
S = sanitize({}); S.list = [{ id: 'i1', name: 'Putengeschnetzeltes', qty: '2', pid: 'putengeschn', done: false }];
S.bons = [{ id: 'b1', date: iso(20), store: 'rewe', total: 5, items: [{ n: 'GUT&GUENSTIG PUTENGESCHN. 400G', q: 1, p: 4.99, pid: 'putengeschn', k: 'kg', a: 0.4, b: 'Gut & Günstig' }] }, { id: 'b2', date: iso(6), store: 'rewe', total: 5, items: [{ n: 'GUT&GUENSTIG PUTENGESCHN. 400G', q: 1, p: 5.19, pid: 'putengeschn', k: 'kg', a: 0.4, b: 'Gut & Günstig' }] }];
SRC.offers = [{ id: 'o1', store: 'netto', name: 'Wiesenhof Putengeschnetzeltes', desc: '400 g', price: 3.99, regular: 4.99, amount: 400, unit: 'g', valid: [iso(1), iso(-5)] }]; CACHE = null;
const html = buyBlock(PROD('putengeschn'), productInfo(PROD('putengeschn'))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
S.bons = []; const leer = buyBlock(PROD('putengeschn'), productInfo(PROD('putengeschn'))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
return { mitKaeufen: html, ohneKaeufe: leer };
})()
