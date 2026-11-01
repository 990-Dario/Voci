# Bestehende Abos auf die neuen Preise umstellen

Das Werkzeug `scripts/reprice-subscriptions.mjs` ist lokal geprüft. Ein echter Stripe-Test ist noch offen. Vor produktiver Anwendung müssen der Zahlungstest, die Vertrags-/Steuerprüfung und die im Gesamtplan festgelegte Veröffentlichungsvorbereitung abgeschlossen sein.

## Voraussetzungen

Node 24 mit TypeScript-Unterstützung, die aktuelle Arbeitskopie und ein Stripe-Testkonto verwenden. `STRIPE_SECRET_KEY` muss als Umgebungsvariable gesetzt sein. Für die Anwendung zusätzlich `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` in der geschützten Ausführungsumgebung bereitstellen. Geheimnisse nicht in Befehlsbeispiele, Berichte, Website-Dateien oder Git schreiben.

Vor Anwendung prüfen, dass Stripe-Abos und Supabase-Projekt zusammengehören. Die Schul-/Preis-Migrationen und kompatiblen Webhooks müssen dort bereits eingerichtet sein. Das Werkzeug verwendet dieselben Datenbankreservierungen wie die Aboverwaltung der Website.

## 1. Vorschau erstellen

Im Projektordner ausführen:

```powershell
node scripts/reprice-subscriptions.mjs --dry-run --report .private/preiswechsel-test.json
```

Der Bericht enthält Abo-IDs, bisherigen und neuen Monatspreis in Rappen, einen Fingerabdruck des vorgefundenen Zustands und eine Einteilung:

- `update`: einfacher bezahlter Monatstarif, der automatisch umgestellt werden kann;
- `unchanged`: Preis bereits aktuell;
- `manual`: gesondert zu prüfender Fall, etwa Kündigung, offene Rechnung, geplanter Tarifwechsel, Rabatt, Steuerkonfiguration oder abweichende Abrechnung.

Das Restguthaben und der daraus geschätzte Saldo sind **Schätzwerte zum Zeitpunkt der Vorschau**. Stripe bestimmt die tatsächliche anteilige Verrechnung beim Wechsel. Der Bericht ersetzt keine Rechnung. Beträge unter null sind keine Zusage einer Rücküberweisung auf die Karte.

Die Vorschau verändert keine Abos. Eine vorhandene Berichtsdatei wird nicht überschrieben. `.private/` ist von Git ausgeschlossen; Berichte trotzdem nur berechtigten Personen zugänglich machen.

## 2. Geprüfte Auswahl anwenden

Nach Kontrolle des Berichts:

```powershell
node scripts/reprice-subscriptions.mjs --apply --report .private/preiswechsel-test.json
```

Der Bericht ist höchstens 24 Stunden verwendbar. Vor der ersten Änderung wird die gesamte darin zur automatischen Umstellung vorgesehene Auswahl nochmals gelesen. Jede Änderung wird unter einer Datenbankreservierung erneut geprüft. Bei einem veränderten Stand ist eine neue Vorschau nötig.

Automatische Änderungen setzen den Monatsbeginn auf den Änderungszeitpunkt und veranlassen die anteilige Verrechnung. Ein serverseitig festgelegter Versionsmarker und eine feste Wiederholungskennung verhindern die erneute Umstellung nach einer erfolgreichen Anwendung. Die Preise werden aus der gemeinsamen Serverberechnung bestimmt: CHF 3/5/7/8/9 für ein bis fünf Fächer und CHF 40/100 für die beiden Schulpakete.

Gekündigte Abos bleiben unverändert und werden als Einzelprüfungen ausgewiesen. Offene Rechnungen werden nicht automatisch ausgeglichen; geplante Tarifwechsel werden nicht still aufgehoben. Diese Fälle vor dem endgültigen Preiswechselbericht separat klären.

## Fehler und Wiederholung

Ein Bericht mit mehreren Abos ist keine gemeinsame Transaktion bei Stripe. Bei einem Fehler können vorherige Einträge bereits geändert sein. Zuerst Stripe und Supabase kontrollieren und dann denselben gültigen Bericht erneut verwenden. Bereits bestätigte Änderungen werden erkannt; ihre Datenbanksynchronisierung kann erneut versucht werden. Nicht einfach Versionsmarker oder Reservierungen löschen.

Die automatische Umstellung stoppt, wenn Stripe zusätzliche Zahlungsbestätigung verlangt. Diesen Fall gesondert bearbeiten. Nach Anwendung tatsächliche Rechnungen, Monatsbeginn, Supabase-Abostand und Unterrichtsrechte prüfen. Webhooks müssen spätere Zahlungen und Änderungen weiterhin verarbeiten.

## Lokaler Nachweis

```powershell
node --test tests/reprice-subscriptions.test.mjs
```

Abgedeckt sind Vorschau ohne Schreibzugriff, zweimalige Anwendung mit einer Änderung, veralteter/manipulierter Bericht, Kündigung/offene Rechnung/geplanter Wechsel, Schultarife und eine belegte Bearbeitungsreservierung. Diese Tests verwenden simulierte Stripe-Antworten.

Umsetzungsgrundlagen: [Stripe: anteilige Verrechnung](https://docs.stripe.com/billing/subscriptions/prorations) und [Stripe: wiederholbare API-Aufrufe](https://docs.stripe.com/api/idempotent_requests). Echte Stripe-Testläufe und der geprüfte Bericht für tatsächlich bestehende Abos bleiben Teil der Release-Abnahme.
