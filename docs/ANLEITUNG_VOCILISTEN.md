# Vokabellisten erstellen

Alle Vokabeln der App stehen in der Datei [`data/vocabulary.json`](../data/vocabulary.json). Dort kannst du Lehrmittel, Units, Lernziele und beliebig viele Vokabeln ergänzen.

Wichtig: Bearbeite die Datei in einem Editor, der JSON unterstützt, zum Beispiel Visual Studio Code. Speichere sie anschliessend als **UTF-8**. Umlaute und französische Akzente wie `é`, `è` oder `œ` sind erlaubt.

## Aufbau

Jedes Lernziel ist ein eigener Block. Ein Block gehört genau zu einem Lehrmittel und einer Unit und enthält eine Liste von Wörtern.

```json
{
  "language": "en",
  "course": "Young World 2",
  "schoolLevel": "primary",
  "unit": "Unit 3 · At the zoo",
  "objective": "LZ 1 · Tiere benennen",
  "words": [
    { "id": "en-yw2-u3-lz1-lion", "term": "lion", "translation": "der Löwe" },
    { "id": "en-yw2-u3-lz1-elephant", "term": "elephant", "translation": "der Elefant" }
  ]
}
```

Die Felder bedeuten:

| Feld | Bedeutung | Beispiel |
| --- | --- | --- |
| `language` | Sprache der Liste | `en` oder `fr` |
| `course` | Lehrmittel und Band | `Young World 2` |
| `schoolLevel` | Schulstufe des Lehrmittels | `primary` oder `secondary` |
| `unit` | Name der Unit oder Unité | `Unit 3 · At the zoo` |
| `objective` | Lernziel innerhalb der Unit | `LZ 1 · Tiere benennen` |
| `words` | Die Vokabeln dieses Lernziels | Liste mit beliebig vielen Einträgen |
| `id` | Eindeutige technische Kennung einer Vokabel | `en-yw2-u3-lz1-lion` |
| `term` | Fremdsprachige Vokabel | `lion` |
| `translation` | Deutsche Übersetzung | `der Löwe` |

## Erlaubte Lehrmittel

Schreibe den Wert bei `course` genau so:

| Schulstufe | Englisch | Französisch |
| --- | --- | --- |
| Primarschule | `Young World 1` bis `Young World 4` | `Dis Donc 5` und `Dis Donc 6` |
| Sekundarschule | `Open World 1` bis `Open World 3` | `Dis Donc 7` bis `Dis Donc 9` |

Für die Schulstufe gilt:

- `Young World 1`–`4`, `Dis Donc 5` und `6`: `"schoolLevel": "primary"`
- `Open World 1`–`3`, `Dis Donc 7`–`9`: `"schoolLevel": "secondary"`

Open World zählt in deiner Liste einfach weiter: Verwende den Unit-Namen, der im Lehrmittel steht, zum Beispiel `"Unit 7 · …"`. Die App setzt die Nummer nicht zurück.

## Neues Lernziel in einer vorhandenen Unit ergänzen

Kopiere einen vollständigen Block, ändere `objective` und ersetze die Wörter. `course`, `schoolLevel` und `unit` bleiben gleich. Zwischen zwei Blöcken muss ein Komma stehen.

```json
[
  {
    "language": "fr",
    "course": "Dis Donc 7",
    "schoolLevel": "secondary",
    "unit": "Unité 4 · En ville",
    "objective": "LZ 1 · Orte in der Stadt",
    "words": [
      { "id": "fr-dd7-u4-lz1-gare", "term": "la gare", "translation": "der Bahnhof" }
    ]
  },
  {
    "language": "fr",
    "course": "Dis Donc 7",
    "schoolLevel": "secondary",
    "unit": "Unité 4 · En ville",
    "objective": "LZ 2 · Nach dem Weg fragen",
    "words": [
      { "id": "fr-dd7-u4-lz2-ou", "term": "où est … ?", "translation": "wo ist …?" }
    ]
  }
]
```

## Beliebig viele Wörter hinzufügen

In `words` darfst du so viele Vokabeln eintragen, wie das Lernziel braucht. Setze zwischen zwei Wörtern ein Komma, aber **nie nach dem letzten Wort**.

```json
"words": [
  { "id": "en-yw1-u1-lz1-book", "term": "book", "translation": "das Buch" },
  { "id": "en-yw1-u1-lz1-chair", "term": "chair", "translation": "der Stuhl" },
  { "id": "en-yw1-u1-lz1-table", "term": "table", "translation": "der Tisch" }
]
```

Es gibt keine feste Sechsergrenze. Beim Zuordnen verwendet die App pro Runde höchstens zwölf Wörter; für weitere Wörter startest du einfach eine neue Runde.

## Regeln, damit die App die Liste laden kann

1. Die gesamte Datei beginnt mit `[` und endet mit `]`.
2. Jeder Block braucht mindestens eine Vokabel.
3. Jede `id` muss in der **ganzen Datei einmalig** sein. Verwende eine klare Schreibweise, etwa `en-yw2-u3-lz1-lion`.
4. `term` und `translation` dürfen nicht leer sein.
5. Verwende gerade Anführungszeichen `"` und keine typografischen Anführungszeichen.
6. Setze kein Komma nach dem letzten Eintrag einer Liste oder dem letzten Block.
7. Ändere bestehende `id`-Werte möglichst nicht: Lernfortschritt und Karteikarten-Markierungen sind an diese Kennungen gebunden.

## Empfohlener Arbeitsablauf

1. Sichere vor grösseren Änderungen eine Kopie von `data/vocabulary.json`.
2. Ergänze zuerst ein Lernziel mit zwei oder drei Wörtern.
3. Speichere die Datei und starte die Webseite lokal.
4. Erstelle ein Lernset und prüfe, ob Lehrmittel, Unit, Lernziel und Wörter richtig angezeigt werden.
5. Ergänze danach die restlichen Wörter und weiteren Lernziele.
6. Wenn alles stimmt, speichere die Änderungen mit Git und veröffentliche sie erneut.

## Häufige Fehler

| Problem | Ursache und Lösung |
| --- | --- |
| Die Seite meldet, dass Vokabeldaten nicht geladen werden | Meist fehlt ein Komma oder es gibt ein Komma zu viel. Prüfe die zuletzt geänderte Stelle. |
| Ein Lernziel fehlt in der Auswahl | Prüfe `language`, `course`, `schoolLevel` und ob der Block innerhalb der äusseren `[` und `]` steht. |
| Das Lehrmittel erscheint unter der falschen Stufe | Kontrolliere den exakten `course`-Namen und den passenden Wert für `schoolLevel`. |
| Lernfortschritt scheint verschwunden | Wahrscheinlich wurde eine bestehende `id` geändert. Stelle die frühere Kennung wieder her. |

Die Beispielwörter in der Datei sind nur technische Beispieldaten. Ersetze sie durch die Vokabellisten, für die du die Rechte hast.
