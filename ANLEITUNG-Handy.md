# App aufs Handy bringen (kostenlos, ohne eigenen Server)

**Ziel:** Die Einkaufsliste läuft auf deinem Handy, **auch im Laden ohne Internet**. Die Angebote aktualisiert GitHub jeden Morgen automatisch. Dein PC muss dafür nicht laufen.

## Was du brauchst
- Ein kostenloses Konto bei **GitHub** (github.com). Das musst du selbst anlegen.
- Etwa 15 Minuten.

## Schritt 1: Konto und Ablage anlegen
1. Auf github.com mit **Sign up** ein Konto erstellen (E-Mail, Passwort, Benutzername).
2. Oben rechts **+ → New repository**.
3. Name: `einkauf`. Auswahl **Public** (nötig für die kostenlose Seite). **Create repository**.

## Schritt 2: Dateien hochladen
1. Auf der neuen Seite den Link **uploading an existing file** anklicken.
2. Aus dem Ordner „Privater Einkauf App" diese Dateien und den Ordner `.github` hineinziehen:
   - `index.html`, `app.js`, `route.js`, `receipt.js`, `Caveat.ttf`, `data.js`, `offers.js`, `offers.json`
   - `sw.js`, `manifest.webmanifest`
   - `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
   - `research-core.js`, `refresh-offers.js`
   - der Ordner `.github` (darin liegt der Zeitplan)
3. **Nicht hochladen:** das PDF und die Excel-Datei (dein persönlicher Einkaufsverlauf), `server.js` und die `.bat`-Dateien.
4. Unten **Commit changes** klicken.

> Der Ordner `.github` fängt mit einem Punkt an. Im Windows-Explorer ist er sichtbar, wenn unter „Ansicht" die „Ausgeblendeten Elemente" angezeigt werden.

## Schritt 3: Seite einschalten
1. Im Repository **Settings → Pages**.
2. Bei **Source** „Deploy from a branch" wählen, Branch `main`, Ordner `/ (root)`, **Save**.
3. Nach 1 bis 2 Minuten steht oben die Adresse, z. B. `https://DEINNAME.github.io/einkauf/`.

## Schritt 4: Automatische Aktualisierung erlauben
1. **Settings → Actions → General**, ganz unten **Workflow permissions**: „Read and write permissions" wählen, **Save**.
2. Oben **Actions** → links „Angebote aktualisieren" → **Run workflow**. Nach ca. 2 Minuten sollte es grün sein.
3. Ab jetzt läuft es täglich um ca. 6 Uhr und samstags abends von selbst.

## Schritt 5: Aufs Handy installieren
- **Android (Chrome):** Adresse öffnen, Menü ⋮ → **App installieren** (oder „Zum Startbildschirm hinzufügen").
- **iPhone (Safari):** Adresse öffnen, **Teilen** → **Zum Home-Bildschirm**.
- Einmal mit Internet öffnen. Danach funktioniert die App auch offline.

## Gut zu wissen
- Die **Liste liegt nur auf dem jeweiligen Gerät**. Am Handy ist sie getrennt von der am PC. Mit **Mehr → Exportieren/Importieren** überträgst du sie.
- **Im Laden:** Liste, Haken setzen und die zuletzt geladenen Angebote gehen ohne Netz. „Neueste Angebote" braucht Internet.
- **Spracheingabe** geht am Handy über die https-Adresse (Mikrofon erlauben).
- Die Angebote sind weiter händlerweit, nicht filial-genau, ALDI SÜD kommt von der ALDI-Webseite (falls ALDI die GitHub-Server sperrt, steht unter Mehr → Datenstand ein Hinweis).
- Der Ordner ist öffentlich lesbar (Programmcode und deine Produktregeln, **nicht** deine Liste).
- Falls die Aktualisierung nach längerer Zeit stoppt: **Actions** → Zeitplan wieder aktivieren („Enable workflow").
- Eigene Beobachtungs-Produkte werden nur gefunden, wenn sie in den allgemeinen Suchbegriffen vorkommen. Für neue Suchbegriffe sag mir Bescheid, ich trage sie ein.
