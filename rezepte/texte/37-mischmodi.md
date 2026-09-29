---
titel: Mischmodi verstehen
kategorie: Level gestalten
stufe: 3
kurz: Derselbe Kreis viermal – normal, leuchtend, aufhellend und abdunkelnd. So siehst du, was jeder Mischmodus mit den Farben dahinter macht.
szene:
  himmel: ['#29366f', '#b13e53']
  legende: { Q: farbkreis }
  ebenen:
    - name: Mauer
      kollision: false
      karte: |
        ............
        ............
        ............
        ............
        MMMMMMMMMMMM
        ............
    - name: Welt
      # the wall on the right stops Pip inside the last disc (without it he walks off the scene)
      karte: |
        ............
        ............
        ............
        ...........M
        P..........M
        ############
    - name: Normal
      kollision: false
      vorne: true
      karte: |
        ............
        ............
        ............
        .Q..........
        .Q..........
        ............
    - name: Leuchten
      kollision: false
      vorne: true
      mischmodus: leuchten
      karte: |
        ............
        ............
        ............
        ....Q.......
        ....Q.......
        ............
    - name: Aufhellen
      kollision: false
      vorne: true
      mischmodus: aufhellen
      karte: |
        ............
        ............
        ............
        .......Q....
        .......Q....
        ............
    - name: Abdunkeln
      kollision: false
      vorne: true
      mischmodus: abdunkeln
      karte: |
        ............
        ............
        ............
        ..........Q.
        ..........Q.
        ............
beschriftung:
  - { text: Normal, spalte: 1, zeile: 2 }
  - { text: Leuchten, spalte: 4, zeile: 2 }
  - { text: Aufhellen, spalte: 7, zeile: 2 }
  - { text: Abdunkeln, spalte: 10, zeile: 2 }
ablauf:
  - { t: 0.4, halten: rechts, dauer: 2.2 }
dauer: 3.8
erwartet:
  figur_rechts_von: 9
---
## Kurz gesagt

1. Der **Mischmodus** bestimmt, wie die Farben eines Sprites mit den Farben **dahinter** gemischt werden.
2. **Normal** deckt ab. **Leuchten** und **Aufhellen** machen nur heller, **Abdunkeln** macht nur dunkler.
3. Oben liegt der Kreis vor dem Himmel, unten vor der Mauer – und vor Pip, wenn er hindurchläuft. Vergleich, was aus dem schwarzen Rand und dem weißen Glanzpunkt wird.

## Das brauchst du

- **Das musst du zeichnen:** einen Kreis mit dunklem Rand, einer kräftigen Farbe und einem weißen Glanzpunkt.
- **Das kannst du später dazumalen:** nichts – hier geht es nur ums Ausprobieren.

![Farbkreis](katalog:welt/farbkreis)

## Schritt für Schritt

1. Mal den Kreis, ganz deckend. Er bekommt **keinen** Mischmodus – den stellen wir diesmal bei den Ebenen ein.
2. Leg vier Ebenen ohne **Kollisionen erkennen** an und schieb sie in der Layer-Liste **über** die Ebene mit der Figur.
3. Stell bei den Ebenen den **Mischmodus** ein: **Normal**, **Leuchten**, **Aufhellen** und **Abdunkeln**.
4. Setz in jede Ebene zwei Kreise übereinander: einen vor den Himmel, einen vor die Mauer.
5. Spiel es aus: Pip läuft durch alle vier Kreise. Im Normal-Kreis verschwindet er, im Leuchten-Kreis wird er grell, im Aufhellen-Kreis schimmert er, im Abdunkeln-Kreis wird er dunkel und rötlich.

## So rechnet der Computer

Jede Farbe besteht aus drei Anteilen: Rot, Grün und Blau. Jeder Anteil geht von **0** (gar nichts) bis **1** (ganz viel). Schwarz ist überall 0, Weiß ist überall 1.

- **Normal:** Die Farbe des Sprites ersetzt die Farbe dahinter – so weit, wie sie undurchsichtig ist.
- **Leuchten:** Die Farben werden **addiert**: Sprite + dahinter. Schwarz ist 0, und plus 0 ändert nichts – deshalb verschwindet der schwarze Rand. Mehr als 1 geht nicht: Wird es zu viel, wird es weiß. Wie echtes Licht: Zwei Lampen sind heller als eine.
- **Aufhellen:** Auch hier wird es nur heller, aber sanfter: Je heller es dahinter schon ist, desto weniger kommt dazu. Deshalb wird nichts grell. Der schwarze Rand verschwindet auch hier.
- **Abdunkeln:** Die Farben werden **multipliziert**: Sprite × dahinter. Weiß ist 1, und mal 1 ändert nichts – deshalb verschwindet der weiße Glanzpunkt. Schwarz ist 0, und mal 0 ergibt 0 – der Rand bleibt schwarz. Wie eine farbige Folie vor einer Lampe.

## Was passt wozu?

- **Normal:** alles, was einfach da ist – Figuren, Steine, Bäume.
- **Leuchten:** Lampen, Feuer, Funken, Glühwürmchen, Zaubersprüche. Am schönsten im Dunkeln.
- **Aufhellen:** Geister, Nebel, Spiegelungen, Mondschein.
- **Abdunkeln:** Schatten, getöntes Glas, Wasser, eine Abendstimmung über dem ganzen Level.

Den Mischmodus gibt es beim **Sprite** und bei der **Ebene**. Beim Sprite gilt er überall, wo der Sprite liegt. Bei der Ebene gilt er für alle Sprites darin – so wie hier: ein Kreis, vier Ebenen, vier Wirkungen.

## Tipps

> **Tipp:** Für Leuchten malst du auf **Schwarz**, für Abdunkeln auf **Weiß**: Was schwarz ist, leuchtet nicht, was weiß ist, dunkelt nicht ab. Noch einfacher ist ein ganz durchsichtiger Hintergrund.

- Vor einem hellen Tageshimmel bringt **Leuchten** kaum noch etwas – da ist es schon fast so hell wie möglich.
- Vor einer schwarzen Nacht wirkt **Abdunkeln** gar nicht – dunkler als schwarz geht nicht.
- Probier dieselbe Szene mit verschiedenen Farben: Ein blauer Kreis mit **Abdunkeln** macht alles kühl, ein gelber mit **Leuchten** alles warm.

## Wenn's nicht klappt

- **Der Normal-Kreis leuchtet auch:** Beim Sprite selbst ist ein Mischmodus eingestellt. In einer Ebene mit **Normal** behält jeder Sprite seinen eigenen. Stell ihn beim Sprite auf **Normal**.
- **Der Kreis leuchtet nicht, er verschwindet fast:** Er liegt vor etwas sehr Hellem. Leuchten wirkt nur, wo es noch dunkel ist.
- **Pip wird nicht eingefärbt:** Die Ebenen mit den Kreisen liegen in der Layer-Liste unter der Figur.

## Mach mehr draus

Nimm ein Level, das du schon gebaut hast, und leg eine große Ebene mit **Abdunkeln** und einem hellen Blau darüber – schon ist es Nacht. Mit Orange wird es Abend. Und mit ein paar **Leuchten**-Flecken gehen die Laternen an.
