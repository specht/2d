---
titel: Förderbänder und Rolltreppen
kategorie: Welt bauen
stufe: 2
kurz: Am Flughafen muss Pip nicht laufen. Das Laufband trägt sie durch die Halle, die Rolltreppe hinauf zu den Gates.
tasten_zeigen: true
skala: 2
# the camera shows the whole terminal, down to its floor
bild_hoch: 1
schritte: 2
# the gallery card: Pip on the escalator
standbild: 4.2
szene:
  himmel: ['#41a6f6', '#c3e6f6']
  # the terminal is wider than the screen: the camera follows Pip
  kamera: { bildhoehe: 144 }
  legende: { t: vorfeld, w: terminalfenster, s: sitzbank, B: abflugtafel, G: gate_schild, '|': saeule, p: pflanze,
             '[': gelaender_anfang, '-': gelaender, ']': gelaender_ende, x: rolltreppe_gelaender, y: rolltreppe_gelaender_oben,
             '#': flughafen_boden, a: laufband_anfang, l: laufband, e: laufband_ende,
             r: rolltreppe_flughafen, u: rolltreppe_unter, n: rolltreppe_panel, g: galerie }
  ebenen:
    - name: Vorfeld
      kollision: false
      karte: |
        ..........................
        ..........................
        ..........................
        ..........................
        tttttttttttttttttttttttttt
        ..........................
    - name: Fenster
      kollision: false
      karte: |
        wwwwwwwwwwwwwwwwwwwwwwwwww
        wwwwwwwwwwwwwwwwwwwwwwwwww
        wwwwwwwwwwwwwwwwwwwwwwwwww
        wwwwwwwwwwwwwwwwwwwwwwwwww
        wwwwwwwwwwwwwwwwwwwwwwwwww
        ..........................
    - name: Halle
      kollision: false
      karte: |
        ....................B...G.
        .....B..............ps....
        ............G.............
        ...................|...|..
        s..................|...|..
        ..........................
    - name: Geländer
      kollision: false
      karte: |
        ..........................
        ................y--]......
        ...............x..........
        ..............x...........
        ....[----]................
        ..........................
    - name: Welt
      karte: |
        ..........................
        ..........................
        ................rggggggggg
        ...............ru.........
        .P............run.........
        ####alllle################
# Pip steps onto the walkway and lets go: it carries her through the hall. Then
# a few steps to the escalator, which takes her up, and on to the gate.
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.35 }
  - { t: 3.2, halten: rechts, dauer: 0.55 }
  - { t: 5.1, halten: rechts, dauer: 1.0 }
dauer: 6.6
erwartet:
  figur_hoeher_als: 3
  figur_rechts_von: 20
---
## Kurz gesagt

1. Ein Block mit der Eigenschaft **Förderband / Rolltreppe** nimmt jede Figur mit, die darauf steht.
2. **Richtung** und **Geschwindigkeit** stellst du selbst ein.
3. Hat derselbe Sprite auch **Schräge / Treppe**, wird daraus eine Rolltreppe.

## Das brauchst du

- **Das musst du zeichnen:** ein Band-Stück, das man aneinanderreihen kann, mit ein paar Bildern, in denen die Rillen weiterwandern. Für die Rolltreppe eine Treppe mit wandernden Stufen.
- **Das kannst du später dazumalen:** Enden mit gelben Kanten, ein Glasgeländer, die Seitenwand unter der Rolltreppe – und einen Ort, an dem das alles steht: hier einen Flughafen mit großen Fenstern, Anzeigetafeln und Wartebänken.

![Laufband (Anfang)](katalog:flughafen/laufband_anfang 60)
![Laufband](katalog:flughafen/laufband 60)
![Laufband (Ende)](katalog:flughafen/laufband_ende 60)
![Rolltreppe](katalog:flughafen/rolltreppe 60)
![Rolltreppe (unten drunter)](katalog:flughafen/rolltreppe_unter)
![Rolltreppe (Seitenwand)](katalog:flughafen/rolltreppe_panel)
![Glasgeländer](katalog:flughafen/gelaender)
![Abflugtafel](katalog:flughafen/abflugtafel 1)

## Schritt für Schritt

1. Zeichne das Laufband: oben die Lauffläche mit Rillen, darunter eine silberne Seite. Im nächsten Bild wandern die Rillen **1 Pixel** weiter. Wiederholt sich das Muster alle 6 Pixel, brauchst du 6 Bilder – dann passt das letzte wieder zum ersten. Anfang und Ende bekommen gelbe Kanten, damit man sieht, wo das Band beginnt.
2. Gib dem Sprite die Block-Eigenschaften (*man kann nicht von oben reinfallen* usw.) – man soll ja darauf stehen können.
3. **Eigenschaft hinzufügen → Förderbänder → Förderband / Rolltreppe**. Pip benutzt **Richtung: nach rechts** und **Geschwindigkeit 1**.
4. Im Zustand: **Framerate 60** und **Phase** überall auf **0**. Dann laufen alle Band-Stücke im Gleichtakt, und die Streifen passen über die ganze Länge.
5. Für die Rolltreppe: eine Treppe mit Stufen, die schräg nach oben wandern – auch hier 1 Pixel pro Bild (bei 6 Pixel breiten Stufen also 6 Bilder). Sie bekommt **Schräge / Treppe** mit **Richtung: nach rechts oben** und **Förderband / Rolltreppe** mit **Richtung: nach rechts**. Mal alles an der Rolltreppe **parallel zur Schräge**: die Stufenkanten, den schwarzen Streifen darunter, die Streifen der Seitenwand. Dann passen die Stücke schräg aneinander, und in der Mitte entsteht keine Delle.
6. Unter die Rolltreppe kommt ihre **Seitenwand**: direkt darunter ein Stück, in dem der schwarze Streifen weiterläuft, weiter unten nur noch Seitenwand. Über jede Stufe gehört ein Stück **Glasgeländer** mit Handlauf – in eine Ebene hinter der Figur.
7. **Der Ort:** Große Fenster, ein Vorfeld draußen, Anzeigetafeln, Wartebänke und ein Schild zu den Gates erzählen: Das ist ein Flughafen. Oben liegt eine Galerie auf Säulen – dorthin fährt die Rolltreppe.
8. Probier es aus: Pip stellt sich aufs Laufband und lässt alle Tasten los – das Band trägt sie durch die Halle. Ein paar Schritte, dann fährt die Rolltreppe sie hinauf zu den Gates.

## Tipps

> **Tipp:** Die Animation soll zur Geschwindigkeit passen. Wandern die Streifen 1 Pixel pro Bild, dann gilt: **Framerate = Geschwindigkeit × 60**. Bei Geschwindigkeit 1 also 60 fps. Kleine Schritte von 1 Pixel sehen viel ruhiger aus als große – große Sprünge flimmern.

- Läuft die Figur **mit** dem Band, ist sie schneller. Läuft sie **dagegen**, wird sie langsamer – und auf einem schnellen Band kommt sie kaum vom Fleck, wie auf einem Laufband.
- Ein Band **nach links** ist einfach das gespiegelte Bild – die Bewegung dreht sich beim Spiegeln mit.
- Normalerweise fahren auch Gegner mit. Ein Band kann einen Gegner also direkt in die Stacheln tragen. Soll er stehen bleiben, schalte **nimmt auch Gegner mit** aus.
- Beim Springen nimmt das Band dich nicht mit. Erst wenn du wieder landest, geht es weiter.
- Auf der Rolltreppe schaut die Figur weiter in ihre Richtung – anders als auf einer Leiter.

## Wenn's nicht klappt

- **Die Figur bewegt sich nicht:** Die Eigenschaft sitzt beim falschen Sprite, oder die **Geschwindigkeit** ist 0.
- **Die Figur fällt durchs Band:** Es fehlt die Block-Eigenschaft *man kann nicht von oben reinfallen*.
- **Die Streifen springen an den Übergängen:** Stell die **Phase** auf 0 – sonst beginnt jedes Stück an einer anderen Stelle der Animation.
- **Die Rolltreppe fährt nach unten statt nach oben:** Die **Richtung** des Förderbands passt nicht zur Schräge. Bei einer Treppe nach rechts oben muss das Band **nach rechts** laufen.

## Mach mehr draus

Bau ein Einkaufszentrum mit Rolltreppen über mehrere Stockwerke – oder eine Fabrik mit Förderbändern in beide Richtungen, dazwischen Lücken und Stacheln, und einem Glibber, der auf dem Band herumfährt.
