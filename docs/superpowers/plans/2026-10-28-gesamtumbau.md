# Voci: Gesamtumbau Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voci um fünf Fächer, neue Lernmodule und Preise erweitern und sämtliche Benutzeroberflächen einschliesslich Typografie neu gestalten.

**Architecture:** Die bestehende statische Web-App bleibt bestehen. Fachneutrale Lernsets verbinden die spezialisierten Übungsmodule mit bestehender Speicherung und Klassenfunktion. Supabase bleibt für Konten, Rechte und Schulprozesse zuständig; Stripe steuert bestätigte Zahlungen und Aboperioden.

**Tech Stack:** HTML, CSS, natives JavaScript; JSON-Kataloge; Supabase/Postgres und TypeScript Edge Functions; Stripe. Neue Bibliotheken nur für begründete Spezialaufgaben, mit festgelegter Version und Lizenz.

**Spec:** `../specs/2026-10-28-faecher-und-preise-design.md` und `../specs/2026-10-28-ui-und-typografie-brief.md`.

## Global Constraints

- Fach-IDs: `de`, `en`, `fr`, `math`, `geography`.
- Weltkataloge ausschliesslich `un195` und `ioc206`; Schweizer Kantone `ch26`. Kein dritter Staaten-/Gebietemodus.
- Bestehende Konten, Vokabel-IDs, Lernziele, eigene Lernsets, Teil-Links und Ergebnisse bleiben verwendbar.
- Schüler lernen weiterhin kostenlos; Abos schalten Lehrpersonenfunktionen frei.
- Lernfortschritt bleibt privat. Klassenankündigungen bleiben aktuell; eine Kopie unter eigenen Lernsets bleibt unabhängig.
- Die gesamte Oberfläche samt Typografie wird überarbeitet; das ist kein auf einzelne Kacheln beschränkter CSS-Schritt.
- Alle fünf Fächer und die Preise gehören zu einer zusammenhängenden Veröffentlichung. Intern entstehen überprüfbare Etappen.
- Keine echte Zahlung, kein Versand an echte Nutzer und keine Live-Migration beim Ausführen lokaler Prüfungen.

## Review Focus

1. Alte und neue Lernsets im selben Konto: beide überstehen Laden, Speichern, Teilen und die neue UI ohne Datenverlust (F1/F2, U3, S1).
2. Seltene Kartenobjekte, Inseln und abweichende IOC-Bezeichnungen: jeder der 195/206 Einträge ist erreichbar und genau einmal enthalten (G1/G2).
3. 49/50/51 Lehrpersonen mit offenen Einladungen: Kapazität und Preise bleiben auch bei gleichzeitigen Anfragen korrekt (S1/S3).
4. Mitternacht, Zeitumstellung und verspätete Zahlungsbestätigung: keine vorzeitigen Rechte und keine doppelte Belastung (S2/S3).
5. Smartphone mit Bildschirmtastatur, 200 % Zoom und langen Namen: Hauptaktion, Fokus und Aufgabentext bleiben erreichbar (U2–U5).

## Geprüfter Ausgangsstand

Die Planung beruht auf dem lokalen Quellstand vom 28. Oktober 2026. Die Arbeitskopie enthält bereits umfangreiche uncommittete Änderungen und neue Schuldateien; vor Umsetzung wird dieser Stand gesichert und fachlich zugeordnet.

| Vorhanden | Daraus folgt für die Umsetzung |
|---|---|
| `app.js`: Vokabelauswahl, Lernsets, fünf sichtbare Übungsarten, lokale Speicherung, Supabase-Sync, Teil-Links | Erweitern und die Sprache-Annahmen an benannten Stellen ersetzen; Verhalten der Vokabelmodi erhalten |
| `app-data.js`, `data/vocabulary.json` | Bestehende Kurs-/Unit-/Lernzielstruktur und IDs übernehmen |
| `school.js`, `school-data.js` | Rollen, Klassen, Prüfungsankündigungen, Ex-/Import und Aboansicht sind lokal vorhanden; auf fünf Fächer und neues Design ausbauen |
| `supabase/migrations/202610250001_schools.sql` | Bisherige Regeln enthalten nur `en/fr`, alte Fristen und Aktivierung; neue additive Migration verwenden |
| Edge Functions `voci-billing`, `voci-stripe-webhook`, `voci-mail-worker` | Alte Preise und Zahlungslogik ersetzen; Wiederholungs- und Signaturprüfungen erhalten |
| `DESIGN.md`, `styles.css`, `index.html` | Aktuelle Instrument-Sans-/Serif-Gestaltung neu entwerfen, nicht als neue Richtung festschreiben |
| Node- und Browser-/Datenbankprüfungen in `tests/` | Vorhandene Testwege weiterverwenden; Prüfungen mit fehlender Umgebung dürfen bei Abnahme nicht unbemerkt übersprungen werden |

Die frühere Live-Abfrage zeigte nur `learning_states` und `shared_sets`, noch keine Schultabellen. Dies ist eine frühere Bestandsaufnahme, keine erneute Bestätigung des heutigen Onlinezustands. Vor einem Ausrollen werden Schema, Migrationshistorie und echte Stripe-Abos neu gelesen.

## Teilpläne und Reihenfolge

| Etappe | Arbeit | Sichtbares Ergebnis / Abnahmepunkt | Teilplan |
|---|---|---|---|
| 0 | Arbeitsstand sichern, alte/neue Anforderungen abgleichen, Testumgebung bestimmen | Reproduzierbarer Ausgangsstand; keine unbeabsichtigten Altänderungen im Umbau | P0 unten |
| 1 | Navigation, Layout und Typografie entwerfen | Drei repräsentative Desktop-/Mobilentwürfe und festgelegte Gestaltungsrichtung | [UI U1](2026-10-28-ui-neugestaltung.md) |
| 2 | Fachkatalog, Lernsetformat und Speicherkompatibilität | Alte Voci-Sets und neue fachbezogene Sets funktionieren gemeinsam | [Fächer F1/F2](2026-10-28-faecher-lernmodule.md) |
| 3 | App-Rahmen, Inhaltsauswahl und bestehende Voci-Modi neu gestalten | Vollständige neue Schüleroberfläche für vorhandene Funktionen | [UI U2/U3](2026-10-28-ui-neugestaltung.md) |
| 4a | Grammatik in Deutsch/Englisch/Französisch | Eigener Grundkatalog für beide Schulstufen mit Erklärung und Übungen | [Fächer F3](2026-10-28-faecher-lernmodule.md) |
| 4b | Mathematik und wissenschaftlicher Rechner | Geometrie/Pythagoras, korrekte Einheiten und Rundung, Rechner in Aufgaben | [Fächer F4/F5](2026-10-28-faecher-lernmodule.md) |
| 4c | Geografie | 195 UN-/206 IOC-Einträge und 26 Kantone, Filter, Karte, Namen tippen, Bewertung | [Geografie G1–G3](2026-10-28-geografie.md) |
| 5 | Fortschritt, Klassen und fachbezogene Rechte verbinden | Alle Module speichern Ergebnisse; Lehrpersonen kündigen Inhalte der fünf Fächer an | [Fächer F6](2026-10-28-faecher-lernmodule.md), [Schule S1](2026-10-28-schulen-preise-aktivierung.md), [UI U4](2026-10-28-ui-neugestaltung.md) |
| 6 | Neue Preise und zeitgesteuerte Aktivierung | Abrechnung und Zugriffe entsprechen denselben Regeln | [Schule S2/S3](2026-10-28-schulen-preise-aktivierung.md) |
| 7 | Gesamtabnahme und Veröffentlichung vorbereiten | Geprüfte Vorschau, Migrations-/Preiswechselbericht und Betriebsanleitung | [UI U5](2026-10-28-ui-neugestaltung.md), [Schule S4](2026-10-28-schulen-preise-aktivierung.md), P1 unten |
| 8 | Abschliessende Tests und Sicherheitsprüfung, danach GitHub und Supabase aktualisieren | Geprüfter Stand auf GitHub; kompatible Datenbank und Serverfunktionen in Supabase; Abschlusskontrolle | P2 am Dokumentende |
| Später | PDF-Prüfungsgenerator | Druckprüfung mit Aufgabenzahl pro Typ und separater Lösung | Folgeprojekt unten |

4a–4c lassen sich nach F2 unabhängig bearbeiten. Daraus folgt keine automatische Beauftragung zusätzlicher Agenten. Schulrechte S1 und Aktivierungslogik S2 werden vor der endgültigen Abrechnung S3 geprüft. Es wird erst veröffentlicht, wenn alle Etappen bis 7 zusammen bestehen.

## Verbindliche Produktwerte

| Regel | Wert |
|---|---|
| Einzelabo: 1 / 2 / 3 / 4 / 5 Fächer | CHF 3 / 5 / 7 / 8 / 9 pro Monat |
| Schule mit höchstens 50 zählenden Lehrpersonen | CHF 40 pro Monat |
| Schule ab 51 zählenden Lehrpersonen | CHF 100 pro Monat |
| Lehrerzahl | Lehrpersonen plus reservierte Einladungsplätze; reine Admins und Schüler zählen nicht |
| Administratoren | Höchstens 5 pro Schule |
| Bestehende Abos | Sofort neue Preise, anteilige Verrechnung, neuer Monatsbeginn am Umstellungsdatum |
| Antrag | Prüfung innerhalb von 14 Tagen ab vollständigem Antrag; Voci-Verzug gewährt einen Gratismonat |
| Bestätigungstag | Administrator wird informiert und kann sofort Lehrpersonen einladen |
| Aktivierung | 00:00 Uhr am folgenden Kalendertag in `Europe/Zurich`; Unterrichtsrechte erst ab diesem Zeitpunkt und bestätigter Zahlung bzw. gewährtem Freimonat |
| Zahlungsfehler | Rechte bleiben gesperrt; bezahlter Zeitraum beginnt mit erfolgreicher Zahlung |
| Kündigung | Nutzung bis Ende der bezahlten Periode; keine anteilige Erstattung bei freiwilliger Kündigung |
| Beitrittscode | Maximale Verwendungen je Code; Ablauf nach 7 Tagen oder nach Erreichen des Limits; neue Codes möglich |
| Klassenlöschung / Teil-Links | Bestehende 7-Tage-Regeln erhalten |

## Gemeinsamer Lernsetvertrag

Die Details stehen in F1; diese Bezeichnungen gelten verbindlich für alle Teilpläne:

```text
LearningSetV2 = { version: 2, id, name, subjectId, blocks, examDate,
                 cards, quizWrong, results, progress }
subjectId = 'de' | 'en' | 'fr' | 'math' | 'geography'
blocks = ContentSelection[]
ContentSelection = { type: 'vocabulary', objectiveIds: string[] }
                 | { type: 'grammar', topicIds: string[] }
                 | { type: 'mathematics', topicIds: string[] }
                 | { type: 'geography', catalogId: 'un195'|'ioc206'|'ch26',
                     continentId: string|null, regionId: string|null }
progress.byItem[itemId] = { attempts, correct, lastScore, lastPracticedAt }
StudySnapshotV2 = { version: 2, name, subjectId, blocks, examDate }
```

Ein Lernset gehört zu einem Fach. In Englisch/Französisch kann es Vokabel- und Grammatikblöcke kombinieren. Kartenfilter sind Teil des gespeicherten Lernsets. Die UI zeigt nur Modi, die zu den gewählten Blöcken passen. Es wird kein universeller Aufgabengenerator für alle Inhalte gebaut.

## Task P0: Umsetzung vorbereiten

**Files:** bestehende Änderungen im Projekt; `docs/superpowers/plans/`; bestehende Tests.
**Interfaces:** Produziert gesicherten Ausgangsstand, Liste der vorhandenen Module und dokumentierte Prüfkommandos.

- [ ] Änderungen mit `git status --short` und `git diff --stat` erfassen; alte Nutzeränderungen und neue Dateien erhalten. Nur zusammengehörige, geprüfte Änderungen später pro Aufgabe committen.
- [ ] Ausführungsumgebung bestimmen: Node mit TypeScript-Unterstützung für die vorhandenen Billing-Tests, Browser und lokale Postgres-/PGlite-Umgebung. Bestehende Hilfsvariablen `VOCI_PGLITE_PATH`, `VOCI_PLAYWRIGHT_PATH`, `VOCI_PREVIEW_URL` dokumentieren.
- [ ] Bestehende Prüfungen einmal als Ausgangsstand ausführen; Fehlschläge vor Umbau festhalten. Kein Neuaufsetzen oder Zurücksetzen des Live-Supabase-Projekts.
- [ ] U1 starten. Bis zur Festlegung der visuellen Richtung sind UI-Struktur und Schriftwahl Vorschläge. Eine Framework-Migration ist nicht erforderlich.

## Task P1: Gemeinsame Abnahme und Übergabe

**Files:** alle geänderten Module; `tests/`; `SUPABASE.md`; `docs/SCHULFUNKTION_EINRICHTEN.md`; `SPEC.md`; `PRODUCT.md`; `DESIGN.md`; Datenschutzerklärungs-/AGB-Entwürfe.
**Interfaces:** Konsumiert die überprüften Ergebnisse aller Teilpläne; produziert eine veröffentlichbare Vorschau mit Betriebsanleitung.

- [ ] Die gemeinsamen Kernabläufe im Browser prüfen: Altset laden → neues Fachset anlegen → üben → neu laden → anmelden → auf zweitem Gerät öffnen → teilen → Klassenprüfung kopieren. Fortschritt und Klassendaten bleiben wie vorgesehen getrennt.
- [ ] Node-Prüfungen ausführen: `node tests/app-data.test.js`, `node --test tests/school-data.test.js tests/content-data.test.js tests/grammar-data.test.js tests/math-data.test.js tests/calculator-data.test.js tests/geography-data.test.js`, `node --experimental-strip-types --test tests/billing.test.mjs tests/billing-activation.test.mjs tests/reprice-subscriptions.test.mjs`, danach `node --test tests/schools-db.test.js tests/navigation-ui.test.js tests/learning-ui.test.js tests/geography-ui.test.js tests/school-ui.test.js` mit eingerichteter Umgebung. Fehlende Ausführungsvoraussetzungen gelten als offener Abnahmepunkt.
- [ ] Neue Schrift/Layout-Richtung in allen Ansichten visuell bei 390, 768, 1366 und 1920 Pixeln prüfen; 320 Pixel und 200 % Zoom als Überlauf-/Zugänglichkeitsprüfung ergänzen. Touch und Bildschirmtastatur zusätzlich auf einem echten Smartphone prüfen, sobald eines verfügbar ist.
- [ ] Einen lokalen Katalogcheck über tatsächliche Daten ausführen: IDs, Verweise, 195/206/26, Aufgabengültigkeit, Lösungen und Quellen. Grammatik mit einer sprachkundigen Person und Mathematik mit fachkundiger Person abnehmen; generierte Beispielaufgaben ersetzen keine fachliche Freigabe.
- [ ] Datenbank-, Stripe-Testmodus- und Benachrichtigungsabläufe in einer Vorschau vollständig durchspielen. Echte Empfänger und Karten werden dabei nicht verwendet.
- [ ] Einrichtung und Rechtstextentwürfe auf neue Fächer, Preise, Aktivierungsbeginn, Datenspeicherung, lokale Schriftdateien und Kartenquellen aktualisieren. Anbieterangaben, Steuern und rechtliche Freigabe bleiben vor öffentlicher kostenpflichtiger Nutzung durch den Betreiber zu klären.
- [ ] Einen konkreten Release-Bericht mit Dateistand, Migrationen, Testnachweisen, Abo-Preisvorschau, Datenquellen/Lizenzen und Rückfallweg erstellen. Nach erfolgreicher Abnahme folgen Sicherheitsprüfung, GitHub-Push und Supabase-Aktualisierung gemäss P2.

## Folgeprojekt: Prüfungen als PDF erstellen

Dieses bereits besprochene Vorhaben bleibt sichtbar, ist gemäss Fachentwurf aber kein Teil der ersten gemeinsamen Veröffentlichung. Die neue Inhaltsauswahl bereitet es vor.

- Lehrperson wählt Lernset, Aufgabenarten und Anzahl je Typ, z. B. 30 Vokabelübersetzungen, 4 Zeitformumwandlungen und 4 Aufgaben zur indirekten Rede.
- Nötig sind eine Vorschau, reproduzierbare Aufgabenauswahl, festgehaltene Version der Inhalte, druckfähiges Prüfungsblatt und getrennte Musterlösung mit Punkten.
- Zufallsauswahl darf keine Aufgabe doppelt verwenden und keine Lösung versehentlich auf dem Schülerblatt ausgeben. Bei zu wenig geeigneten Aufgaben wird die verfügbare Anzahl angezeigt.
- Erst nach festgelegtem Drucklayout und Aufgabenformaten wird dafür ein eigener Ausführungsplan erstellt; keine neue PDF-Abhängigkeit im aktuellen Umbau.

## Planungsentscheidungen und offene Lieferungen

- **Fest:** Umfang, Preisstaffel, zwei Weltkataloge, Mathe-Rundung und vollständige Typografie-/UI-Überarbeitung.
- **Im ersten UI-Schritt festzulegen:** neue visuelle Richtung und endgültige Schrift anhand repräsentativer Ansichten. Atkinson Hyperlegible ist ein begründeter Vergleichskandidat, keine bereits getroffene Nutzerauswahl.
- **Für eine verlässliche Mitternachtsaktivierung vorzubereiten:** wiederkehrende Kartenzahlung vor der Freigabe über Stripe einrichten, ohne vorher Geld einzuziehen. S2 behandelt fehlende oder nachträglich zu bestätigende Zahlungsmittel ausdrücklich.
- **Vor Live-Betrieb nötig:** tatsächliche Supabase-/Stripe-Bestandsaufnahme, benötigte Geheimnisse, freigegebene Lerninhalte und Kartenquellen sowie Anbieter-/Steuerangaben. GitHub-Push und Supabase-Anpassungen sind als Abschluss der Umsetzung beauftragt; die nötigen Zugänge und das genaue Ziel werden vor Ausführung geprüft.

## Task P2: Abschliessende Tests, Sicherheitsprüfung und Aktualisierung von GitHub/Supabase

**Ziel:** Sobald der gesamte für diese Veröffentlichung geplante Umbau fertiggestellt und geprüft ist, wird der geprüfte Stand auf GitHub gepusht und das zugehörige Supabase-Projekt angepasst. Dieser Abschluss gehört zum Umsetzungsauftrag. Der spätere PDF-Prüfungsgenerator ist keine Voraussetzung dafür.

**Files:** gesamter geänderter Projektstand, Tests, Abhängigkeiten/Lockfiles, Supabase-Migrationen und Edge Functions, Konfiguration sowie Release-Bericht.
**Interfaces:** Konsumiert P1 und die Ergebnisse aller Teilpläne. Produziert einen nachvollziehbaren GitHub-Stand sowie dazu kompatible Supabase-Datenbank, Serverfunktionen und Hintergrundaufträge.

- [ ] **Gesamttests abschliessen:** Die in P1 vorgesehenen Funktions-, Browser-, Datenbank-, Zahlungs- und Mobilprüfungen erfolgreich abnehmen. Insbesondere alte und neue Lernsets, Kontowechsel, Klassen, alle Fächer, Ergebnisse und Aktivierungszeitpunkte prüfen. Fehlgeschlagene oder wegen fehlender Umgebung übersprungene Pflichtprüfungen verhindern den Abschluss; nach Korrekturen die betroffenen Prüfungen erneut ausführen.
- [ ] **Das gesamte Projekt auf Sicherheitslücken prüfen:** Anmeldung und Sitzungen, Rollen und Fachrechte, schulübergreifende Zugriffe, Supabase-Zugriffsregeln/RPCs, Teil-Links und Beitrittscodes, Importdaten, Formular-/HTML-Eingaben, Rechnerauswertung und Zahlungs-Webhooks untersuchen. Unberechtigte Zugriffe ausdrücklich mit verschiedenen Schüler-, Lehrer- und Admin-Konten testen. Falls neue Pakete verwendet werden, auch deren bekannte Schwachstellen prüfen.
- [ ] **Geheimnisse und private Daten kontrollieren:** Vor dem Commit sicherstellen, dass keine privaten Schlüssel, Tokens, lokalen Sicherungen, Kartendaten oder Schülerdaten ins Repository oder in den Browser gelangen. Supabase-Sicherheitsberater ausführen und relevante Befunde bearbeiten. Service-Schlüssel bleiben ausschliesslich auf dem Server.
- [ ] **Befunde beheben und dokumentieren:** Veröffentlichungsrelevante Fehler und Sicherheitslücken schliessen, Änderungen gezielt nachprüfen und die Ergebnisse im Release-Bericht festhalten. Bei offenen kritischen oder hohen Sicherheitsrisiken erfolgt kein produktiver Rollout. Eine Sicherheitsprüfung ist keine Garantie, dass jede mögliche Lücke entdeckt wurde.
- [ ] **Ausrollung vorbereiten:** GitHub-Remote, Zielbranch und das tatsächlich zugehörige Supabase-Projekt prüfen; erwartetes Repository ist `990-Dario/Voci`. Vor Datenbankänderungen eine Sicherung und einen Rückfallweg bereitstellen. Prüfen, ob ein Push auf den vorgesehenen Branch automatisch die Website veröffentlicht.
- [ ] **Geprüften Stand auf GitHub pushen:** Nur die zum Umbau gehörenden Änderungen committen und pushen; keine fremden Änderungen verwerfen und keinen Force-Push verwenden. Falls der Produktionsbranch sofort eine Website-Veröffentlichung auslöst, zunächst einen Arbeitsbranch pushen und die kompatiblen Supabase-Erweiterungen vor der produktiven Website bereitstellen.
- [ ] **Supabase anpassen:** Die geprüften additiven Migrationen anwenden, erforderliche Edge Functions bereitstellen und nötige Serverkonfiguration sowie Hintergrundaufträge einrichten. Bestehende Konten, Lernsets und Lernstände erhalten; keine produktive Datenbank zurücksetzen. Der veröffentlichte Code und die serverseitigen Schnittstellen müssen zueinander passen.
- [ ] **Online-Abschlusskontrolle durchführen:** Nach der Aktualisierung Anmeldung, Lesen/Speichern eines eigenen Lernsets, einen Lernablauf, Klassen-/Fachrechte und die benötigten Serverfunktionen mit dafür vorgesehenen Testkonten prüfen. Keine unbeauftragte echte Belastung oder Testmail an Schüler auslösen. Bei einem neuen Fehler den Rollout stoppen und den vorbereiteten Rückfallweg nutzen.
- [ ] **Abschluss melden:** GitHub-Commit/Branch, angewandte Migrationen, bereitgestellte Funktionen und erfolgreiche Prüfungen nennen. Falls ein notwendiger Zugang fehlt, den konkreten offenen Schritt festhalten; GitHub oder Supabase nicht als aktualisiert melden, solange dies nicht bestätigt ist.
