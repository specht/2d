---
titel: Bröckelnde Steine
kategorie: Welt bauen
stufe: 2
kurz: Die Brücke hält nur kurz – wer stehen bleibt, fällt mit den Steinen hinunter.
szene:
  karte: |
    ..........
    ..........
    .P........
    ###BBBB###
    ###....###
    ###....###
ablauf:
  - { t: 0.4, halten: rechts, dauer: 1.0 }
dauer: 2.6
erwartet:
  figur_rechts_von: 7
---
## Kurz gesagt

1. Ein Block mit **fällt runter, wenn man drauf steht** bröckelt weg.
2. Ein zweiter Zustand **zerbröselt** zeigt Risse, bevor er fällt.
3. Wer zu lange stehen bleibt, fällt mit!

## Das brauchst du

- **Das musst du zeichnen:** einen Stein, der fast wie eine normale Mauer aussieht – aber schon einen kleinen Riss hat.
- **Das kannst du später dazumalen:** einen Zustand **zerbröselt** mit immer größeren Rissen.

![Bröckelstein](katalog:welt/broeckel)
![zerbröselt](katalog:welt/broeckel_zerfall 6)

## Schritt für Schritt

1. Zeichne den Stein und gib ihm alle drei Block-Eigenschaften, damit man darauf stehen kann.
2. **Eigenschaft hinzufügen → Blöcke → fällt runter, wenn man drauf steht**.
3. Stell **fällt nach** auf **0,5 s**.
4. Neuer Zustand mit drei Frames: der Riss wird größer, am Ende brechen Stücke ab.
5. Beim Zustand: **Eigenschaft hinzufügen → fällt runter, wenn man drauf steht → zerbröselt**.
6. Bau im **Level** eine Brücke aus Bröckelsteinen über ein Loch. Lauf schnell drüber!

## Tipps

> **Tipp:** Die Frames von **zerbröselt** werden genau einmal abgespielt – verteilt auf die Zeit bei **fällt nach**. Der letzte Frame ist der Moment kurz vor dem Fallen.

- Mit **akkumuliert Schaden** bröckelt der Stein nur, solange jemand draufsteht. Geht man runter, hört er auf zu bröckeln – bis man wieder draufsteigt.
- Ein kleiner Riss im normalen Bild ist ein fairer Hinweis: Aufmerksame Spieler erkennen den Bröckelstein.
- **Schaden** und **fällt auch bei Gegnern** machen fallende Steine zur Falle für Gegner.

## Wenn's nicht klappt

- **Der Stein fällt sofort:** **fällt nach** ist 0.
- **Der Stein fällt, aber man sieht keine Risse:** Dem zweiten Zustand fehlt **zerbröselt**.
- **Man fällt einfach durch den Stein:** Er braucht zusätzlich *man kann nicht von oben reinfallen*.

## Mach mehr draus

Bau eine lange Bröckelbrücke mit einer Münze in der Mitte. Traust du dich, stehen zu bleiben?
