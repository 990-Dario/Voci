# Voci mit Supabase verbinden

Diese Anleitung verbindet die bestehende Voci-Webseite mit Supabase. Danach können Schülerinnen und Schüler ein Konto mit E-Mail und Passwort erstellen und Lernsets sowie Lernfortschritt auf mehreren Geräten verwenden.

## Was du vorher brauchst

- ein kostenloses Konto bei [Supabase](https://supabase.com/dashboard)
- dieses Voci-Projekt auf deinem Computer
- einen laufenden lokalen Server, zum Beispiel VS Code Live Server unter `http://127.0.0.1:5500`

## 1. Neues Supabase-Projekt anlegen

1. Öffne das [Supabase Dashboard](https://supabase.com/dashboard) und wähle **New project**.
2. Wähle eine Organisation oder erstelle eine neue.
3. Gib dem Projekt einen Namen, zum Beispiel `voci`.
4. Wähle eine Region in Europa, idealerweise Frankfurt.
5. Lege ein sicheres Datenbank-Passwort fest und bewahre es an einem sicheren Ort auf. Dieses Passwort kommt **nie** in die Voci-Dateien.
6. Erstelle das Projekt und warte, bis es bereit ist.

## 2. Tabelle und Datenschutzregeln einrichten

1. Öffne in Supabase links **SQL Editor**.
2. Wähle **New query**.
3. Öffne die Datei `supabase-schema.sql` in diesem Projekt.
4. Kopiere ihren gesamten Inhalt in den SQL Editor.
5. Klicke auf **Run**.

Dadurch entsteht die Tabelle `learning_states`. Sie speichert pro Konto genau einen Lernstand mit allen Lernsets, Karteikarten-Kategorien, falschen Antworten und Testresultaten.

Die SQL-Datei aktiviert Row Level Security. Diese Regeln sorgen dafür, dass ein angemeldeter Benutzer nur den eigenen Lernstand lesen und ändern kann. Lass diese Regeln aktiv.

### Kontrolle

Öffne nach dem Ausführen links **Table Editor**. Dort sollte die Tabelle `learning_states` erscheinen. Sie kann noch leer sein; der erste Datensatz wird beim ersten angemeldeten Lernen angelegt.

## 3. E-Mail und Passwort einschalten

1. Öffne links **Authentication** und danach **Providers**.
2. Öffne den Anbieter **Email**.
3. Aktiviere den Anbieter, falls er noch deaktiviert ist.
4. Lass die E-Mail-Bestätigung für den Anfang aktiviert. Neue Benutzer erhalten dann zuerst eine Bestätigungs-E-Mail.
5. Speichere die Einstellungen.

Die App verlangt mindestens acht Zeichen für ein Passwort. Nach der Kontoerstellung meldet sich ein Benutzer erst an, nachdem die E-Mail-Adresse bestätigt wurde.

## 4. Erlaubte Website-Adressen festlegen

Supabase darf nur zu bekannten Website-Adressen Bestätigungs-E-Mails und Passwortlinks zurückschicken.

1. Öffne **Authentication → URL Configuration**.
2. Trage bei **Site URL** für den lokalen Test ein:

   `http://127.0.0.1:5500`

3. Ergänze unter **Redirect URLs** ebenfalls:

   `http://127.0.0.1:5500`

4. Nach dem späteren Deployment ergänzt du dort zusätzlich deine echte Adresse, zum Beispiel:

   `https://dein-name.github.io/voci/`

   oder deine Netlify-Adresse.

5. Speichere die Einstellungen.

## 5. Project URL und anon key kopieren

1. Öffne links **Project Settings → API**.
2. Kopiere die **Project URL**. Sie beginnt mit `https://` und endet normalerweise mit `.supabase.co`.
3. Kopiere den öffentlichen Schlüssel **anon** oder **publishable key**.
4. Öffne im Voci-Projekt [supabase-config.js](C:/Users/dario/Documents/Coding/Voci/supabase-config.js).
5. Trage die Werte ein:

```js
globalThis.VOCI_SUPABASE = {
  url: 'https://dein-projekt.supabase.co',
  anonKey: 'dein-öffentlicher-anon-key'
};
```

Der anon key darf in einer Web-App stehen. Er funktioniert nur zusammen mit den Datenschutzregeln aus Schritt 2. Kopiere **nie** den `service_role`-Schlüssel in diese Datei, auf GitHub oder auf eine Webseite.

## 6. Lokal testen

1. Speichere `supabase-config.js`.
2. Stelle sicher, dass Live Server läuft und öffne `http://127.0.0.1:5500`.
3. Oben rechts sollte jetzt der Button **Anmelden** sichtbar sein.
4. Klicke auf **Anmelden** und danach auf **Konto erstellen**.
5. Verwende eine E-Mail-Adresse, auf die du zugreifen kannst, und ein Passwort mit mindestens acht Zeichen.
6. Öffne die Bestätigungs-E-Mail von Supabase und klicke auf den enthaltenen Link.
7. Kehre zu Voci zurück und melde dich an.
8. Erstelle ein Lernset, bearbeite Karteikarten oder absolviere einen Test.
9. Öffne in Supabase den **Table Editor → learning_states**. Es sollte nun ein Eintrag vorhanden sein.

### Synchronisation prüfen

1. Melde dich in Voci ab.
2. Öffne die App in einem anderen Browser oder einem privaten Fenster.
3. Melde dich mit derselben E-Mail-Adresse an.
4. Deine Lernsets und der Lernfortschritt sollten erscheinen.

Beim Abmelden entfernt Voci die lokal zwischengespeicherten Kontodaten aus diesem Browser. Der Lernstand bleibt sicher in Supabase gespeichert.

## 7. Nach dem Deployment anpassen

Nach einer Veröffentlichung auf GitHub Pages, Netlify oder einer anderen Plattform:

1. Öffne deine veröffentlichte Voci-Adresse.
2. Ergänze diese Adresse in Supabase unter **Authentication → URL Configuration** bei **Site URL** und **Redirect URLs**.
3. Stelle sicher, dass `supabase-config.js` zusammen mit der Webseite veröffentlicht wird.
4. Teste Konto erstellen, E-Mail bestätigen, Anmelden und Synchronisation erneut.

Wenn du mehrere Adressen verwendest, etwa eine Netlify-Vorschau und eine eigene Domain, füge jede verwendete Adresse als Redirect URL hinzu.

## Wenn etwas nicht funktioniert

| Problem | Prüfung |
| --- | --- |
| Der Button „Anmelden“ fehlt | Sind `url` und `anonKey` in `supabase-config.js` ausgefüllt? Seite danach neu laden. |
| Nach Kontoerstellung kommt keine E-Mail | Spam-Ordner prüfen und kontrollieren, ob E-Mail als Provider aktiviert ist. |
| Bestätigungslink führt auf eine Fehlerseite | Die lokale oder veröffentlichte URL fehlt unter **Redirect URLs**. |
| Lernstand wird nicht online gespeichert | Prüfen, ob der SQL-Code vollständig ausgeführt wurde und `learning_states` existiert. |
| Ein anderer Benutzer sieht fremde Daten | Sofort die Row-Level-Security-Regeln in `supabase-schema.sql` erneut ausführen und keine eigenen, zu offenen Policies hinzufügen. |

## Wichtige Dateien

- [supabase-config.js](C:/Users/dario/Documents/Coding/Voci/supabase-config.js): Hier stehen Project URL und öffentlicher anon key.
- [supabase-schema.sql](C:/Users/dario/Documents/Coding/Voci/supabase-schema.sql): Erstellt die Tabelle und Zugriffsregeln.
- [app.js](C:/Users/dario/Documents/Coding/Voci/app.js): Enthält Anmeldung, Abmeldung und Synchronisation.

Weiterführende offizielle Dokumentation: [Passwort-Authentifizierung](https://supabase.com/docs/guides/auth/passwords), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) und [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Lehrmittel, Schulstufe und Teil-Links

Führe nach dem Aktualisieren der App den gesamten Inhalt von `supabase-schema.sql` nochmals im **SQL Editor** aus. Das Script ergänzt die Tabelle `shared_sets`, zwei Datenbankfunktionen und einen täglichen Cron-Auftrag. Bereits gespeicherte Lernstände bleiben erhalten.

- Beim Erstellen eines Kontos wird Primarschule oder Sekundarschule gewählt.
- Standardmässig erscheinen nur passende Lehrmittel. Die Auswahl kann in der App für die andere Stufe erweitert werden.
- Ein Teil-Link enthält eine Kopie ohne persönlichen Lernfortschritt, läuft nach sieben Tagen ab und wird danach täglich aus der Datenbank entfernt.
- Empfänger müssen angemeldet sein, damit sie ein geteiltes Lernset importieren können.

Wenn der SQL Editor bei `pg_cron` einen Fehler meldet, aktiviere die Erweiterung **pg_cron** unter **Database → Extensions** und führe das Script erneut aus.
