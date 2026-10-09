// Version hochzählen: setzt die Nummer in sw.js (Cache-Name) und Nummer + Uhrzeit in app.js (Anzeige im Kopfbereich).
// Aufruf: node bump.js   (nur für die Entwicklung, wird nicht hochgeladen)
const fs = require('fs');
process.chdir(__dirname);
const sw = fs.readFileSync('sw.js', 'utf8'), m = sw.match(/einkauf-v(\d+)/);
if (!m) throw new Error('Version in sw.js nicht gefunden');
const v = +m[1] + 1;
fs.writeFileSync('sw.js', sw.replace(/einkauf-v\d+/, 'einkauf-v' + v));
const d = new Date(), p = n => String(n).padStart(2, '0'), t = `${p(d.getDate())}.${p(d.getMonth() + 1)}. ${p(d.getHours())}:${p(d.getMinutes())}`;
let a = fs.readFileSync('app.js', 'utf8');
const rx = /const APP_BUILD = \{[^}]*\};/;
if (!rx.test(a)) throw new Error('APP_BUILD in app.js nicht gefunden');
a = a.replace(rx, `const APP_BUILD = { v: ${v}, t: '${t}' };`);
fs.writeFileSync('app.js', a);
console.log('Version v' + v + ' · ' + t);
