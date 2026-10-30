# Voci: UI und Typografie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Schüler-, Lehrpersonen-, Schul- und Kontofunktionen mit einer einheitlichen neuen Oberfläche und lesbarer Typografie ausstatten.
**Architecture:** Vorhandene HTML-/JavaScript-Renderfunktionen werden auf eine gemeinsam festgelegte Navigation und Komponentensprache umgestellt. Fachmodule liefern spezialisierte Aufgabenansichten im gleichen App-Rahmen. Das Design wird zuerst an drei Ansichten entschieden und anschliessend auf sämtliche Zustände übertragen.
**Tech Stack:** Bestehendes HTML/CSS/JavaScript; lokale Schriftdateien; vorhandene Browserprüfungen. Kein Framework-Wechsel.
**Spec:** `../specs/2026-10-28-ui-und-typografie-brief.md`, ergänzend Fach-/Preisdesign und `2026-10-28-gesamtumbau.md`.

## Global Constraints

- «Topografie» ist vom Nutzer als **Typografie / Schriftgestaltung** geklärt.
- Gesamte UI umfasst Einstieg, Auswahl, Lernsets, sämtliche Übungen, Fortschritt, Konten, Klassen, Schule, Abos und Betreiberbereich.
- Funktionsregeln aus dem UI-Brief bleiben erhalten; keine Bedienfunktion wird beim visuellen Umbau entfernt.
- UI-Sprache Deutsch mit Schweizer Schreibweise; Beispiele und Fehlermeldungen bleiben verständlich für Schüler.
- Sichtbarer Fokus, semantische Formulare, Beschriftungen, reduzierte Bewegung und Hinweise neben Statusfarben.
- Produkt-/Fachrechte bestimmt der Server; ausgeblendete Navigation ersetzt keine Berechtigungsprüfung.

## Review Focus

1. Keine Klasse / reine Administration / Lehrperson: Navigation zeigt genau die erlaubten Bereiche (U2/U4).
2. Korrektur löst Neurendern aus: Auswahloptionen und eingegebene Antwort bleiben stehen (U3).
3. Enter bei geöffnetem Rechner oder Dialog: nur die aktive Aktion wird ausgelöst, keine doppelte Bewertung (U3/U4).
4. Lange Titel, 206 Kartenobjekte und 200 % Zoom: weder Hauptaktion noch Fehlermeldung wird verdeckt (U4/U5).
5. Ausfall einer Schriftdatei und französische Akzente: Fallback bleibt lesbar, keine leeren Zeichen oder kaputten Zeilen (U2/U5).

## Dateien und Zuständigkeiten

| Datei | Verantwortung |
|---|---|
| `index.html` | App-Rahmen, Navigation, semantische Dialoge, lokale Schrifteinbindung und Seitendaten |
| `styles.css` | Neue Tokens, Typografierollen, Layouts, Zustände und responsive Regeln; überholte Regeln entfernen |
| `app.js` | Schülernavigation, Inhaltswahl, Lernset-/Übungs-/Fortschrittsansichten |
| `school.js` | Klassen-, Rollen-, Einladungs-, Verwaltungs- und Aboansichten |
| `grammar.js`, `math.js`, `geography.js` | Fachansichten nach F3–F5/G2–G3; keine doppelte globale Navigation |
| `assets/fonts/` | Nur tatsächlich verwendete lokale Schriftdateien samt Lizenz |
| `DESIGN.md`, `.impeccable/design.json` | Tatsächlich umgesetzte Schrift-, Farb-, Layout- und Zustandsregeln am Ende |
| `tests/navigation-ui.test.js`, `tests/learning-ui.test.js`, `tests/school-ui.test.js` | Verhaltensprüfungen mit realem Browser |

## Task U1: Seitenstruktur und neue Gestaltungsrichtung festlegen

**Files:** UI-Brief; neue Entwicklungsentwürfe in `.impeccable/mocks/`; zugehörige Surface-Briefs.
**Interfaces:** Konsumiert den vollständigen Fachumfang; produziert eine gewählte Richtung und eine Bildschirm-/Zustandsliste für U2–U5. Noch kein Produktcode.

- [ ] Bestehende Ansichten erfassen und lesbare Seitenfolge festlegen: Einstieg → Fächer/Inhalte → Lernset → Üben → Ergebnis. Eigene Lernsets, Fortschritt, Klassen und Schulverwaltung erhalten feste Ziele in der Navigation.
- [ ] Zwei oder drei tragfähige visuelle Vorschläge anhand derselben echten Voci-Inhalte ausarbeiten. Eine Richtung muss Schülerlernen und dichte Lehrpersonenverwaltung tragen. Unterschiede an Struktur, Typografie und Informationshierarchie zeigen.
- [ ] Für die Entscheidung jeweils Lernübersicht, eine Aufgabenansicht und eine Klassen-/Verwaltungsansicht auf Desktop und Smartphone zeigen. Schriftkandidaten mit `I l 1`, `O 0`, `é è ê ç`, `ä ö ü`, `π`, `−`, `² ³` prüfen. Keine endgültige Schrift allein anhand einer Überschrift auswählen.
- [ ] Richtung mit dem Nutzer festlegen; bestätigte Entscheidungen und noch offene Details im Surface-Brief festhalten. Die genaue Farbrichtung ist vor diesem Schritt nicht verbindlich.
- [ ] Visuelle Abnahme dokumentieren: wichtigste Aktion erkennbar, Aufgabenfläche erhält Vorrang, lesbare Verwaltung, klare Rollen, nutzbare kleine Ansicht. Kein automatischer Test für reine Stilentscheidungen.

## Task U2: Typografie, App-Rahmen und Navigation umsetzen

**Files:** `index.html`, `styles.css`, `app.js:render`, `school.js:updateNav`, `assets/fonts/`, `tests/navigation-ui.test.js`.
**Interfaces:** Konsumiert U1 und `VociContent.subjects` aus F1. Produziert einheitliche Navigationsziele und `renderContentPicker(subjectId, blocks, context) -> string` in `app.js`; `context` ist `student` oder `teacher`.

- [ ] Vor Umbau Browserfälle ergänzen: Gast kann lernen; Schüler ohne Klassen sieht kein Klassen-Tab; Schüler mit Klasse sieht es; reiner Admin erhält Verwaltung und keine Unterrichtsaktion. Fokus wird nach Seitenwechsel auf die Seitenüberschrift bzw. erste sinnvolle Eingabe gesetzt.
- [ ] Neue Tokens und Typografierollen aus U1 umsetzen. Schrift lokal mit Fallback und Lizenz ausliefern; externe Font-Aufrufe entfernen. Native Formelemente übernehmen Typografie, Eingabefelder auf Mobilgeräten mindestens 16 Pixel.
- [ ] App-Kopf, Navigation, Seitenbreite und Aufgabenrahmen neu bauen. Desktop erhält mehr Arbeitsfläche für Übungen; Mobilnavigation bleibt mit Daumen erreichbar und überdeckt keine Aktion. Zurücknavigation erhält Auswahl und Lernsetentwurf.
- [ ] `renderContentPicker` entsprechend F1 umsetzen: Fachauswahl, passende Blöcke und Ordner, Auswahlzusammenfassung und stufenbezogene Vorauswahl. Keine Sprachabfrage für Mathematik/Geografie anzeigen.
- [ ] `node --test tests/navigation-ui.test.js` mit eingerichteter Browserumgebung ausführen. Zusätzlich Schriftblockierung, 320/390 Pixel und langen Schulnamen prüfen; kein horizontales Scrollen im normalen Seiteninhalt.
- [ ] Nur die zu U2 gehörenden Dateien und aktualisierten Entwürfe committen.

## Task U3: Bestehende Lernoberflächen vollständig übertragen

**Files:** `app.js:renderIntro`, `renderSets`, `renderSetup`, `renderDashboard`, `renderMatch`, `renderFlash`, `renderQuiz`, `renderTest`; `styles.css`; `tests/learning-ui.test.js`.
**Interfaces:** Konsumiert U2 und F1/F2; verwendet bestehende `data-action`-Verträge weiter, soweit die Aktion gleich bleibt. Produziert vollständig neu gestaltete Vokabelabläufe.

- [ ] Browserregressionen vor den UI-Änderungen festhalten: separate Kacheln für Multiple Choice und Schreiben; Antwortsprache pro Modus; Antwortoptionen nach Korrektur identisch; eingegebener Text bleibt sichtbar; Enter bewertet und geht beim nächsten Druck genau einmal weiter; Textfeld erhält Fokus.
- [ ] Lernsetliste, Erstellen/Bearbeiten, Termine, Teilen und Löschen neu gestalten. Alle bisherigen Lernziel-/Unit-/Lehrmittel- und Schulstufenfilter sowie Einheiten über mehrere Units erhalten.
- [ ] Zuordnen neu aufteilen: höchstens 12 Wortpaare, Desktop vier Reihen; grosse Flächen und +1 Sekunde pro Fehlzuordnung. Auf kleinen Höhen/200 % Zoom keine unsichtbaren Zeilen erzwingen; kontrolliertes Scrollen ist dann zulässig.
- [ ] Karteikarten und Moduskacheln mit «Alle wiederholen»/«Noch üben» gestalten. Wiederholungen überschreiben nicht die Unterscheidung zwischen bekannten und zu übenden Karten. Abfragen können alle/falsche Antworten wiederholen.
- [ ] Testanzahl als numerische Eingabe erhalten: mehr als verfügbar verwendet alle, 0/leer startet keinen Test; Endauswertung erst nach letzter Antwort. Fortschritt und laufende Frage klar darstellen.
- [ ] `node --test tests/learning-ui.test.js` ausführen; bei 1366 × 768 das maximale Zuordnungsraster auf 24 sichtbare Kacheln und vier Reihen prüfen. Auf Mobilgerät Tipp-/Korrektur-/Weiterfolge durchspielen.
- [ ] U3 als zusammenhängenden Änderungsschritt committen.

## Task U4: Neue Fächer, Konten, Klassen und Schule durchgängig gestalten

**Files:** Fach-UIs, `app.js`, `school.js`, Dialoge in `index.html`, `styles.css`, `tests/school-ui.test.js`, `tests/learning-ui.test.js`.
**Interfaces:** Konsumiert F3–F6, G2/G3 und S1–S3. Schul-Callback `hooks.curriculum(language, selected)` wird durch `hooks.contentPicker(subjectId, blocks)` ersetzt; die Darstellung stammt aus U2.

- [ ] Tests ergänzen: gemischtes Englisch-Set zeigt Vokabeln und Grammatik; Mathematik zeigt Rechner und Einheit; Kartenansicht zeigt die gewählte Liste und Fortschritt; fremdes Fach ist in der Lehrpersonenwahl gesperrt.
- [ ] Neue Module im selben Aufgabenrahmen gestalten. Kartenflächen, mathematische Skizzen, Zahlenfelder und Grammatiktexte erhalten jeweils angemessene Breite statt identischer Voci-Kachelgrössen.
- [ ] Registrierung/Anmeldung/Konto neu gestalten. E-Mail-Bestätigung und Fehler bleiben im Dialog sichtbar; Anmeldung nach Abmelden übernimmt keine alten Formularwerte. Schulstufe und individuelle Benachrichtigungsschalter bleiben zugänglich.
- [ ] Klassen, Einladungen, Codeerstellung, Klassenimport/-export und Prüfungsbearbeitung neu gestalten. Herkunft einer Klassenprüfung und Unabhängigkeit einer eigenen Kopie verständlich anzeigen.
- [ ] Antrag, Prüfung, Freigabe, Vorbereitung, Aktivierung, Freimonat, Zahlungsproblem und Kündigung als verständliche Zustände darstellen. Admin kann sofort einladen; Unterrichtsaktionen zeigen bei Bedarf den Freischaltzeitpunkt. Tarifanzeige zeigt 3/5/7/8/9 und 40/100 entsprechend S3.
- [ ] `node --test tests/school-ui.test.js tests/learning-ui.test.js` ausführen; danach Modal-Fokus, Fehlermeldung vor geblurrtem Hintergrund und Rechner-/Enter-Konflikt prüfen.
- [ ] Änderungen der betreffenden Ansichten committen.

## Task U5: Visuelle Gesamtabnahme und Design dokumentieren

**Files:** alle neu gestalteten Ansichten; `.impeccable/review/`; `DESIGN.md`; `.impeccable/design.json`.
**Interfaces:** Konsumiert abgeschlossene U2–U4; produziert dokumentierte Designregeln und visuelle Nachweise für P1.

- [ ] Repräsentative Normal-, Leer-, Fehler- und umfangreiche Zustände bei 390, 768, 1366 und 1920 Pixeln erfassen. 320 Pixel, 200 % Zoom, reduzierte Bewegung, fehlende Schrift und Bildschirmtastatur ergänzen.
- [ ] Kontrast, Fokusfolge, Beschriftungen, Zielgrössen, abgeschnittene Texte und überdeckte Aktionen prüfen. Länderfarben werden immer mit Legende und Ergebnistext vermittelt; Blinken erhält eine statische Alternative bei reduzierter Bewegung.
- [ ] Die Impeccable-Fertigprüfung mit den tatsächlich gerenderten Ansichten durchführen; reale Befunde beheben. Alte Hook-Funde nicht ohne Zuordnung als neue Regression behandeln. Bewusst zugelassene Ausnahmen begründen und dokumentieren.
- [ ] Neue Tokens und Komponenten aus dem fertigen UI in `DESIGN.md` und `.impeccable/design.json` festhalten. `PRODUCT.md` auf fünf Fächer und die tatsächlich lieferbaren Funktionen aktualisieren; veraltete Aussage «noch keine Vokabeldateien vorhanden» anhand der vorhandenen Inhalte berichtigen.
- [ ] Abnahmebericht mit offenen Punkten an P1 übergeben und zusammengehörige Dokumentation committen. Ein ausgelassener echter Mobilgerätetest wird als offen benannt.
