---
titel: Halbdurchsichtige Sprites
kategorie: Level gestalten
stufe: 2
kurz: Wasser, Licht, Glas und Geister – Farben, durch die man hindurchsieht.
farben: 256
szene:
  himmel: ['#29366f', '#b13e53']
  ebenen:
    - name: Hintergrund
      kollision: false
      karte: |
        ............
        ........MMM.
        ........MEM.
        ........MMM.
        ....===.....
        ............
    - name: Laterne
      kollision: false
      karte: |
        ............
        ............
        ............
        .J..........
        ............
        ............
    - name: Welt
      karte: |
        ............
        ............
        ..........G.
        .P..........
        ####...#####
        ============
    - name: Glas und Licht
      kollision: false
      vorne: true
      karte: |
        ............
        ............
        .........O..
        .Y..........
        ....SSS.....
        ............
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.3 }
  - { t: 0.95, drücken: springen }
dauer: 2.6
erwartet:
  figur_rechts_von: 8
---
## Kurz gesagt

1. Pixel können **halb durchsichtig** sein: Man sieht, was dahinter liegt.
2. So entstehen Wasser, Licht, Glasscheiben und Geister.
3. Liegt so ein Sprite in einer Ebene **vor** der Figur, färbt es die Figur mit ein.

## Das brauchst du

- **Das musst du zeichnen:** eine Wasserfläche und einen Lichtkegel mit halb durchsichtigen Farben.
- **Das kannst du später dazumalen:** eine Glasscheibe für ein Fenster, einen Geist als Gegner.

![Wasser](katalog:welt/wasser)
![Wasseroberfläche](katalog:welt/wasser_oben)
![Lichtkegel](katalog:welt/lichtkegel)
![Glasscheibe](katalog:welt/glas)
![Geist](katalog:welt/geist 6)

## Schritt für Schritt

1. Such dir im Malprogramm eine Farbe in der **Palette** aus. Darunter erscheinen Abwandlungen der Farbe. Die **unterste Reihe** geht von fast unsichtbar bis ganz deckend.
2. Wasser: Füll ein Sprite mit einem mittleren Blau aus der untersten Reihe. Für die Oberfläche malst du oben eine hellere, kräftigere Wellenlinie und lässt darüber alles durchsichtig.
3. Licht: Ein großes Sprite (**Funktionen → Sprite → Größe ändern**, hier 48 × 72) mit einem hellgelben Dreieck. Oben kräftiger, unten fast unsichtbar – das geht gut mit dem **Farbverlauf**.
4. Glas: fast durchsichtiges Hellblau, dazu ein paar weiße, schräge Striche als Glanz. In die Mauer kommt ein Stein mit einem Loch – das Glas liegt in einer eigenen Ebene davor.
5. Leg Wasser, Licht und Glas in eine Ebene mit **Kollisionen erkennen** aus. In der Layer-Liste steht sie **über** der Ebene mit der Figur.
6. Spiel es aus: Pip watet durchs Wasser und wird dabei blau, unter der Laterne wird er heller.

## Tipps

> **Tipp:** Mal halbdurchsichtige Sprites nie mit schwarzem oder weißem Hintergrund. Alles um das Wasser oder den Lichtkegel herum bleibt **ganz** durchsichtig.

- Malst du mit einer halb durchsichtigen Farbe über einen Pixel, wird er **ersetzt** und nicht gemischt. Probier die Stufen in der untersten Reihe aus, bis es passt.
- Licht wirkt am schönsten in dunklen Levels: ein Abend- oder Nachthimmel und helles, warmes Gelb.
- Ein Geist ist ein ganz normaler Gegner – nur mit halb durchsichtigen Farben. Die Augen dürfen kräftiger sein, damit man ihn gut erkennt.
- Liegt das Wasser **hinter** der Figur, läuft sie davor her, als wäre es nur ein Bild. Liegt es **davor**, steckt sie mittendrin.

## Wenn's nicht klappt

- **Man sieht einen Kasten um den Lichtkegel:** Die Pixel um den Kegel sind nicht ganz durchsichtig. Radier sie weg.
- **Die Figur wird im Wasser nicht blau:** Die Wasser-Ebene liegt in der Layer-Liste unter der Figur. Schieb sie nach oben.
- **Das Wasser sieht grau aus:** Hinter dem Wasser ist nur der Himmel. Setz in eine hintere Ebene Erde, dann sieht es wie ein Becken aus.
- **Die Figur schwimmt nicht:** Stimmt – das Wasser ist nur ein Bild ohne Eigenschaften. Unter dem Wasser braucht es festen Boden, sonst fällt die Figur hindurch.

## Mach mehr draus

Bau eine Höhle mit leuchtenden Pilzen, einen Nebel, der vor dem Level hängt, oder ein Spukschloss mit Geistern hinter den Fenstern.
