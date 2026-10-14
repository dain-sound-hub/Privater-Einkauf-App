// Prüft: fremde Angebots-IDs dürfen im Klick-Handler nie zu ausführbarem Code werden (Regel 50). Aufruf: node tests/pruefen.js --js tests/ablauf/sicherheit.js
(() => {
const iso = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const evil = ["x');window.__xss=1;('", 'a"b', "a\'b", 'x</script><img src=x>', '`${1}`', 'ok-ID_1.2:3'];
const dec = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const R = [];
for (const id of evil) {
  const c = cleanOffers([{ id, store: 'netto', name: 'Seltsames Ding XY', price: 1, regular: 2, valid: [iso(0), iso(-5)] }]);
  const o = enrich(c.offers[0]), html = offerCard(o);
  const hs = [...html.matchAll(/onclick="((?:rememberOffer|addOfferItem)\([^"]*)"/g)].map(m => dec(m[1]));
  let calls = [], flag = false; const ctx = { rememberOffer: x => calls.push(x), addOfferItem: x => calls.push(x) };
  hs.forEach(h => { try { new Function('rememberOffer', 'addOfferItem', 'window', h)(ctx.rememberOffer, ctx.addOfferItem, { }); } catch (e) { flag = 'FEHLER ' + e.message; } });
  R.push({ id, idNachClean: c.offers[0].id, idSicher: /^[\w.:-]{1,80}$/.test(c.offers[0].id), handlerAnzahl: hs.length, aufrufe: calls.length, nurIdUebergeben: calls.every(x => x === c.offers[0].id), fehler: flag });
}
const ok = R.every(r => r.idSicher && r.fehler === false && r.nurIdUebergeben);
return { ok, R };
})()
