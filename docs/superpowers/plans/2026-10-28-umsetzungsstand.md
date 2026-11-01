# Umsetzungsstand – Gesamtumbau vom 28. Oktober 2026

Plan: `2026-10-28-gesamtumbau.md` und seine vier Teilpläne.

- Arbeitskopie: `codex/faecher-ui-preise`, bestehende uncommittete Projektdateien vollständig übernommen; Originalordner erhalten.
- GitHub: Repository `990-Dario/Voci` verbunden, Push-Berechtigung bestätigt.
- Supabase: Projekt `dycuevqtzmhbgaaearph` verbunden, Schema-/Funktionsbestand vor Migration erneut zu prüfen.
- P0 abgeschlossen: lokale Baseline und Schema geprüft; Richtung Lernpfad gewählt.
- U1–U5/F1–F6/G1–G3 in Arbeit: neue Lernoberfläche, fünf Fächer, Grammatik/Mathe/Geografie umgesetzt; Lehrpersonenprüfungen V2 und Preise aktualisiert.
- S1/S2: additive lokale Migrationen erstellt; Rollen, Folgetag Zürich, 14-Tage-Prüfung, Gratiszeit und Klasseninhalte lokal getestet.
- S3: Zahlungsablauf und Worker vorbereitet; lokale Simulationen bestanden. Stripe-Testkonto fehlt.
- Rollout offen: Gesamtsicherheitsprüfung, fachliche Freigabe, Stripe-Test, GitHub-Push und Supabase-Anwendung stehen aus.

## Entscheidungen

- Die Umsetzung läuft in dieser Sitzung schrittweise. Eine unabhängige Gesamtprüfung erfolgt vor dem Rollout.
- Bestehende Schuländerungen gehören zum Ausgangsstand; das Repository wird nicht auf den alten Vokabelstand zurückgesetzt.
