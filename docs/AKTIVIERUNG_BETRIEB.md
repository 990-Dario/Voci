# Schulaktivierung: Einrichtung und Betriebsprüfung

Stand: 1. November 2026. Die Funktionen sind lokal vorbereitet. Diese Anleitung bestätigt keine produktive Einrichtung.

## Voraussetzungen

Die drei Migrationen unter `supabase/migrations` werden in ihrer zeitlichen Reihenfolge benötigt. Vor der Anwendung den tatsächlichen Projektbestand, eine Sicherung und den Rückfallweg prüfen. Bestehende Lernstände werden nicht zurückgesetzt.

Für die erste Prüfung eine getrennte Testumgebung mit Stripe-Testschlüsseln verwenden. Das Stripe-Testkonto ist derzeit noch nicht eingerichtet. Test- und Live-Webhooks, Schlüssel und Supabase-Projekte dürfen nicht vermischt werden.

## Serverfunktionen und Geheimnisse

Bereitzustellen sind `voci-billing`, `voci-stripe-webhook`, `voci-activation-worker` und für Nachrichten `voci-mail-worker`. Die Einstellungen in `supabase/config.toml` gehören zur Bereitstellung.

| Einstellung | Zweck |
|---|---|
| `VOCI_APP_URL` | Vollständige Website-Adresse; bestimmt erlaubte Browserherkunft und Rückleitung |
| `STRIPE_SECRET_KEY` | Stripe-Serverzugriff, zunächst ausschliesslich Testschlüssel |
| `STRIPE_WEBHOOK_SECRET` | Signaturprüfung des Endpunkts der jeweiligen Umgebung |
| `VOCI_ACTIVATION_WORKER_SECRET` | Eigenes langes Zufallsgeheimnis für den Aktivierungsaufruf |
| `VOCI_MAIL_WORKER_SECRET` | Anderes Zufallsgeheimnis für den Mail-Aufruf |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Vom Absender autorisierter Gmail-Zugriff |

Die Supabase-eigenen Servervariablen werden vom Funktionsdienst bereitgestellt. Geheimnisse gehören ausschliesslich in die Serverkonfiguration beziehungsweise den geschützten Speicher des Zeitplandienstes. `.env.example` enthält nur Platzhalter. Der Browser erhält keinen Service-Schlüssel und keine Kartendaten.

## Stripe-Ereignisse

Den Webhook auf die bereitgestellte Funktion `voci-stripe-webhook` richten. Die implementierte Verarbeitung benötigt:

- `checkout.session.completed` für Karteneinrichtung und abgeschlossene Buchung;
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`;
- `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`.

Die Funktion prüft die Signatur und lädt den aktuellen Stripe-Stand. Eine erfolgreiche Browser-Rückleitung allein vergibt keine Rechte. Abos dürfen erst mit bestätigter Zahlung oder einem ausdrücklich gewährten Freimonat Unterrichtsrechte erhalten.

## Wiederkehrende Aufrufe

Einen serverseitigen Zeitplan einrichten, der mindestens einmal pro Minute einen HTTP-POST an die bereitgestellte Funktion `voci-activation-worker` sendet. Der Header `Authorization` muss `Bearer ` gefolgt vom **Aktivierungsgeheimnis** enthalten. Das Geheimnis geschützt speichern und nicht im Website-Code, in öffentlich lesbaren Zeitplantexten oder Protokollen ablegen.

Der Worker fragt fällige Aktivierungen ab und verarbeitet höchstens fünf je Aufruf. Die Datenbank reserviert Arbeit gegen gleichzeitige Aufrufe. Vor dem vorgesehenen Schweizer Kalendertag wird nicht belastet. Ein fehlendes Zahlungsmittel ergibt einen wartenden Zustand, ein Zahlungsproblem eine notwendige Aktion für den Administrator.

`voci-mail-worker` separat regelmässig aufrufen, mit seinem eigenen Geheimnis. Vor der Freigabe nur Testkonten und abgefangene beziehungsweise ausdrücklich bestimmte Testempfänger verwenden. Der Gmail-Absender muss durch seinen Inhaber autorisiert sein.

## Abnahmeszenarien

- [ ] Aufruf ohne oder mit falschem Geheimnis wird abgelehnt.
- [ ] Freigabe vor Mitternacht sowie an beiden Zeitumstellungstagen startet frühestens am nächsten Tag um 00:00 Uhr in Zürich.
- [ ] Doppelter Worker-Aufruf verarbeitet dieselbe Aktivierung nicht gleichzeitig.
- [ ] Kartenhinterlegung zieht noch keinen Monatspreis ein.
- [ ] Normale Erstzahlung, Kartenbestätigung und abgebrochener Checkout werden mit Stripe-Testkarten durchgespielt.
- [ ] Wiederholung nach Timeout erzeugt keine zweite Belastung; veraltete Webhooks überschreiben keinen neueren Zustand.
- [ ] Freimonat endet nach einem Kalendermonat; der erste bezahlte Monat bleibt davon getrennt.
- [ ] Kündigung vor Aktivierung sowie nach erster Zahlung erhält den vorgesehenen Nutzungszeitraum.
- [ ] Ein ausgefallener Zeitplan wird wieder aufgenommen; wartende Schulen werden nachvollziehbar verarbeitet.
- [ ] Nachrichten respektieren die individuellen Schalter und gehen ausschliesslich an die vorgesehenen Testempfänger.

## Störungen und Freigabe

Fehlgeschlagene Funktionsaufrufe und länger wartende Aktivierungen kontrollieren. Bei unklarer Stripe-Zuordnung oder möglicher Doppelbuchung keine Reservierungen, Ereigniskennungen oder Abo-IDs von Hand löschen, um einen neuen Versuch zu erzwingen. Zuerst Zahlungsanbieter und Datenbankzustand vergleichen; ein erneuter Versuch muss dieselbe Buchung wiedererkennen.

Ein erfolgreicher lokaler Test ersetzt diese Betriebsprüfung nicht. Echte Einzüge und automatische produktive Worker-Aufrufe erst nach erfolgreichem Stripe-Test, Rechteprüfung und Freigabe der Vertrags-/Anbieterangaben aktivieren. GitHub und Supabase werden danach in der im Gesamtplan beschriebenen Reihenfolge aktualisiert.
