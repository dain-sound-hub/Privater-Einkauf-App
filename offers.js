// Recherchierte, echte Angebote. Jede Zeile hat Quelle + Abrufdatum. NICHT erfunden.
// Wichtig: kaufDA zeigt Händler-weite Prospekte. Ob exakt die Filiale in Chorweiler das Angebot hat, ist NICHT geprüft.
// Fehlende Packungsgrößen bleiben leer -> App zeigt dann keinen Grundpreis (statt einen zu erfinden).
window.OFFERS_META = {
  fetched: '2026-10-05',
  note: 'Teilweise Recherche (kaufDA-Prospektseiten, Händler-weit). Lückenhaft: REWE, dm, Penny und die Aldi/Lidl-Einzelpreise waren nicht abrufbar. Weitere Angebote in der App unter „Daten" eintragen oder von Claude nachrecherchieren lassen.'
};
const KD = 'https://www.kaufda.de/Geschaefte/Netto-Marken-Discount';
window.OFFERS = [
  // --- Netto, gültig 05.10.–10.10.2026 (Quelle kaufDA Netto-Prospekt) ---
  { id: 'n1', store: 'netto', name: 'Hähnchen-Brustfilet', pid: 'haehnchen', price: 7.99, regular: 9.99, valid: ['2026-10-05', '2026-10-10'], src: KD, incomplete: 'Packungsgröße nicht bekannt, kein Grundpreis' },
  { id: 'n2', store: 'netto', name: 'Bio Heidelbeeren', pid: 'heidelbeeren', price: 2.22, regular: 2.69, valid: ['2026-10-05', '2026-10-10'], src: KD, incomplete: 'Packungsgröße nicht bekannt, kein Grundpreis' },
  { id: 'n3', store: 'netto', name: 'Kiwi grün', pid: 'kiwi', price: 0.44, regular: 0.49, valid: ['2026-10-05', '2026-10-10'], src: KD, incomplete: 'Stück oder Packung unklar' },
  { id: 'n4', store: 'netto', name: 'Bitburger 0,0 % alkoholfrei', pid: 'bitburger', price: 0.79, regular: 0.99, unitPrice: 1.58, base: 'l', valid: ['2026-10-05', '2026-10-10'], src: KD, note: 'Achtung: alkoholfrei' },
  { id: 'n5', store: 'netto', name: 'Walnusskerne', price: 2.22, regular: 2.69, valid: ['2026-10-05', '2026-10-10'], src: KD, cat: 'food', incomplete: 'Packungsgröße nicht bekannt' },
  { id: 'n6', store: 'netto', name: 'Frische Teigwaren', price: 2.29, regular: 4.49, valid: ['2026-10-05', '2026-10-10'], src: KD, cat: 'food', incomplete: 'Packungsgröße nicht bekannt' }
];
