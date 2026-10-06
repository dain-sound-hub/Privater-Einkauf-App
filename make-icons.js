// Erzeugt die App-Symbole (PNG) ohne Zusatzpakete.
const zlib = require('zlib'), fs = require('fs');
function png(size, maskable) {
  const px = Buffer.alloc(size * size * 4), r = size * 0.22, S = size;
  const seg = (x, y, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)); };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    // abgerundetes Quadrat
    const cx = Math.max(r, Math.min(S - r, x)), cy = Math.max(r, Math.min(S - r, y)), inside = maskable ? true : Math.hypot(x - cx, y - cy) <= r;
    const k = maskable ? 1 / 0.7 : 1, X = (x - S / 2) * k + S / 2, Y = (y - S / 2) * k + S / 2;
    if (!inside) { px[i + 3] = 0; continue; }
    const g = (x + y) / (2 * S); // Verlauf grün
    let R = 255 + (214 - 255) * g, G = 154 + (47 - 154) * g, B = 31 + (63 - 31) * g;
    // Einkaufstüte: weißer Körper + Henkel
    const bx1 = S * 0.27, bx2 = S * 0.73, by1 = S * 0.40, by2 = S * 0.78;
    const inBag = X > bx1 && X < bx2 && Y > by1 && Y < by2;
    const handle = Math.abs(Math.hypot(X - S / 2, (Y - by1) * 1.15) - S * 0.15) < S * 0.028 && Y < by1 + 2;
    // Haken in der Tüte
    const tick = Math.min(seg(X, Y, S * 0.40, S * 0.60, S * 0.47, S * 0.67), seg(X, Y, S * 0.47, S * 0.67, S * 0.61, S * 0.52)) < S * 0.03;
    if (inBag || handle) { R = G = B = 255; if (tick) { R = 214; G = 47; B = 63; } }
    px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = 255;
  }
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t), d])) >>> 0, 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [n, s] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) fs.writeFileSync(n, png(s));
fs.writeFileSync('icon-maskable-512.png', png(512, true));
console.log('Symbole erzeugt');
