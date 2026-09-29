---
titel: Himmel mit Farbverlauf
kategorie: Level gestalten
stufe: 1
kurz: Tag, Sonnenuntergang, Nacht – der Himmel ist ein Farbverlauf, kein Sprite.
farben: 256
szene:
  himmel: ['#41a6f6', '#73eff7']
  ebenen:
    - name: Berge
      kollision: false
      karte: |
        ............
        ............
        ............
        N.......N...
        ............
    - name: Tannen
      kollision: false
      karte: |
        ............
        ............
        ............
        Q.......Q...
        ............
    - name: Welt
      karte: |
        ............
        ............
        ............
        .P..........
        ############
ablauf:
  - { t: 0.4, halten: rechts, dauer: 0.5 }
dauer: 1.6
varianten:
  - szene:
      himmel:
        farben: [['#29366f', 0.0, 1.0], ['#5d275d', 1.0, 1.0], ['#ef7d57', 0.0, 0.0], ['#ffcd75', 1.0, 0.0]]
  - szene:
      himmel: ['#1a1c2c', '#29366f']
      ebenen:
        - name: Sterne
          kollision: false
          karte: |
            .+.++.+..++.
            +.+..+.++.+.
            ............
            ............
            ............
        - name: Berge
          kollision: false
          karte: |
            ............
            ............
            ............
            N.......N...
            ............
        - name: Tannen
          kollision: false
          karte: |
            ............
            ............
            ............
            Q.......Q...
            ............
        - name: Welt
          karte: |
            ............
            ............
            ............
            .P..........
            ############
---
## Kurz gesagt

1. Der Himmel ist **kein Sprite**, sondern eine Ebene **Hintergrund** mit Farben.
2. Zwei Farben ergeben einen Verlauf von oben nach unten, vier Farben einen Verlauf in alle Richtungen.
3. Mit anderen Farben wird aus demselben Level Tag, Sonnenuntergang oder Nacht.

## Das brauchst du

- **Das musst du zeichnen:** nichts für den Himmel selbst. Berge und Bäume davor sind normale Sprites.
- **Das kannst du später dazumalen:** Sterne als kleines Sprite mit viel Durchsichtigkeit.

![Berge](katalog:welt/berge)
![Tannen](katalog:welt/tannen)
![Sterne](katalog:welt/sterne)

## Schritt für Schritt

1. Neue Ebene über **+ → Hintergrund**. Schieb sie in der Layer-Liste ganz nach unten.
2. Stell **Art: Farbe** und **Farben: zwei Farben** ein.
3. Bei **Farbe 1** und **Farbe 2** wählst du die Farben aus. Im Level siehst du zwei Punkte, die du verschieben kannst: Dort ist die Farbe am kräftigsten.
4. Zieh das Rechteck der Ebene so groß, dass es das ganze Level bedeckt.
5. Für einen Sonnenuntergang: **Farben: vier Farben**. Oben dunkles Lila und Blau, unten Orange und Gelb.
6. Für die Nacht: fast Schwarz nach Dunkelblau. Die Sterne kommen in eine eigene Ebene darüber, **Kollisionen erkennen** aus.

## Tipps

> **Tipp:** Unten am Horizont ist der Himmel **heller** als oben. Das sieht fast immer natürlicher aus.

- Pass die Berge an den Himmel an: Bei Sonnenuntergang dürfen sie lila und rötlich werden, in der Nacht fast schwarz.
- Die **Hintergrundfarbe** in den Level-Eigenschaften sieht man nur dort, wo kein Hintergrund liegt. Stell sie auf eine der Himmelsfarben, dann fällt ein zu kleines Rechteck nicht auf.
- Sterne sollen weit weg wirken: Gib ihrer Ebene eine **Parallaxe** von **1**, dann bleiben sie stehen wie der Himmel.

## Wenn's nicht klappt

- **Der Himmel verdeckt alles:** Die Hintergrund-Ebene steht in der Layer-Liste zu weit oben. Schieb sie ganz nach unten.
- **Am Rand hört der Himmel auf:** Das Rechteck ist kleiner als das Level. Zieh es größer.
- **Der Verlauf steht auf dem Kopf:** Tausch die Farben oder verschieb die Farbpunkte.

## Mach mehr draus

Mach aus einem Level drei: morgens, abends und nachts – mit denselben Sprites und nur einem anderen Himmel.
