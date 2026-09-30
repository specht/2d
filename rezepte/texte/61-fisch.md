---
titel: Ein Fisch als Spielfigur
kategorie: Wasser & Weltall
stufe: 2
kurz: Das ganze Level ist Wasser. Der Fisch schwimmt in alle Richtungen, eine Strömung schießt ihn durch einen Tunnel und eine Blubbersäule trägt ihn nach oben.
skala: 2
schritte: 2
# the gallery card: the fish shoots through the tunnel
standbild: 2.1
szene:
  himmel: ['#41a6f6', '#29366f']
  kamera: { bildhoehe: 144 }
  legende: { F: fisch, Q: qualle, R: riff, _: sand, o: perle, w: seegras, k: koralle, K: koralle_gruen, T: truhe }
  # the whole level is water: no gravity, no swim strokes – the fish just swims
  bewegung: { art: schwimmen, schwerkraft: 0, schwimmzug: 0, tempo: 1.2, gleiten: 85 }
  bewegungsbereiche:
    # a current through the tunnel …
    - { name: Strömung, art: wie_darunter, stroemung: [240, 0], rechtecke: [[12, 3, 9, 1]] }
    # … and a column of bubbles that carries everything up
    - { name: Blubbersäule, art: wie_darunter, stroemung: [150, 90], rechtecke: [[24, 1, 2, 4]] }
  effekte:
    - { effekt: lightrays, name: Licht, farbe: '#ffffff30', vorne: false }
    # you can see where the water pulls: streaks in the tunnel, bubbles in the column
    - { effekt: current, name: Strömung, farbe: '#c3e6f6cc', richtung: 0, tempo: 3, bereich: [13, 3, 7, 1] }
    - { effekt: bubbles, name: Blasen, farbe: '#c3e6f6cc', tempo: 2, bereich: [24, 1, 2, 4], hinter: Figuren }
  ebenen:
    - name: Deko
      kollision: false
      karte: |
        ..............................
        ..............................
        ..............................
        ..w.........................w.
        ....k..K...w..........K..k.T..
        ..............................
    - name: Welt
      karte: |
        RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR
        .............RRRRRRR..........
        .....o.......RRRRRRR.....o....
        .F.......Q....................
        .............RRRRRRR..........
        ______________________________
ablauf:
  - { t: 0.3, halten: rechts, dauer: 2.65 }
  - { t: 0.45, halten: hoch, dauer: 0.35 }
  - { t: 1.3, halten: runter, dauer: 0.3 }
dauer: 4.0
erwartet:
  punkte: 20
  figur_rechts_von: 24
  lebt: true
---
## Kurz gesagt

1. Ist das ganze Level Wasser, stellst du das bei den **Level-Eigenschaften** ein: **Bewegung im ganzen Level: Schwimmen**.
2. Mit **Schwerkraft 0 %** und **Schwimmzug 0** schwimmt der Fisch einfach mit den Pfeiltasten – in alle Richtungen.
3. Bewegungsbereiche mit einer **Strömung** ziehen ihn in eine Richtung: durch einen Tunnel und in einer Blubbersäule nach oben.

## Das brauchst du

- **Das musst du zeichnen:** einen Fisch, der nach rechts schwimmt, Riff-Felsen und Meeresboden.
- **Das kannst du später dazumalen:** Quallen, Perlen, Seegras, Korallen und eine Schatztruhe.

![Fisch](katalog:meer/fisch 10)
![Fisch taucht ab](katalog:meer/fisch_ab 10)
![Fisch taucht auf](katalog:meer/fisch_auf 10)
![Qualle](katalog:meer/qualle 5)
![Riff](katalog:meer/fels)
![Grüne Koralle](katalog:meer/koralle_gruen)
![Schatztruhe](katalog:meer/truhe)

## Schritt für Schritt

1. **Der Fisch ist die Spielfigur:** Eigenschaft **Spielfigur**. Er braucht nur einen Zustand **Spielfigur schwimmt nach rechts** (mit schlagender Schwanzflosse) und einen zum Stehen – nach links dreht das Spiel ihn von selbst um. Schräg gezeichnet für **Spielfigur taucht ab** und **Spielfigur taucht auf** neigt er sich, wenn er nach unten oder oben schwimmt.
2. **Das ganze Level ist Wasser:** In den **Level-Eigenschaften** stellst du **Bewegung im ganzen Level: Schwimmen** ein. Dazu **Schwerkraft 0 %** (er sinkt nicht), **Schwimmzug 0** (die Sprungtaste macht nichts), **Tempo 1,2 ×** und **Gleiten 85 %**.
3. **Die Strömung im Tunnel:** Neue Ebene über **+ → Bewegungsbereich** mit **Bewegung: wie darunter (nur Strömung)**. Das heißt: Hier wird weiter geschwommen, nur zieht das Wasser dazu. **Strömung: 240 px/s**, **Richtung: 0°** (nach rechts). Zieh das Rechteck durch den Tunnel.
4. **Damit man die Strömung sieht:** Neue Ebene über **+ → Hintergrund**, **Art: Effekt**, **Effekt: Strömung**, **Richtung: 0°**, über dasselbe Rechteck. Hellblaue Striche treiben in die Richtung, in die es zieht.
5. **Die Blubbersäule:** noch ein Bewegungsbereich **wie darunter** mit **Strömung 150 px/s** und **Richtung 90°** (nach oben), dazu ein Effekt **Blasen** darüber. Schwimmt der Fisch hinein, trägt ihn die Säule nach oben – auch wenn du nichts drückst.
6. **Die Qualle:** ein Gegner mit **Verhalten: Flatterer**, **Wellenhöhe 20 px** und **Dauer einer Welle 3,2 s** – sie treibt langsam auf und ab. **Schaden 10**: Wer sie berührt, bekommt einen Stich.
7. Probier es aus: Der Fisch schnappt sich eine Perle, schwimmt über die Qualle hinweg, wird durch den Tunnel geschossen und von der Blubbersäule zur zweiten Perle getragen.

## Tipps

> **Tipp:** Die Strömungen aller Bereiche, in denen die Figur gerade ist, zählen zusammen. Die Art der Bewegung bestimmt aber nur der vorderste Bereich – „wie darunter“ ändert daran nichts.

- Eine Strömung schneller als der Fisch reißt ihn mit, egal was du drückst. Ist sie langsamer, kann er dagegen anschwimmen – aber nur mühsam.
- **Richtung** geht in Grad: 0° rechts, 90° oben, 180° links, 270° unten – und jeder Winkel dazwischen, zum Beispiel 45° schräg nach rechts oben.
- **Gleiten** bestimmt, wie flink der Fisch ist: Mit wenig Gleiten hält er sofort an und wendet blitzschnell, mit viel Gleiten treibt er weiter.

## Wenn's nicht klappt

- **Der Fisch sinkt nach unten:** Die **Schwerkraft** im Level steht nicht auf 0 %.
- **Der Fisch springt, statt zu schwimmen:** Beim Level ist noch **normal** eingestellt – stell **Bewegung im ganzen Level: Schwimmen** ein.
- **Die Strömung zieht nicht:** Das Rechteck des Bereichs liegt nicht dort, wo der Fisch schwimmt (es zählt seine Mitte), oder die Strömung steht auf 0.
- **Man sieht nicht, wohin es zieht:** Der Effekt **Strömung** braucht dieselbe **Richtung** wie der Bewegungsbereich.

## Mach mehr draus

Bau ein Labyrinth aus Riffen mit Strömungen, die in verschiedene Richtungen ziehen – manche helfen, manche treiben den Fisch zurück zu den Quallen.
