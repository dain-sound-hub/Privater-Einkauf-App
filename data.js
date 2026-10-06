// Stammdaten aus Uebergabedokument + Excel (Stand: Chat-Historie). Preise hier sind NUR Referenzen, keine aktuellen Angebote.
window.STORES = [
  // A = Hauptbereich: City-Center Chorweiler / Türkplatz, alles direkt am Gebäude, wenige Minuten zu Fuß
  { id: 'netto', name: 'Netto Marken-Discount', short: 'Netto', tier: 'A', walk: 3, car: 2, addr: 'Mailänder Passage 1, City-Center Chorweiler', hours: 'Mo–Sa 08:00–20:00 (historisch, bitte prüfen)', links: [['Prospekt (kaufDA)', 'https://www.kaufda.de/Geschaefte/Netto-Marken-Discount'], ['Netto Angebote', 'https://www.netto-online.de/angebote']] },
  { id: 'rewe', name: 'REWE', short: 'REWE', tier: 'A', walk: 3, car: 2, addr: 'Florenzer Straße 24-28, Köln-Chorweiler', hours: 'nicht gesichert', links: [['REWE Angebote', 'https://www.rewe.de/angebote/'], ['Prospekt (kaufDA)', 'https://www.kaufda.de/Geschaefte/REWE']] },
  { id: 'aldi', name: 'ALDI SÜD', short: 'ALDI', tier: 'A', walk: 3, car: 2, addr: 'Salzburger Hof 2, Köln-Chorweiler (Nähe Türkplatz)', hours: '08:00–21:00 (Stand 17.04.2026, bitte prüfen)', note: 'Für ALDI gibt es keine auslesbaren Wochenpreise. Preise dort bitte im Prospekt prüfen.', links: [['ALDI SÜD Angebote', 'https://www.aldi-sued.de/de/angebote.html'], ['Prospekt (kaufDA)', 'https://www.kaufda.de/Geschaefte/Aldi-Sued']] },
  { id: 'dm', name: 'dm', short: 'dm', tier: 'A', walk: 3, car: 2, addr: 'Mailänder Passage 1, City-Center Chorweiler', hours: 'nicht gesichert', links: [['dm Angebote', 'https://www.dm.de/angebote']] },
  // B = Spaziergang-Lidl (Rucksack), optional
  { id: 'lidl', name: 'Lidl Elbeallee', short: 'Lidl', tier: 'B', walk: 18, car: 5, addr: 'Elbeallee 11, Köln', hours: 'Mo–Sa 07:00–22:00 (historisch, bitte prüfen)', note: 'Dein Spaziergang-Lidl: mit Rucksack mitnehmen, wenn du eh dort spazierst.', links: [['Prospekt (kaufDA)', 'https://www.kaufda.de/Geschaefte/Lidl'], ['Lidl Angebote', 'https://www.lidl.de/c/aktuelle-angebote/s10008614']] },
  // D = Großmarkt & Online, nur als Option wenn du Zeit und Lust hast
  { id: 'selgros', name: 'Selgros Köln-Am Butzweilerhof', short: 'Selgros', tier: 'D', walk: null, car: 15, addr: 'Von-Hünefeld-Straße 100, 50829 Köln-Ossendorf', hours: 'Mo–Fr 06:00–22:00, Sa 06:00–20:00 (laut Selgros-Seite, bitte prüfen)', note: 'Sehr großer Großmarkt, ca. 60.000 Artikel. Vermutlich dein Großmarkt. Fahrzeit geschätzt.', links: [['Selgros Markt Köln', 'https://www.selgros.de/markt/koeln']] },
  { id: 'metro', name: 'METRO Köln', short: 'METRO', tier: 'D', walk: null, car: 20, addr: 'Otto-Hahn-Straße 15, 50997 Köln', hours: 'nicht gesichert', note: 'Großmarkt, Gewerbekunden-Karte nötig. Fahrzeit geschätzt.', links: [['METRO', 'https://www.metro.de/']] },
  { id: 'handelshof', name: 'Handelshof Köln-Müngersdorf', short: 'Handelshof', tier: 'D', walk: null, car: 18, addr: 'Widdersdorfer Straße 429-431, 50933 Köln', hours: 'nicht gesichert', note: 'Großmarkt, vor allem für Gastronomie. Alternative in der Nähe. Fahrzeit geschätzt.', links: [['Handelshof', 'https://www.handelshof.de/cash-carry-maerkte/']] },
  { id: 'online', name: 'Online / Bestellung', short: 'Online', tier: 'D', walk: 0, car: 0, addr: 'Bestellung', hours: '-', links: [] }
];
window.TIER_LABEL = { A: 'City-Center Chorweiler (Haupteinkauf)', B: 'Spaziergang-Lidl (optional)', C: 'Sonderfahrt (optional)', D: 'Großmarkt & Online (optional)' };
window.TIER_SHORT = { A: 'City-Center', B: 'Spaziergang', C: 'Sonderfahrt', D: 'Großmarkt' };

// base: kg | l | st (Vergleichsbasis). ref = historischer Referenz-Grundpreis (€ je Basis), nur wo im Dokument belegt.
// kw = Suchbegriffe (Regex) zum Abgleich mit Angebotsnamen
window.PRODUCTS = [
  { id: 'wm_dunkel', heavy: 1, cat: 'Haushalt & Wäsche', name: 'Waschmittel dunkel', kw: 'waschmittel.*(black|dunkel|schwarz)|black sensation', base: 'st', stock: 1, note: 'Denkmit Black Sensation, vergleiche je Waschladung' },
  { id: 'wm_bunt', heavy: 1, cat: 'Haushalt & Wäsche', name: 'Waschmittel bunt', kw: 'waschmittel.*(color|bunt)|color(waschmittel)?|coral', base: 'st', stock: 1, note: 'je Waschladung vergleichen' },
  { id: 'wm_weiss', heavy: 1, cat: 'Haushalt & Wäsche', name: 'Waschmittel weiß', kw: 'weißer riese|weisser riese|megaperls|vollwaschmittel', base: 'st', stock: 1 },
  { id: 'wm_uni', heavy: 1, cat: 'Haushalt & Wäsche', name: 'Universalwaschmittel', kw: 'universal.*waschmittel|waschmittel.*universal|waschpulver|waschmittel', base: 'st', stock: 1 },
  { id: 'weichspueler', heavy: 1, cat: 'Haushalt & Wäsche', name: 'Weichspüler', kw: 'weichspüler|kuschelweich|vernel|lenor', base: 'st', stock: 1 },
  { id: 'farbfang', cat: 'Haushalt & Wäsche', name: 'Farb-/Schmutzfangtücher', kw: 'farbfang|schmutzfang|farbschutz', base: 'st', stock: 1, prio: 1, note: 'je Stück vergleichen' },
  { id: 'kuechenrolle', heavy: 1, cat: 'Haushalt & Wäsche', name: 'Küchenrollen', kw: 'küchenrolle|küchentuch|küchentücher|haushaltstücher', base: 'st', stock: 1, prio: 1, pref: 'rewe', note: 'Dein Standard: REWE 8er-Big-Pack' },
  { id: 'toilettenpapier', cat: 'Haushalt & Wäsche', name: 'Toilettenpapier / Klopapier', kw: 'toilettenpapier|klopapier|toilet', base: 'st', heavy: 1, stock: 1, prio: 1, note: 'sperrig, immer zuletzt kaufen' },
  { id: 'servietten', cat: 'Haushalt & Wäsche', name: 'Servietten', kw: 'servietten', base: 'st', heavy: 1, stock: 1, note: 'sperrig' },
  { id: 'milch', cat: 'Milchprodukte', name: 'Frische Milch', kw: '\\b(vollmilch|weidemilch|frische milch|frische bio milch|h-milch|haltbare milch|bio-milch|milch)\\b(?![-\\s]?(schokolade|reis|schnitte|brötchen|creme|shake|riegel|pudding|eis|mix|kakao|drink))', base: 'l', perish: 1, note: 'Frische Milch ist dir wichtig' },
  { id: 'ayran', cat: 'Milchprodukte', name: 'Ayran', kw: 'ayran', base: 'l', perish: 1 },
  { id: 'buttermilch', cat: 'Milchprodukte', name: 'Buttermilch', kw: 'buttermilch', base: 'l', perish: 1 },
  { id: 'kefir', cat: 'Milchprodukte', name: 'Kefir', kw: 'kefir', base: 'l', perish: 1 },
  { id: 'butter', cat: 'Milchprodukte', name: 'Butter', kw: '\\b(markenbutter|butter|kaergarden|kærgården|kerrygold|streichzart)\\b(?![\\s-]?(toast|käse|gemüse|keks|croissant|brezel|kuchen|milch|schmalz|spekulatius|vanille|creme|reis|bohnen|mais|aroma))', base: 'kg', stock: 1, prio: 1 },
  { id: 'butterschmalz', cat: 'Milchprodukte', name: 'Butterschmalz', kw: 'butterschmalz', base: 'kg', stock: 1, prio: 2, note: 'Knallerpreise immer melden' },
  { id: 'tomaten', cat: 'Obst & Gemüse', name: 'Tomaten / Strauchtomaten', kw: 'tomate', base: 'kg', perish: 1 },
  { id: 'gurken', cat: 'Obst & Gemüse', name: 'Gurken', kw: 'gurke', base: 'st', perish: 1 },
  { id: 'paprika', cat: 'Obst & Gemüse', name: 'Paprika', kw: 'paprika', base: 'kg', perish: 1, prio: 2, note: 'Hohe Priorität' },
  { id: 'melone', cat: 'Obst & Gemüse', name: 'Honigmelone', kw: 'honigmelone|melone', base: 'st', perish: 1, sweet: 1 },
  { id: 'trauben', cat: 'Obst & Gemüse', name: 'Weintrauben', kw: 'trauben', base: 'kg', perish: 1, sweet: 1 },
  { id: 'heidelbeeren', cat: 'Obst & Gemüse', name: 'Heidelbeeren', kw: 'heidelbeere', base: 'kg', perish: 1, sweet: 1 },
  { id: 'erdbeeren', cat: 'Obst & Gemüse', name: 'Erdbeeren', kw: 'erdbeere', base: 'kg', perish: 1, sweet: 1 },
  { id: 'apfel', cat: 'Obst & Gemüse', name: 'Äpfel rot', kw: '(?<![a-zäöü])(äpfel|apfel)(?![a-zäöü])', base: 'kg', perish: 1, sweet: 1 },
  { id: 'ananas', cat: 'Obst & Gemüse', name: 'Ananas', kw: 'ananas', base: 'st', perish: 1, sweet: 1 },
  { id: 'kiwi', cat: 'Obst & Gemüse', name: 'Kiwi', kw: 'kiwi', base: 'st', perish: 1, sweet: 1 },
  { id: 'zwiebeln', cat: 'Obst & Gemüse', name: 'Zwiebeln', kw: 'zwiebel', base: 'kg' },
  { id: 'leinoel', cat: 'Öle & Grundnahrung', name: 'Leinöl', kw: 'leinöl', base: 'l', stock: 1, note: 'Gesunde Öle bevorzugt (kühl lagern, kurz haltbar)' },
  { id: 'salatoel', cat: 'Öle & Grundnahrung', name: 'Gesunde Salatöle', kw: 'olivenöl|rapsöl|walnussöl|salatöl|speiseöl', base: 'l', stock: 1 },
  { id: 'basmati', cat: 'Öle & Grundnahrung', name: 'Himalaya-Basmati-Reis', kw: 'basmati|\\breis\\b', base: 'kg', stock: 1 },
  { id: 'buchweizen', cat: 'Öle & Grundnahrung', name: 'Buchweizen', kw: 'buchweizen', base: 'kg', stock: 1, ref: 3.38, refNote: 'ALDI Bio 500 g, 3,38 €/kg (historisch)' },
  { id: 'sonnenblumenkerne', cat: 'Öle & Grundnahrung', name: 'Sonnenblumenkerne', kw: 'sonnenblumenkern', base: 'kg', stock: 1 },
  { id: 'kuerbiskerne', cat: 'Öle & Grundnahrung', name: 'Kürbiskerne', kw: 'kürbiskern', base: 'kg', stock: 1 },
  { id: 'pinienkerne', cat: 'Öle & Grundnahrung', name: 'Pinienkerne', kw: 'pinienkern', base: 'kg', stock: 1 },
  { id: 'rinderhack', cat: 'Fleisch', name: 'Rinderhack (rein)', kw: 'rinder.?hack|hackfleisch.*rind|rinder-hack', base: 'kg', meat: 1, stock: 1, prio: 2, ref: 9.99, refNote: 'Netto Gut Ponholz 9,99 €/kg (historisch); Penny/Kaufland 9,98 €/kg', note: 'Für Burger rein Rind' },
  { id: 'gemhack', cat: 'Fleisch', name: 'Gemischtes Hack', kw: 'gemischtes hack|hackfleisch gemischt|hack.*gemischt|^hackfleisch', base: 'kg', meat: 1, stock: 1, note: 'Einzige Schweinefleisch-Ausnahme' },
  { id: 'haehnchen', cat: 'Fleisch', name: 'Hähnchen', kw: 'hähnchen|hühnchen|hendl|geflügel(?!wurst)', base: 'kg', meat: 1, stock: 1 },
  { id: 'pute', cat: 'Fleisch', name: 'Pute / Geflügel', kw: '\\bpute|\\bputen', base: 'kg', meat: 1, stock: 1 },
  { id: 'rind', cat: 'Fleisch', name: 'Rind allgemein', kw: 'rindersteak|rumpsteak|entrecôte|rinderfilet|rindergulasch|rinderbraten|rinderroulade|tafelspitz|\\brindfleisch|\\brind(?!er.?hack)', base: 'kg', meat: 1, stock: 1 },
  { id: 'wasser', cat: 'Getränke', name: 'Stilles Wasser', kw: 'mineralwasser|stilles wasser|tafelwasser|wasser still', base: 'l', heavy: 1 },
  { id: 'bitburger', heavy: 1, cat: 'Getränke', name: 'Bitburger Bier', kw: 'bitburger', base: 'l', note: 'Dose bevorzugt, Flasche okay' }
];

// Begriffe, die in „Entdecken" nie auftauchen (Schwein/Wurst/Salami laut deinen Regeln)
window.EXCLUDE_RX = /schwein|salami|wurst|schinken|speck|bacon|bratwurst|leberkäse|mettwurst|nackensteak|kasseler|eisbein|spareribs|haxe|krakauer|mett\b|lyoner|mortadella|fleischwurst|bärchenwurst/i;

// Suchbegriffe für die Recherche (kaufDA, ohne Umlaute)
const Q={wm_dunkel:['Waschmittel'],wm_bunt:['Waschmittel'],wm_weiss:['Waschmittel'],wm_uni:['Waschmittel'],weichspueler:['Weichspueler'],farbfang:['Farbfangtuecher','Farbschutztuecher'],kuechenrolle:['Kuechentuecher','Kuechenrollen'],toilettenpapier:['Toilettenpapier','Klopapier'],servietten:['Servietten'],milch:['Frische-Milch','Milch'],ayran:['Ayran'],buttermilch:['Buttermilch'],kefir:['Kefir'],butter:['Butter'],butterschmalz:['Butterschmalz'],tomaten:['Tomaten'],gurken:['Gurken'],paprika:['Paprika'],melone:['Honigmelone'],trauben:['Weintrauben'],heidelbeeren:['Heidelbeeren'],erdbeeren:['Erdbeeren'],apfel:['Aepfel'],ananas:['Ananas'],kiwi:['Kiwi'],zwiebeln:['Zwiebeln'],leinoel:['Leinoel'],salatoel:['Olivenoel','Rapsoel'],basmati:['Basmati-Reis','Reis'],buchweizen:['Buchweizen'],sonnenblumenkerne:['Sonnenblumenkerne'],kuerbiskerne:['Kuerbiskerne'],pinienkerne:['Pinienkerne'],rinderhack:['Rinderhackfleisch','Hackfleisch'],gemhack:['Hackfleisch'],haehnchen:['Haehnchenbrust','Haehnchen'],pute:['Pute','Putenbrust'],rind:['Rindfleisch','Rindergulasch','Rindersteak'],wasser:['Mineralwasser'],bitburger:['Bitburger']};
PRODUCTS.forEach(p=>p.q=Q[p.id]||[]);
// Entdecken: breite Suche nach guten Angeboten außerhalb der Liste
window.DISCOVER_TERMS=['Lachs','Kaese','Joghurt','Nuesse','Eier','Nudeln','Kaffee','Garnelen','Honig','Rinderfilet','Lammfleisch','Thunfisch','Avocado','Spinat','Brokkoli','Haferflocken','Olivenoel','Schokolade','Tiefkuehlgemuese','Reis','Gummibaerchen','Kekse','Chips','Eiscreme','Pralinen','Lakritz','Haselnusscreme','Marmelade','Muesli','Cornflakes','Salzgebaeck','Knabbergebaeck','Cola','Limonade','Orangensaft','Apfelsaft','Energy-Drink','Wein','Sekt','Whisky','Kaffeekapseln','Tee','Sprudel','Pils','Radler','Wasser','Brot','Broetchen','Toastbrot','Croissant','Mehl','Zucker','Backpulver','Hefe','Margarine','Sahne','Quark','Skyr','Mozzarella','Gouda','Frischkaese','Schmand','Pudding','Parmesan','Feta','Hirtenkaese','Butterkaese','Bananen','Orangen','Zitronen','Mandarinen','Birnen','Pflaumen','Mango','Wassermelone','Kartoffeln','Moehren','Salat','Champignons','Zucchini','Aubergine','Blumenkohl','Knoblauch','Ingwer','Kuerbis','Radieschen','Kohlrabi','Lauch','Mais','Eisbergsalat','Rote-Bete','Feldsalat','Himbeeren','Brombeeren','Kirschen','Pfirsich','Nektarinen','Granatapfel','Haehnchenschenkel','Haehnchenfluegel','Putenschnitzel','Rinderbraten','Rinderrouladen','Entenbrust','Forelle','Seelachs','Fischstaebchen','Rinderburger','Rinderleber','Rinderhuefte','Kalbfleisch','Schnitzel','Tiefkuehlpizza','Pommes','Spaghetti','Linsen','Kichererbsen','Bohnen','Sardinen','Suppe','Ravioli','Couscous','Bulgur','Quinoa','Haferdrink','Sojadrink','Sonnenblumenoel','Essig','Salz','Pfeffer','Gewuerze','Ketchup','Senf','Mayonnaise','Sojasauce','Tomatenmark','Passata','Spuelmittel','Geschirrspueltabs','Allzweckreiniger','Muellbeutel','Toilettenpapier','Taschentuecher','Alufolie','Backpapier','Zahnpasta','Duschgel','Shampoo','Deo','Seife','WC-Reiniger','Batterien','Gefrierbeutel','Servietten','Spuelschwamm','Haushaltsreiniger','Glasreiniger','Kosmetiktuecher'];

// Treffer, die zwar das Stichwort enthalten, aber kein echtes Produkt sind (Chips, Saucen, Kosmetik …)
window.NOISE_RX = /passata|passiert|paprikamark|mark|saft|schorle|nektar|marmelade|konfitüre|joghurt|limo|röst|tomatenmark|ketchup|püree|aufschnitt|gurkensalat|krautsalat|kartoffelsalat|nudelsalat|fleischsalat|salatmix|kondens|chips|cracks|snack|riegel|pizza|sauce|soße|dip|aufstrich|gewürz|würzmischung|suppe|brühe|müsli|toast|keks|croissant|spekulatius|gebäck|kuchen|torte|bodyspray|shampoo|duschgel|body|futter|lakritz|bonbon|fertiggericht|grill|bio-?tonne|aroma|vanille|backaroma/i;
