# Fächer und Preismodell für Voci

**Stand:** 28. Oktober 2026  
**Zweck:** Entwurf zur Erweiterung der Schüler- und Schulplattform um fünf Fächer, neue Lerninhalte, ein angepasstes Preismodell und die neue Aktivierung einer Schule.

**Erweiterung des Auftrags:** Der Nutzer verlangt zusätzlich eine vollständige UI- und Typografieüberarbeitung. «Topografie» wurde ausdrücklich als Schriftgestaltung geklärt. Siehe [UI- und Typografiebrief](2026-10-28-ui-und-typografie-brief.md) und [Gesamtumsetzungsplan](../plans/2026-10-28-gesamtumbau.md).

## Ziel

Voci soll neben den bestehenden Vokabellisten einen klaren Einstieg für Deutsch, Englisch, Französisch, Mathematik und Geografie anbieten. Die bisherigen englischen und französischen Vokabeln bleiben erhalten. Deutsch, Englisch und Französisch erhalten Grammatikbereiche. Geografie deckt Staaten nach Kontinent und die Schweizer Kantone ab. Mathematik startet mit den genannten Flächen-, Umfangs-, Volumen- und Pythagoras-Themen. Individuelle Lehrpersonenpreise und Schultarife werden gemeinsam mit diesem fachlichen Ausbau angepasst.

Nach Bestätigung eines Schuladministrators darf dieser sofort Lehrpersonen einladen. Die Einladungen und Rollen werden erst am Kalendertag danach für Unterrichtsfunktionen freigeschaltet; an diesem Tag beginnt auch die bezahlte Abo-Periode. Der Administrator wird am Bestätigungstag informiert. Die frühere Anforderung einer 30-tägigen Zahlungslink-Gültigkeit entfällt.

## Nutzer und Erfolg

- Schüler wählen ein Fach und passende Inhalte und können damit persönliche Lernsets, Übungen und Fortschritt führen.
- Lehrpersonen können die für ihre Fächer freigegebenen Klassen- und Prüfungsfunktionen verwenden.
- Schuladministratoren können ihre Schule und Lehrpersonen verwalten; sie können Lehrpersonen bereits am Tag der eigenen Bestätigung einladen.
- Die Preisberechnung ist im Frontend nachvollziehbar und wird auf dem Server verbindlich validiert.
- Der Ausbau lässt bestehende Englisch-/Französisch-Vokabeldaten, Lernsets, Ergebnisse und Konten intakt.

## Ansätze

1. **Fächer einzeln nacheinander ergänzen.** Geringere Einzelschritte, aber wiederholte Umbauten an Auswahl, Abo, Klassenprüfung und Datenmodell.
2. **Gemeinsame Fach- und Inhaltsstruktur, alle fünf Fächer als ein zusammenhängender Ausbau.** Einmalige Anpassung von Auswahl, Fachzugriff und Preisen; die Inhalte verwenden passende Lernmodule je Fach. **Gewählt**, weil der Nutzer neue Fächer und Preise gemeinsam umgesetzt haben möchte.
3. **Zusätzlich den Lehrer-Prüfungsgenerator in denselben Umbau integrieren.** Einheitliches Endprodukt, aber deutlich grösserer Umfang: PDF-Erzeugung, Aufgabengeneratoren, Lösungsschlüssel und Klassenverteilung würden gleichzeitig eingeführt.

Der Prüfungs-PDF-Generator bleibt ein anschliessender eigener Ausbauschritt. Die Inhaltsstruktur dieses Projekts muss ihn später ermöglichen, aber diese Änderung liefert noch keinen PDF-Generator.

## Fachlicher Umfang

### Fächer und Lerninhalte

- **Englisch:** bestehende Vokabeln beibehalten und um Grammatik erweitern.
- **Französisch:** bestehende Vokabeln beibehalten und um Grammatik erweitern.
- **Deutsch:** Grammatikbereich ergänzen. Eigene deutsche Wortschatzlisten sind nicht Teil dieses Auftrags.
- **Geografie:** Staaten der Welt, nach Kontinenten filterbar; zusätzlich Schweizer Kantone.
- **Mathematik:** Aufgaben zu Umfang und Fläche von Rechteck, Quadrat, Rhombus, Rhomboid, Kreis und Dreieck (gleichseitig, gleichschenklig, rechtwinklig und allgemeines Dreieck); Volumen von Quader, Würfel, Pyramide, Kugel und Prisma; Satz des Pythagoras.

Lerninhalte und Lernstand müssen auch über Fächer hinweg persistent bleiben und bei Schulprüfungen fachbezogen abrufbar sein. Lernziele und Themen dürfen nicht mehr ausschliesslich als Sprach- und Vokabel-`objectives` modelliert sein.

### Fachmodule und Bedienung

Die bestehende Vokabelansicht bleibt als Modul erhalten. Grammatik erhält thematische Einheiten mit knapper Erklärung und Übung. Der Startkatalog umfasst:

- **Deutsch Primarstufe:** Nomen, Verben und Adjektive; Präsens, Präteritum und Perfekt; Personalformen und Infinitiv; Wortstamm und Wortfamilien; einfache Satzglieder und Fälle.
- **Deutsch Sekundarstufe:** Pronomen, Partikeln, Präpositionen und Konjunktionen; vier Fälle; Futur und Plusquamperfekt; Subjekt und Objekt; einfache und zusammengesetzte Sätze; Indikativ, Imperativ, Konjunktiv I/II, Aktiv und Passiv; direkte und indirekte Rede.
- **Englisch Primarstufe:** Personalpronomen, `be` und `have`, Artikel und Plural; Satzstellung, Fragen und Verneinung; Simple Present, Present Continuous und einfache Vergangenheitsformen; Possessivformen und Adjektivsteigerung.
- **Englisch Sekundarstufe:** Zeitformen und Hilfsverben; Fragen und Verneinung; Modalverben; Pronomen; Adjektivsteigerung; Präpositionen und Konjunktionen; Relativsätze, Bedingungssätze, Passiv und reported speech.
- **Französisch Primarstufe:** Artikel, Geschlecht und Mehrzahl; Subjektpronomen; présent von `être`, `avoir` und häufigen Verben; Verneinung und einfache Fragen; Adjektivübereinstimmung und Possessivbegleiter.
- **Französisch Sekundarstufe:** présent und häufige unregelmässige Verben; passé composé und imparfait; futur proche; Imperativ; Verneinung und Fragen; Objektpronomen; Adjektivübereinstimmung und Steigerung; Relativsätze und conditionnel.

Diese Themenliste ist ein eigener Grundkatalog, keine Kopie aus einem Lehrmittel. Sie folgt dem Kompetenzaufbau des Lehrplans 21 von einfachen zu anspruchsvolleren Strukturen und muss vor Veröffentlichung mit den konkreten Lehrmitteln und kantonalen Vorgaben abgeglichen werden.

Geografie erhält eine interaktive Karte mit Ländergrenzen. Staaten, deren Umrisse zu klein für eine zuverlässige Auswahl sind, werden zusätzlich durch anklickbare Punkte dargestellt. Für Regionsfilter wird die Hierarchie der UN-Statistikregionen (M49) verwendet: jedes Land bzw. Gebiet gehört dort zu genau einer Subregion. Die aktuelle UN-Regionseinteilung ist laut UN für Statistikzwecke bestimmt und keine Aussage zur politischen Zugehörigkeit. https://unstats.un.org/unsd/methodology/m49/

Vor einer Runde wählt der Schüler den Umfang der Kartenfragen aus zwei Katalogen:

1. **UN-Mitgliedstaaten und Beobachterstaaten (195):** die 193 UN-Mitgliedstaaten sowie die beiden Beobachterstaaten Heiliger Stuhl und Staat Palästina. https://www.un.org/about-us/member-states und https://research.un.org/en/unmembers/observers
2. **Olympische Komitees:** die Länder und Gebiete der vom IOC anerkannten Nationalen Olympischen Komitees. Das IOC führt aktuell 206 NOCs; dieser Katalog kann deshalb Gebiete enthalten, die kein UN-Mitgliedstaat sind. https://www.olympics.com/ioc/national-olympic-committees

Die beiden Kataloge verwenden dieselben Karten-, Kontinent- und Regionsfilter sowie dieselben Spielmodi. Ein Eintrag, der im gewählten Katalog enthalten ist, zählt als eigene Frage; doppelte geografische Einträge werden über stabile Codes vermieden. Katalogname und Datenstand werden in der Auswahl angezeigt. UN M49 dient ausschliesslich der geografischen Filterung und bildet keinen zusätzlichen Fragenkatalog.

Zwei Geografie-Modi:

1. **Land auf der Karte finden:** Voci zeigt zufällig einen Ländernamen. Der Schüler klickt die passende Fläche oder den Punkt an. Der gleiche Kartenablauf gilt für die Schweizer Kantone.
2. **Land benennen:** Die Karte markiert/blinkt das gesuchte Land. Der Schüler tippt den Namen in ein Textfeld. Eine einblendbare Liste zeigt auf Wunsch alle möglichen Ländernamen; sie kann wieder ausgeblendet werden. Kantone funktionieren entsprechend.

Ergebnisstufen je Land/Kanton: beim ersten Versuch richtig = grün und 100 Punkte; nach einem Fehler richtig = gelb und 75; nach zwei Fehlern richtig = orange und 50; nach drei Fehlern richtig = rot und 25. Nach vier Fehlversuchen blinkt die richtige Fläche; wenn der Schüler sie danach anklickt, wird sie schwarz und erhält 0 Punkte. Der Rundenwert ist der Durchschnitt der Länder-/Kantonspunkte in Prozent. Farben erhalten zusätzlich Text-/Symbolhinweise, damit die Bewertung nicht allein über Farbe verständlich ist. Am Rundenende kann dieselbe Auswahl wiederholt werden.

Mathematik erhält Themenauswahl und Zahlenaufgaben. Bei Längen/ Strecken wird auf Millimeter gerundet, bei Flächen auf drei und bei Volumen auf vier Nachkommastellen. Nachkommastellen mit Wert null am Ende dürfen weggelassen werden; mitgeschriebene Endnullen gelten ebenfalls. Dezimalkomma und Dezimalpunkt werden als Eingabe akzeptiert. Die Aufgabe zeigt die verlangte Einheit an. Für Pyramiden gilt Volumen = Grundfläche × senkrechte Höhe ÷ 3; beim Prisma Grundfläche × senkrechte Höhe.

In jeder Matheaufgabe ist ein wissenschaftlicher Taschenrechner eingebaut: Grundrechenarten, Vorzeichenwechsel, Klammern, Prozent, Dezimalzahlen, Pi, Potenzen, Wurzeln, Kehrwert, Fakultät, sin/cos/tan samt Umkehrfunktionen, log10, ln und Exponentialfunktion. Grad ist voreingestellt; ein Schalter wechselt zwischen Grad und Bogenmass. Berechnete Ergebnisse können in das Antwortfeld übernommen werden.

Ein gemeinsamer Katalogvertrag speichert Fach, Lehrmittel/Quelle falls vorhanden, Thema/Lernziel, Inhaltstyp und versionierte Inhalte. Jedes Modul kann seinen eigenen Übungstyp bereitstellen, während Lernsets, Verlaufsanzeige und Klassenrechte einen gemeinsamen Fachbezug verwenden.

### Bestehende Daten und Migration

- Bestehende Vokabel-JSONs, IDs, Lernstände und Sets müssen weiter funktionieren.
- Im verbundenen Supabase-Projekt ist derzeit `public.learning_states` und `public.shared_sets` vorhanden; die abgefragte Migrationstabelle ist leer und `voci_private`-Schultabellen sind nicht vorhanden. Die Schuleinrichtung ist dort noch nicht ausgerollt. Daher eine neue, additive Migration erstellen; bestehende Tabellen und Nutzerdaten erhalten.
- Die Fachliste muss die IDs `de`, `en`, `fr`, `math`, `geography` enthalten. Bisherige `en`-/`fr`-Fachzugriffe werden erhalten.
- `valid_set`, Fachzugriff und Klassenprüfung müssen einen versionierten, fachneutralen Inhaltsauszug validieren. Der PDF-Prüfungsgenerator kann später denselben Auszug und Themenbezug verwenden.
- Es gibt keine automatische Umstellung bestehender Lernsets auf neue Fächer; bestehende Sets bleiben unverändert.

## Preise

### Einzel-Lehrperson

Preis pro Monat für die ausgewählten Fächer:

| Anzahl Fächer | Monatspreis |
|---:|---:|
| 1 | CHF 3.– |
| 2 | CHF 5.– |
| 3 | CHF 7.– |
| 4 | CHF 8.– |
| 5 | CHF 9.– |

Die neuen Einzelpreise gelten sofort auch für bestehende Abos. Die Preisänderung wird am Änderungstag wirksam; Stripe rechnet den Rest des laufenden Monats anteilig ab bzw. gut und setzt den Monatsbeginn auf den Änderungstag. Interpretation von «ein Fach früher auf CHF 1.– pro Fach»: Der Aufpreis von CHF 1.– beginnt beim vierten Fach; das zweite und dritte Fach kosten je CHF 2.– zusätzlich.

### Schule

- Bis einschliesslich 50 zählende Lehrpersonen: **CHF 40.– pro Monat**.
- Ab 51 zählenden Lehrpersonen: **CHF 100.– pro Monat**.
- Schülerzahlen ändern den Preis nicht.
- Administratoren zählen nur, wenn sie auch eine Lehrpersonenrolle besitzen.
- Offene Lehrpersonen-Einladungen reservieren Plätze.
- Bei mehr als 50 Lehrpersonen ist das grosse Paket erforderlich; bei bis zu 50 im grossen Paket erscheint ein Hinweis auf das kleinere Paket.
- Auch bestehende Schulabos wechseln sofort auf die neuen CHF 40/CHF 100-Tarife. Stripe verrechnet bzw. gutschreibt den anteiligen Unterschied; der neue Monatszeitraum beginnt am Änderungsdatum.
- Einzel-Lehrpersonen wählen aus den fünf verfügbaren Fächern; das Schulpaket umfasst alle fünf.

## Schulbestätigung und Aktivierung

- Der Schuladmin-Antrag wird vor einem Zahlungseinzug durch Voci geprüft. Die 14-Tage-Frist beginnt, sobald alle nötigen Angaben und Nachweise eingegangen sind.
- Wird die Prüfung durch Voci länger als 14 Tage verzögert, erhält die Schule einen Gratismonat. Der Schulzugang beginnt am Aktivierungstag; während dieses Gratismonats wird noch keine erste Monatszahlung eingezogen. Nach Ablauf des Gratismonats beginnt der erste bezahlte Monat.
- Bei bestätigtem Antrag wird der Administrator noch am Bestätigungstag informiert. Ab dem Bestätigungszeitpunkt darf er Lehrpersonen einladen und Rollen vorbereiten.
- Aktivierungszeitpunkt ist 00:00 Uhr am folgenden Kalendertag in der Zeitzone Europe/Zurich. An diesem Tag beginnt die Abo-Periode und wird die erste Zahlung belastet. Erst danach werden die Lehrpersonenrechte für Klassen und Unterricht freigeschaltet.
- Reine Administratorrechte zur Verwaltung und Einladung gelten ab der Bestätigung; eine Administratorrolle mit Unterrichtsberechtigung erhält den Lehrpersonen-Zugriff erst ab dem Aktivierungstag.
- Die Mindestlaufzeit nach erfolgreicher Zahlung beträgt einen bezahlten Monat. Kündigung bleibt danach möglich und wirkt am Ende des bezahlten Monats. Die bestehenden Regeln zu Kündigung und Upgrades bleiben bestehen.
- Eine separate 30-Tage-Gültigkeitsregel für einen Zahlungslink wird nicht verwendet.
- Falls die Zahlung am geplanten Aktivierungstag fehlschlägt, bleiben Unterrichtsrechte gesperrt. Als Implementierungsregel wird Aktivierung und Monatsbeginn bis zur erfolgreichen Zahlung verschoben, damit keine bezahlte Laufzeit verloren geht.

## Nicht Bestandteil dieses Arbeitspakets

- PDF-Prüfungsgenerator für Lehrpersonen, Aufgabenzahlen pro Typ, druckfertige Prüfungen und separate Musterlösungen.
- Automatische Grammatik- und Mathematik-Erstellung von unbegrenzt vielen Inhalten.
- Weitere Fächer über die fünf genannten hinaus.
- Verbindliche AGB, Datenschutzerklärung, Steuer- und Rechnungsfreigabe.
- Direkte Veröffentlichung oder Änderung am Online-GitHub-Repository bzw. Live-Supabase ohne verbundene Zugänge und ausdrückliche Freigabe.

## Qualitäts- und Sicherheitsanforderungen

- Preise im Browser und Server verwenden exakt dieselbe Staffel; Serverwerte sind autoritativ.
- Ein Fachzugriff darf nicht allein durch vom Browser gesendete Fachnamen gewährt werden.
- Kursinhalte, JSON und Übungseingaben werden geprüft; fehlerhafte oder leere Inhalte starten keinen Modus.
- Zahlenaufgaben validieren mathematisch sinnvolle Werte, Einheiten und Rundung.
- Geografie-Kataloge enthalten eindeutige, stabile Kennungen; Kontinentfilter sollen keine Länder versehentlich auslassen.
- Bei Migration oder Datenmodelländerung bleiben bestehende `learning_states`-Daten unverändert.
- Bildschirmlesbarkeit, Tastaturbedienung und Mobilansicht bleiben erhalten.

## Festgehaltene Entscheidungen und verbleibende Annahmen

- Genau 50 zählende Lehrpersonen kosten CHF 40; CHF 100 gilt ab 51.
- Bestehende Abos wechseln sofort auf die neuen Preise. Anteilsberechnung und neuer Abomonat beginnen am Änderungsdatum.
- Die erste Belastung erfolgt erst am Aktivierungstag, dem Kalendertag nach der Administratorbestätigung. Wenn eine Zahlung fehlschlägt, bleiben Lehrpersonenrechte gesperrt und Aktivierung/Aboperiode verschieben sich bis zur erfolgreichen Zahlung.
- Die 14-Tage-Frist beginnt mit Eingang des vollständigen Antrags. Eine von Voci verursachte Überschreitung gewährt einen Gratismonat; dieser wird als kostenfreie Zugangsperiode vor dem ersten bezahlten Monat umgesetzt.
- Der Grammatik-Grundkatalog für Primar- und Sekundarstufe ist im fachlichen Umfang aufgeführt und an den Kompetenzbereichen des Lehrplans 21 ausgerichtet.
- Die Karten-/Textmodi umfassen zwei wählbare Weltkataloge: 195 UN-Mitgliedstaaten und Beobachterstaaten sowie die 206 IOC-anerkannten Nationalen Olympischen Komitees. Ein zusätzlicher Staaten-/Gebietekatalog entfällt. Schweizer Kantone bleiben ein eigener Katalog; Hauptstädte bleiben ausserhalb des Umfangs. Datenstände werden versioniert.
- Mathe-Eingaben verlangen die angegebene Einheit, runden Strecken auf 1 mm, Flächen auf 3 und Volumen auf 4 Nachkommastellen; Endnullen sind optional. Der integrierte wissenschaftliche Rechner startet im Gradmodus und kann auf Bogenmass umgeschaltet werden.
- Kantonal unterschiedliche Lernzielprogression und Inhalte werden bei der späteren Abstimmung mit Lehrpersonen/Lehrmitteln geprüft. Der Vorschlag orientiert sich am Kompetenzaufbau «Sprache(n) im Fokus» des Lehrplans 21, der Grammatik vom Erkennen einfacher Strukturen bis zum Anwenden komplexerer Strukturen staffelt: https://gr-d.lehrplan.ch/container/GR_D_DE_Fachbereich_SPR.pdf

## Auswirkungen und Rückwärtskompatibilität

Betroffen sind die Inhaltsauswahl, Lernmodule, Fachpreisanzeige und serverseitige Preisberechnung, Schulfachberechtigungen, Klassenprüfungsdaten und Supabase-Schema. Die Erweiterung ist additiv. Bestehende englische/französische Lernsets bleiben gültig. Lehrerprüfungen bleiben bis zur späteren PDF-Erweiterung einfache Klassenankündigungen mit Lerninhaltsauswahl.





