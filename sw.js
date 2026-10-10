// Offline-Speicher: Die App und die zuletzt geladenen Angebote funktionieren auch ohne Internet (z. B. im Laden).
// Die App startet sofort aus dem Speicher (auch bei schwachem Netz) und aktualisiert sich im Hintergrund.
const V = 'einkauf-v114', SHELL = ['./', 'index.html', 'app.js', 'route.js', 'receipt.js', 'extras.js', 'PatrickHand.ttf', 'header.jpg', 'Bangers.ttf', 'data.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
// 'reload': nie eine alte Kopie vom Hosting-Zwischenspeicher holen, sonst mischen sich alte und neue Dateien
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const put = (key, res) => { if (res && res.ok) { const c = res.clone(); caches.open(V).then(ca => ca.put(key, c)); } return res; };
const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  if (u.origin === location.origin) {
    const key = u.origin + u.pathname;
    if (u.pathname.endsWith('/offers.json')) { // Angebote: erst Netz (höchstens 4 Sekunden), sonst die gespeicherte Kopie
      e.respondWith(timeout(fetch(r), 4000).then(res => put(key, res)).catch(() => caches.match(key)));
      return;
    }
    // App-Dateien: sofort aus dem Speicher, im Hintergrund aktualisieren
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
      const net = fetch(u.href, { cache: 'no-cache' }).then(async res => { // 'no-cache': beim Hosting nachfragen, ob es etwas Neueres gibt // gibt es eine neuere Version? Dann der App Bescheid sagen
        if (hit && res.ok && /\.(js|html)$|\/$/.test(u.pathname)) { try { const [x, y] = await Promise.all([hit.clone().text(), res.clone().text()]); if (x !== y) self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage('update'))); } catch (err) { } }
        return put(r, res);
      }).catch(() => null);
      return hit || net.then(res => res || caches.match('index.html'));
    }));
    return;
  }
  // Produktbilder: erst gespeicherte Kopie, dann Netz
  if (r.destination === 'image') {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const c = res.clone(); caches.open(V).then(ca => ca.put(r, c)); return res; }).catch(() => Response.error())));
  }
});
