# Lehrmittel, Schulstufe und Teil-Links

**Datum:** 2026-10-25

## Ziel

Die Vokabelauswahl wird als aufklappbare Hierarchie dargestellt: Lehrmittel, Unit, Lernziel. Ein Konto hat eine Schulstufe. Lernsets lassen sich über einen Link teilen und werden beim Empfänger als unabhängige Kopie importiert.

## Gewählter Ansatz

- **Lehrmittel-Hierarchie:** Jede Vokabelgruppe erhält ein Lehrmittel-Feld. Die Auswahl zeigt Sprache → Lehrmittel → Unit → Lernziel.
- **Schulstufe:** Beim Erstellen eines Kontos wird Primarschule oder Sekundarschule gewählt. Der Wert wird im eigenen Lernstand gespeichert und kann später in Kontoeinstellungen geändert werden.
- **Filtern:** Primar zeigt Dis Donc 5–6 und Young World 1–4. Sekundar zeigt Dis Donc 7–9 und Open World 1–3. Ein Button blendet die andere Stufe zusätzlich ein.
- **Teil-Link:** Ein angemeldeter Benutzer erzeugt aus einem Lernset einen Link. Der Link enthält einen nicht erratbaren Kennwert. Ein angemeldeter Empfänger importiert damit eine eigene Kopie. Änderungen des Empfängers oder Eigentümers beeinflussen einander nicht.
- **Ablauf:** Jeder Teil-Link endet nach sieben Tagen. Abgelaufene Daten werden täglich aus der Datenbank entfernt.
- **Löschen:** Ein Lernset kann aus der Lernsetübersicht gelöscht werden. Vorher wird eine Bestätigung verlangt. Das Löschen entfernt auch alle zugehörigen Teil-Links.

## Daten

- `data/vocabulary.json`: Jede Gruppe erhält `course` und `schoolLevel`.
- `learning_states.state`: Ergänzung um `profile.schoolLevel`.
- Neue Tabelle `shared_sets`: Besitzer, Quell-Lernset-ID, Kennwert, Lernsetdaten, Erstellzeit und Ablaufzeit.
- Eine Datenbankfunktion gibt ausschließlich den Lernsetinhalt zu einem gültigen Kennwert zurück. Direkter Lesezugriff auf alle geteilten Lernsets bleibt gesperrt.
- Ein täglicher Datenbankauftrag entfernt Teil-Links, deren Ablaufzeit überschritten ist.

## Bedienung

- In der Lernsetauswahl sind Lehrmittel und Units aufklappbare Bereiche.
- Nur Lehrmittel der eigenen Stufe sind anfangs geöffnet und sichtbar.
- „Andere Stufe anzeigen“ erweitert die Liste, ohne die gespeicherte Stufe zu ändern.
- Unter einem geöffneten Lernset steht „Lernset teilen“. Nach dem Erzeugen wird der Link angezeigt und kann kopiert werden.
- Öffnet ein angemeldeter Benutzer einen gültigen Teil-Link, erscheint ein Import-Hinweis mit dem Namen des Lernsets.
- In der Lernsetübersicht steht bei jedem Set „Löschen“. Nach der Bestätigung verschwindet es samt eigenem Fortschritt und allen dazugehörigen Teil-Links.

## Grenzen

- Teil-Links sind für Personen gedacht, die den Link erhalten. Nach sieben Tagen ist ein Import nicht mehr möglich.
- Gelöschte Lernsets werden in der ersten Version nicht wiederhergestellt.
- Bestehende Beispielvokabeln erhalten Beispiel-Zuordnungen. Echte Lehrmittel-Daten müssen beim Import korrekt mit Lehrmittel und Schulstufe ausgezeichnet werden.
