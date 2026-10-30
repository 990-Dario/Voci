# Voci: Schulen, Preise und Aktivierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fünf Fächer in Klassen verfügbar machen, neue Tarife durchsetzen und Schulrechte mit dem Aktivierungs- und Zahlungsbeginn verbinden.
**Architecture:** Bestehende Schul-RPCs und Edge Functions werden additiv erweitert. Eine schulbezogene Aktivierung hält Freigabe, geplanten Start und tatsächlichen Zugriff auseinander. Stripe-Ereignisse und wiederholbare Hintergrundarbeit bestätigen Zahlungen; ein Browser-Weiterleitungsziel schaltet keinen Zugang frei.
**Tech Stack:** Supabase/Postgres, bestehende TypeScript Edge Functions, Stripe, vorhandener Mail-Worker und lokale DB-/Billing-/Browserprüfungen.
**Spec:** Fach-/Preisdesign, UI-Brief und `2026-10-28-gesamtumbau.md`; bestehende Schulanforderungen in `docs/LEHRPERSONENFUNKTION.md` gelten weiter, soweit sie nicht durch die neueren Entscheidungen ersetzt werden.

## Global Constraints

- Einzelabo für 1/2/3/4/5 Fächer: 300/500/700/800/900 Rappen monatlich. Schule ≤50: 4000 Rappen; ab 51: 10000 Rappen.
- Schüleranzahl und reine Administratoren beeinflussen den Tarif nicht; Einladungen reservieren Lehrpersonenplätze, maximal fünf Admins.
- Bestehende Abos sofort auf neue Preise; keine stillschweigende Verlängerung einer bereits erklärten Kündigung.
- 14 Tage ab vollständigem Antrag; bei Voci-Verzug ein Gratismonat. Keine erste Belastung vor dem Aktivierungstag.
- Schuladmin verwaltet/einlädt ab Bestätigung; Unterricht erst am nächsten Kalendertag um 00:00 `Europe/Zurich` und nach bestätigter Zahlung oder innerhalb eines gewährten Freimonats.
- Die 30-Tage-Zahlungsfreigabe entfällt vollständig aus Produktlogik, Meldungen und Dokumentation. Technische Ablaufzeiten einzelner Stripe-Sessions bleiben als Zahlungsanbietermechanismus bestehen.
- Neue Migration statt Änderung bereits ausgelieferter Migrationsdateien; bestehende private Lernstände erhalten.
- Service-Schlüssel und Kartendaten gelangen nicht in die Website; Rollen bleiben serverseitig geprüft.

## Review Focus

1. Lehrperson mit nur Englisch versucht Mathematik oder gemischten falschen Inhaltsblock: Server verweigert, auch bei verändertem Browser-Payload (S1).
2. Zweiter Admin einer bereits aktiven Schule wird bestätigt: kein neuer Aktivierungstermin, Freimonat oder zweites Abo (S2).
3. Zeitumstellung, fehlendes Zahlungsmittel und doppelter Cron-Aufruf: eine Freigabe führt zu höchstens einer aktiven Aboperiode und einer Belastung (S2/S3).
4. Veralteter oder doppelter Webhook: aktueller bestätigter Stripe-Zustand gewinnt, ohne Rechte vorzeitig freizugeben (S3).
5. Preiswechsel bei offenen Rechnungen oder gekündigten Abos: kein unkontrollierter Einzug, keine verlorene Kündigung und keine doppelte Gutschrift (S3/S4).

## Dateien und Verantwortung

| Datei | Verantwortung |
|---|---|
| Neue, mit Supabase CLI erzeugte Migrationen `*_subjects_content_v2.sql` und `*_school_activation.sql` | Getrennte additive Schritte für Fächer/Snapshots und Aktivierung; eine bereits angewandte Migration bleibt unverändert |
| Bestehend `supabase/migrations/202610250001_schools.sql` | Unveränderte historische Basis, weiterhin in lokalen Migrationsprüfungen enthalten |
| Bestehend `school-data.js`, `school.js` | Preisvorschau, Fachwahl, V1/V2-Klassenimport und Aktivierungsanzeigen |
| Bestehend `supabase/functions/_shared/server.ts` | Serverseitiger Preis und verlässliche Stripe-Zustandsauswertung |
| Bestehend `voci-billing/index.ts`, `voci-stripe-webhook/index.ts` | Zahlungsmittelvorbereitung, Tarifwechsel und Zahlungsereignisse |
| Neu `supabase/functions/voci-activation-worker/index.ts` | Wiederholbare Aktivierungen, Fristen und automatische erste Belastung |
| Neu `supabase/functions/_shared/activation.ts` | Zustandsregeln des Workers, getrennt von dessen HTTP-Einstieg für lokale Tests |
| Bestehend `voci-mail-worker/index.ts`, neue SQL-Mailvorlagen | Freigabe-, Aktivierungs- und bestehende individuelle Benachrichtigungen |
| Neu `scripts/reprice-subscriptions.mjs` | Einmaliger, vorab sichtbarer und wiederholbarer Wechsel tatsächlich vorhandener Stripe-Abos |
| Bestehend/neu `tests/schools-db.test.js`, `billing.test.mjs`, `billing-activation.test.mjs`, `reprice-subscriptions.test.mjs`, `school-data.test.js`, `school-ui.test.js` | Zugriffe, Grenzen, Zeit- und Zahlungsabläufe |

## Task S1: Fächer, Snapshots und Klassenrechte erweitern

**Files:** neue Migration; `school-data.js:parseClassExport`, `school.js:editExam/renderClass`; `app.js`-Schulcallbacks; DB-/Daten-/UI-Tests.
**Interfaces:** Bestehende RPC-Namen `public.voci_school`, `voci_school_snapshot` und `voci_billing_context` erhalten. `save_exam` akzeptiert `{class_id, title, exam_date, set_data: StudySnapshotV2}`; `voci_private.valid_set(d jsonb)` unterstützt Legacy und V2. UI-Auswahl verwendet U2s `hooks.contentPicker(subjectId, blocks)`.

- [ ] Lokale DB-Tests zuerst erweitern: V1-Englischprüfung bleibt gültig; V2-Mathe und kombinierte Englisch-/Grammatikprüfung sind gültig; fremdes Fach, unbekannter Block und privater Lernstand im Snapshot sind ungültig. Englisch-Einzelabo kann keine Matheprüfung speichern.
- [ ] Supabase CLI mit `--help` prüfen; neue Migration per `supabase migration new subjects_content_v2` erzeugen. Fünf Fächer additiv eintragen; bestehende `en/fr`-IDs erhalten. Jede Variante gegen frische Basis und vorhandene Schultabellen prüfen; keine produktiven Tabellen zurücksetzen.
- [ ] `valid_set` mit maximal 1 MB Snapshot, höchstens einem Block je Typ und höchstens 2000 IDs je Auswahl erweitern. IDs sind nichtleere Strings mit höchstens 300 Zeichen. Blocktyp und Fach müssen zusammenpassen; Fortschritt, Antworten, Namen von Schülern und beliebige HTML-Felder gehören nicht in Inhaltsauszüge.
- [ ] Fachzugriff beim Speichern und Ändern von Prüfungen explizit für `subjectId` prüfen. Klassenverwaltung und allgemeine Lehrpersonenrolle allein gewähren keinen Zugriff auf ein ungebuchtes Fach. Schulpakete umfassen alle fünf Fächer.
- [ ] Klassenexport `voci-class` Version 2 für neue Inhaltsauszüge ergänzen; Import von Version 1 weiter akzeptieren. UUIDs, Schule, Datum und Rechte prüfen; keine Konten durch Import anlegen. Lehrpersonenzuordnungen müssen zur Schule passen.
- [ ] Bestandsregeln nochmals gezielt prüfen: schulbezogene Nutzernamen `vorname.nachname`, Zähler ab 1; keine Selbstabmeldung aus Klassen; mehrere Klassenlehrpersonen; 7-Tage-/Verwendungslimit je Code; wiederholt neue Codes; Export vor endgültiger Klassenlöschung; unabhängige Setkopie. Vorhandene Umsetzung wiederverwenden.
- [ ] `node --test tests/school-data.test.js tests/schools-db.test.js tests/school-ui.test.js` mit DB-/Browserumgebung ausführen. Mit normalen Nutzerrollen testen; Operator-/Service-Schlüssel darf verbotene Zugriffe nicht versehentlich verdecken.
- [ ] Migration, App-Anpassungen und Tests dieser Aufgabe committen.

## Task S2: Antrag, Folgetag und Aktivierungszustand modellieren

**Files:** neue, per `supabase migration new school_activation` erzeugte Migration; `_shared/activation.ts`; `school.js`; DB-/Aktivierungsprüfungen. Die S1-Migration bleibt unverändert.
**Interfaces:** Neue Tabelle `voci_private.school_activations` mit genau einer Zeile pro Schule: `school_id`, `approved_at`, `scheduled_at`, `activated_at`, `free_until`, `status`, Stripe-Zuordnungen und Wiederholungszustand. `admin_requests` erhält `completed_at`, `review_due_at` und einen nur vom Betreiber setzbaren Verzugsgrund. Snapshot liefert `activation` mit lesbaren Zeit-/Statusangaben. Service-RPCs `voci_claim_activations(batch_size)` und `voci_finish_activation(school_id, outcome)` bereiten die wiederholbare Verarbeitung in S3 vor.

- [ ] Zeit-/Rollentests zuerst: Freigabe am 28.10.2026 um 15:00 Zürich → Start 29.10.2026 um 00:00; Freigabe unmittelbar vor/nach Mitternacht und an beiden Zeitumstellungstagen ergibt immer nächsten lokalen Kalendertag. Kein `+86400000` als Ersatz für Kalenderlogik.
- [ ] Vollständigkeit des Antrags und Frist serverseitig festhalten; Unterlagen-/Berechtigungsprüfung bleibt bei Voci mit Schul-E-Mail. Die Frist startet mit vollständigen nötigen Nachweisen und wird nicht wegen eines intern verspätet gesetzten Status verschoben. Kartenbereitstellung verlängert die Prüffrist nicht.
- [ ] Betreiberfreigabe atomar machen: Rolle/Schule bestätigen, beim erstmaligen Schulabo `scheduled_at` berechnen, Adminverwaltung sofort ermöglichen und Freigabemail vormerken. Nachträgliche Bestätigung weiterer Admins einer aktiven Schule verändert das Abo nicht.
- [ ] Zugriff als Zustandsmodell umsetzen: `scheduled`, `awaiting_payment`, `active`, `free_month`, `payment_failed`; abgelaufene Aboperiode weiter über den bestätigten Abostand behandeln. Einladungen sind ab Genehmigung möglich, Unterricht vor Start bleibt gesperrt. Ein genehmigter Freimonat erhält `free_until` nach einem Kalendermonat und nicht nach pauschal 30 Tagen.
- [ ] Die vorhandene 30-Tage-Freigabeprüfung aus RPCs, Reservierungen und UI entfernen. Keine unbegrenzte Stripe-Session erzeugen; bei abgelaufener technischer Session darf ein Berechtigter eine neue anfordern.
- [ ] Voci-Verzug >14 Tage nur anhand Betreiberentscheidung/Begründung und Fristdaten gewähren; genau einen Freimonat je Erstaktivierung. Kündigungswunsch kann erfasst werden, die vereinbarte Mindestdauer bleibt ein bezahlter Monat; Gratismonat ist davon getrennt.
- [ ] `node --test tests/schools-db.test.js` und `node --experimental-strip-types --test tests/billing-activation.test.mjs` ausführen: zweiter Admin, wiederholte Freigabe, Fristgrenze, Freimonat und Rollen vor/nach Start.
- [ ] S2 committen; U4 nutzt die verbindlichen Zustände für die Anzeige.

## Task S3: Preise, Zahlungsmittel und erste Belastung verbinden

**Files:** `_shared/server.ts`, `_shared/activation.ts`, `voci-billing`, `voci-stripe-webhook`, neuer Worker; `school-data.js`, `school.js`; Billing-/DB-Tests.
**Interfaces:** Bestehendes `price(plan, subjects, allowed) -> amountInRappen` bleibt erhalten; `individualPrice(count) -> CHF` nutzt dieselbe Staffel für 1–5 Fächer und weist andere Anzahlen ab. Neue Billing-Aktion `prepare_payment_method` richtet künftige Zahlung ein, zieht aber keinen Monatspreis ein. Die in S2 angelegten Service-RPCs sind ausschliesslich für den Worker freigegeben.

- [ ] Tariftests zuerst auf `[300,500,700,800,900]`, Schule 4000/10000 aktualisieren. Unbekannte oder doppelte Fach-IDs werden abgewiesen. Browseranzeige und Serverberechnung werden mit denselben Fällen geprüft; die Serverberechnung entscheidet.
- [ ] Gegen die bei Umsetzung aktuelle Stripe-Dokumentation eine gehostete Setup-Session für wiederkehrende Kartenzahlung einrichten. Vor der ersten Belastung wird nur die Zahlungsmethode bei Stripe hinterlegt und der Zahlungsauftrag verständlich bestätigt. In Voci nur Stripe-IDs speichern. Individuelle Lehrpersonenabos behalten ihren normalen Buchungsablauf nach Rollenprüfung; der Folgetag betrifft Schulaktivierungen.
- [ ] Worker über eng authentifizierten Cron-Aufruf starten: fällige Schule mit begrenzter Lease beanspruchen, aktuellen Stand prüfen, genau einen Abo-/Zahlungsvorgang auslösen und Ergebnis festhalten. Idempotency-Key aus Schul-ID und Aktivierungsversion bilden, nicht aus einem neuen Zufallswert bei jedem Wiederholungsversuch.
- [ ] Am Folgetag bei vorhandener Zahlungsmethode ohne Freimonat Zahlung auslösen; Rechte nach bestätigter Zahlung aktivieren. Fehlt die Methode oder verlangt Stripe weitere Bestätigung, Status und geschützte Fortsetzungsaktion anzeigen. Datum der erfolgreichen Zahlung startet den bezahlten Monat; vor diesem Erfolg kein Unterrichtszugriff.
- [ ] Beim gewährten Freimonat Zugriff zum vorgesehenen Start ohne Einzug freigeben, erste Belastung erst zum Ende des Kalendermonats. Freimonat, erste bezahlte Periode und frühester Kündigungstermin werden unabhängig gespeichert und angezeigt.
- [ ] Webhook-Verarbeitung um die nötigen Zahlungs-/Setup-Ereignisse ergänzen. Signatur und Ereignis-Deduplizierung erhalten; aktuellen Stripe-Stand nachladen. Ein `checkout=success`-/`billing=success`-Parameter oder vom Browser gemeldetes «bezahlt» erteilt keine Rechte. Verarbeitung funktioniert auch, wenn Worker vor dem Webhook oder nach ihm beendet wird.
- [ ] 50er-Grenze mit offenen Einladungen atomar weiter durchsetzen; 51. Platz nur mit grossem Paket. Reine Admins bleiben ausserhalb der Zählung. Bestehende Upgrades samt anteiligem Guthaben und neuem Monatsbeginn erhalten; freiwillige spätere Reduktionen können weiter zum Periodenende gelten. Die einmalige neue Preisversion in S4 ist davon getrennt.
- [ ] `node --experimental-strip-types --test tests/billing.test.mjs tests/billing-activation.test.mjs` und DB-Tests ausführen. Doppelter Cron/Webhook, verspätete Nachricht, abgebrochene Setup-Session, zusätzliche Kartenbestätigung und Zahlungsfehler abdecken. Im Stripe-Testmodus mit kontrollierter Uhr Erstaktivierung, Verlängerung, Freimonat und Kündigung prüfen.
- [ ] S3 committen. Keine tatsächlichen bestehenden Abos allein durch neue Codebereitstellung unkontrolliert ändern.

## Task S4: Preiswechsel, Mails und kontrollierte Einführung vorbereiten

**Files:** `scripts/reprice-subscriptions.mjs`; neue Preiswechsel-Nachweise; Migration/Worker-Konfiguration; `SUPABASE.md`, Schul-/AGB-/Datenschutzentwürfe; Mailvorlagen und Tests.
**Interfaces:** `node scripts/reprice-subscriptions.mjs --dry-run` produziert einen lokal geschützten Bericht mit Abo-Referenz, altem/neuem Tarif und berechneter Umstellung. `--apply --report <path>` führt nur die konkret geprüfte Menge mit stabiler Umstellungsversion aus. Keine Geheimnisse oder persönlichen Daten im Git-Bericht.

- [ ] `tests/reprice-subscriptions.test.mjs` zuerst mit gemocktem Stripe ergänzen: Dry-run schreibt kein Abo, zweimaliges Apply verursacht eine Umstellung, veralteter Bericht bricht ab, gekündigte Abos behalten ihr Enddatum, unbeglichene Rechnung wird zur Einzelprüfung markiert.
- [ ] Unmittelbar vor Ausrollung aktuelle Supabase-Schemata, Migrationen und tatsächliche Stripe-Abos lesen. Gibt es keine bestehenden Abos, entfällt die echte Preiswechselaktion; der neue Tarif wird trotzdem getestet.
- [ ] Neue Preisversion für Bestandsabos vorbereiten: Restguthaben/Restforderung anteilig, neuer Monatsbeginn am Umstellungstag, wiederholte Ausführung ohne weitere Rechnung. Bereits gekündigte Abos und offene Rechnungen separat im Bericht kennzeichnen; keine Kündigung aufheben oder deren Enddatum still verschieben.
- [ ] Preiswechsel zunächst im Stripe-Testmodus prüfen, einschliesslich Senkung eines Einzelabos von CHF 5 auf CHF 3, Erhöhung der Schulpakete und vorhandener Tarifwechselplanung. Bei unvereinbaren Sonderzuständen keine automatische Belastung, sondern konkrete Einzelprüfung.
- [ ] `node --experimental-strip-types --test tests/reprice-subscriptions.test.mjs` ausführen; Bericht vor Apply gegen den aktuellen Abo-/Rechnungsstand prüfen und bei Abweichung eine neue Vorschau verlangen.
- [ ] Vorhandene individuellen Benachrichtigungseinstellungen für Prüfungen, Kündigungen und Adminwechsel erhalten. Freigabemail nennt den Aktivierungstag; Zahlungsproblem nennt die nötige Aktion. Optional abschaltbare Nachrichten bleiben pro Kategorie abschaltbar; notwendige Konto-/Zahlungsmitteilungen werden im Einstelltext als solche kenntlich gemacht.
- [ ] Absender `fuerschule65@gmail.com` und bestehenden Mail-Worker weiterverwenden, soweit konfiguriert. Lokale und Vorschautests nur mit abgefangenen Nachrichten/Testempfängern. Wiederholungen dürfen keine zusätzliche Begrüssungs-/Freimonatsmail erzeugen.
- [ ] Vor Live-Einsatz DB- und Zugriffsprüfungen mit echten Rollen sowie Supabase-Sicherheitsberater ausführen; private Schemas nicht direkt freigeben. Chronologie dokumentieren: additive Migration → kompatible Funktionen/Worker → neue UI → kontrollierter Tarifwechsel. Vorher Backup und Rückfall auf kompatible Version vorbereiten; neue Fachsets dürfen beim UI-Rückfall nicht gelöscht oder als Englisch gespeichert werden.
- [ ] Einrichtungsschritte, Cron-Authentifizierung und benötigte Secrets dokumentieren; 30-Tage-Regel und alte Preise aus nutzerrelevanter Dokumentation entfernen. Betreiber-/Steuer-/Vertragsfreigabe bleibt vor echten Einzügen erforderlich.
- [ ] P1 eine konkrete Vorschau und Umstellungsliste übergeben. Nach den erfolgreichen Gesamttests und der Sicherheitsprüfung übernimmt P2 des Gesamtplans den beauftragten GitHub-Push und die Supabase-Anpassungen.

## Offizielle Dokumentation bei Umsetzung erneut prüfen

- Stripe Zahlungsmittel ohne Einzug vorbereiten: https://docs.stripe.com/payments/checkout/save-and-reuse
- Anteilsberechnung: https://docs.stripe.com/billing/subscriptions/prorations
- Zahlungs-/Aboereignisse: https://docs.stripe.com/billing/subscriptions/webhooks
- Supabase Änderungen: https://supabase.com/changelog
- Supabase Zugriffsregeln: https://supabase.com/docs/guides/database/postgres/row-level-security

Die genannten Abläufe sind technische Planungsentscheidungen zur Erfüllung des vereinbarten Starts. Beispielsweise kann eine zusätzliche Kartenbestätigung den tatsächlichen Zahlungszeitpunkt verschieben; dieser Fall bekommt einen sichtbaren Zustand statt eines unerfüllbaren Versprechens einer garantierten Mitternachtsbelastung.
