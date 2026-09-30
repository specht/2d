---
titel: Himmel mit Farbverlauf
kategorie: Level gestalten
stufe: 1
skala: 2
kurz: Tag, Sonnenuntergang, Sternennacht – der Himmel ist ein Farbverlauf, auf Wunsch knusprig gepixelt.
farben: 256
szene:
  himmel: { farben: [['#41a6f6', 0.5, 1.0], ['#73eff7', 0.5, 0.0]], dither: noise, stufen: 5 }
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
        dither: bayer
        stufen: 6
  - szene:
      himmel: { farben: [['#1a1c2c', 0.5, 1.0], ['#29366f', 0.5, 0.0]], dither: noise, stufen: 4 }
      effekte:
        - { effekt: stars, farbe: '#f4f4f4ff', vorne: false }
---
## Kurz gesagt

1. Der Himmel ist **kein Sprite**, sondern eine Ebene **Hintergrund** mit Farben.
2. Zwei Farben ergeben einen Verlauf von oben nach unten, vier Farben einen Verlauf in alle Richtungen.
3. Mit **Dithering** wird der weiche Verlauf zu echter Pixel-Art: wenige Farbstufen, fein gemischt.

## Das brauchst du

- **Das musst du zeichnen:** nichts für den Himmel selbst. Berge und Bäume davor sind normale Sprites.
- **Das kannst du später dazumalen:** nichts – die Sterne der Nacht sind ein Effekt.

![Berge](katalog:welt/berge)
![Tannen](katalog:welt/tannen)

## Schritt für Schritt

1. Neue Ebene über **+ → Hintergrund**. Schieb sie in der Layer-Liste ganz nach unten.
2. Stell **Art: Farbe** und **Farben: zwei Farben** ein.
3. Bei **Farbe 1** und **Farbe 2** wählst du die Farben aus. Im Level siehst du zwei Punkte, die du verschieben kannst: Dort ist die Farbe am kräftigsten.
4. Zieh das Rechteck der Ebene so groß, dass es das ganze Level bedeckt.
5. Stell **Dithering** auf **Rauschen** und **Farbstufen** auf **5**. Jetzt besteht der Himmel aus fünf Blautönen, die sich Pixel für Pixel mischen.
6. Für einen Sonnenuntergang: **Farben: vier Farben** – oben dunkles Lila und Blau, unten Orange und Gelb. Hier mit **Dithering: Raster** und **6** Stufen.
7. Für die Nacht: fast Schwarz nach Dunkelblau, **Rauschen** mit **4** Stufen. Darüber eine zweite Hintergrund-Ebene mit **Art: Effekt** und **Effekt: Sternenhimmel**.

## Tipps

> **Tipp:** **Rauschen** wirkt körnig wie ein altes Foto, **Raster** mischt in einem regelmäßigen Muster wie auf alten Spielkonsolen. Wenige Farbstufen (2 bis 5) sehen grob und mutig aus, viele (16 und mehr) fast wie ein weicher Verlauf.

- Mit Dithering wird der Himmel automatisch **pixelig (wie Sprites)**: ein Farbpunkt pro Spielpixel. Das Häkchen kannst du auch ohne Dithering setzen – und bei jedem Effekt.
- Unten am Horizont ist der Himmel **heller** als oben. Das sieht fast immer natürlicher aus.
- Pass die Berge an den Himmel an: Bei Sonnenuntergang dürfen sie lila und rötlich werden, in der Nacht fast schwarz.
- Die Sterne funkeln von selbst und werden zum Horizont hin weniger. Die beiden weißen Punkte des Effekts bestimmen, wo sie ausblenden.
- Die **Hintergrundfarbe** in den Level-Eigenschaften sieht man nur dort, wo kein Hintergrund liegt. Stell sie auf eine der Himmelsfarben, dann fällt ein zu kleines Rechteck nicht auf.

## Wenn's nicht klappt

- **Der Himmel verdeckt alles:** Die Hintergrund-Ebene steht in der Layer-Liste zu weit oben. Schieb sie ganz nach unten.
- **Am Rand hört der Himmel auf:** Das Rechteck ist kleiner als das Level. Zieh es größer.
- **Der Verlauf steht auf dem Kopf:** Tausch die Farben oder verschieb die Farbpunkte.
- **Das Dithering sieht bunt gesprenkelt aus:** Die beiden Farben sind sehr verschieden (zum Beispiel Rot und Grün). Nimm zwei Farben, die gut zusammenpassen, oder mehr Farbstufen.
- **Man sieht keine Sterne:** Die Sternen-Ebene liegt unter dem Himmel. Sie muss in der Layer-Liste darüber stehen.

## Mach mehr draus

Mach aus einem Level drei: morgens, abends und nachts – mit denselben Sprites und nur einem anderen Himmel.
