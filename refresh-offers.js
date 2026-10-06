// Holt die Angebote und schreibt offers.json. Läuft von Hand (node refresh-offers.js) oder automatisch bei GitHub (siehe .github/workflows/offers.yml).
const fs = require('fs'), path = require('path'), vm = require('vm');
const core = require('./research-core.js');
const sb = {}; vm.createContext(sb); sb.window = sb;
vm.runInContext(fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8') + ';this.__P = PRODUCTS; this.__X = EXCLUDE_RX.source; this.__N = NOISE_RX.source; this.__D = DISCOVER_TERMS;', sb);
const body = { products: sb.__P.map(p => ({ id: p.id, kw: p.kw, q: p.q || [] })), exclude: sb.__X, noise: sb.__N, discover: true, discoverTerms: sb.__D };
core.research(body, (d, t, term, n) => process.stdout.write(`\r${d}/${t} ${term} (${n} Angebote)        `)).then(res => {
  fs.writeFileSync(path.join(__dirname, 'offers.json'), JSON.stringify(res));
  console.log(`\nFertig: ${res.offers.length} Angebote, ${res.errors.length} Fehler, gespeichert in offers.json`);
}).catch(e => { console.error('\nFehler:', e.message); process.exit(1); });
