# Bereitstellung vom 7. November 2026

## GitHub

Der geprüfte Projektstand ist auf `990-Dario/Voci`, Branch `codex/faecher-ui-preise`, Commit `6337d640f86be2a77c8c5bc3de58e1be79dc7b93` gepusht. Der Produktionsbranch `main` bleibt auf dem bisherigen Stand. Damit ist keine automatische Veröffentlichung der neuen Oberfläche bestätigt.

## Supabase

Ziel: `dycuevqtzmhbgaaearph`, Projekt Voci, Region eu-central-1.

Bereitgestellt, jeweils Version 1: `voci-billing`, `voci-stripe-webhook`, `voci-mail-worker`, `voci-activation-worker`. Die Funktionen prüfen ihre eigenen Benutzer-, Signatur- oder Worker-Berechtigungen. Die Bereitstellung aktiviert noch keine Zahlungen, Benachrichtigungen oder Zeitpläne.

**Datenbankmigrationen sind erfolgreich angewandt.** Nach zwei zuvor abgelaufenen Freigaben gelang der erneute Durchlauf am 7. November 2026. Die Onlinekontrolle bestätigt das Schema `voci_private`, alle fünf Fächer, die Aktivierungstabelle und den aktiven täglichen Löschauftrag. Beide bestehenden Lernstände sind weiterhin vorhanden. Alle privaten Tabellen haben RLS aktiviert; normale Benutzer können die serverseitigen Zahlungs-RPCs nicht ausführen, anonyme Benutzer können keine Aktivierungsaufträge abrufen.

Die folgenden lokal geprüften Dateien wurden in dieser Reihenfolge angewandt:

1. `supabase/migrations/202610250001_schools.sql`
2. `supabase/migrations/20261030222631_subjects_content_v2.sql`
3. `supabase/migrations/20261030222736_school_activation.sql`

Der Supabase-Connector hat dafür die Onlineversionen `20261107122858` (`schools`), `20261107122909` (`subjects_content_v2`) und `20261107122927` (`school_activation`) registriert. Diese entsprechen den oben genannten lokalen Dateien; die Dateien dürfen nicht nochmals angewandt werden. Vor einem künftigen CLI-`db push` die unterschiedlichen lokalen und online registrierten Versionsnummern ausdrücklich abgleichen.

Der Sicherheitsberater meldet keine Fehlerstufe. Die Hinweise zu RLS ohne Policies betreffen absichtlich gesperrte private Tabellen: Browserzugriff erfolgt ausschliesslich über überprüfte RPCs. Die aufrufbaren SECURITY-DEFINER-Funktionen sind die vorgesehenen Such-, Teil- und Schul-Schnittstellen. Die bereits vorher deaktivierte Prüfung auf kompromittierte Passwörter ist weiterhin ein offener Auth-Konfigurationspunkt; keine pauschale Sicherheitsfreigabe.

Die zwei vorhandenen Lernstände wurden vorab mit den betroffenen öffentlichen Funktionsdefinitionen und Richtlinien in einer lokalen, von Git ausgeschlossenen Datei unter `.private/supabase-predeploy-2026-11-07.json` gesichert. Das ist eine gezielte Datensicherung, kein vollständiges Supabase-Projektbackup. Vor jeder Fortsetzung den aktuellen Zustand erneut prüfen.

## Noch benötigte Einrichtung

Noch einzurichten beziehungsweise abzunehmen: `VOCI_APP_URL`, Stripe-Testschlüssel/Webhook und getrennte Worker-Geheimnisse; autorisierter Gmail-Zugriff; geschützte Aktivierungs-/Mail-Zeitpläne. Der Datenbank-Löschauftrag ist bereits aktiv. Siehe `AKTIVIERUNG_BETRIEB.md`. Echte Stripe-Tests und Online-Kontotests stehen aus. Keine Geheimnisse im Chat oder Repository hinterlegen.

## Rückfall

## Korrektur der Website-Veröffentlichung

Die öffentliche Seite wird von GitHub Pages aus `main` erzeugt. Der erste Push auf den Arbeitsbranch hatte deshalb die Website nicht aktualisiert. Zur Behebung wird der geprüfte Arbeitsstand ohne Force-Push nach `main` übernommen. `.nojekyll` sorgt dafür, dass GitHub Pages die statische App direkt veröffentlicht. Die anschliessende Kontrolle erfolgt an der öffentlichen Pages-Adresse und anhand des Deploymentstatus.

Der vorherige Oberflächenstand bleibt über `main` verfügbar. Bei Problemen keine Datenbank zurücksetzen oder Lernstände löschen. Die neuen Serverfunktionen sind ohne vollständige Konfiguration nicht betriebsbereit; vor Rückbau zuerst aktuelle Daten und Funktionen sichern. Nach einem UI-Rückfall dürfen neue Fachsets nicht mit einem älteren Client überschrieben werden.
