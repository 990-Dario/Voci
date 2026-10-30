# Voci: Fachstruktur und Lernmodule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fachneutrale Lernsets, Grammatik in drei Sprachen, Mathematik mit Rechner und dauerhaften privaten Fortschritt bereitstellen.
**Architecture:** Kleine Datenmodule im vorhandenen Browser-/CommonJS-Muster halten Validierung und Bewertung getrennt von der Darstellung. Bestehende Vokabeldaten bleiben erhalten. Die spezialisierten Fach-UIs verwenden denselben Lernset- und Ergebnisvertrag, ohne eine allgemeine Aufgabenplattform einzuführen.
**Tech Stack:** Natives JavaScript, JSON, bestehendes localStorage/Supabase-Sync, Node-Assert-/Browserprüfungen.
**Spec:** Fach-/Preisdesign, UI-Brief und `2026-10-28-gesamtumbau.md`.

## Global Constraints

- Fach-IDs exakt `de`, `en`, `fr`, `math`, `geography`; ein Set gehört zu einem Fach.
- `LearningSetV2` und `ContentSelection` aus dem Gesamtplan verwenden; Vokabel- und Grammatikblöcke dürfen in `en/fr` zusammen vorkommen.
- Keine Änderung vorhandener Vokabel-IDs oder Unit-Nummern. Open World 1: 1–7; Open World 2: 8–14; Open World 3: 15–21.
- Alte Lernsets werden beim Lesen kompatibel normalisiert; vorhandene Cloud-Daten werden nicht durch eine Massenmigration umgeschrieben.
- Strecken auf 1 mm, Flächen auf 3 und Volumen auf 4 Nachkommastellen; Dezimalkomma/-punkt, optionale Endnullen.
- Eingabetext bleibt nach Korrektur stehen; Klassenfortschritt ist privat; alle neuen Modi unterstützen Wiederholen.

## Review Focus

1. Gemischte alte/neue oder teilweise ungültige Speicherdaten: ein ungültiger Eintrag löscht keine gültigen Sets (F1/F2).
2. Grammatik mit mehreren richtigen Lösungen oder Akzenten: nur ausdrücklich hinterlegte Varianten gelten, relevante Zeichen werden nicht entfernt (F3).
3. Einheit m/cm/mm, Rundungsgrenze und zusätzliche Endnullen: Vergleich verwendet die verlangte Einheit und Rundung (F4).
4. Rechner mit ungültigem Ausdruck, extremer Potenz oder falscher Eingabe: Fehler statt Ausführung fremden Codes oder Infinity-Antwort (F5).
5. Lehreränderung während einer Runde oder abgemeldetes Konto: kein fremder Lernstand und keine stille Änderung laufender Fragen (F6).

## Dateien und Schnittstellen

| Datei | Verantwortung |
|---|---|
| Neu `content-data.js` / `VociContent` | Fachkatalog, Setformat, Auswahlvalidierung, Legacy-Normalisierung, kompatible Modi |
| Bestehend `app-data.js` | Vorhandene Kurs- und Antwortsprachen-Helfer weiterverwenden |
| Bestehend `app.js` | Speicherung, Routing, vorhandene Vokabelmodi und Integration neuer Module |
| Neu `data/grammar/{de,en,fr}.json`, `grammar-data.js`, `grammar.js` | Kuratierte Grammatikaufgaben, Bewertung, Erklärung und Übungsansicht |
| Neu `data/mathematics/topics.json`, `math-data.js`, `math.js` | Themen, gültige Geometrieaufgaben, Einheiten, Bewertung und Ansicht |
| Neu `calculator-data.js` | Wissenschaftliche Ausdrucksauswertung für `math.js` |
| Neu `tests/content-data.test.js`, `grammar-data.test.js`, `math-data.test.js`, `calculator-data.test.js` | Fachlogik mit beobachtbaren Ergebnissen prüfen |
| Bestehend `index.html`, `school.js`, `school-data.js` | Dateieinbindung und gemeinsame Lernsetverwendung |

Neue Module folgen `app-data.js`: Browser-Global plus `module.exports`, damit keine Build-Umstellung nötig ist. An einer zentralen Stelle werden Bibliotheks-/Modulnamen und Ladefolge festgelegt.

## Task F1: Fachkatalog und kompatibles Setformat

**Files:** `content-data.js`, `app.js:blankSet/normalizeSet/normalizeStore/wordsFor/setLabel`, `index.html`, `tests/content-data.test.js`.
**Interfaces:** Produziert `VociContent.subjects`, `normalizeLearningSet(value) -> LearningSetV2`, `validateSelection(subjectId, blocks) -> void` und `modesFor(set) -> string[]`. Ungültige Auswahl wirft einen verständlichen Fehler. Modus-IDs der vorhandenen Voci-Funktionen aus `startMode` übernehmen; neue IDs `grammar`, `mathematics`, `geography-find`, `geography-name`.

- [ ] Tests zuerst ergänzen: Fach-IDs stimmen; Legacy-Set `{language:'en',objectives:['x']}` wird zu `subjectId:'en'` mit Vokabelblock; ID, Karten, Falschliste und Ergebnisse bleiben erhalten; Normalisierung ist idempotent. Unbekanntes Fach wird abgewiesen und nicht zu Englisch umgedeutet.
- [ ] `LearningSetV2` nach Gesamtplan umsetzen. `blocks` hat höchstens einen Block je Typ; erlaubte Typen: `de` Grammatik, `en/fr` Vokabeln/Grammatik, `math` Mathematik, `geography` Geografie. Leere Auswahl darf als Entwurf existieren, aber keinen Modus starten.
- [ ] Fachkatalog und erlaubte Modi aus derselben lokalen Liste ableiten. Bestehende `language`-/`objectives`-Annahmen an den genannten App-Stellen ersetzen; alte Vokabel-Routinen beziehen ihre Auswahl aus dem Vokabelblock.
- [ ] `normalizeStore` so anpassen, dass ungültige Einträge gesondert erhalten und gemeldet werden; automatische Speicherung blockieren, wenn sonst unbekannte Daten überschrieben würden. Vor einer tatsächlich nötigen lokalen Formatumstellung eine Sicherung des bisherigen Speichertexts anlegen, ohne personenbezogene Daten ins Repository zu schreiben.
- [ ] `node --test tests/content-data.test.js` und `node tests/app-data.test.js` ausführen: Legacy-/V2-Rundlauf, wiederholte Normalisierung, gemischter Speicher und unbekannte Version abgedeckt.
- [ ] Nur F1-Dateien committen.

## Task F2: Speicherung und Teilen für alle Fächer erweitern

**Files:** `app.js:loadStore/saveCloudStore/loadCloudStore/sharedCopy/checkShareImport`, `tests/content-data.test.js`, `tests/learning-ui.test.js`; Servervalidierung gemeinsam mit S1.
**Interfaces:** Konsumiert F1. Produziert `createStudySnapshot(set) -> StudySnapshotV2` in `content-data.js` und `cloneLearningSet(set, newId) -> LearningSetV2` mit leerem privatem Fortschritt. `StudySnapshotV2` enthält genau `version`, `name`, `subjectId`, `blocks`, `examDate` gemäss Gesamtplan.

- [ ] Prüfungen ergänzen: alle fünf Fächer überstehen JSON-Rundlauf; Voci-Kopie behält Inhalt, aber keine `cards`, `quizWrong`, `results` oder `progress`; Import erhält eigene ID; unbekannte Inhaltstypen starten keine Übung.
- [ ] Lokalen und Cloud-Rundlauf auf V2 umstellen. Vorher geladener Konto-/Sitzungsstand darf nach Abmeldung oder Kontowechsel nicht zurückgeschrieben werden; vorhandene Revisions-/Sitzungswachen erhalten.
- [ ] Snapshots und Kopien für Teilen und Klassen verwenden. Teil-Links behalten sieben Tage Gültigkeit; die Nutzerdaten bleiben in `learning_states`, Inhalte in den statischen Katalogen.
- [ ] Browserfall für ein Altset plus ein Mathematikset: anlegen, neu laden, anmelden, erneut laden und abmelden; beide bleiben im korrekten Speicher-/Kontokontext vorhanden. Einen Geteilt-Import ohne privaten Fortschritt prüfen.
- [ ] `node --test tests/content-data.test.js tests/learning-ui.test.js` mit Browserumgebung ausführen; S1 muss die passenden Snapshots serverseitig akzeptieren, bevor Teilen öffentlich freigeschaltet wird.
- [ ] F2-Dateien committen.

## Task F3: Grammatik-Grundkatalog und Üben

**Files:** `data/grammar/de.json`, `en.json`, `fr.json`; `grammar-data.js`, `grammar.js`; `app.js`, `tests/grammar-data.test.js`.
**Interfaces:** Produziert `VociGrammarData.validateCatalog(data)`, `questionsFor(topicIds, catalog) -> Question[]`, `evaluateAnswer(question, raw) -> {correct, expectedAnswers, explanation}`. `Question = {id, topicId, type:'choice'|'written', prompt, acceptedAnswers, caseSensitive:boolean, options?, explanation}`. `VociGrammar.render(session) -> string` und `VociGrammar.start(set, catalogs) -> session` werden durch `app.js` aufgerufen.

- [ ] Den im Fachdesign aufgeführten Katalog für **alle sechs Kombinationen aus Sprache und Schulstufe** als Themeninventar anlegen. Primarstufe und Sekundarstufe sind Filter, keine unterschiedlichen Benutzerkonten.
- [ ] Pro Thema eine kurze eigene Erklärung, zwei gelöste Beispiele und zunächst mindestens acht eigenständige Übungsfragen erstellen. Enthalten sind insbesondere Zeitformen sowie direkte/indirekte Rede. Ein gemeinsamer Item darf mehreren Stufen zugeordnet sein, behält aber dieselbe ID.
- [ ] Tests zuerst für Varianten, Gross-/Kleinschreibung je Aufgabe, französische Akzente, Apostrophe und eindeutig richtige Multiple-Choice-Antworten ergänzen. Akzententfernung ist keine allgemeine Normalisierung; eine Variante muss fachlich zulässig und ausdrücklich hinterlegt sein.
- [ ] Katalogvalidierung und Bewertung umsetzen; bei Auswahlfragen die Reihenfolge nur beim Erstellen der Frage mischen. Bei schriftlichen Aufgaben eingegebenen Text, Lösung und knappe Erklärung nach Bewertung sichtbar halten.
- [ ] Themenauswahl, Erklärung, Übung, Ergebnis und alle/falsche Wiederholung integrieren. Grammatikfragen können aus einem gemischten Sprachlernset gestartet werden; bestehende Voci-Modi erhalten nur dessen Vokabelblock.
- [ ] `node --test tests/grammar-data.test.js` ausführen; Katalogreferenzen, korrekte Varianten und die genannten Fachthemen prüfen. Tatsächliche Texte vor Veröffentlichung fachlich lesen lassen; kein als «offiziell» bezeichneter Lehrmittel-Grammatikkatalog.
- [ ] F3 inklusive Inhaltsquellen-/Autorhinweisen committen.

## Task F4: Mathematikaufgaben, Einheiten und Bewertung

**Files:** `math-data.js`, `math.js`, `data/mathematics/topics.json`, `tests/math-data.test.js`.
**Interfaces:** Produziert `generateQuestion(topicId, seed) -> MathQuestion`, `evaluateNumber(raw, expected, {dimension, unit}) -> {valid, correct, expectedText}`. `MathQuestion = {id, topicId, prompt, diagram, expected, dimension:'length'|'area'|'volume', unit, solutionSteps}`. Die Aufgabe speichert Startwerte und Seed für nachvollziehbare Lösungen.

- [ ] Themen inventarisieren: Umfang/Fläche von Rechteck, Quadrat, Rhombus, Rhomboid, Kreis; gleichseitiges, gleichschenkliges, rechtwinkliges und allgemeines Dreieck; Volumen von Quader, Würfel, Pyramide, Kugel, Prisma; Pythagoras mit gesuchter Hypotenuse oder Kathete.
- [ ] Mathematische Referenzfälle zuerst prüfen: Rechteck 3 cm × 4 cm ergibt 12 cm² und 14 cm; Kugel Radius 1 cm ergibt gerundet 4,1888 cm³; Pythagoras 3/4 ergibt 5. Rhombus/Rhomboid unterscheiden Höhe und Seitenlänge; Pyramide verwendet senkrechte Höhe, nicht Seitenkante.
- [ ] Gültige parametrisierte Aufgaben und beschriftete SVG-Skizzen umsetzen. Dreiecksungleichung, positive Dimensionen und berechenbare Lösung sicherstellen. Bei Prismen/Pyramiden werden die Grundfläche oder alle dafür nötigen Masse angegeben. Dieselbe Kombination aus Thema und Seed erzeugt dieselbe Aufgabe.
- [ ] Zahlenparser und Rundung umsetzen: `1,2300` und `1.23` sind gleich; mm ganzzahlig, cm auf 0,1 cm, m auf 0,001 m; Fläche/Volumen auf 3/4 Stellen in der angezeigten Zieleinheit. Zusätzliche Endnullen akzeptieren; zusätzliche bedeutende Stellen werden nicht durch eine grobe Toleranz als richtig gewertet. Leerer Text, NaN, Infinity oder widersprüchliche Trennzeichen sind ungültig.
- [ ] Aufgabenansicht mit sichtbarer Zieleinheit, Zahleneingabe, Korrektur und Lösungsweg umsetzen. Die Einheit steht beim Feld und muss nicht als Text mitgetippt werden. Rechner aus F5 in jede Matheaufgabe einbinden.
- [ ] `node --test tests/math-data.test.js` ausführen; alle Themen mehrfach mit verschiedenen Seeds, Rundungsgrenzen, Einheiten und Endnullen abdecken. Browserprüfung: Korrektur lässt Eingabe stehen, Enter funktioniert.
- [ ] F4 committen.

## Task F5: Wissenschaftlichen Taschenrechner integrieren

**Files:** `calculator-data.js`, `math.js`, `styles.css`, `tests/calculator-data.test.js`, `tests/learning-ui.test.js`.
**Interfaces:** `VociCalculatorData.evaluate(expression, angleMode:'deg'|'rad') -> number`; bei Fehlern wird ein lesbarer Fehler geworfen. Das Rechnerpanel führt Ausdruck, Ergebnis und Winkelmodus lokal in der laufenden Mathesitzung und übergibt nur ein numerisches Ergebnis ins Antwortfeld.

- [ ] Tests zuerst mit `2+3*4 = 14`, `2^3^2 = 512`, `-2^2 = -4`, `sin(30)` im Gradmodus ≈ 0,5, `sin(pi/2)` im Bogenmass ≈ 1, `sqrt(9) = 3`, `0! = 1`, `log(100) = 2` ergänzen. `x%` bedeutet `x/100`; das wird im Rechner erklärt.
- [ ] Begrenzten wissenschaftlichen Ausdrucksparser mit expliziter Funktionsliste implementieren: Grundoperationen, Klammern, Vorzeichen, Dezimalzahl, π/e, Potenzen, Wurzeln, Kehrwert, Fakultät, sin/cos/tan mit Umkehrfunktionen, log10/ln/exp. Keine Verwendung von `eval`, `Function` oder frei zugänglichen Objekten.
- [ ] Längen-/Tiefenlimits festlegen: höchstens 300 Zeichen und 20 Klammer-/Funktionsverschachtelungen, Fakultät nur ganzzahlig 0–170. Nichtendliche Ergebnisse, Division durch null, ungültige Wurzeln und nicht definierte Funktionen ergeben Fehler; der ursprüngliche Ausdruck bleibt sichtbar.
- [ ] Rechner mit Tastatur und Touch bedienen; Grad ist voreingestellt, Bogenmass umschaltbar. Ergebnis durch explizite Aktion ins Antwortfeld übernehmen, Fokus dorthin zurückgeben. Enter im Rechner rechnet, ohne die Matheaufgabe gleichzeitig abzusenden.
- [ ] `node --test tests/calculator-data.test.js tests/learning-ui.test.js` ausführen. Fremde Zeichen, Codeversuch, riesige Exponenten und negative Fakultät werden abgewiesen; erlaubte wissenschaftliche Rechnungen funktionieren.
- [ ] F5 committen.

## Task F6: Ergebnisse und fachübergreifenden Fortschritt verbinden

**Files:** `app.js:logResult/replaceSet/activeSet/renderDashboard`, `content-data.js`, Fachmodule, `school.js`-Studiencallback, `tests/content-data.test.js`, `tests/learning-ui.test.js`, `tests/school-ui.test.js`.
**Interfaces:** `recordStudyResult(set, result, itemResults) -> LearningSetV2` in `content-data.js`. `result = {type, score, total, date, detail, subjectId, unit:'answers'|'points'}`; geografische Ergebnisse nutzen ganzzahlige Punkte, also `score=sum(points)` und `total=100*Anzahl`. `itemResults = [{itemId, correct, score}]`; `score` ist 0–100. Alte Ergebnisse ohne `unit` bleiben Antworten.

- [ ] Tests zuerst: ein Voci-Ergebnis 3/4 bleibt 75 %; Geografie 250/500 ergibt 50 %; wiederholte Kartenrunden verändern nur die betroffenen Items; alte Ergebnisse bleiben lesbar. Ergebnisse behalten die bisherige Begrenzung auf die letzten 30 Runden pro Set; `progress.byItem` hält den kumulierten Lernstand.
- [ ] Bewertung aller neuen Module über diese gemeinsame Funktion speichern. Fach, Thema, Datum und Ergebniseinheit zeigen; Prozentwerte von Karteipunkten und klassischen Antworten korrekt berechnen.
- [ ] Fortschrittsansicht je Fach/Lernset umsetzen: letzte Übungen, Entwicklung und zuletzt schwierige Inhalte. Keine erfundenen Prognosen oder Schulranglisten; Zeit-/Punkt-/Antwortwerte nicht unbeschriftet vermischen.
- [ ] Klassenfortschritt weiterhin getrennt nach Prüfungs-ID privat speichern. Inhalt und Revision zu Beginn einer Runde festhalten; Lehreränderungen erst für eine neue Runde übernehmen und sichtbar melden. Kopie eines Lernsets trennt Klassenupdates und beginnt mit eigenem Fortschritt.
- [ ] Node- und Browserprüfungen für Speichern, Neuladen, Kontowechsel, unabhängige Kopie und Lehreränderung während einer laufenden Runde ausführen. Eine gelöschte Prüfung darf keine neue Runde starten.
- [ ] F6 committen und geprüfte Schnittstellen an U4/S1 übergeben.
