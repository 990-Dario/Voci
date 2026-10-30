# Schulen, Klassen und Abos einrichten

Die neuen Funktionen sind im Projekt enthalten. Damit sie auf deiner veröffentlichten Webseite funktionieren, müssen die neue Datenbankmigration und die drei Serverfunktionen in deinem Supabase-Projekt eingerichtet werden. Bestehende Lernsets bleiben in `learning_states` erhalten.

## 1. Datenbank erweitern

1. Erstelle vor der Migration eine Sicherung deines Supabase-Projekts bzw. nutze zunächst ein separates Testprojekt.
2. Die bisherige Datei `supabase-schema.sql` muss bereits eingerichtet sein.
3. Öffne Supabase → **SQL Editor**.
4. Führe den vollständigen Inhalt von `supabase/migrations/202610250001_schools.sql` **einmal** aus. Die Migration erstellt neue Tabellen im privaten Schema `voci_private`; sie ersetzt keine vorhandenen Lernsets.
5. Lass das Schema `voci_private` aus der Liste der öffentlich erreichbaren API-Schemas heraus. Der Browser verwendet ausschliesslich die vorgesehenen `voci_…`-Funktionen. Die Migration sperrt zusätzlich den direkten Tabellenzugriff.
6. Unter **Cron** muss der Auftrag `voci-school-cleanup` erscheinen. Er entfernt gelöschte Klassen ab sieben Tagen. Ab diesem Zeitpunkt sind die Klassen unabhängig vom Löschlauf nicht mehr über die App abrufbar. Die Aufbewahrung in Supabase-Backups ist davon getrennt und muss in der Datenschutzerklärung korrekt beschrieben werden.

Falls eine SQL-Fehlermeldung erscheint, nicht einzelne Teile unkontrolliert erneut ausführen: Die Hauptmigration läuft in einer Transaktion, die Cron-Einrichtung folgt danach. Fehlermeldung und vorhandene Tabellen zuerst prüfen.

## 2. Dich als Betreiber freischalten

Ein Schuladmin wird von Voci bestätigt. Die erste Freigabe kann deshalb nur ein Betreiber erteilen.

1. Erstelle dein eigenes Voci-Konto und bestätige die E-Mail.
2. Kopiere unter **Authentication → Users** deine User-ID.
3. Führe im SQL Editor folgenden Befehl aus, mit deiner echten ID:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"voci_operator":true}'::jsonb
where id = 'DEINE-USER-ID';
```

4. Melde dich in Voci ab und wieder an. Unter **Schule & Abos** erscheint der Betreiberbereich zur Prüfung von Anträgen.

Verwende dafür ausdrücklich `raw_app_meta_data`. Rollen dürfen nicht aus frei bearbeitbaren Profil-Metadaten übernommen werden. Gib diese Betreiberberechtigung nur vertrauenswürdigen Personen aus deinem Team.

## 3. Schulprofil und Berechtigung

Neue Konten geben Vorname, Nachname und Schule an. Bestehende Konten ergänzen diese Angaben unter **Schule & Abos**. Nutzernamen werden pro Schule als `vorname.nachname`, bei Doppelungen als `vorname.nachname1` usw. vergeben.

Wer Schuladmin oder einzelne Lehrperson werden möchte, stellt dort einen Antrag mit Schul-E-Mail und einer Beschreibung der Berechtigung. Du prüfst den Nachweis ausserhalb der App. Die App kann nicht selbst feststellen, ob eine Person von der Schule bevollmächtigt wurde. Im Betreiberbereich bestätigst du anschliessend die Schuldomain und gibst den Antrag frei oder lehnst ihn ab.

Ein genehmigter Schuladmin erhält eine Zahlungsfreigabe für 30 Tage. Er kann reine Administratoren oder Lehrpersonen über einen an die Schuladresse gebundenen Einladungslink aufnehmen. Maximal fünf Administratoren; nur Personen mit Lehrpersonenrolle zählen zum Tarif. Ein reiner Administrator kann keine Klassenprüfungen erstellen.

## 4. Stripe im Testmodus verbinden

1. Erstelle ein Stripe-Konto und nutze zunächst den **Testmodus**.
2. Installiere bei Bedarf die Supabase CLI gemäss der offiziellen Anleitung und melde sie an. Im Projektverzeichnis:

```powershell
npx supabase login
npx supabase link --project-ref DEINE-PROJEKT-ID
npx supabase functions deploy voci-billing
npx supabase functions deploy voci-stripe-webhook
npx supabase functions deploy voci-mail-worker
```

3. Hinterlege unter Supabase → **Edge Functions → Secrets**:

| Name | Wert |
| --- | --- |
| `VOCI_APP_URL` | Vollständige öffentliche Voci-Adresse, einschliesslich Unterordner, falls vorhanden |
| `STRIPE_SECRET_KEY` | Stripe-Testschlüssel `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Signaturgeheimnis des Webhooks, siehe nächster Schritt |

Die Supabase-Variablen `SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stehen Edge Functions automatisch zur Verfügung. Kein privater Schlüssel gehört in `supabase-config.js`, in die Website oder auf GitHub. `.env.example` enthält nur Platzhalter.

4. Erstelle in Stripe einen Webhook auf:

```text
https://DEINE-PROJEKT-ID.supabase.co/functions/v1/voci-stripe-webhook
```

Abonniere `customer.subscription.created`, `customer.subscription.updated` und `customer.subscription.deleted`. Kopiere dessen `whsec_…` in `STRIPE_WEBHOOK_SECRET`. Der Server prüft die Signatur am unveränderten Nachrichteninhalt und lädt anschliessend den aktuellen Abostand bei Stripe.

5. Öffne in Voci **Schule & Abos → Abonnements**. Bei der ersten Buchung führt Voci zu Stripe. Erst nach Zahlungsbestätigung wird ein Abo aktiv. Für die Zahlung wird jeweils eine Stripe-Seite mit begrenzter Laufzeit angelegt; die interne Freigabe der Schule bleibt 30 Tage gültig.

### Hinterlegte Monatspreise

- Einzelne Lehrperson: 1 Fach CHF 5, 2 CHF 7, 3 CHF 9, 4 CHF 11, 5 CHF 12; danach +CHF 1 pro zusätzlichem Fach.
- Schule bis einschliesslich 50 Lehrpersonen: CHF 30, ab 51 CHF 75. Schülerzahlen und reine Administratoren verändern den Preis nicht.
- Einladungen reservieren Plätze im Lehrpersonen-/Adminlimit bis zur Annahme oder ihrem Ablauf.
- Kündigung: Nutzung bis zum bezahlten Ende. Keine anteilige Rückzahlung bei freiwilliger Kündigung.
- Upgrade: sofort, mit Stripe-Gutschrift für die unverbrauchte Zeit; neuer Monatsbeginn am Upgrade-Datum. Bei einer nicht abgeschlossenen Zahlung wird das Upgrade nicht freigeschaltet.
- Reduktion: ab der nächsten Periode, ohne Rückerstattung für die laufende Periode. Diese ergänzende Standardregel wurde bei der Umsetzung gewählt und sollte in den finalen Vertragsbedingungen bestätigt werden.

Die Fachliste enthält derzeit Englisch und Französisch. Weitere Fächer müssen mit eigenen Lerninhalten und passenden Lernansichten ergänzt werden; der Tarif unterstützt schon weitere Fächer. Preise werden serverseitig berechnet. Vor echten Zahlungen fehlen noch die abschliessende Mehrwertsteuer-/Rechnungsregelung und die finalen Anbieter- und Rechtstexte.

## 5. Gmail-Versand aktivieren

Voci verwendet zunächst `fuerschule65@gmail.com`. Das Passwort dieses Postfachs wird nicht benötigt. Autorisiere stattdessen die Gmail API mit OAuth für genau dieses Absenderkonto:

1. Erstelle in Google Cloud ein Projekt und aktiviere die Gmail API.
2. Richte den OAuth-Zustimmungsbildschirm und einen passenden OAuth-Client ein.
3. Autorisiere `https://www.googleapis.com/auth/gmail.send` für `fuerschule65@gmail.com` mit Offlinezugriff und speichere den erhaltenen Refresh-Token sicher. Je nach Google-Konfiguration sind Freigabe oder Verifizierung nötig; Tokens eines im Testmodus verbleibenden OAuth-Projekts können kurzlebig sein.
4. Hinterlege diese Secrets in Supabase: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` und einen langen zufälligen Wert als `VOCI_MAIL_WORKER_SECRET`.
5. Erstelle unter Supabase → Cron einen HTTP-Auftrag, der beispielsweise jede Minute einen **POST** an folgende Adresse sendet:

```text
https://DEINE-PROJEKT-ID.supabase.co/functions/v1/voci-mail-worker
```

Header: `Authorization: Bearer DEIN-VOCI_MAIL_WORKER_SECRET`. Speichere ihn geschützt, idealerweise in Supabase Vault; niemals in öffentlichem Code. Der Browser ruft diesen Worker nicht auf.

Der Worker verarbeitet bis zu zehn E-Mails pro Aufruf, berücksichtigt die individuellen Einstellungen und reserviert Nachrichten gegen parallelen Versand. Fehlgeschlagene Nachrichten werden bis zu fünfmal versucht. Bei einem Abbruch direkt nach dem Gmail-Versand und vor der Speicherbestätigung kann eine Nachricht nochmals versendet werden. Ohne Gmail-Konfiguration bleiben E-Mails in der Warteschlange und werden nicht als versendet gemeldet. Die Gmail-Versandlimits gelten weiterhin. Dies ersetzt nicht den separat konfigurierten Supabase-Auth-Versand für Bestätigungs- und Passwortmails.

## 6. Klassen und Prüfungen verwenden

Nach aktiver Buchung kann eine bestätigte Lehrperson unter **Klassen** eine Klasse erstellen und weitere Lehrpersonen zuweisen. Ein neuer Beitrittscode erhält ein eigenes Teilnahmelimit und läuft nach sieben Tagen ab. Schüler geben ihn unter **Schule & Abos** ein. Der Klassen-Tab erscheint für Schüler erst nach einem Beitritt.

Prüfungen verwenden die vorhandenen Lehrmittel, Units und Lernziele. Beim Erstellen, Ändern oder Löschen werden Nachrichten für die jeweiligen Klassenmitglieder eingeplant. Die Klassenansicht aktualisiert sich beim Öffnen, bei Rückkehr zum Browser und alle 30 Sekunden. Änderungen an einer Klassenprüfung ändern keine bereits erstellte persönliche Lernset-Kopie. Übungsergebnisse bleiben im eigenen Konto.

Ein Klassenexport enthält Prüfungen und Kontoverknüpfungen als JSON, ohne Zugangsdaten oder private Lernstände. Ein Import erstellt eine neue Klasse innerhalb derselben Schule und prüft alle Konten. Fehlende bzw. schulwechselnde Konten führen zu einem verständlichen Abbruch des gesamten Imports. Gelöschte Klassen lassen sich während der siebentägigen Frist noch exportieren. Danach werden sie vom Löschauftrag entfernt.

## 7. Veröffentlichung

Veröffentliche die geänderten Website-Dateien zusammen mit `school.js` und `school-data.js`. Es gibt keinen zusätzlichen Frontend-Build. Öffne nach der Veröffentlichung die App neu. Bleiben die neuen Serverfunktionen noch uneingerichtet, zeigt der Schulbereich einen entsprechenden Hinweis; die bisherigen persönlichen Lernsets bleiben nutzbar.

Die Dokumente `DATENSCHUTZ_ENTWURF.md` und `AGB_ENTWURF.md` sind Entwürfe und wurden nicht als fertige öffentliche Rechtstexte eingebunden.

## Lokale Prüfungen für die Entwicklung

Die Umsetzung wurde mit Node.js 24, einer temporären PGlite-Datenbank und Chrome geprüft. Alle neun lokalen Prüfungen waren erfolgreich. Echte Stripe-Zahlungen und Gmail-Nachrichten wurden dabei nicht ausgelöst.

Die kleinen Prüfungen laufen mit `node --test tests/app-data.test.js tests/school-data.test.js tests/billing.test.mjs`. Für `tests/schools-db.test.js` muss `VOCI_PGLITE_PATH` auf ein lokal installiertes `@electric-sql/pglite/dist/index.cjs` zeigen. Für `tests/school-ui.test.js` muss `VOCI_PLAYWRIGHT_PATH` auf ein installiertes Playwright-Paket zeigen und `VOCI_PREVIEW_URL` auf die lokale Voci-Vorschau. Die Browserprüfung verwendet ein simuliertes Konto und sperrt externe Netzwerkaufrufe. Ohne diese optionalen Werkzeuge werden die jeweiligen Prüfungen ausdrücklich übersprungen; sie sind keine Abhängigkeiten der Webseite.

Quellen für die Anbindung: [Supabase-Datenbankfunktionen](https://supabase.com/docs/guides/database/functions), [Supabase Edge-Authentifizierung](https://supabase.com/docs/guides/functions/auth), [Stripe-Aboänderungen](https://docs.stripe.com/api/subscriptions/update), [Gmail-Versand](https://developers.google.com/workspace/gmail/api/guides/sending).
