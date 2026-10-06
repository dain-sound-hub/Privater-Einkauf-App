// Offline-Speicher: Die App und die zuletzt geladenen Angebote funktionieren auch ohne Internet (z. B. im Laden).
const V = 'einkauf-v2', SHELL = ['./', 'index.html', 'app.js', 'route.js', 'data.js', 'offers.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  // Eigene Dateien und Angebote: erst Netz (immer aktuell), sonst gespeicherte Kopie
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(ca => ca.put(r, c)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
    return;
  }
  // Produktbilder: erst gespeicherte Kopie, dann Netz
  if (r.destination === 'image') {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const c = res.clone(); caches.open(V).then(ca => ca.put(r, c)); return res; }).catch(() => Response.error())));
  }
});
