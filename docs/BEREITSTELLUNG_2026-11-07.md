# Bereitstellung vom 7. November 2026

## GitHub

Der geprüfte Projektstand ist auf `990-Dario/Voci`, Branch `codex/faecher-ui-preise`, Commit `6337d640f86be2a77c8c5bc3de58e1be79dc7b93` gepusht. Der Produktionsbranch `main` bleibt auf dem bisherigen Stand. Damit ist keine automatische Veröffentlichung der neuen Oberfläche bestätigt.

## Supabase

Ziel: `dycuevqtzmhbgaaearph`, Projekt Voci, Region eu-central-1.

Bereitgestellt, jeweils Version 1: `voci-billing`, `voci-stripe-webhook`, `voci-mail-worker`, `voci-activation-worker`. Die Funktionen prüfen ihre eigenen Benutzer-, Signatur- oder Worker-Berechtigungen. Die Bereitstellung aktiviert noch keine Zahlungen, Benachrichtigungen oder Zeitpläne.

**Datenbankmigrationen sind noch nicht angewandt.** Zwei Aufrufe von `apply_migration` wurden durch die Supabase-Verbindung mit `status: expired` beendet: die erforderliche Bestätigung lief nach zwei Minuten ab. Die anschliessende Kontrolle zeigt eine leere Migrationshistorie und weiterhin kein Schema `voci_private`.

Die folgenden lokal geprüften Dateien müssen in dieser Reihenfolge angewandt werden:

1. `supabase/migrations/202610250001_schools.sql`
2. `supabase/migrations/20261030222631_subjects_content_v2.sql`
3. `supabase/migrations/20261030222736_school_activation.sql`

Die zwei vorhandenen Lernstände wurden vorab mit den betroffenen öffentlichen Funktionsdefinitionen und Richtlinien in einer lokalen, von Git ausgeschlossenen Datei unter `.private/supabase-predeploy-2026-11-07.json` gesichert. Das ist eine gezielte Datensicherung, kein vollständiges Supabase-Projektbackup. Vor jeder Fortsetzung den aktuellen Zustand erneut prüfen.

## Noch benötigte Einrichtung

Nach bestätigter Migration: Schema-/Rollenprüfung und Kontrolle der erhaltenen Lernstände; `VOCI_APP_URL`, Stripe-Testschlüssel/Webhook und getrennte Worker-Geheimnisse; autorisierter Gmail-Zugriff; geschützte Zeitpläne. Siehe `AKTIVIERUNG_BETRIEB.md`. Echte Stripe-Tests und Online-Kontotests stehen aus. Keine Geheimnisse im Chat oder Repository hinterlegen.

## Rückfall

Der vorherige Oberflächenstand bleibt über `main` verfügbar. Bei Problemen keine Datenbank zurücksetzen oder Lernstände löschen. Die neuen Serverfunktionen sind ohne vollständige Konfiguration nicht betriebsbereit; vor Rückbau zuerst aktuelle Daten und Funktionen sichern. Nach einem UI-Rückfall dürfen neue Fachsets nicht mit einem älteren Client überschrieben werden.
