---
titel: Halbdurchsichtige Sprites
kategorie: Level gestalten
stufe: 2
kurz: Wasser, Licht, Glas und Geister – Farben, durch die man hindurchsieht, und Mischmodi zum Leuchten.
szene:
  himmel: ['#29366f', '#b13e53']
  anpassen:
    # the ghost only floats back and forth behind the two windows
    geist: { baddie: { behavior: { type: guard, range: 1 } } }
  ebenen:
    - name: Zimmer
      kollision: false
      karte: |
        ............
        ............
        ........yyy.
        ............
        ............
        ............
    - name: Geister
      kollision: false
      figuren: true           # the ghost stays here: behind the wall, visible through the windows
      karte: |
        ............
        ............
        .........G..
        ............
        ............
        ............
    - name: Hintergrund
      kollision: false
      karte: |
        ............
        .......MMMMM
        .......MEMEM
        .......MMMMM
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
        ............
        .P..........
        ####...#####
        ============
    - name: Glas und Licht
      kollision: false
      vorne: true
      karte: |
        ............
        ............
        ........O.O.
        .Y..........
        ....SSS.....
        ............
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.15 }
  - { t: 0.95, drücken: springen }
dauer: 3.0
erwartet:
  figur_rechts_von: 8
  gegner_leben: 1
  gegner_weg: 30
---
## Kurz gesagt

1. Pixel können **halb durchsichtig** sein: Man sieht, was dahinter liegt. So entstehen Wasser, Glas und Geister.
2. Mit dem **Mischmodus** eines Sprites wird es noch schöner: **Leuchten** macht Licht, **Aufhellen** lässt Geister schimmern, **Abdunkeln** färbt wie getöntes Glas.
3. Liegt so ein Sprite in einer Ebene **vor** der Figur, färbt es die Figur mit ein.

## Das brauchst du

- **Das musst du zeichnen:** eine Wasserfläche und einen Lichtkegel mit halb durchsichtigen Farben.
- **Das kannst du später dazumalen:** eine Glasscheibe für ein Fenster, einen Geist, der dahinter vorbeischwebt.

![Wasser](katalog:welt/wasser)
![Wasseroberfläche](katalog:welt/wasser_oben)
![Lichtkegel](katalog:welt/lichtkegel)
![Glasscheibe](katalog:welt/glas)
![Geist](katalog:welt/geist 6)

## Schritt für Schritt

1. Such dir im Malprogramm eine Farbe in der **Palette** aus. Darunter erscheinen Abwandlungen der Farbe. Die **unterste Reihe** geht von fast unsichtbar bis ganz deckend.
2. **Wasser:** Füll ein Sprite mit einem mittleren Blau aus der untersten Reihe. Für die Oberfläche malst du oben eine hellere, kräftigere Wellenlinie und lässt darüber alles durchsichtig.
3. Damit das Wasser sich bewegt, malst du mehrere Bilder, in denen die Wellen jeweils **1 Pixel** weiterwandern. Wiederholt sich die Welle alle 8 Pixel, reichen 8 Bilder für eine endlose Bewegung. Stell im Zustand **Framerate 8** und die **Phase** überall auf **0** – dann laufen die Wellen im Gleichtakt über alle Wasser-Sprites hinweg.
4. **Licht:** Ein großes Sprite (**Funktionen → Sprite → Größe ändern**, hier 48 × 72) mit einem hellgelben Dreieck, oben kräftiger, unten fast unsichtbar. Stell beim Sprite den **Mischmodus: Leuchten** ein. Jetzt wird alles darunter heller – auch die Figur, wenn sie hindurchläuft.
5. **Fenster:** In die Mauer kommt ein Stein mit einem Loch. Dahinter liegt eine Ebene mit einer dunklen Tapete – das Zimmer. Die Glasscheibe liegt in einer Ebene **vor** der Mauer und bekommt den **Mischmodus: Abdunkeln**. So färbt sie alles dahinter leicht türkis.
6. **Geist:** Ein ganz normaler Gegner mit dem Verhalten **Wächter** und einem kleinen **Bereich**. Er liegt in einer eigenen Ebene zwischen Zimmer und Mauer – man sieht ihn nur durch die Fenster. Mit dem **Mischmodus: Aufhellen** schimmert er wie Nebel.
7. Leg Wasser, Licht und Glas in eine Ebene ohne **Kollisionen erkennen**. In der Layer-Liste steht sie **über** der Ebene mit der Figur.
8. Probier es aus: Pip läuft durchs Licht, watet durchs Wasser und wird dabei blau – und im Haus schwebt jemand am Fenster vorbei.

## Die Mischmodi

- **Normal:** Die Farbe deckt so viel ab, wie sie undurchsichtig ist.
- **Leuchten:** Die Farben werden **addiert**. Es wird nur heller, nie dunkler – wie echtes Licht.
- **Aufhellen:** Wie Leuchten, aber sanfter: Nichts wird grell.
- **Abdunkeln:** Die Farben werden **multipliziert**. Es wird nur dunkler, nie heller.

Was dabei genau passiert, zeigt das Rezept *Mischmodi verstehen*. Den Mischmodus gibt es beim **Sprite** und bei der **Ebene**. Stellst du ihn bei einer Ebene ein, gilt er für alle Sprites darin – auch für Hintergrund-Ebenen mit Effekten.

## Tipps

> **Tipp:** Mal halbdurchsichtige Sprites nie mit schwarzem oder weißem Hintergrund. Alles um das Wasser oder den Lichtkegel herum bleibt **ganz** durchsichtig.

- Malst du mit einer halb durchsichtigen Farbe über einen Pixel, wird er **ersetzt** und nicht gemischt. Probier die Stufen in der untersten Reihe aus, bis es passt.
- Licht wirkt am schönsten in dunklen Levels: ein Abend- oder Nachthimmel und helles, warmes Gelb.
- Beim Geist mit **Aufhellen** verschwinden dunkle Augen fast ganz – dann schaut er mit leeren Augen. Magst du ihn lieber mit Augen, nimm **Normal**.
- Liegt das Wasser **hinter** der Figur, läuft sie davor her, als wäre es nur ein Bild. Liegt es **davor**, steckt sie mittendrin.

## Wenn's nicht klappt

- **Man sieht einen Kasten um den Lichtkegel:** Die Pixel um den Kegel sind nicht ganz durchsichtig. Radier sie weg.
- **Das Licht ist viel zu grell:** Mit **Leuchten** wird jede Farbe voll addiert. Nimm eine durchsichtigere Stufe aus der untersten Reihe.
- **Die Figur wird im Wasser nicht blau:** Die Wasser-Ebene liegt in der Layer-Liste unter der Figur. Schieb sie nach oben.
- **Das Wasser sieht grau aus:** Hinter dem Wasser ist nur der Himmel. Setz in eine hintere Ebene Erde, dann sieht es wie ein Becken aus.
- **Der Geist ist vor der Mauer:** Seine Ebene liegt in der Layer-Liste über der Mauer. Schieb sie unter die Mauer, aber über das Zimmer.
- **Die Figur schwimmt nicht:** Stimmt – das Wasser ist nur ein Bild ohne Eigenschaften. Unter dem Wasser braucht es festen Boden, sonst fällt die Figur hindurch.

## Mach mehr draus

Bau eine Höhle mit leuchtenden Pilzen, einen Nebel, der mit **Aufhellen** vor dem Level hängt, oder ein Spukschloss mit Geistern hinter allen Fenstern.
