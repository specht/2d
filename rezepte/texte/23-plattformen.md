---
titel: Plattformen zum Durchspringen
kategorie: Welt bauen
stufe: 1
skala: 2
kurz: Von unten springt Pip einfach durch – oben kann er stehen.
szene:
  ebenen:
    - name: Stützen
      kollision: false
      # the posts start in the same cell as their plank (behind it) and reach the ground
      karte: |
        ..........
        ..........
        .....|.|..
        ..|.||.|..
        ..|.||.|..
        ..........
    - name: Welt
      karte: |
        ..........
        ..........
        .....---..
        ..---.....
        .P........
        ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.35 }
  - { t: 0.4, drücken: springen }
  - { t: 1.3, halten: rechts, dauer: 0.4 }
  - { t: 1.35, drücken: springen }
dauer: 3.0
erwartet:
  figur_hoeher_als: 4
---
## Kurz gesagt

1. Zeichne ein Brett, das nur oben dick ist.
2. Gib ihm **nur** die Eigenschaft *man kann nicht von oben reinfallen*.
3. Von unten springt die Figur hindurch, oben kann sie stehen.

## Das brauchst du

- **Das musst du zeichnen:** ein Brett. Male es an den **oberen Rand** des Sprites – dort ist die Oberfläche.
- **Das kannst du später dazumalen:** Pfosten, die das Brett tragen (siehe *Level, die echt wirken*).

![Brett](katalog:welt/brett)
![Pfosten](katalog:welt/pfosten)

## Schritt für Schritt

1. Zeichne das Brett in die obersten Pixelreihen des Sprites.
2. **Eigenschaft hinzufügen → Blöcke → man kann nicht von oben reinfallen**. Die beiden anderen Block-Eigenschaften lässt du weg!
3. Leg im **Level** zwei Bretter wie eine Treppe übereinander.
4. **Pfosten:** Nichts schwebt einfach so in der Luft. Leg eine neue Ebene mit **Kollisionen erkennen** aus an und schieb sie in der Layer-Liste **unter** die Bretter. Setz den obersten Pfosten in **dasselbe Feld** wie das Brett – er verschwindet dahinter – und stapel weitere Pfosten bis zum Boden.
5. Probier es aus: Springen – durch das Brett hindurch – und oben landen.

## Tipps

> **Tipp:** Welche Seiten fest sind, bestimmst du mit den drei Block-Eigenschaften. Nur *von oben* ergibt eine Plattform zum Durchspringen, alle drei eine feste Mauer.

- Mit *man kann nicht von unten reinspringen* allein entsteht eine Decke, durch die man nach unten fallen kann.
- Statt Pfosten gehen auch Ketten von oben, ein Seil oder ein Felsvorsprung – Hauptsache, man sieht, was das Brett hält (siehe *Level, die echt wirken*).
- Mit Pfeil nach unten fällt man **nicht** durch das Brett. Hinunter geht es nur über die Kante.

## Wenn's nicht klappt

- **Zwischen Pfosten und Brett ist eine Lücke:** Der oberste Pfosten sitzt ein Feld zu tief. Setz ihn in dasselbe Feld wie das Brett.
- **Die Figur stößt sich von unten den Kopf:** Das Brett hat noch *man kann nicht von unten reinspringen*. Nimm die Eigenschaft weg.
- **Die Figur schwebt über dem Brett:** Das Brett ist nicht oben im Sprite gemalt. Das Spiel nimmt immer die Oberkante des Sprites.
- **Die Figur bleibt an den Pfosten hängen:** Die Pfosten liegen in einer Ebene mit Kollisionen und haben Block-Eigenschaften. Deko braucht keine Eigenschaften.

## Mach mehr draus

Bau einen Turm aus vielen Brettern, auf dem man immer höher springt – oben wartet eine Münze.
