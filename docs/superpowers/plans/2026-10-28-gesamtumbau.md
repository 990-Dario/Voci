# Voci: Vollständiger Umsetzungs- und Veröffentlichungsplan

**Planungsstand: 1. November 2026.** Dieses Dokument legt den verbindlichen Umfang, den nachgewiesenen Arbeitsstand und die verbleibenden Schritte fest. Die Planung ist vollständig beschrieben; die Umsetzung und Veröffentlichung sind noch nicht abgeschlossen. Nicht abgehakte Punkte bleiben offen, auch wenn bereits ein Teil davon programmiert wurde.

**Festgelegte Gestaltung:** «Lernpfad – Tannengrün und Gelb». Die Arbeitsversion verwendet die lokal ausgelieferte Schrift Atkinson Hyperlegible Next. Die Gestaltungsrichtung wurde vom Nutzer gewählt; die vollständige visuelle Abnahme steht noch aus.

**Lesereihenfolge:** Produktwerte und Lernsetvertrag beschreiben das Ziel. Die Tabelle «Umsetzungsstand» unterscheidet vorhandenen Code von vollständiger Abnahme. «Verbleibende Arbeitspakete» legt die nächsten Schritte fest. P2 am Ende regelt Tests, Sicherheit, GitHub und Supabase.

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

Die ursprüngliche Planung beruht auf dem lokalen Quellstand vom 28. Oktober 2026. Die damals vorhandenen Änderungen wurden in einer getrennten Arbeitskopie erhalten. Der historische Ausgangsstand in der folgenden Tabelle ist vom heutigen Umsetzungsstand zu unterscheiden.

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

## Umsetzungsstand und vorhandene Nachweise

Arbeitsbranch: `codex/faecher-ui-preise`. Die Änderungen sind lokal in `bfd6bcd` (Fächer, Karten, Oberfläche und Klasseninhalte V2) sowie `706a19a` (Schulaktivierung und Preise) gesichert. Diese Commits belegen keine Online-Veröffentlichung. GitHub und das produktive Supabase-Projekt wurden für diesen Umbau noch nicht aktualisiert.

| Bereich | Vorhanden | Noch bis zur Abnahme erforderlich |
|---|---|---|
| Oberfläche und Typografie U1–U4 | Neuer App-Rahmen, Fächerauswahl, Lernsets, Übungsansichten und Schulansichten in Tannengrün/Gelb; lokale Schrift | Vollständige Ansichts- und Zustandsprüfung, Tastatur/Zoom, Design-Dokumentation U5 |
| Lernsets F1/F2 | V2-Format, Legacy-Lesbarkeit, private Ergebnisse, Inhaltskopien ohne Fortschritt, serverseitige Snapshot-Prüfung | Vollständiger Cloud-Rundlauf, Kontowechsel und zweites Gerät; Datenverlust- und Sitzungsprüfung |
| Grammatik F3 | 35 Themen und 280 Fragen für Deutsch, Englisch und Französisch; Stufenfilter und Bewertungslogik | Inhaltliche Freigabe durch eine sprachkundige Person; tatsächliche Aufgabenvielfalt und Auswahlfragen gegen den Teilplan abgleichen |
| Mathematik F4/F5 | 25 Themen, erzeugte Aufgaben, SVG-Skizzen, Rundung und wissenschaftlicher Rechner | Fachliche Prüfung aller Formeln, Angaben, Skizzen und Lösungswege |
| Geografie G1–G3 | Kataloge mit 195/206/26 Einträgen, Regionenfilter, regionale Vergrösserung, Punkte für kleine Staaten, Finden/Schreiben und Farbwertung | Erreichbarkeit aller Einträge und Aliasnamen vollständig prüfen; Quellen/Lizenzen und mobile Bedienung abnehmen |
| Fortschritt F6 | Neue Module speichern Ergebnisse und Aufgabenfortschritt; Klassenkopien bleiben unabhängig | Bestands-Voci-Fortschritt und Änderungen während laufender Klassenübungen vollständig prüfen und fehlende Hinweise ergänzen |
| Klassen und Fachrechte S1 | Prüfungen für fünf Fächer, V1/V2-Import, Export und serverseitige Fachprüfung | Browserprüfung der Prüfungserstellung für alle Fächer und schulübergreifende Zugriffsfälle vervollständigen |
| Schulaktivierung S2/S3 | Folgetag in Zürich, Adminverwaltung ab Bestätigung, Freimonat, Kartenhinterlegung, Worker und Zahlungsereignisse vorbereitet | Vollständige Wiederholungs-/Fehlertests, Stripe-Testmodus, zeitgesteuerter Betrieb und Benachrichtigungen |
| Preise S3/S4 | Neue Staffel im Browser und Server | Werkzeug und Bericht für Bestandsabos, anteilige Umstellung, Kündigungs- und Rechnungsfälle |
| Veröffentlichung P1/P2 | Lokale Migrationen und Funktionen vorhanden | Gesamtprüfung, Betriebsanleitung, Sicherung, GitHub-Push, Supabase-Bereitstellung und Online-Abnahme |

**Bisherige Prüfungsergebnisse:** 29 lokale Daten-/Logik-/Datenbankprüfungen und 3 Browserprüfungen bestanden beim zuletzt dokumentierten Lauf; keine dieser Prüfungen wurde übersprungen. Die Browserprüfungen decken ausgewählte Lern-, Karten- und Klassenabläufe ab und ersetzen nicht die vollständige Abnahmematrix. `npm audit --omit=dev --audit-level=high` meldete keine bekannten Schwachstellen in Laufzeitabhängigkeiten; Entwicklungsabhängigkeiten und die Anwendungssicherheit sind damit nicht vollständig geprüft.

**Bekannte externe Voraussetzung:** Der Nutzer hat bestätigt, dass noch kein Stripe-Testkonto eingerichtet ist. Die vorhandenen Zahlungstests verwenden simulierte Antworten. Dieser fehlende Zugang blockiert echte Stripe-Tests und die kostenpflichtige Produktionsfreigabe, aber keine weitere lokale Entwicklung, Dokumentation oder Sicherheitsprüfung.

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
| Mindestdauer | Ein bezahlter Monat; ein gewährter Gratismonat zählt zusätzlich und ersetzt ihn nicht |
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

- [x] Änderungen erfasst und vorhandene Nutzeränderungen in der Arbeitskopie erhalten; zwei lokale Zwischenstände committed.
- [x] Ausführungsumgebung bestimmt: Node 24.16, Chrome/Playwright und PGlite 0.5.10. `VOCI_PGLITE_PATH` und `VOCI_PLAYWRIGHT_PATH` werden für die lokalen Prüfungen gesetzt. Browserprüfungen verwenden inzwischen einen temporären lokalen Server je Prüfung; ein dauerhaft laufender Vorschau-Server ist dafür nicht nötig.
- [x] Ausgangsprüfungen ausgeführt und später durch Datenbank-/Browserprüfungen ergänzt; produktive Datenbank nicht zurückgesetzt.
- [x] U1 gestartet und Richtung «Lernpfad – Tannengrün und Gelb» mit dem Nutzer festgelegt. Eine Framework-Migration ist nicht erforderlich.

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
- **Festgelegte UI-Richtung:** «Lernpfad – Tannengrün und Gelb»; Atkinson Hyperlegible Next ist lokal implementiert. U5 prüft die fertigen Ansichten und dokumentiert die Gestaltung.
- **Für den Aktivierungstag vorzubereiten:** Nach bestätigter Berechtigung kann der Administrator die Karte über Stripe hinterlegen, ohne einen Monatspreis zu bezahlen. Die erste Belastung erfolgt frühestens am geplanten Aktivierungstag beziehungsweise nach dem gewährten Gratismonat. Fehlende oder nachträglich zu bestätigende Zahlungsmittel erhalten einen sichtbaren Zustand; eine erfolgreiche Mitternachtszahlung kann nicht garantiert werden.
- **Vor Live-Betrieb nötig:** tatsächliche Supabase-/Stripe-Bestandsaufnahme, benötigte Geheimnisse, freigegebene Lerninhalte und Kartenquellen sowie Anbieter-/Steuerangaben. GitHub-Push und Supabase-Anpassungen sind als Abschluss der Umsetzung beauftragt; die nötigen Zugänge und das genaue Ziel werden vor Ausführung geprüft.

## Verbleibende Arbeitspakete in Ausführungsreihenfolge

Die folgenden Pakete konkretisieren die offenen Teilpläne. Sie sind keine zusätzliche Produktausweitung. Bereits vorhandenen Code weiterverwenden; ein Häkchen bedeutet vollständige Erfüllung des genannten Abnahmepunkts.

### R1 – Lern- und Kontofunktionen vollständig abschliessen

- [ ] Alte Vokabelabläufe gezielt nachprüfen: feste Multiple-Choice-Antworten nach Korrektur, Antwortsprache, automatische Eingabefokussierung, Enter ohne Doppelauslösung, sichtbare geschriebene Antwort und Wiederholung aller/falscher Aufgaben.
- [ ] Zuordnen mit 12 Wortpaaren, vier Desktopreihen und einer Strafsekunde je Fehlzuordnung prüfen; Karteikartenkategorien und Wiederholungen dauerhaft erhalten; Übungstestanzahl und reine Endauswertung prüfen.
- [ ] Grammatik-, Mathe- und Geografieauswahl in eigenen Sets und Klassenprüfungen vollständig bedienen. Ungebuchte Lehrerfächer verständlich sperren; serverseitige Prüfung bleibt entscheidend.
- [ ] Cloud-Speichern bei verzögerten Antworten, Abmeldung und Kontowechsel prüfen. Kein alter Kontostand darf in das nächste Konto gelangen; unbekannte Daten dürfen beim Laden nicht still verschwinden.
- [ ] Inhaltsversion für laufende Klassenübungen festhalten und Änderungen der Lehrperson für die nächste Runde sichtbar machen. Bereits kopierte Lernsets bleiben unabhängig; gelöschte Prüfungen dürfen keine neue Runde starten.

**Abnahme:** Reproduzierbare Browserfälle für jede genannte Regel; gespeicherte Daten und sichtbare Ergebnisse stimmen überein. Die im ursprünglichen Plan genannte `tests/navigation-ui.test.js` fehlt noch; entweder anlegen oder die vollständigen Fälle nachvollziehbar in die vorhandenen Browserprüfungen aufnehmen.

### R2 – Zahlungen, Wiederholungen und Bestandsabos abschliessen

- [ ] Worker und Webhooks gemeinsam prüfen: gleichzeitige Aufrufe, abgelaufene Reservierung, Timeout nach erfolgreicher Stripe-Aktion, veraltete Ereignisse, erneute Kartenhinterlegung und abgebrochene Zahlungsseite dürfen weder doppelt belasten noch voreilig Rechte vergeben.
- [ ] Dienstfunktionen für Zahlung und Aktivierung mit normalen Schüler-/Lehrer-/Admin-Konten als unzugänglich nachweisen; gültige und ungültige Worker-Aufrufe prüfen.
- [ ] Erste kostenpflichtige Periode, Freimonat, Kartenbestätigung und Kündigung vor/nach Aktivierung vollständig testen. Ein Freimonat ersetzt den vereinbarten ersten bezahlten Monat nicht.
- [ ] `scripts/reprice-subscriptions.mjs` und `tests/reprice-subscriptions.test.mjs` aus S4 erstellen; beide fehlen aktuell. Vorschau ohne Änderungen, veralteter Bericht, wiederholte Anwendung, offene Rechnung und erhaltenes Kündigungsdatum prüfen.
- [ ] Echte Bestandsabos erst unmittelbar vor dem Preiswechsel ermitteln. Gibt es keine, den Nachweis festhalten und keine unnötige Umstellung ausführen. Neue Preise allein rechtfertigen keine unkontrollierten Einzüge.

**Abnahme:** Lokale Tests sind erfolgreich; anschliessend bestehen dieselben entscheidenden Zahlungsfälle in Stripe im Testmodus. Der Umstellungsbericht nennt geplante Änderungen und ausgelassene Sonderfälle ohne Geheimnisse oder personenbezogene Daten im Repository.

### R3 – Oberfläche, Inhalte und Dokumentation abnehmen

- [ ] U5 für alle Schüler-, Konto-, Lehrer- und Adminansichten durchführen, einschliesslich leerer Listen, Fehlern und langen Namen. Prüfen: 320/390/768/1366/1920 Pixel, 200 % Zoom, Tastatur, reduzierte Bewegung und ausgefallene Schriftdatei. Echten Mobilgerätetest gesondert dokumentieren.
- [ ] Grammatikfragen, akzeptierte Varianten, Mathe-Skizzen/Formeln und Lösungen fachlich abnehmen lassen; geografische Namen, Aliase, Filter und Erreichbarkeit aller Katalogeinträge kontrollieren.
- [ ] Quellen, Datenstand und Lizenzen von Schrift und Karten dokumentieren; Fremdmaterial nicht als selbst verfasst oder offiziell freigegeben ausweisen.
- [ ] `DESIGN.md`, `.impeccable/design.json`, `PRODUCT.md`, `SPEC.md`, `SUPABASE.md`, Schulanleitung und Rechtstextentwürfe mit der tatsächlichen Umsetzung abgleichen. Veraltete Preise und die frühere 30-Tage-Zahlungsfreigabe aus aktuellen Nutzertexten entfernen; historische Migrationen erhalten.

**Abnahme:** Visueller Bericht, fachliche Freigaben und aktuelle Betriebs-/Produktdokumentation liegen vor. Offene fachliche oder rechtliche Freigaben werden als solche geführt, nicht durch technische Tests ersetzt.

### R4 – Externe Einrichtung und Betriebsbereitschaft

| Voraussetzung | Zuständigkeit | Nachweis vor Freigabe |
|---|---|---|
| Stripe-Testkonto und Testschlüssel | Betreiber richtet Konto ein; Entwicklung verbindet Funktionen | Kartenspeicherung, Erstzahlung, Zusatzbestätigung, Verlängerung, Freimonat, Kündigung und Upgrade mit Testkarten bestanden |
| Stripe-Webhooks | Entwicklung nach Bereitstellung des Testkontos | Signierte Setup-/Checkout-, Abo- und Rechnungsereignisse erreichen die richtige Umgebung; Wiederholungen funktionieren |
| Supabase-Serverkonfiguration | Entwicklung mit verbundenem Zugang; Betreiber liefert fehlende Geheimnisse über Servereinstellungen | `VOCI_APP_URL`, Stripe-Schlüssel, Webhook-Geheimnis und getrennte Worker-Geheimnisse gesetzt; keine geheimen Werte im Browser oder Repository |
| Zeitgesteuerte Aktivierung | Entwicklung | Geschützter Aufruf von `voci-activation-worker` mindestens einmal je Minute; nächste fällige Schule wird verarbeitet, ausgefallene Aufrufe werden nachgeholt |
| Benachrichtigungen | Betreiber autorisiert Gmail-Absender; Entwicklung richtet Worker ein | Testnachrichten nur an Testempfänger; individuelle Einstellungen und wiederholte Verarbeitung geprüft |
| Fachliche und rechtliche Freigaben | Betreiber und beauftragte fachkundige Personen | Inhalte, Anbieterangaben, AGB/Datenschutz, Steuer-/Rechnungsangaben geprüft |
| Veröffentlichung | Entwicklung innerhalb des bereits erteilten Auftrags | Abnahmebericht, aktuelle Zielprüfung, Sicherung und Rückfallanleitung vorhanden |

Die Worker speichern Reservierungen und Bearbeitungszustände in der Datenbank. Der Zeitplan allein stellt keine Zahlungsgarantie dar: Ein Ausfall, ein fehlendes Zahlungsmittel oder eine ausstehende Kartenbestätigung muss nachvollziehbar angezeigt und sicher erneut verarbeitet werden.

### R5 – Veröffentlichungsunterlagen fertigstellen

- [ ] Release-Bericht mit Commit, Prüfbefehlen/Ergebnissen, offenen Einschränkungen und Freigaben erstellen. Fehlende Prüfungen ausdrücklich aufführen.
- [ ] Folgende lokale Migrationen in Reihenfolge gegen den tatsächlich vorhandenen Onlinebestand prüfen: `202610250001_schools.sql`, `20261030222631_subjects_content_v2.sql`, `20261030222736_school_activation.sql`. Weitere Korrekturen additiv planen, sobald eine Migration ausgeliefert ist.
- [ ] Bereitstellung für `voci-billing`, `voci-stripe-webhook`, `voci-mail-worker` und `voci-activation-worker` dokumentieren; benötigte Secrets, Zeitpläne und Fehlerbehandlung aufnehmen.
- [ ] Sicherung der betroffenen produktiven Daten und Funktionen sowie einen getesteten Rückfallweg vorbereiten. Bei UI-Rückfall dürfen neue Fachsets nicht überschrieben oder zu alten Vokabelsets umgedeutet werden.
- [ ] GitHub-Ziel `990-Dario/Voci`, Arbeitsbranch und Supabase-Projekt `dycuevqtzmhbgaaearph` erneut bestätigen. Automatische Website-Deployments berücksichtigen: Serverkompatibilität vor Veröffentlichung der neuen produktiven Oberfläche herstellen.

**Fertigstellungskriterium:** Die Planung gilt mit diesem Dokument als vollständig beschrieben. Das Produkt gilt erst als ausgeliefert, wenn R1–R5 sowie P1/P2 nachweislich abgeschlossen sind. Es werden keine Pflichtprüfungen allein wegen fehlender Zugänge oder bereits vorhandener Commits als bestanden markiert.

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
