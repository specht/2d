---
titel: Level, die echt wirken
kategorie: Level gestalten
stufe: 2
kurz: Nichts schwebt einfach so – Pfosten, Ketten und Erde halten die Welt zusammen.
farben: 256            # many colours: avoid banding in the sky
szene:
  ebenen:
    - name: Stützen
      kollision: false
      karte: |
        ........cc..
        ............
        ............
        ....||......
        ....||......
        ....||......
    - name: Welt
      karte: |
        ............
        ........##..
        ....##......
        .P..........
        ####....####
        ====....====
vorher:
  szene:
    ebenen:
      - name: Welt
        karte: |
          ............
          ........##..
          ....##......
          .P..........
          ####....####
          ............
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.5 }
  - { t: 0.45, drücken: springen }
  - { t: 1.4, halten: rechts, dauer: 0.6 }
  - { t: 1.45, drücken: springen }
  - { t: 2.3, halten: rechts, dauer: 0.2 }
dauer: 3.2
erwartet:
  figur_rechts_von: 9
---
## Kurz gesagt

1. In einer echten Welt schwebt nichts einfach so in der Luft.
2. Plattformen **stehen** auf etwas (Pfosten, Pfeiler) oder **hängen** an etwas (Ketten, Seile).
3. Der Boden ist **dick** – unter dem Gras kommt Erde bis zum Bildrand.

## Das brauchst du

- **Das musst du zeichnen:** Stützen: einen Pfosten, einen Pfeiler, eine Kette. Dazu Erde für unter den Boden.
- **Das kannst du später dazumalen:** Wurzeln unter einer schwebenden Insel, Seile, Balken.

![Pfosten](katalog:welt/pfosten)
![Pfeiler](katalog:welt/pfeiler)
![Kette](katalog:welt/kette)
![Wurzeln](katalog:welt/wurzeln)

## Schritt für Schritt

1. Schau dir dein Level an und frag bei jedem Block: **Was hält den fest?**
2. Neue Ebene „Stützen“ mit **Kollisionen erkennen** aus. In der Layer-Liste steht sie **unter** der Welt, damit die Stützen hinten liegen.
3. Unter Plattformen, die auf dem Boden stehen könnten: Pfosten oder Pfeiler bis ganz nach unten.
4. Über Plattformen, die hoch oben hängen: Ketten bis zum oberen Bildrand oder bis zu einer Decke.
5. Unter die oberste Bodenreihe: Erde, bis das Bild zu Ende ist. Dann steht die Welt auf festem Grund.
6. Spiel es aus: Das Level spielt sich genauso, sieht aber viel echter aus.

## Tipps

> **Tipp:** Die Stützen ändern nichts am Spiel. Sie sind nur gemalt und liegen in einer Ebene ohne Kollisionen. Die Figur läuft davor entlang.

- **Material passt zusammen:** Holzbretter auf Holzpfosten, Steinplatten auf Steinpfeilern, Metall an Ketten.
- **Schweben ist erlaubt – mit Grund:** Eine Zauberinsel mit Wurzeln darunter oder eine Wolke sieht gewollt aus, ein einzelner Grasblock nicht.
- **Größen passen zusammen:** Türen sind etwas größer als die Figur, Treppenstufen etwas kleiner.
- Mauern gehen bis zum Boden, Dächer liegen auf Wänden, Leitern führen irgendwohin.

## Wenn's nicht klappt

- **Die Figur bleibt an einem Pfosten hängen:** Die Stützen liegen in einer Ebene mit **Kollisionen erkennen** oder haben Block-Eigenschaften.
- **Die Stützen verdecken die Figur:** Schieb die Ebene „Stützen“ in der Layer-Liste nach unten.
- **Es sieht immer noch schwebend aus:** Reicht die Stütze wirklich bis zum Boden oder bis zur Decke? Eine halbe Kette hält nichts.

## Mach mehr draus

Nimm dein eigenes Level und such fünf schwebende Blöcke. Gib jedem eine Stütze – vorher und nachher ein Bildschirmfoto machen!
