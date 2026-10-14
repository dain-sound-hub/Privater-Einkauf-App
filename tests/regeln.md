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

## Ergänzt am 12.10. (Scheinrabatt Quellbrunn)
28. **Rundung ist kein Rabatt:** Weicht der Grundpreis der Quelle nur um Cent-Rundung (höchstens 0,006 €) von Preis/Menge ab, wird exakt gerechnet (mit kleinem Aufschlag, damit 2,975 als 2,98 angezeigt wird). Eine Ersparnis gegen die eigene Historie zählt erst ab 5 % (`REF_MIN`).
29. **Historie zählt Kauftage:** Ein Eintrag je Produkt, Tag und Laden (der neueste gewinnt), keiner aus Bons mit unplausiblem Datum; die Referenz ist der echte Median aus mindestens 2 Käufen. Einträge ohne Datum werden nur zusammengelegt, wenn sie völlig gleich sind. Beim Laden fremder Daten erst bereinigen, dann kürzen.
30. **Jede Änderung an S.hist leert den Angebots-Zwischenspeicher (CACHE).**

## Ergänzt am 13.10. (Bon ohne Laden/Datum)
31. **Laden aus mehreren Hinweisen:** je Art des Hinweises (Name, Adresse, Eigenmarke) zählt ein Laden nur einmal; Name im Kopf 4, später 2,5, Straße mit Hausnummer 3, Straße allein 1,5, Eigenmarke 0,6. Gleichstand und Werte unter 2 sind nur ein Vorschlag. „Ein Unternehmen der REWE Group“ und Steuerzeilen („Netto 1,00“, „Netto-Füllmenge“) zählen nicht.
32. **Datum aus allen Zeilen:** Ziffern-Verwechslungen nur zwischen Ziffern korrigieren; Zeilen mit gültig/bis/MHD/Coupon/Aktion nie; kein Datum in Bon- oder Telefonnummern; ein verlesenes Jahr wird vom Foto-Tag übernommen, nur in reinen Datums-/Fußzeilen, nie bei Uhr/Uhrzeit, und braucht Bestätigung. Datum über 400 Tage oder in der Zukunft wird beim Speichern abgelehnt.
33. **Uhrzeit:** nie aus Öffnungszeiten (Zeitspannen, Wochentage) und nie aus Datumsteilen.
34. **Nie leer fragen:** Fehlt Laden oder Datum, steht ein Vorschlag da (Laden-Hinweis, Foto-Tag). Rohtext und Erkennung werden lokal in der Bon-Diagnose festgehalten (20 Einträge, wird beim Speicherengpass zuerst geopfert).

## Ergänzt am 13.10. (Route, Sammelbegriffe)
35. **Sammelbegriff als eigenes Produkt:** Ein eigenes Produkt, dessen Name nur ein Obst-/Gemüsewort oder ein Sammelbegriff ist (Obst, Gemüse, Früchte, Beeren, Salat), gehört zur Rubrik Obst & Gemüse und bekommt alle Frisch-Sperren (CAN_RX, Regal, Bindestrich, Bon), auch auf dem Fundstellen-Weg (customOk). Tiefkühl, getrocknet, Trocken-/Dörr- und Dose zählen nie als frisches Obst.
36. **Sammelprodukte:** Obst, Gemüse, Käse, Wurst und Fleisch sind Sammelprodukte (virtual + sam + group). Ein Sammelwort auf der Liste zeigt das beste Angebot aller Sorten, Käufe jeder Sorte zählen dafür. Ein gleichnamiger eigener Eintrag wird beim Laden zum Sammelprodukt (Liste, Favoriten, Verlauf). Frischkäse zählt nicht zu Käse, Tiefkühl/getrocknet/Dose/Saft/Tee nie zu Obst und Gemüse. Wurst-Sorten (onlyList) erscheinen nie ungefragt in allgemeinen Angebotslisten.
37. **Angebote = echte Angebote:** ALDI-Dauerpreise (Regalpreis, Hinweis „Dauerpreis“) erscheinen nicht unter Angebote und nicht auf der Startseite. Sie bleiben für die Preissuche der Liste und Route. Keine Ersparnis-Zeilen für Angebote ohne Vergleichspreis.

## Ergänzt am 14.10. (Oberfläche)
38. **Symbole in Kreisen und Knöpfen werden gezeichnet (CSS-Striche), nie als Text-Zeichen mit Polster:** Text-Zeichen sitzen je nach Schrift schief. Allgemeine Klassennamen wie .plus dürfen keine fremden Elemente treffen.
39. **Grüne Flächen mit Schrift** nutzen --g1/--g2 und --on-acc (hell: weiß auf dunklem Grün, dunkel: dunkle Schrift auf hellem Grün). Kontrast mindestens 4,5:1 (große fette Schrift 3:1).
40. **Produktbilder:** Prospekt-Titelbilder (/main.jpg) sind keine Produktfotos, dafür gilt das Symbol. Falsche Symbole (Wortgrenze bei cola/Rucola) wie Regel 1 verhindern.
41. **Fenster** sperren das Scrollen der Seite dahinter (body.noscroll). Jede Ansicht, jedes Fenster nutzt dieselben Tokens (--gloss, --sh2).
42. **Route** ist die Einkaufsliste im Laden: schmaler Kopf, Fortschritt x von y, Zeilen 36 px, Marke klein, Abgehaktes bleibt sichtbar im Block Erledigt.

## Ergänzt am 14.10. (nur Angebote mit Ersparnis, Archiv)
43. **Packungspreis ist kein Normalpreis:** Ist der Normalpreis ≈ N × Preis und nennen Name oder Beschreibung N Teile („6 x 0,75 l“, „6er“), ist es der Preis der ganzen Packung, also kein Rabatt.
44. **Ersparnis nur aus dem Laden selbst oder eigenen Käufen:** kein Markt-Median, kein fremder Laden, keine Prozentzahl aus dem Text (Fett, Vol., Fruchtgehalt), kein Bonial-Rabattlabel. App-, Bonus-, Plus- und PAYBACK-Preise sind nie eine Ersparnis.
45. **Startseite und Angebote zeigen nur Angebote mit bekannter Ersparnis (pct vorhanden).** Auf der Angebote-Seite schaltet eine Zeile unter der Suche die übrigen zu; ihr Zähler und jede Leer-Meldung kommen aus genau der angezeigten Menge (Laden, Reiter, Suche). Zähler, Meldungen und Anzeige nutzen dieselbe Filterfunktion.
46. **Langzeit-Archiv:** Jeder gespeicherte Bon bleibt mit allen Positionen in IndexedDB „einkauf-archiv“ (nie gekürzt, nur Alles löschen leert es); Sicherung und Import enthalten es. Die App-Daten führen nur die letzten 60 Bons.

## Ergänzt am 14.10. (Paket A: Speichern und Archiv)
47. **„Gespeichert“ erst nach bestätigtem Speichern:** Ein Bon gilt erst als gespeichert (Meldung, Warteschlange abgeschlossen, Abschrift entfernt), wenn save() gelungen ist. Sonst wird er zurückgenommen, bleibt in der Warteschlange, trägt eine sichtbare Meldung und lässt sich mit derselben Nummer (b_<Warteschlangen-ID>) wiederholen. Ablaufprüfung: node tests/pruefen.js --js tests/ablauf/speichern.js
48. **Archiv wird nie aus einer gekürzten Kopie überschrieben:** Jeder Bon geht beim Verbuchen vollständig ins Archiv, bevor die Arbeitsmenge (60 Bons, 120 Positionen) gekürzt wird. arcPut ersetzt einen Eintrag nie durch eine Fassung mit weniger Positionen und prüft den Eingang (id, Datum, Positionen).
49. **Sicherung und Import melden Archivfehler:** Lesefehler (null) ist nicht „leer“. Ohne lesbares Archiv fragt die Sicherung nach, markiert die Datei (archivVollstaendig: false) und setzt „zuletzt gesichert“ nicht. Der Import wartet auf das Archiv und meldet einen Fehler sichtbar.

## Ergänzt am 14.10. (Paket B: Sicherheit)
50. **Fremde Werte nie als Text in Klick-Handler einsetzen:** Angebots-IDs (offers.json, manuelle Angebote, Import) werden beim Bereinigen auf [A-Za-z0-9_.:-] geprüft (sonst feste Ersatz-ID), und Handler bekommen Werte nur über jsq() (JSON-Literal, HTML-maskiert), nicht über esc() in einem JS-Text. Ablaufprüfung: node tests/pruefen.js --js tests/ablauf/sicherheit.js. Die CSP bleibt, bis alle Handler umgestellt sind.

## Ergänzt am 14.10. (Pakete C und D)
51. **Mengen aus dem Text:** „N x M St.“ zählt N Rollen, wenn M ≥ 50 (Blatt je Rolle), sonst N × M; „N x M WL“ zählt N × M. Liefert die Quelle nur M, gilt die Gesamtzahl aus dem Text.
52. **Bedingte Preise (App, Coupon, PAYBACK, Bonus, Plus) bekommen nie Prozent** (appRequired und Hinweistext), auch nicht aus der eigenen Preis-Referenz.
53. **Frisch-Sperren gelten auch für die Beschreibung;** Fonds und alles in ml/l sind kein Fleisch; Reinigungs-, Baumwoll- und Mikrofasertücher sind keine Küchenrolle; Herzogin-/Duchesse-Kartoffeln sind keine frischen Kartoffeln.
54. **Entscheidung und Wartehinweis vergleichen mit dem Angebot der Zeile,** nicht mit dem besten City-Center-Angebot. Der bekannte Preis des Standardladens bleibt stehen, auch ohne Prozent. Wortgrenzen auch in route.js (Rucola ≠ Cola). Ablaufprüfung: node tests/pruefen.js --js tests/ablauf/route.js

Bewusst offen (Entscheidung des Nutzers): Lidl mit Listenmenge (D1), Vergleich gegen geplante Route (D2), Route stabil halten (D3), Wurst bei der Abholung (D4), Vollbeleg-Archiv (D5), Fremdladen-Referenz p.ref (D6), Änderungen an research-core.js (C5/C7/C8/C10).
