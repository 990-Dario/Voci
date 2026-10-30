# Voci: vollständige UI- und Typografieüberarbeitung

**Stand:** 28. Oktober 2026. Ergänzung zu `2026-10-28-faecher-und-preise-design.md`.
**Status:** Planungsgrundlage. Die konkrete visuelle Richtung wird vor der UI-Implementierung an repräsentativen Ansichten entschieden.

## Auftrag und Ziel

Der Nutzer verlangt zusätzlich zum Fach- und Preisausbau eine vollständige Überarbeitung der Oberfläche und der Typografie. Mit «Topografie» war ausdrücklich **Typografie / Schriftgestaltung** gemeint. Die bereits vereinbarten geografischen Kartenübungen bleiben ein eigenes Fachmodul.

Die Oberfläche soll Schülern das Finden, Zusammenstellen und Üben ihres Prüfungsstoffs erleichtern. Lehrpersonen, Schuladministration und Betreiber erhalten klare Arbeitsansichten für ihre jeweiligen Aufgaben. Die Gestaltung muss auf Primar- und Sekundarstufe sowie Desktop, Tablet und Smartphone funktionieren.

## Umfang der Neugestaltung

| Bereich | Erwartete Überarbeitung |
|---|---|
| Einstieg | Kurze Einführung in das erweiterte Lernangebot, verständliche Hauptaktion zur Fach-/Inhaltswahl |
| Navigation | Fächer, eigene Lernsets, persönlicher Fortschritt; Klassen für Schüler erst bei Mitgliedschaft; Verwaltung entsprechend Rolle |
| Fach- und Inhaltswahl | Fach → Lernbereich → Lehrmittel/Thema → Unit/Lernziel; stufenbezogene Vorauswahl mit Anzeige der anderen Stufe |
| Lernsets | Anlegen, Bearbeiten, Prüfungstermin, Auswahlübersicht, Teilen, Löschen, Wiederholen |
| Übungen | Eigenständige Ansichten für Zuordnen, Karteikarten, Multiple Choice, Schreiben, Übungstest, Grammatik, Mathematik und Kartenlernen |
| Ergebnisse | Fachlich passende Auswertung, Fehler und Wiederholung, Vergleich mit früheren Ergebnissen |
| Konten | Registrierung, E-Mail-Bestätigung, Anmeldung, Konto, Schulstufe, Benachrichtigungen und Speicherstatus |
| Klassen | Prüfungsübersicht, aktuelle Lehrerangaben, eigene Lernsetkopie, Klassenverwaltung und Beitrittscodes |
| Schule und Abo | Schulprofil, Anträge, Lehrpersonen/Admins, Einladungen, Tarif und Aktivierungszustand |
| Betreiber | Vollständigkeit und Prüfung von Anträgen, Frist und Freimonat, nachvollziehbare Freigabe |

## Gestaltungsauftrag

- Die neue Oberfläche ersetzt den bisherigen visuellen Aufbau. Sie umfasst Informationshierarchie, Layout, Komponenten, Schrift, Farben, Abstände und Interaktionen.
- Lerninhalte stehen im Mittelpunkt: grosse Aufgabenfläche beim Üben; dichte, gut lesbare Zeilen für Verwaltung und Verlauf; Karten erhalten möglichst viel Platz im Geografie-Modul.
- Die öffentliche Einführung darf stärker gestalten; Lern- und Verwaltungsansichten folgen vertrauten Bedienmustern.
- Keine endgültige Farbrichtung oder Schrift ist bereits vom Nutzer ausgewählt. Eine neue Richtung wird in U1 anhand echter Projektinhalte vorgeschlagen und festgelegt.
- Vorschlag für die Schriftprüfung: lokal ausgelieferte Atkinson Hyperlegible neben einer Systemschrift vergleichen. Entscheidend sind unterscheidbare Zeichen, französische Akzente, deutsche Umlaute und mathematische Zeichen. Quelle: https://www.brailleinstitute.org/freefont/
- Die Typografie erhält feste Rollen für Seitentitel, Aufgabentext, Fliesstext, Formulare, Hilfetext, Formeln und Zahlen. Eingaben auf Smartphones mindestens 16 CSS-Pixel; regulärer Lesetext als Ausgangspunkt 16–18 Pixel; konkrete Skala wird an den Ansichten geprüft.
- Schriften werden mit Lizenz lokal ausgeliefert. Die im Bestand verwendeten externen Google-Fonts-Aufrufe entfallen im Zuge der Umsetzung.

## Funktionsschutz und Bedienung

Vorhandene Lernfunktionen bleiben erhalten: getrennte Multiple-Choice-/Schreibkacheln; stabile Antwortoptionen nach Korrektur; eingegebener Text bleibt stehen; Enter bestätigt die jeweils nächste sinnvolle Aktion genau einmal; Schreibfelder erhalten Fokus; Antwortsprache bleibt wählbar.

Zuordnen behält grosse Desktop-Karten, höchstens 12 Wortpaare und vier Desktop-Zeilen; ein Fehler addiert eine Strafsekunde. Bei 12 Paaren ergeben sich 24 Kacheln, sechs Kacheln pro Zeile. Für andere Mengen bleibt die Höhe auf vier Reihen begrenzt. Auf kleinen oder stark vergrösserten Ansichten darf notwendiger Inhalt nicht abgeschnitten werden.

Karteikarten behalten «Kann ich», «Noch üben», «Alle wiederholen» und beliebig oft wiederholbare Übungsrunden. Abfragen behalten die Wahl zwischen allen und nur falschen Antworten. Tests behalten die numerische Wortanzahl mit Begrenzung auf vorhandene Wörter und die Auswertung nach dem letzten Eintrag.

Formularfehler und die E-Mail-Bestätigung erscheinen im geöffneten Dialog. Fokus, verständliche Beschriftung, Tastaturbedienung, reduzierte Bewegung und Hinweise zusätzlich zur Farbe gehören zu allen neuen Komponenten. Textkontrast mindestens 4,5:1, bei grosser Schrift 3:1. Sichtbare Bedienelemente erhalten auf Touch-Geräten mindestens 44 × 44 CSS-Pixel grosse Zielflächen; Karten-Kleinstaaten erhalten dafür passende Punkt-/Zoomhilfen.

## Zustände und Abnahme

Jeder Bereich wird mit leeren, normalen und umfangreichen Inhalten sowie Lade-, Fehler-, Speicher- und Berechtigungszuständen entworfen. Namen mit Umlauten, lange Schulnamen, 0 und viele Lernsets, viele Units sowie 195/206 Kartenobjekte gehören in die Prüfbeispiele.

U1 liefert Entwürfe für Lernübersicht, eine Übungsansicht und eine Klassen-/Verwaltungsansicht auf Desktop und Mobilgerät. Erst nach Festlegung dieser Richtung werden sämtliche Ansichten umgesetzt. `DESIGN.md` und `.impeccable/design.json` dokumentieren am Ende die tatsächlich umgesetzte Gestaltung.
# Direction contract

**THESIS:** Lernpfad macht den nächsten Lernschritt sichtbar: Fach wählen, Inhalte zusammenstellen, üben. Eine ruhige Arbeitsfläche ersetzt die dekorative Buchkulisse.

**OWN-WORLD:** Tannengrün #234f45, Gelb #f2d25d, beinahe weisser Hintergrund #f7f9f6 und dunkle Schrift #172c25. Atkinson Hyperlegible Next wird lokal eingebunden. Klare Linien, 12px Radien und sparsame gelbe Hauptaktionen halten die Lernaufgabe im Vordergrund.

**STORY:** Schüler finden ihre Fächer, sehen ihren Prüfungstermin und beginnen direkt mit der passenden Übung. Lehrpersonen verwenden dieselben vertrauten Bedienelemente.

**FIRST VIEWPORT:** Auf breiten Bildschirmen links eine 224px breite tannengrüne Navigation; rechts Seitentitel, nächste Prüfung, fünf Fachzugänge und letzte Lernsets. Mobil wird die Navigation zu einer kompakten oberen Leiste. Die nächste Lernaktion hebt sich gelb ab. Beim Abschluss wechselt die Aufgabenfläche ruhig zur Ergebnisansicht; reduzierte Bewegung deaktiviert den Übergang.

**FORM:** Schweizer Wegweisung, Kandidat 7 «Lernpfad», seed:6cfcb9d5d6e24e0c. Vom Nutzer am 28.10.2026 über die strukturierte Auswahl bestätigt. Codebasierter Aufbau anhand lernpfad.html.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

