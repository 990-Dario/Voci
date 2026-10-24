# Spec: Voci – Schüler-Version

## Annahmen für diesen Entwurf

1. Die erste Auslieferung ist eine responsive Web-App, keine native App.
2. Vokabellisten werden von dir kuratiert und mit Sprache, Unit/Unité und Lernziel ausgeliefert.
3. Schüler können sich optional mit E-Mail und Passwort anmelden. Prüfungstermin und Lernstand werden lokal gespeichert und bei Anmeldung mit Supabase synchronisiert.
4. Der Prüfungstermin dient in der ersten Version zur Anzeige und wird noch nicht für automatische Lernpläne verwendet.
5. Für die schlanke erste Version schlage ich HTML, CSS und JavaScript ohne zusätzliche Frameworks oder Abhängigkeiten vor.

## Objective

Die Startseite erklärt kurz das Lernangebot und führt dann zur Auswahl. Schülerinnen und Schüler wählen Englisch oder Französisch, eine Unit/Unité, passende Lernziele und einen Prüfungstermin. Danach üben sie die ausgewählten Vokabeln in vier Modi:

- **Zuordnen auf Zeit:** Wörter und Übersetzungen möglichst schnell verbinden.
- **Karteikarten:** Vokabel und Übersetzung ansehen und den Lernstand selbst einschätzen.
- **Abfragen:** Antwort per Multiple Choice auswählen oder selbst schreiben.
- **Übungstests:** einen kurzen Test mit den ausgewählten Vokabeln absolvieren; ausgewertet wird erst nach der letzten Antwort.

Erfolg bedeutet, dass ein Schüler eine Wortauswahl treffen, einen Modus starten, üben und den gespeicherten Lernstand nach einem Neuladen im selben Browser wiederfinden kann.

## Tech Stack

Statische Web-App mit HTML, CSS und JavaScript. Vokabeln liegen versioniert als strukturierte Datendateien im Projekt; Browser `localStorage` speichert Auswahl, Prüfungstermin und Lernstand. Supabase Auth und eine durch Row-Level Security geschützte Tabelle synchronisieren Lernsets und Lernstand pro Konto.

## Commands

- Entwicklung: `python -m http.server 8000`
- Prüfung: im Browser manuell auf Desktop- und mobiler Breite; zusätzlich die vier Lernmodi und das Wiederherstellen lokaler Daten prüfen.
- Build/Test/Lint: nicht vorgesehen, solange keine Build-Werkzeuge eingeführt werden.

## Project Structure

- `index.html` – Seitenstruktur und Einstieg
- `styles.css` – responsive Darstellung und Fokuszustände
- `app.js` – Auswahl, Lernmodi und lokale Speicherung
- `data/vocabulary.json` – kuratierte Vokabeln, gruppiert nach Sprache, Unit/Unité und Lernziel
- `supabase-config.js` – Projekt-URL und öffentlicher anon key
- `supabase-schema.sql` – Tabelle und Sicherheitsregeln
- `SUPABASE.md` – Einrichtungsschritte

## Code Style

Kleine, native JavaScript-Funktionen; sprechende Namen; keine Abhängigkeit für einfache UI- oder Speicherlogik. Beispiel für die Datenform:

```json
{
  "language": "en",
  "unit": "Unit 1",
  "objective": "At school",
  "words": [{ "term": "book", "translation": "Buch" }]
}
```

## Testing Strategy

Keine Testbibliothek für den MVP. Vor Freigabe manuell prüfen: Unit/Unité und Lernziel auswählen, Vokabelauswahl starten, alle vier Modi durchspielen, Prüfungstermin setzen und nach Neuladen kontrollieren, dass Auswahl und Fortschritt erhalten bleiben. Leere Wortlisten und fehlende Übersetzungen dürfen keinen Lernmodus starten.

## Boundaries

- **Immer:** Eingaben und Vokabeldaten vor der Nutzung prüfen; Bedienung per Tastatur ermöglichen; bei fehlenden oder ungültigen Daten verständlich reagieren.
- **Zuerst abstimmen:** Konten, Synchronisation, automatische Lernplanung, Lehrpersonenfunktionen, Import von Lehrmittel-Inhalten und zusätzliche Abhängigkeiten.
- **Nie:** Zugangsdaten oder persönliche Schülerdaten in den Vokabeldateien ablegen.

## Success Criteria

- Schüler können Englisch oder Französisch und danach Unit/Unité sowie Lernziele wählen.
- Ein Prüfungstermin lässt sich setzen und bleibt nach Neuladen im selben Browser erhalten.
- Die vier oben beschriebenen Modi verwenden die ausgewählten Vokabeln.
- Lernstand bleibt lokal erhalten; ungültige oder leere Datensätze führen nicht zu einem kaputten Lernmodus.
- Die Oberfläche funktioniert auf schmalen und breiten Bildschirmen und ist per Tastatur bedienbar.

## Open Questions

- Das Datenmodell speichert einen Lernstand als JSON-Datensatz. Bei sehr grossen Datenmengen oder Lehrpersonenfunktionen sollte es in einzelne Tabellen aufgeteilt werden.
