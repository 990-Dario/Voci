# Spezifikation: Schulen und Lehrpersonen

Abgestimmte Anforderungen; die optionale Erweiterung ist im Projekt implementiert. Produktive Aktivierung und externe Anbindungen: siehe [Schulfunktionen einrichten](SCHULFUNKTION_EINRICHTEN.md).

## Rollen und Schulen

- Jede Schule hat eine interne eindeutige ID; Schüler müssen diese ID nicht sehen.
- Eine Schule wird durch Name, Postleitzahl und Ort beschrieben. Bei abweichendem Namen mit bereits verwendeter PLZ wird auf mögliche Duplikate hingewiesen. Identische Einträge sollen nicht versehentlich doppelt angelegt werden.
- Schüler können bei der Registrierung eine bestehende Schule wählen oder eine neue hinzufügen. Die Nutzung der Schülerfunktionen setzt kein Schulabo voraus.
- Ein Administratorantrag muss mit einer E-Mail-Adresse der Schule gestellt und von Voci bestätigt werden. Niemand wird allein durch Auswahl einer Schule Administrator.
- Ein Wechsel der Administration wird vom aktuellen Admin bestätigt oder nach Kontaktaufnahme und Berechtigungsnachweis durch Voci geprüft.
- Pro Schule sind höchstens fünf Administratoren möglich. Administratoren verwalten die Lehrpersonen ihrer Schule.
- Schülerkonten erhalten eine interne ID. Der Nutzername wird aus `vorname.nachname` gebildet; bei Namensgleichheit innerhalb derselben Schule werden fortlaufend Ziffern angehängt (`vorname.nachname1`, `vorname.nachname2` usw.). Schüler müssen die interne ID nicht sehen. Gleiche Namen an verschiedenen Schulen sind erlaubt.
- Ein Administrator kann zugleich Lehrperson sein oder ausschliesslich Administrator. Ausschliessliche Administratoren unterrichten keine Klassen und zählen nicht zur Preisgrenze von 50 Lehrpersonen.

## Klassen

- Mehrere Lehrpersonen können dieselbe Klasse verwalten.
- Für jeden Beitrittscode legt die Lehrperson die maximale Zahl an Teilnahmen fest. Der Code verfällt bei Erreichen dieses Limits oder sieben Tage nach Erstellung. Die Lehrperson kann weitere Codes für dieselbe Klasse erstellen; das Limit gilt pro Code und begrenzt nicht die Gesamtgrösse der Klasse.
- Lehrpersonen können Schüler aus einer Klasse entfernen; Schüler können eine Klasse nicht selbst verlassen.
- Vor dem Löschen einer Klasse kann ihr Inhalt exportiert werden. Gelöschte Klasseninhalte werden nach sieben Tagen serverseitig endgültig entfernt. Ein vollständiger Klassenimport ist vorgesehen.
- Export und Import verwenden eine versionierte JSON-Datei (UTF-8), damit Klassen, Prüfungen und Zuordnungen strukturiert und wieder importierbar bleiben. Zugangsdaten und unnötige personenbezogene Daten werden nicht exportiert. Importdateien werden validiert; interne IDs werden neu vergeben und Verknüpfungen wiederhergestellt.
- Löschfristen müssen auch Backups und Fehlerfälle berücksichtigen; technische Aufbewahrungsfristen sind vor Umsetzung festzulegen.

## Prüfungen und Benachrichtigungen

- Lehrpersonen können Klassenprüfungen erstellen, bearbeiten, verschieben und löschen. Änderungen an der Klassenprüfung erscheinen bei allen Klassenmitgliedern.
- Schüler können eine Prüfung in ein eigenes Lernset kopieren. Die Kopie wird danach unabhängig weitergeführt; die Klassenprüfung bleibt bestehen.
- Schüler erhalten bei einer neu erstellten Klassenprüfung eine E-Mail. Lehrpersonen erhalten eine E-Mail bei Kündigung des Schulabos und bei einem Wechsel der Administration.
- Benachrichtigungen sind je Kategorie in den Kontoeinstellungen abschaltbar. Notwendige Sicherheits- und Vertragsmitteilungen sind davon getrennt zu behandeln.
- Vorläufiger Absender: `fuerschule65@gmail.com`. Versanddienst, Zustellbarkeit, Absenderdomain und Datenschutz des Anbieters sind vor Produktivbetrieb zu prüfen.

## Abonnement und Preise

- Einzelne Lehrpersonen wählen Fächer individuell: Das erste Fach kostet CHF 3.– pro Monat. Das zweite und dritte Fach kosten je CHF 2.– zusätzlich; jedes weitere Fach kostet CHF 1.– zusätzlich. Für ein bis fünf Fächer sind das CHF 3.–, 5.–, 7.–, 8.– und 9.– pro Monat.
- Schulen erhalten alle Fächer. Das Schulpaket kostet CHF 40.– pro Monat bei bis zu 50 zählenden Lehrpersonen und CHF 100.– pro Monat bei mehr als 50. Schülerzahlen sind unbegrenzt und ändern den Preis nicht.
- Zur 50er-Grenze zählen Lehrpersonen und Administratoren, die zugleich Lehrpersonen sind. Ausschliessliche Administratoren zählen nicht mit.
- Bei mehr als 50 zählenden Lehrpersonen muss auf das grössere Paket upgegradet werden. Bei höchstens 50 und dem grösseren Paket erscheint ein Hinweis, dass aktuell mehr als nötig bezahlt wird.
- Schulberechtigung wird vor einer Zahlung geprüft. Der Administrator kann ab Bestätigung Lehrpersonen einladen. Der Unterrichtszugriff und der bezahlte Monat beginnen frühestens am Folgetag um 00:00 Uhr Schweizer Zeit und nach bestätigter Zahlung. Bei einer von Voci verursachten Prüfung über 14 Tage erhält die Schule einen Gratismonat. Die monatliche Periode wird bezahlt, die Kündigung ist jederzeit möglich und wird zum bezahlten Ende wirksam.
- Upgrades sind jederzeit möglich; ein anteiliges Restguthaben soll angerechnet und ab dem Upgrade-Datum monatlich abgerechnet werden. Berechnung, Rückerstattungen und Abrechnungszeitpunkt müssen vor Umsetzung verbindlich spezifiziert werden.
- Kündigung des Abos löst eine E-Mail an die Lehrpersonen der Schule aus, sofern deren entsprechende Benachrichtigung aktiv ist.

## Noch vor Umsetzung festzulegen

1. Implementierte Standardregel bestätigen: Ein Upgrade ist vor Aufnahme der 51. Lehrperson nötig; ein Downgrade gilt ab der nächsten bezahlten Periode und begrenzt neue Einladungen bereits auf 50.
2. Mehrwertsteuerbehandlung und Rechnungsdaten finalisieren. Stripe berechnet anteilige Gutschriften und den neuen Monatsbeginn beim Upgrade.
3. Welche Identitäts- und Berechtigungsnachweise Voci akzeptiert und wie lange Anträge gespeichert werden.
4. Löschfristen für Backups und Wiederherstellungen.
5. Maildienst, Absenderdomain, Empfängerauswahl und notwendige Transaktionsmails.
6. Datenschutzrollen von Schule und Voci, Auftragsbearbeitungsverträge und Verfahren für Minderjährige.
