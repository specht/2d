---
titel: Bröckelnde Steine
kategorie: Welt bauen
stufe: 2
skala: 2
kurz: Die Brücke hält nur kurz – wer stehen bleibt, fällt mit den Steinen hinunter.
einzelbilder: true
szene:
  # the small one is in the scene's game, too (Szene öffnen), and in the Sprite-Katalog
  zusaetzlich: [broeckel_klein]
  karte: |
    ..........
    ..........
    .P........
    ###....###
    ###BBBB###
    ###....###
    ###....###
ablauf:
  - { t: 0.4, halten: rechts, dauer: 1.0 }
dauer: 2.6
erwartet:
  figur_rechts_von: 7
varianten:
  # 1: the small stone (24 × 24) sits right in the bridge and crumbles where it lies
  - szene:
      legende: { b: broeckel_klein }
      karte: |
        ..........
        ..........
        .P........
        ###bbbb###
        ###....###
        ###....###
        ###....###
    erwartet:
      figur_rechts_von: 7
---
## Kurz gesagt

1. Ein Block mit **fällt runter, wenn man drauf steht** bröckelt weg.
2. Ein zweiter Zustand **zerbröselt** zeigt Risse – dann brechen Stücke heraus und fallen in den leeren Platz darunter.
3. Wer zu lange stehen bleibt, fällt mit!

## Das brauchst du

- **Das musst du zeichnen:** einen Stein, der fast wie eine normale Mauer aussieht – aber schon einen kleinen Riss hat. Das Sprite ist **24 × 48** Pixel groß: Der Stein ist die **obere Hälfte**, die untere bleibt leer.
- **Das kannst du später dazumalen:** einen Zustand **zerbröselt**: Erst wandern Risse durch den Stein, dann gehen sie auf, und die Bruchstücke fallen nacheinander in die leere untere Hälfte – die Stücke unter den Füßen ganz zum Schluss. Ein bisschen Staub rieselt hinterher.

![Bröckelstein](katalog:welt/broeckel)
![zerbröselt](katalog:welt/broeckel_zerfall 28)

## Schritt für Schritt

1. Mach das Sprite mit **Funktionen → Sprite → Größe ändern** **1 × 2** Felder groß (24 × 48) und zeichne den Stein in die **obere Hälfte**. Unten ist Platz für die Bruchstücke.
2. **Eigenschaft hinzufügen → Blöcke → man kann nicht von oben reinfallen**. Nur diese eine Block-Eigenschaft: So steht man oben auf dem Stein, und die leere Hälfte darunter ist niemandem im Weg.
3. **Eigenschaft hinzufügen → Blöcke → fällt runter, wenn man drauf steht**. Stell **fällt nach** auf **0,5 s**.
4. Neuer Zustand mit vielen Frames – hier vierzehn: zwei, in denen der Riss wächst, dann brechen die Stücke einzeln heraus, fallen und werden dabei immer kleiner, bis nur noch Staub übrig ist.
5. Beim Zustand: **Eigenschaft hinzufügen → fällt runter, wenn man drauf steht → zerbröselt**.
6. Bau im **Level** eine Brücke aus Bröckelsteinen über ein Loch. Weil der Stein oben im Sprite sitzt, setzt du die Sprites **eine Reihe tiefer** als die Brücke: Der Stein landet genau in der Lücke, die leere Hälfte hängt ins Loch. Lauf schnell drüber!

## Der kleine Bröckelstein

Es gibt den Stein auch in **24 × 24** – ein ganz normales Feld. Er hat keine leere Hälfte, also setzt du ihn **genau dorthin**, wo die Brücke sein soll. Seine Stücke fallen innerhalb des Feldes nach unten und werden kleiner, bis sie verschwinden. Im **Sprite-Katalog** findest du ihn bei **Fallen und Gefahren**.

![Kleiner Bröckelstein](katalog:welt/broeckel_klein)
![zerbröselt](katalog:welt/broeckel_klein_zerfall 28)

![Brücke aus kleinen Bröckelsteinen](variante:1)

## Tipps

> **Tipp:** Die Frames von **zerbröselt** werden genau einmal abgespielt – verteilt auf die Zeit bei **fällt nach**. Der letzte Frame ist der Moment, in dem der ganze Rest fällt. Viele Frames in kurzer Zeit wirken schnell und wuchtig.

> **Profi-Tipp:** Zeichne die Risse entlang unregelmäßiger Bruchstücke, nicht entlang der Mauerfugen. Lass Stücke an den Rändern abbrechen statt gerade Kästchen herauszuradieren – dann sieht es nach echtem Stein aus. Und lass jedes Stück beim Fallen **Pixel für Pixel kleiner** werden: Dann verschwindet es sanft, statt plötzlich weg zu sein.

- Mit **akkumuliert Schaden** bröckelt der Stein nur, solange jemand draufsteht. Geht man runter, hört er auf zu bröckeln – bis man wieder draufsteigt.
- Ein kleiner Riss im normalen Bild ist ein fairer Hinweis: Aufmerksame Spieler erkennen den Bröckelstein.
- **Schaden** und **fällt auch bei Gegnern** machen fallende Steine zur Falle für Gegner.

## Wenn's nicht klappt

- **Der Stein fällt sofort:** **fällt nach** ist 0.
- **Der Stein fällt, aber man sieht keine Risse:** Dem zweiten Zustand fehlt **zerbröselt**.
- **Man fällt einfach durch den Stein:** Er braucht zusätzlich *man kann nicht von oben reinfallen*.
- **Die Figur schwebt über dem Stein:** Der Stein ist unten im Sprite gemalt, oder du hast ihn nicht eine Reihe tiefer gesetzt. Man steht immer auf der Oberkante des Sprites.

## Mach mehr draus

Bau eine lange Bröckelbrücke mit einer Münze in der Mitte. Traust du dich, stehen zu bleiben?
