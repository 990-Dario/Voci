# Prüfbericht – Gesamtumbau

Stand: 7. November 2026. Geprüft wurde die Arbeitskopie `codex/faecher-ui-preise`, einschliesslich noch nicht committeter Korrekturen. Dieser Bericht bestätigt keine produktive Veröffentlichung.

## Nachweise

- Abschliessender Gesamtlauf nach den Korrekturen: 43 Tests bestanden, keine übersprungen. Darin Datenmodelle, Mathematik, Grammatik, Kartenkataloge, Rechner, vier Browserabläufe sowie PostgreSQL-Rollen und Schulaktivierung in PGlite. Lokales vollständiges Protokoll: `.superpowers/sdd/2026-10-28-gesamtumbau/final-tests.txt`.
- Danach erweitert: Fortschritt pro Vokabel bei Karteikarten, Abfragen und Übungstests; acht betroffene Daten-/Browserprüfungen bestanden. Tests unterscheiden private Fortschritte und unabhängige Klassenkopien.
- Kartenpunkte besitzen zusätzlich zum sichtbaren Kern eine transparente Klickfläche mit insgesamt 44px Durchmesser. Browserprüfung wählt den Punkt 15px neben seinem Mittelpunkt und bestätigt die Wertung. Drei betroffene Browserabläufe bestehen.
- Checkbox-Beschriftungen vergrössert; nützliche Metadaten unter die Überschriften verschoben; «Wie heisst dieses Land?» korrigiert.
- `npm audit --audit-level=high` im vorangegangenen Abgleich: keine gemeldeten Schwachstellen, einschliesslich Entwicklungsabhängigkeiten.
- Unabhängige Codeprüfung fand Preisänderung vor Checkout-Reservierung und ausbleibenden Neustart nach Ersatzkarte. Beide Korrekturen sind mit lokalen Regressionstests abgesichert.

## Grenzen und offene Arbeit

Die Tests verwenden simulierte Zahlungsantworten und Browserkonten. Echte Stripe-Testkarten, produktiver E-Mail-Versand, ein zweites reales Gerät und ein echter Smartphone-Tastaturablauf sind noch nicht abgenommen. Das Stripe-Testkonto wurde vom Betreiber noch nicht eingerichtet.

Noch offene Planpunkte: fachliche Freigabe der Lerninhalte; zusätzliche tatsächliche Grammatik-Auswahlfragen; vollständig ausgearbeitete Fortschrittsdarstellung für schwierige Inhalte; Dokumentationsabgleich einschliesslich Quellen/Lizenzen, AGB und Betriebsanleitungen; abschliessende Sicherheits- und Online-Abnahme; Sicherung/Rückfall; GitHub-Push und Supabase-Anwendung. Insbesondere ist ein erfolgreicher Testlauf kein Ersatz für diese Abnahmen.

Die Produkt-/Gestaltungsdokumentation wurde im Hauptlauf aktualisiert, einschliesslich `DESIGN.md` und `.impeccable/design.json`. Der separate Dokumentationslauf scheiterte am Nutzungslimit; dafür wird keine unabhängige Freigabe behauptet. Die korrigierte mobile Kartenansicht wurde visuell kontrolliert. Eine erneute unabhängige Gesamtfreigabe steht noch aus.

## Veröffentlichung

GitHub und Supabase wurden in dieser Prüfung nicht verändert. Erst die geprüfte Arbeitskopie sichern, den tatsächlichen Onlinebestand erneut lesen und einen Rückfallweg vorbereiten. Zahlungsfunktionen erst nach Stripe-Testabnahme produktiv freigeben. Bestehende Lernstände dürfen nicht zurückgesetzt werden.
