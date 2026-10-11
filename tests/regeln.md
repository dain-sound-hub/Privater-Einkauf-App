# Allgemeine Regeln der Zuordnung (Gedächtnis der Prüfer)

Diese Datei fasst zusammen, was aus gefundenen Fehlern als **allgemeine Regel** gelernt wurde. Prüfer lesen sie vor der Arbeit, der Ursachen-Analyst ergänzt sie. Jede Regel hat mindestens einen Eintrag in `tests/katalog.json`. Prüfen: `node tests/pruefen.js`.

## Erkennung (Angebote und Bons)
1. **Wortgrenzen:** Ein Stichwort gilt nur mit Wortende (`wordEnd` je Kategorie). Kein Treffer mitten im Wort (Kürbiskernbraten ≠ Kürbiskern, Toilettenbürste ≠ Toilettenpapier). Sperrwörter brauchen ebenfalls Wortgrenzen (`gewürz(?!t)`, `holz` nur als Wortteil bei Fleisch).
2. **Name vor Kategorie:** Ein Treffer nur aus dem Feld `cats` verliert gegen ein anderes Produkt, das im Namen steht (Lenor Waschmittel ≠ Color). Nennt der Name ein anderes Gemüse/Obst, zählt ein Kategorie-Wort nicht (Pfanni Speisekartoffeln ≠ Zwiebeln). Ausnahme: gleiche Produktfamilie (`group`).
3. **Dose, Glas, Tiefkühl, Konserve** ist kein Frischprodukt (Obst & Gemüse): `CAN_RX` (in Stücken, geschält, passiert, Salz-Dill, tiefgekühlt …).
4. **Einheit muss zum Produkt passen:** Ein Produkt in Litern mit Gramm-Angabe ist keine Milch/kein Getränk (Schokolade), außer Kefir, Ayran, Buttermilch (`LITER_G_OK`).
5. **Obst im Namen eines Milchprodukts** ist nur Geschmack (Fruchtkefir). Obst & Gemüse-Treffer verlieren gegen ein Produkt aus anderer Kategorie im Namen.
6. **Fleisch:** Aufschnitt unter 200 g ist kein Frischfleisch (Ausnahmen: Teilstück ≥ 120 g, „je 100 g“-Theke, „N x M g“ zählt als Summe, nie bei Geflügel). Innereien, Geräuchertes, Gebratenes, Brühe/Fond raus. Andere Tierart im Namen schlägt das Teilstück (Kalbs-Tafelspitz ≠ Rind). Geflügel ist nie „Edelstück“.
7. **Bon wie Angebot:** Auf dem Bon gelten dieselben Sperren (`bonBlocked`), dazu AE/OE/UE → ä/ö/ü und Abkürzungen ausschreiben (`bonSchreib`). Marke/Bio vor dem Produktwort darf den Treffer nicht verhindern (kwBon ohne `^`).
8. **Lernen nur bei Sicherheit:** Ein Alias wird nur gespeichert, wenn der Nutzer das Produkt selbst gewählt hat (`how === 'gewählt'`). „ähnlich“ nur bei ganzem Wort oder Wortanfang ab 5 Buchstaben.
9. **Wortanfang ist kein Wort:** Butter ≠ Buttermilch, Milch ≠ Milchschokolade (`knownWord` in `bonMatchList`).

## Mengen und Preise
10. **Preis je kg / je 100 g:** „je kg“ im Namen/Beschreibung/Hinweis → Preis ist Kilopreis (Metro). Nährwertangaben („20 g Protein pro 100 g“) sind keine Preisangabe (`noNutri`).
11. **„N x M Einheit“** = Gesamtmenge (6 x 1,5 l = 9 l); bei Waschladungen N x M WL = Produkt.
12. **Theke (je 100 g):** Ist der Grundpreis ≈ 10 × Preis und die Menge ≥ 200 g, ist der Preis je 100 g → Gesamtpreis nach Gewicht.
13. **„Einzelpreis“:** Ist der Normalpreis ein ganzes Vielfaches des Preises, ist es kein Rabatt.
14. **Größe/Stückzahl** fehlt oft im Feld, steht aber im Namen (ALDI) oder in der Beschreibung (WL, Rollen, N x M Blatt, Stück).

## Eingabe und Daten
15. Füllwörter („und“, „Punkt“, „ähm“) am Anfang/Ende entfernen; Teile ohne Buchstaben überspringen; „0“ ist keine Menge.
16. Gleicher Artikel = gleicher Wortstamm (Möhre = Möhren, Käse = Kaese).
17. Alles Fremde (Angebote, gespeicherte Daten, Importe) am Eingang prüfen: Typen, echte Daten, Grenzen.
18. Gespeicherte Bons behalten ihre alte Zuordnung (`pid`); Verbesserungen der Erkennung gelten nicht rückwirkend. (Seit v116 ordnet bonRemapOld(true) einmal pro Version neu zu, siehe Regel 23.)

## Bekannt offen
- Küchenrolle/Klopapier werden je Rolle, nicht je Blatt verglichen.
- Sorte vor Obst/Gemüse auf dem Bon (GALA APFEL) wird nur nicht zugeordnet (unsicher statt falsch), nicht fest erkannt.
- Bon-Format: Name allein in einer Zeile, Menge und Preis ohne Namen in den Folgezeilen geht verloren.
- Alte Bons: Aufräumen von Marken, die mit älterer Logik gespeichert wurden, nur beim Neu-Zuordnen mit.

## Ergänzt am 11.10. (gezielter Check mit echten Bons)
19. **Sperrwörter auf dem Bon wirken auch abgekürzt und am Wortende:** Ein Wort mit Punkt, dessen Ende (ab 5 Buchstaben) ein Sperrwort beginnt, zählt als Sperrwort (bouil. → Bouillon, aufschn. → Aufschnitt). `bonAbbr` leitet die Liste aus den Sperr-Mustern ab, sie wächst also mit.
20. **Marke vor Obst/Gemüse:** Steht auf dem Bon vor dem Obst-/Gemüsewort ein eigenes, unbekanntes Wort, wird nicht fest zugeordnet (unsicher statt falsch: Jumpys Paprika). Bekannt sind Wörter, die in den Angeboten vor echtem Obst/Gemüse stehen, Ladenmarken, Farben, Herkunft und kurze Abkürzungen. Sorte hinter dem Wort (APFEL ELSTAR) bleibt erkannt.
21. **Gekürzte Marken:** Toleranz nur für Markenwörter aus `kwBon` (Bon-Wort ab 6 Buchstaben, Anfang der Marke, höchstens 3 kürzer, ein einziges Produkt).
22. **Bon-Datum:** Älter als ca. 400 Tage = Lesefehler (Foto-Datum gilt, Bon zählt nicht, Historie ebenso). Gleicher Laden + gleiche Summe + mindestens 4 gleiche Artikel + (gleicher Tag/Monat oder sehr altes Datum) = doppelt.
23. **Alte Bons neu zuordnen:** Einmal pro Version nach dem Laden der Angebote. Nur leere Zuordnung füllen oder innerhalb derselben Produktfamilie genauer machen; Aliase überschreiben nie.
24. **Regal der Quelle:** ALDI-Adresse mit /produkte/konserven oder /tiefkuehl: kein Frischobst/-gemüse.
25. **Grundpreis der Quelle** gegen Preis und Menge prüfen (Abweichung über 2,5-fach und keine glatte Mehrfachpackung bis 24 → neu rechnen). parseUnit nimmt keine Zahl direkt vor der Einheit als Preis.
26. **Dauerpreis und Wochenangebot** (ALDI) zum gleichen Preis sind ein Angebot.
27. **Marke ist keine Farbe/Qualität:** bonBrand ignoriert Farb- und Qualitätswörter (Rote Paprika hat keine Marke).
