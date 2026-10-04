---
titel: Schweben im Weltall
kategorie: Wasser & Weltall
stufe: 3
kurz: Draußen vor der Raumstation gibt es keine Schwerkraft – Pip treibt durchs All und muss selbst bremsen. Auf dem Mond hüpft sie dafür riesige Sprünge.
skala: 4
schritte: 2
# the gallery card: Pip has turned round and still drifts on
standbild: 2.9
szene:
  himmel: ['#1a1c2c', '#29366f']
  kamera: { bildhoehe: 144 }
  legende: { P: astronaut, W: station, B: station_boden, L: luke, b: bullauge, o: stern, S: satellit, G: planet, i: station }
  # in space: no gravity, and Pip glides on for a long time
  bewegung: { art: schweben, gleiten: 98, tempo: 0.7 }
  bewegungsbereiche:
    # inside the station there is gravity: Pip walks
    - { name: Station, art: laufen, rechtecke: [[0, 0, 6.5, 6]] }
  effekte:
    # far away: the stars move only a little when the camera moves (Parallaxe 0.9)
    - { effekt: stars, name: Sterne, farbe: '#f4f4f4ff', vorne: false, parallaxe: 0.9 }
    # the inside of the station is darker than its walls
    - { effekt: farbe, name: Innen, farben: ['#8a93b0', '#6c7594'], mischmodus: abdunkeln, bereich: [1, 1, 5, 4], hinter: Fenster }
  ebenen:
    - name: Planet
      kollision: false
      # between the stars and the station: it drifts by slower than the station
      parallaxe: 0.7
      karte: |
        ..............................
        ..............................
        .........G....................
        ..............................
        ..............................
        ..............................
    - name: Innenraum
      kollision: false
      karte: |
        ..............................
        .iiiii........................
        .iiiii........................
        .iiiii........................
        .iiiiiL.......................
        ..............................
    - name: Fenster
      kollision: false
      karte: |
        ..............................
        ...b.............S............
        ..............................
        ..............................
        ..............................
        ..............................
    - name: Welt
      karte: |
        WWWWWWW.......................
        W.....W.......................
        W.....W.....o.................
        W..............o..............
        W.P...........................
        BBBBBBB.......................
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.5 }
  - { t: 1.9, halten: hoch, dauer: 0.5 }
  # she turns round: at first she keeps drifting on, then she slowly comes back
  - { t: 2.6, halten: links, dauer: 1.4 }
dauer: 6.0
erwartet:
  punkte: 20
  figur_rechts_von: 8
  figur_hoeher_als: 2
# a picture of its own in the text: the same astronaut on the moon
einzelbilder: true
varianten:
  # the camera a little higher: more sky with the Earth, less under the ground
  - bild_hoch: 1.5
    szene:
      himmel: ['#1a1c2c', '#333c57']
      legende: { P: astronaut, M: mondboden, X: mondgestein, s: mondstein, E: erde_planet }
      # on the moon: walking and jumping as always, but with less gravity
      bewegung: { art: laufen, schwerkraft: 60 }
      bewegungsbereiche: []
      effekte:
        - { effekt: stars, name: Sterne, farbe: '#f4f4f4ff', vorne: false, parallaxe: 0.9 }
      ebenen:
        - name: Erde
          kollision: false
          parallaxe: 0.7
          karte: |
            ..............................
            ..............................
            .......E......................
            ..............................
            ..............................
            ..............................
        - name: Steine
          kollision: false
          karte: |
            ..............................
            ..............................
            ..............................
            ..............................
            ....s.................s...s...
            ..............................
        - name: Welt
          karte: |
            ..............................
            ..............................
            ..............................
            .........X....................
            .P.......X....................
            MMMMMMMMMMMMMM...MMMMMMMMMMMMM
    ablauf:
      - { t: 0.3, halten: rechts, dauer: 3.3 }
      - { t: 0.75, drücken: springen }
      - { t: 1.9, drücken: springen }
    dauer: 4.2
    erwartet:
      figur_rechts_von: 20
      lebt: true
---
## Kurz gesagt

1. Im All gibt es keine Schwerkraft: **Bewegung im ganzen Level: Schweben**.
2. Wer schwebt, treibt immer weiter – mit **Gleiten 98 %** muss Pip selbst bremsen, indem sie in die andere Richtung drückt.
3. In der Raumstation gibt es Schwerkraft: Dort liegt ein Bewegungsbereich mit **Laufen**. Und auf dem Mond hüpft Pip mit weniger Schwerkraft riesige Sprünge.

## Das brauchst du

- **Das musst du zeichnen:** Pip im Raumanzug (Stehen, Laufen, Springen), Wände und Boden der Raumstation und Sterne zum Einsammeln.
- **Das kannst du später dazumalen:** ein Bild, auf dem Pip schwebt (**Spielfigur schwebt**), eine Luftschleuse, einen Satelliten und einen Planeten.

![Pip im Raumanzug](katalog:weltall/astronaut_stehen 3)
![Pip läuft](katalog:weltall/astronaut_laufen 10)
![Pip schwebt](katalog:weltall/astronaut_schweben 2)
![Stern](katalog:weltall/stern 6)
![Satellit](katalog:weltall/satellit)
![Ringplanet](katalog:weltall/planet)

## Schritt für Schritt

1. **Das All:** In den **Level-Eigenschaften** stellst du **Bewegung im ganzen Level: Schweben** ein, mit **Gleiten 98 %** und **Tempo 0,7 ×**. Einen Sternenhimmel gibt es als **Hintergrund → Effekt → Sternenhimmel**. Gib dieser Ebene **Parallaxe 0,9**: Die Sterne sind am weitesten weg und ziehen fast gar nicht vorbei.
2. **Die Raumstation:** Wände und Boden sind feste Blöcke. Rechts ist die Luftschleuse offen. Leg über die Station einen **Bewegungsbereich** mit **Bewegung: Laufen – andere Schwerkraft** und **Schwerkraft 100 %**: Drinnen läuft und springt Pip wie immer.
3. **Pip schwebt:** Gib Pip einen Zustand **Spielfigur schwebt nach rechts** – Arme und Beine gespreizt. Ohne dieses Bild nimmt das Spiel die Bilder fürs Laufen, Springen und Fallen.
4. Draußen steuern die Pfeiltasten in alle vier Richtungen. Pip kommt aber nur langsam in Fahrt – und lässt du los, treibt sie einfach weiter. Zum Anhalten drückst du in die Gegenrichtung.
5. Verteil ein paar **Sterne** zum Einsammeln im All. Ein **Satellit** und ein **Planet** (in einer Ebene mit **Parallaxe 0,7** – näher als die Sterne, weiter weg als die Station: Er zieht langsamer vorbei als die Station, aber schneller als die Sterne) machen den Weltraum groß.
6. Probier es aus: Pip läuft aus der Luftschleuse und treibt ins All. Mit **↑** steigt sie zu einem Stern. Dann drückt sie **←**: Sie dreht sich sofort um – treibt aber erst noch ein Stück weiter, bis sie langsam wieder zurückkommt, zum zweiten Stern. So fühlt sich Schweben an: Man lenkt nicht, man gibt Schwung.

![Auf dem Mond](variante:1)

## Auf dem Mond

Auf dem Mond gibt es Schwerkraft, nur weniger als auf der Erde. Dafür stellst du **Bewegung im ganzen Level: Laufen – andere Schwerkraft** ein, hier mit **Schwerkraft 60 %**. Pip läuft wie immer, springt aber viel höher und weiter – über einen Felsbrocken und einen Krater.

> **Tipp:** Auf dem echten Mond ist die Schwerkraft nur ein Sechstel so stark wie auf der Erde – etwa **17 %**. Probier es aus: Dann fliegt Pip so hoch, dass sie oben aus dem Bild springt. Für ein Spiel ist etwas mehr Schwerkraft oft besser.

## Tipps

- **Gleiten** macht den Unterschied zwischen Wasser und Weltall: Unter Wasser bremst das Wasser (90 %), im All bremst fast nichts (98 %).
- Ein Bewegungsbereich mit **Strömung** im All wird zum Sog eines Schwarzen Lochs oder zum Schub eines Triebwerks.
- Auch Gegner schweben im All – ein **Jäger** treibt dir in alle Richtungen hinterher. Ein Meteorit, der geradeaus durchs All fliegt, ist ein Gegner mit dem Verhalten **Flatterer**.

## Wenn's nicht klappt

- **Pip fällt aus der Station ins Nichts:** Draußen ist beim Level noch **normal** eingestellt – stell **Schweben** ein.
- **Pip schwebt auch in der Station:** Der Bewegungsbereich **Laufen** deckt die Station nicht ganz ab. Es zählt die Mitte der Figur.
- **Pip hält nie an:** Das ist im All so! Drück in die Gegenrichtung, oder stell **Gleiten** kleiner ein.

## Mach mehr draus

Bau eine Raumstation mit mehreren Räumen – manche mit Schwerkraft, manche ohne – und Sterne, die nur zu erreichen sind, wenn man sich geschickt treiben lässt.
