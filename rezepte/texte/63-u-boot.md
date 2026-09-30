---
titel: Das U-Boot und der Sog
kategorie: Wasser & Weltall
stufe: 3
kurz: Ein schweres U-Boot gleitet durch die Tiefsee. Über einem Schlot zieht ein Sog es schräg nach unten – nur mit voller Kraft kommt es wieder frei.
skala: 2
schritte: 2
# the gallery card: the submarine pulled down by the Sog
standbild: 3.4
szene:
  himmel: ['#29366f', '#1a1c2c']
  kamera: { bildhoehe: 144 }
  legende: { U: u_boot, R: riff, _: sand, o: perle, w: seegras, k: koralle, K: koralle_gruen, V: schlot, l: quallenlicht, Q: qualle }
  # the whole level is water. The submarine is heavy: it glides on for long
  bewegung: { art: schwimmen, schwerkraft: 0, schwimmzug: 0, tempo: 0.6, gleiten: 96 }
  bewegungsbereiche:
    # above the vent the water pulls down and a little to the left
    - { name: Sog, art: wie_darunter, stroemung: [100, 250], rechtecke: [[10, 0, 8, 5]] }
  effekte:
    - { effekt: current, name: Sog, farbe: '#73eff7aa', richtung: 250, tempo: 2, bereich: [10, 0, 8, 5], hinter: Figuren }
  ebenen:
    - name: Leuchtplankton
      kollision: false
      karte: |
        ..............................
        ....l..............l..........
        ..............................
        ........l.............l.......
        ..............................
        ..............................
    - name: Deko
      kollision: false
      karte: |
        ..............................
        ..............................
        ..............................
        ...w........................w.
        .....k....K..V..........k.K...
        ..............................
    - name: Welt
      karte: |
        ..............................
        ..............................
        .U..................o.........
        ............o.................
        RR.........................RRR
        ______________________________
ablauf:
  - { t: 0.3, halten: rechts, dauer: 5.6 }
  - { t: 3.3, halten: hoch, dauer: 2.2 }
dauer: 6.5
erwartet:
  punkte: 20
  figur_rechts_von: 20
---
## Kurz gesagt

1. Das U-Boot ist die Spielfigur – im ganzen Level wird geschwommen, ganz ohne Schwerkraft.
2. Ein U-Boot ist schwer: Mit **Gleiten 96 %** kommt es langsam in Fahrt und bremst nur langsam.
3. Über einem Schlot liegt ein Bewegungsbereich mit einer **Strömung schräg nach unten** – der Sog zieht das U-Boot mit, bis es mit voller Kraft dagegen anfährt.

## Das brauchst du

- **Das musst du zeichnen:** ein U-Boot (48 × 24 Pixel) mit einem Propeller, der sich dreht, und Meeresboden.
- **Das kannst du später dazumalen:** einen Schlot am Meeresgrund, Leuchtplankton, Seegras und Perlen.

![U-Boot](katalog:meer/u_boot 16)
![Schlot](katalog:meer/schlot)
![Leuchtplankton](katalog:meer/qualle_licht 5)

## Schritt für Schritt

1. **Das U-Boot:** Eigenschaft **Spielfigur**. Ein Zustand **Spielfigur schwimmt nach rechts** mit schnellem Propeller, einer zum Stehen mit langsamem.
2. **Die Tiefsee:** **Bewegung im ganzen Level: Schwimmen** mit **Schwerkraft 0 %**, **Schwimmzug 0**, **Tempo 0,6 ×** und **Gleiten 96 %**. Der Himmel wird ein Farbverlauf von Dunkelblau nach fast Schwarz.
3. **Der Sog:** Neue Ebene über **+ → Bewegungsbereich**, **Bewegung: wie darunter (nur Strömung)**, **Strömung: 100 px/s**, **Richtung: 250°** – das ist nach unten und ein bisschen nach links. Zieh das Rechteck über den Schlot, vom Meeresgrund bis ganz nach oben.
4. **Den Sog sehen:** Ein **Hintergrund** mit **Art: Effekt**, **Effekt: Strömung** und ebenfalls **Richtung: 250°** über demselben Rechteck. Schieb ihn in der Layer-Liste hinter die Figur.
5. **Leuchtplankton:** kleine leuchtende Punkte mit **Mischmodus: Leuchten** – in der dunklen Tiefe sieht man sie von weitem.
6. Probier es aus: Das U-Boot fährt nach rechts in den Sog. Der zieht es schräg hinunter bis auf den Meeresgrund. Erst mit **→** und **↑** zusammen kämpft es sich frei – und steigt danach, schwer wie es ist, noch ein ganzes Stück weiter.

## Tipps

> **Tipp:** Jeder Winkel geht: 0° rechts, 90° oben, 180° links, 270° unten. 250° liegt zwischen „unten“ und „links“. So kannst du einen Sog genau dorthin ziehen lassen, wo der Schlot ist.

- Ist die Strömung **schneller** als das U-Boot (hier: Tempo 0,6 × 3 = 1,8 Pixel pro Schritt), kommt es nie frei. Ist sie **etwas langsamer**, wird es spannend – wie hier.
- Mehrere Sog-Bereiche mit leicht verschiedenen Richtungen nebeneinander ergeben einen Strudel.

## Wenn's nicht klappt

- **Das U-Boot rast los und hält sofort an:** **Gleiten** ist zu klein. Ein schweres Boot braucht 95 % oder mehr.
- **Der Sog zieht in die falsche Richtung:** Die **Richtung** zählt gegen den Uhrzeiger: 90° ist oben, 270° unten.
- **Die Striche treiben anders als das U-Boot:** Effekt und Bewegungsbereich brauchen dieselbe **Richtung**.

## Mach mehr draus

Versteck einen Schatz tief unten neben dem Schlot. Wer ihn holen will, muss sich hinunterziehen lassen – und dann mit voller Kraft wieder hinauf.
