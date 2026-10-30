# Voci: Geografie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Länder und Schweizer Kantone anhand echter Umrisse, kleiner Gebietspunkte und zwei Lernarten üben.
**Architecture:** Länderlisten und Kartenformen werden getrennt gepflegt und über stabile IDs verbunden. Versionierte Daten werden einmalig zu lokalen SVG-/JSON-Dateien aufbereitet; beim Lernen werden keine externen Kartendienste benötigt. Der Quizablauf ist unabhängig von der Darstellung prüfbar.
**Tech Stack:** JavaScript, statisches SVG/JSON, vorhandene Browserprüfungen; bei der Datenaufbereitung gezielt `d3-geo` mit festgelegter Version, nicht die gesamte D3-Bibliothek im Browser.
**Spec:** Fach-/Preisdesign, UI-Brief und `2026-10-28-gesamtumbau.md`.

## Global Constraints

- Genau zwei Weltkataloge: `un195` = 193 Mitgliedstaaten + Heiliger Stuhl + Palästina; `ioc206` = 206 anerkannte Nationale Olympische Komitees.
- `ch26` ist die separate Schweizer-Kantonsauswahl; kein dritter Staaten-/Gebietekatalog.
- Ganze Welt, Kontinent und Region wie Westeuropa/Nordafrika sind wählbar und im Lernset gespeichert.
- Die Modi sind «Auf der Karte finden» und «Namen eingeben», jeweils auch für Kantone.
- Bewertung pro Eintrag: 100/75/50/25/0 Punkte; Durchschnitt entspricht Prozent. Nach vier Fehlversuchen wird geholfen, nicht mehr weiter herabgestuft.
- Kleine oder geometrisch fehlende Einträge benötigen einen echten anklickbaren Punkt; kein Katalogeintrag darf still verschwinden.
- Neu benötigte Daten haben dokumentierte Quelle, Datenstand und Nutzungsbedingungen.

## Review Focus

1. IOC-Eintrag ohne regulären ISO-/M49-Schlüssel: kuratierte ID und Region statt Verlust durch automatisches Join (G1).
2. Kleinstaat, Inselgruppe und Datumsgrenze: richtige Geometrie/Punkte ohne weltumspannendes Polygon oder falsches Zoom (G1/G2).
3. Wechsel von Katalog/Kontinent/Region: leere Auswahl startet keine Runde und alte Ergebnisse färben keine neue Auswahl (G2/G3).
4. Wiederholter Klick oder Enter nach Abschluss: genau eine Bewertung je Frage (G3).
5. Farbsehschwäche, reduzierte Bewegung und Touch: Punkt/Umriss und Bewertung sind ohne Farberkennung und starkes Blinken nutzbar (G2/G3).

## Dateien und Datenvertrag

| Datei | Verantwortung |
|---|---|
| Neu `data/geography/entities.json` | Namen, Antwortvarianten, Katalogmitgliedschaften, Kontinente, Regionen, Form-/Punktzuordnung |
| Neu `data/geography/source-manifest.json` | Quellen, Versionskennungen, Checksummen und Lizenzhinweise |
| Neu `data/geography/world.svg`, `cantons.svg` | Vereinfachte, geprüfte Vektorkarten mit stabilen `data-entity-id`-Zuordnungen |
| Neu `scripts/build-geography.mjs` | Reproduzierbare Projektion und vereinfachte Ausgabe aus festgelegten Quelldaten |
| Neu `geography-data.js` / `VociGeographyData` | Katalogprüfung, Filter, Fragen, Bewertung und Antwortvarianten |
| Neu `geography.js` / `VociGeography` | Kartenbedienung und Quizdarstellung |
| Neu `tests/geography-data.test.js`, `tests/geography-ui.test.js` | Katalogvollständigkeit, Wertung, Karten-/Namensmodus |
| Bestehend `app.js`, `index.html`, `styles.css` | Modulstart, Datei-Ladefolge, Ergebnisse und neue Gestaltung |

`GeoEntity = {id, nameDe, aliases, catalogIds, continentId, regionId, shapeIds, marker}`. `marker` enthält bei Bedarf Kartenkoordinaten und die nachvollziehbare geographische Referenz. Mehrere Flächen/Punkte können einem Eintrag gehören, ergeben aber genau eine Frage. `catalogIds` enthält nur `un195`, `ioc206` oder `ch26`.

## Task G1: Vollständige Länder- und Kantonsdaten aufbereiten

**Files:** Geografiedaten, `scripts/build-geography.mjs`, `geography-data.js`, `tests/geography-data.test.js`; gegebenenfalls kleines `package.json`/Lockfile nur für das Aufbereitungsskript.
**Interfaces:** `validateCatalog(entities, assets) -> void`, `entitiesFor({catalogId, continentId, regionId}, entities) -> GeoEntity[]`. Produziert versionierte lokale Assets für G2. Ohne Geometrie ist ein geprüfter Marker Pflicht.

- [ ] Offizielle Listen in einem festen Datenstand zusammenstellen und Tests zuerst definieren: `entitiesFor(un195).length === 195`, `ioc206 === 206`, `ch26 === 26`; jede Auswahl hat eindeutige IDs; jede Entität ist über Fläche oder Punkt erreichbar. Heiliger Stuhl und Palästina gehören in `un195`; Westsahara erhält keinen eigenen Fragenkatalog.
- [ ] Weltumrisse aus Natural Earth und Kantonsgebiete aus swissBOUNDARIES3D prüfen und beziehen. Quellen-/Versions-/Lizenzangaben ins Manifest aufnehmen. Geeignete Genauigkeit anhand Europa und kleiner Inselstaaten prüfen; Landformen ersetzen nicht die UN-/IOC-Mitgliedsliste.
- [ ] Deutsche Namen und kuratierte zulässige Varianten ergänzen. IOC-Bezeichnungen wie Chinese Taipei oder Hong Kong werden explizit zugeordnet und nachvollziehbar angezeigt. Die Flüchtlingsmannschaft und tagesaktuelle Olympia-Teilnehmerlisten sind keine nationalen Komitees dieses Katalogs.
- [ ] Kontinent-/Regionsschlüssel aus M49 zuordnen; Einträge ohne direkt passenden M49-Schlüssel erhalten eine dokumentierte geografische Zuordnung. Keine Gebiete durch einen fehlenden ISO-/M49-Join auslassen. Schweizer Kantone werden als 26 IDs unabhängig von der Weltliste geführt.
- [ ] Mit `d3-geo` ausschliesslich für die Datenaufbereitung passende Weltprojektion und SVG-Pfade erzeugen. Quelle auf Polygonlöcher, Inselteile und Datumsgrenze prüfen; Schweiz passend projizieren. Kleine Einträge erhalten Marker, deren Bezugspunkt auf dem richtigen Gebiet liegt. Exakte Bibliotheksversion bei Umsetzung prüfen und im Lockfile festhalten.
- [ ] `node scripts/build-geography.mjs` und `node --test tests/geography-data.test.js` ausführen. Zweiter Build erzeugt dieselben Dateien. Deutschland, Schweiz, Vatikan, Palästina, Monaco, Singapur, pazifische Inselstaaten und IOC-Sonderfälle visuell prüfen.
- [ ] Rohdatenpfad, Verarbeitung und Quellen dokumentieren und G1 committen. Umfangreiche unverarbeitete Geodaten nicht unnötig mit der Website ausliefern.

## Task G2: Filter und bedienbare Kartenoberfläche

**Files:** `geography.js`, `app.js`, `styles.css`, `index.html`, `tests/geography-ui.test.js`.
**Interfaces:** Konsumiert G1, F1 und U2. `VociGeography.start(set, entities) -> session` und `render(session) -> string`. Kartenaktionen liefern die stabile `entityId` an G3; Hintergrund und Filterbedienung sind keine Antwort.

- [ ] Browserfälle zuerst anlegen: UN-Auswahl zeigt 195, IOC 206, Kantone 26; Kontinent reduziert die Menge; Westeuropa/Nordafrika liefern nur passende Einträge. Katalogwechsel setzt unpassende Regionsfilter zurück.
- [ ] Kartenlernseite nach U1 gestalten: Aufgabenname und Fortschritt oberhalb einer grossen Kartenfläche, kompakte Filter, sichtbare Legende und Ergebnisaktion. Die Karte ist der Hauptinhalt; keine zusätzliche Weltkarte als Dekoration.
- [ ] Lokale SVGs laden; nur der gewählte Fragenumfang ist als Antwort aktiv. Andere Flächen bleiben neutraler Kontext. Gewertete Flächen behalten ihre Ergebnisfarbe. Eine MultiPolygon-Auswahl zählt als dieselbe Entität.
- [ ] Zoom, Verschieben und «Ausschnitt zurücksetzen» umsetzen. Gewählter Kontinent/Region bekommt einen geeigneten Ausschnitt. Marker bleiben bei Zoom gut bedienbar; bei überlappenden Punktzielen wird erst der Ausschnitt vergrössert, ohne dafür einen Fehler zu zählen. Maus-/Touch- und Tastaturfokus unterstützen.
- [ ] Kleinstaaten auf Mobilgeräten überprüfen; Fläche und dazugehöriger Marker führen zur gleichen ID. Ziehen der Karte darf beim Loslassen keinen falschen Antwortklick auslösen. Für reduzierte Bewegung statische Hervorhebung statt Blinken verwenden.
- [ ] `node --test tests/geography-ui.test.js` mit Browserumgebung ausführen. Datumsgrenze, Inselgruppen, kleine Ziele, Zoom, Touch und Filterwechsel in der neuen Gestaltung prüfen.
- [ ] G2 committen.

## Task G3: Beide Lernarten, Farbwertung und Wiederholen

**Files:** `geography-data.js`, `geography.js`, `app.js`-Ergebnisintegration; Geografietests.
**Interfaces:** `scoreForMistakes(count) -> 100|75|50|25|0`, `submitGeoAnswer(session, answer) -> session`, `normalizeGeoName(raw) -> string`. Sitzung enthält die festgehaltene Auswahl, zufällige Fragenreihenfolge, Fehler je Frage und abgeschlossene Ergebnisse; F6 speichert deren Gesamtwert.

- [ ] Bewertungstests zuerst: `[0,1,2,3,4,5].map(scoreForMistakes)` ergibt `[100,75,50,25,0,0]`. Für fünf Länder mit 100/75/50/25/0 entstehen 250 von 500 Punkten = 50 %; alles grün 100 %, alles rot 25 %, alles schwarz 0 %.
- [ ] Kartenmodus umsetzen: zufälliger Name → falsche Auswahl zählt einen Versuch → passende Auswahl färbt Ziel grün/gelb/orange/rot. Nach dem vierten Fehler wird das richtige Ziel hervorgehoben; sein Anklicken schliesst es mit schwarz/0 ab. Falsch angeklickte Nachbarländer erhalten dadurch keine Ergebnisfarbe für ihre eigene spätere Frage.
- [ ] Namensmodus umsetzen: gesuchte Fläche/Punkt wird hervorgehoben, Feld erhält Fokus. Namen mit ausdrücklich hinterlegten Varianten vergleichen; Grossschreibung, äussere Leerzeichen und Unicode-Normalform vereinheitlichen. Die richtige Lösung nach vier Fehlern anzeigen und über «Lösung übernehmen» mit 0 abschliessen. Dies überträgt die Hilferegel ohne zusätzlichen Kartenklick auf die Texteingabe.
- [ ] Liste sämtlicher Namen der aktuellen Auswahl im Namensmodus ein-/ausblendbar machen. Sie beeinflusst die vereinbarte Wertung nicht. Eingabe nach Korrektur stehen lassen; Enter bewertet oder geht weiter, aber nie beides mit demselben Ereignis.
- [ ] Rundenende zeigt Prozent, Anzahl je Ergebnisstufe und die bewerteten Kartenobjekte. «Alle wiederholen» startet dieselbe Auswahl neu; bekannte Ergebnisfarben werden für die neue Runde zurückgesetzt. F6 erhält Ganzzahlpunkte und Einzelergebnisse mit stabilen IDs.
- [ ] `node --test tests/geography-data.test.js tests/geography-ui.test.js` ausführen. Doppelereignisse, vierte falsche Antwort, Lösungshilfe, Varianten, ausgeblendete Liste, reine Hintergrundklicks und Speicherung nach Neuladen abdecken.
- [ ] G3 committen und fachliche Karten-/Katalogprüfung an P1 übergeben.

## Offizielle Grundlagen für die Umsetzung

- UN-Mitglieder: https://www.un.org/about-us/member-states
- Beobachterstaaten: https://research.un.org/en/unmembers/observers
- IOC-Komittees: https://www.olympics.com/ioc/national-olympic-committees
- Regionen: https://unstats.un.org/unsd/methodology/m49/
- Weltumrisse und Nutzung: https://www.naturalearthdata.com/about/terms-of-use/
- Kantonsgebiete: https://www.swisstopo.admin.ch/de/landschaftsmodell-swissboundaries3d
- Projektion: https://d3js.org/d3-geo/projection

Die Liste bestimmt Quizmitgliedschaft, die Geodaten bestimmen Umrisse. Abweichende Grenzdarstellungen und Namen werden bei der Inhaltsabnahme dokumentiert; sie werden nicht still durch die technische Standardkarte entschieden.
