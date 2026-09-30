---
titel: Parallaxe – Hintergründe mit Tiefe
kategorie: Level gestalten
stufe: 3
kurz: Ferne Berge ziehen langsam vorbei, nahe Tannen schneller – so wirkt die Welt tief.
farben: 256
skala: 4
schritte: 2             # two simulation steps per frame: half the file size
szene:
  himmel: ['#41a6f6', '#73eff7']
  kamera: { bildhoehe: 144 }
  ebenen:
    - name: Wolken
      parallaxe: 0.9
      kollision: false
      karte: |
        .C.........C........C.......
        ............................
        ............................
        ............................
        ............................
        ............................
    - name: Ferne Berge
      parallaxe: 0.75
      kollision: false
      karte: |
        ............................
        ............................
        ............................
        A.......A.......A.......A...
        ............................
        ............................
    - name: Berge
      parallaxe: 0.55
      kollision: false
      karte: |
        ............................
        ............................
        ............................
        ............................
        N.......N.......N.......N...
        ............................
    - name: Wald
      parallaxe: 0.35
      kollision: false
      karte: |
        ............................
        ............................
        ............................
        ............................
        W.......W.......W.......W...
        ............................
    - name: Tannen
      parallaxe: 0.15
      kollision: false
      karte: |
        ............................
        ............................
        ............................
        ............................
        Q...............Q...........
        ............................
    - name: Welt
      karte: |
        ..........................MM
        ..........................MM
        ..........................MM
        ..........................MM
        .P........................MM
        ############################
    - name: Vordergrund
      parallaxe: -0.35
      kollision: false
      karte: |
        ............................
        ............................
        ............................
        ............................
        ............................
        Z.......Z.......Z.......Z...
ablauf:
  - { t: 0.2, halten: rechts, dauer: 2.0 }
  - { t: 2.5, halten: links, dauer: 2.016667 }
  - { t: 4.8, halten: rechts, dauer: 0.016667 }
dauer: 5.1
schleife: true
---
## Kurz gesagt

1. Jede Ebene hat eine **Parallaxe** zwischen −1 und 1.
2. **0** bewegt sich mit der Welt, **1** bleibt stehen wie der Himmel, dazwischen wird es langsamer.
3. Ferne Dinge bekommen große Werte, nahe kleine – und ein Vordergrund einen negativen.

## Das brauchst du

- **Das musst du zeichnen:** zwei oder drei große Hintergrund-Sprites, zum Beispiel Berge und Wald. Den Himmel malst du **nicht** – er ist die Hintergrund-Farbe des Levels.
- **Das kannst du später dazumalen:** Wolken, einzelne Tannen, einen dunklen Vordergrund mit Gräsern.

![Ferne Berge](katalog:welt/berge_fern)
![Berge](katalog:welt/berge)
![Wald](katalog:welt/wald)
![Tannen](katalog:welt/tannen)
![Vordergrund](katalog:welt/vordergrund)
![Wolke](katalog:welt/wolke)

## Schritt für Schritt

1. Mach das Level **breiter als den Bildschirm** – sonst bewegt sich die Kamera nicht, und man sieht keine Parallaxe.
2. Den Himmel legst du als Ebene **Hintergrund** mit einem Farbverlauf an (Pip: hellblau nach türkis).
3. Neuer Sprite für die Berge: **Funktionen → Sprite → Größe ändern**, zum Beispiel **192 × 72**. Die Berge von Pip sind so gemalt, dass rechter und linker Rand zusammenpassen.
4. Für jede Tiefe eine eigene Ebene: Wolken, ferne Berge, Berge, Wald, Tannen. Setz die großen Sprites nebeneinander, bis sie das ganze Level füllen.
5. Stell bei **Layer-Eigenschaften** die **Parallaxe** ein. Pip benutzt: Wolken **0,9**, ferne Berge **0,75**, Berge **0,55**, Wald **0,35**, Tannen **0,15**, die Welt **0**.
6. Für den Vordergrund: eine Ebene ganz oben in der Layer-Liste mit **Parallaxe −0,35**. Sie zieht schneller vorbei als die Welt.
7. Probier es aus und lauf einmal durchs Level. Stell zum Vergleich alle Parallaxen auf 0: Dann klebt alles flach aneinander.

## Tipps

> **Tipp:** Je weiter weg, desto **heller, blauer und blasser**. So macht es auch die echte Luft. Nahe Dinge sind kräftig und dunkel, ferne verschwimmen mit dem Himmel.

- **Dithering** mischt zwei Farben mit einem Pixelmuster, zum Beispiel wie ein Schachbrett. So bekommst du Übergänge, obwohl die Palette nur wenige Farben hat: Nebel am Fuß der Berge, weiche Schatten an den Hängen, Wolken, die unten grau werden.
- Für Dithering reichen drei Muster: jedes vierte Pixel (25 %), Schachbrett (50 %) und jedes vierte Pixel frei (75 %).
- Ebenen mit Parallaxe haben **nie Kollisionen**. Böden und Wände gehören in eine Ebene mit Parallaxe 0.
- Mit Parallaxe verschiebt sich eine Ebene auch nach oben und unten, wenn die Kamera das tut. Schau sie dir im Level-Editor an der Stelle an, an der die Spielfigur startet.

## Wenn's nicht klappt

- **Alles bewegt sich gleich schnell:** Das Level passt auf einen Bildschirm, die Kamera bleibt stehen. Mach es breiter. Oder die Parallaxe ist noch 0.
- **Am Ende hört der Hintergrund auf:** Setz rechts noch ein paar Sprites dazu. Bei Parallaxe nahe 0 brauchst du fast so viel Breite wie das Level, bei Parallaxe nahe 1 viel weniger.
- **Zwischen den Bergen ist eine Kante:** Der rechte Rand des Sprites passt nicht zum linken. Mal beide Ränder auf dieselbe Höhe.
- **Die Figur läuft hinter den Bergen:** Die Ebene mit den Bergen steht in der Layer-Liste über der Welt. Schieb sie nach unten.
- **Der Vordergrund verdeckt die Figur:** Mal ihn dunkler und niedriger, oder nimm eine Parallaxe näher an 0.

## Mach mehr draus

Bau eine Nacht-Version: dunkelblauer Himmel, dunklere Berge – und Sterne in einer Ebene mit Parallaxe **1**. Die bleiben dann stehen, egal wie weit du läufst.
