# Umsetzungsstand – Gesamtumbau vom 28. Oktober 2026

Stand: 1. November 2026. Verbindlicher Überblick: [vollständiger Umsetzungs- und Veröffentlichungsplan](2026-10-28-gesamtumbau.md), insbesondere «Umsetzungsstand» und «Verbleibende Arbeitspakete». Die Planung ist beschrieben; die Produktabnahme bleibt offen.

- Arbeitskopie: `codex/faecher-ui-preise`, bestehende uncommittete Projektdateien vollständig übernommen; Originalordner erhalten.
- GitHub: Repository `990-Dario/Voci` verbunden, Push-Berechtigung bestätigt.
- Supabase: Projekt `dycuevqtzmhbgaaearph` verbunden, Schema-/Funktionsbestand vor Migration erneut zu prüfen.
- P0 abgeschlossen: lokale Baseline und Schema geprüft; Richtung Lernpfad gewählt.
- U1–U5/F1–F6/G1–G3 in Arbeit: neue Lernoberfläche, fünf Fächer, Grammatik/Mathe/Geografie umgesetzt; Lehrpersonenprüfungen V2 und Preise aktualisiert.
- S1/S2: additive lokale Migrationen erstellt; Rollen, Folgetag Zürich, 14-Tage-Prüfung, Gratiszeit und Klasseninhalte lokal getestet.
- S3: Zahlungsablauf und Worker vorbereitet; lokale Simulationen bestanden. Stripe-Testkonto fehlt.
- Rollout offen: Gesamtsicherheitsprüfung, fachliche Freigabe, Stripe-Test, GitHub-Push und Supabase-Anwendung stehen aus.

## Gesicherte Zwischenstände und Prüfungen

Onlinebereitstellung vom 7. November 2026: Arbeitsbranch auf GitHub gepusht; vier Supabase-Serverfunktionen bereitgestellt und alle drei Datenbankmigrationen erfolgreich angewandt. Nachkontrolle bestätigt fünf Fächer, RLS, gesperrte Server-RPCs, aktiven Löschauftrag und zwei erhaltene Lernstände. Produktionsbranch `main`, Zahlungs-/E-Mail-Konfiguration und vollständige Onlineabnahme bleiben offen. Details und Zuordnung der Migrationsversionen: [Bereitstellungsbericht](../../BEREITSTELLUNG_2026-11-07.md).

Prüfung vom 7. November 2026: Vollständiger lokaler Lauf mit 43 bestandenen Tests und null übersprungenen Fällen. Zusätzliche Korrekturen betreffen Wortfortschritt, Karten-Klickflächen, Checkboxen und Metadaten. Produkt- und Gestaltungsdokumentation aktualisiert. Nachweise und weiterhin offene Abnahmen: [Prüfbericht](../../PRUEFBERICHT_2026-11-07.md). Die Veröffentlichung ist weiterhin offen.

Oberflächenkorrekturen vom 6. November 2026: Prüfungsdatum und Fach sind in Klassenprüfungen wieder sichtbar. Kleine Schaltflächen, mobile Navigation und Schliessen-Schaltflächen haben mindestens 44 Pixel Höhe; Schuleingaben verwenden 16 Pixel Schrift. Die Prüfungsauswahl sperrt ungebuchte Fächer mit Erklärung und berücksichtigt Einzelabo, Schulabo, Aktivierungsbeginn und Gratismonat. Bei einem nicht mehr gebuchten Prüfungsfach bleiben Inhalte und Speichern gesperrt, bis ein verfügbares Fach gewählt wird. Browserprüfung bei 320/390/768/1366 Pixeln sowie lokale Rechteprüfungen bestanden; die serverseitige Berechtigungsprüfung bleibt verbindlich. Diese Korrekturen sind lokal und noch nicht veröffentlicht.

- `bfd6bcd`: Fächer, Karten, neue Oberfläche und Klasseninhalte V2.
- `706a19a`: Schulaktivierung, neue Preise und vorbereitete Zahlungsabläufe.
- Zuletzt dokumentiert: 29 lokale Daten-/Logik-/Datenbankprüfungen sowie 3 Browserprüfungen bestanden, ohne übersprungene Fälle in diesen Läufen. Keine vollständige Produktionsabnahme.
- Laufzeitabhängigkeiten: `npm audit --omit=dev --audit-level=high` ohne bekannte Befunde. Entwicklungsabhängigkeiten und Anwendungssicherheit sind damit nicht vollständig geprüft.
- Stripe-Testkonto laut Nutzer noch nicht eingerichtet. Bisherige Zahlungstests verwenden simulierte Antworten.

## Nächste Arbeitspakete

Fortschritt R1: Laufende Klassenrunden behalten nun ihren Inhaltsstand und zeigen Änderungen an. Neue Runden greifen auf die aktuelle Prüfung zu. Verspätete Cloud-Ladeantworten aus älteren Sitzungen werden verworfen. Ungültige Testanzahlen starten keine Runde. Die drei bestehenden Browserprüfungen wurden um Regressionen ergänzt und erfolgreich ausgeführt.

Fortschritt R2: Die lokale Datenbankprüfung beansprucht jetzt tatsächlich Worker-Aufträge, prüft den gleichzeitigen zweiten Aufruf und verweigert Aktivierung ohne bestätigte Zahlung. Beide Datenbankprüfungen bestehen. Die [Betriebsanleitung für die Schulaktivierung](../../AKTIVIERUNG_BETRIEB.md) ist vorbereitet; externe Einrichtung und Stripe-Abnahme bleiben offen.

1. R1: Lern-, Konto- und Klassenabläufe vervollständigen, insbesondere Kontowechsel und Änderungen während einer laufenden Übung.
2. R2: Zahlungswiederholungen, Rollen, Kündigung und Bestandsabo-Umstellung abschliessen. Preiswechselwerkzeug und fünf zugehörige lokale Tests sind jetzt vorhanden und bestanden; die [Preiswechselanleitung](../../PREISWECHSEL.md) beschreibt Vorschau, Anwendung und Sonderfälle. Echte Stripe-Tests und der Bestandsbericht bleiben offen.
3. R3: Visuelle Gesamtabnahme, fachliche Inhaltsprüfung und Dokumentationsabgleich durchführen.
4. R4: Stripe-Testumgebung, Worker-Zeitpläne und Testmail-Versand einrichten.
5. R5/P1/P2: Release-Bericht, Sicherheit, Sicherung und Rückfall vorbereiten; danach GitHub und Supabase aktualisieren und online prüfen.

Fehlender Stripe-Zugang verhindert nur die davon abhängigen Prüfungen und Freigaben. Die übrigen Arbeiten werden unabhängig weitergeführt. GitHub-Push und Supabase-Anpassung sind bereits beauftragt und erfordern nach erfolgreicher Abnahme keine erneute allgemeine Zustimmung.

## Entscheidungen

- Die Umsetzung läuft in dieser Sitzung schrittweise. Eine unabhängige Gesamtprüfung erfolgt vor dem Rollout.
- Bestehende Schuländerungen gehören zum Ausgangsstand; das Repository wird nicht auf den alten Vokabelstand zurückgesetzt.
