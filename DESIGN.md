---
name: Voci Lernpfad
description: Ruhiger Lernplatz in Tannengrün und Gelb
colors:
  forest: "#234f45"
  yellow: "#f2d25d"
  ground: "#f7f9f6"
  surface: "#ffffff"
  ink: "#172c25"
  muted: "#54655e"
typography:
  body:
    fontFamily: '"Atkinson Next", system-ui, sans-serif'
    fontSize: "17px"
    lineHeight: 1.5
rounded:
  control: "8px"
  card: "12px"
components:
  button-primary:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
---

# Voci Design

## Overview

**Creative North Star: "Lernpfad – Tannengrün und Gelb"**

Die bestätigte Gestaltung stellt den nächsten Lernschritt ins Zentrum. Fünf Fächer, eigene Lernsets und private Fortschritte teilen denselben App-Rahmen. Stand vom 7. November 2026, aus den tatsächlichen Styles und Komponenten abgeleitet.

## Colors

Tannengrün trägt Navigation und hervorgehobene Lernaktionen. Gelb kennzeichnet Hauptaktionen und den aktiven Navigationspunkt. Kartenbewertungen verwenden Grün, Gelb, Orange, Rot und Schwarz sowie beschriftete Punktwerte.

## Typography

Atkinson Hyperlegible Next wird lokal aus `assets/fonts/atkinson-hyperlegible-next.ttf` geladen, mit `font-display: swap` und Systemschrift als Rückfall. Grundschrift: 17px bei 1,5 Zeilenhöhe. Schuleingaben verwenden 16px. Die Hauptüberschrift variiert zwischen 38 und 58px und wird unter 520px auf 36px begrenzt.

## Layout

Desktop: feste 224px-Navigation, flexibler Inhaltsbereich bis 1500px. Unter 800px wird die Navigation horizontal und mehrzeilig. Unter 520px stehen Fächer untereinander. Zuordnen zeigt bis zu zwölf Wortpaare in vier Desktopzeilen; auf Mobilgeräten bleiben zwei Sprachspalten erhalten.

## Elevation & Depth

Normale Inhalte nutzen Flächen und dünne Trennlinien. Dialoge erhalten einen versetzten Schatten und einen abgedunkelten Hintergrund. Fokus: sichtbarer 3px-Umriss in `#a57700` mit 3px Abstand.

## Shapes

Inhaltsflächen haben 12px, Standardbuttons 8px Rundung. Schliessen-Schaltflächen sind rund und 44px gross. Auswahlfelder verwenden native Browserbedienung.

## Components

Hauptbuttons sind gelb, sekundäre Aktionen hellgrün. Kleine Buttons und mobile Navigation sind mindestens 44px hoch. Checkbox-Beschriftungen vergrössern die anklickbare Fläche auf mindestens 44px Höhe. Gesperrte Fächer bleiben mit Erklärung sichtbar. Prüfungsdatum und Fach stehen unter dem Titel.

Kartenpunkte behalten einen kleinen sichtbaren Kern und besitzen einen transparenten, vergrösserten Klickbereich. Verbindungslinien zeigen ihre tatsächliche Lage. Karten lassen sich verschieben, vergrössern und per Tastatur bedienen.

Ergebnisse erscheinen mit einer kurzen 280ms-Bewegung; `prefers-reduced-motion` reduziert Bewegung. Eingaben bleiben nach der Korrektur lesbar, die nächste Aufgabe erhält den Fokus.

## Do's and Don'ts

- Echte Prüfungsangaben, Fehlermeldungen und Lernstände sichtbar halten.
- Farben durch Text beziehungsweise Zahlen ergänzen.
- Lange Namen umbrechen lassen und kleine Ansichten prüfen.
- Die bestätigte Schrift und Farbwelt erhalten.
- Keine fachliche oder rechtliche Freigabe aus einer technischen Prüfung ableiten.
