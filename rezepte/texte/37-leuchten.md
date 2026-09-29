---
id: licht-und-schatten
titel: Licht und Schatten
kategorie: Level gestalten
stufe: 3
kurz: Mit dem Mischmodus leuchten Fackeln wirklich, und ein Schatten macht alles darunter dunkler – auch die Figur.
szene:
  himmel: ['#1a1c2c', '#333c57']
  ebenen:
    - name: Tapete
      kollision: false
      karte: |
        yyyyyyyyyyyyyy
        yyyyyyyyyyyyyy
        yyyyyyyyyyyyyy
        yyyyyyyyyyyyyy
        yyyyyyyyyyyyyy
        ..............
    - name: Fackeln
      kollision: false
      karte: |
        ..............
        ..............
        ..............
        ...t......t...
        ..............
        ..............
    - name: Welt
      karte: |
        ..............
        ..............
        ..............
        ......###.....
        .P............
        ##############
    - name: Licht
      kollision: false
      vorne: true
      mischmodus: leuchten    # the layer's Mischmodus: every sprite in it glows
      karte: |
        ..............
        ..............
        ..............
        ..............
        ..............
        .*......*.....
    - name: Schatten
      kollision: false
      vorne: true
      karte: |
        ..............
        ..............
        ..............
        ..............
        ......%%%.....
        ..............
ablauf:
  - { t: 0.5, halten: rechts, dauer: 0.25 }
  - { t: 1.3, halten: rechts, dauer: 0.5 }
  - { t: 2.4, halten: rechts, dauer: 0.45 }
dauer: 3.6
erwartet:
  figur_rechts_von: 9
---
## Kurz gesagt

1. Jeder Sprite und jede Ebene hat einen **Mischmodus**. Er bestimmt, wie die Farben mit allem dahinter gemischt werden.
2. **Leuchten** zählt die Farben zusammen: Es wird nur heller – wie echtes Licht.
3. **Abdunkeln** nimmt die Farben mal: Es wird nur dunkler – wie ein Schatten.

## Das brauchst du

- **Das musst du zeichnen:** einen runden Lichtschein und einen Schatten, beide mit halb durchsichtigen Farben.
- **Das kannst du später dazumalen:** Fackeln oder Lampen, zu denen das Licht gehört.

![Lichtschein](katalog:welt/leuchtschein)
![Schatten](katalog:welt/schatten)

## Schritt für Schritt

1. **Lichtschein:** Ein großes Sprite (**Funktionen → Sprite → Größe ändern**, hier 120 × 120) mit einem runden Fleck in warmem Gelb. Innen kräftig, nach außen immer durchsichtiger – mit ein paar verstreuten Pixeln am Rand wirkt es weich.
2. Leg eine neue Ebene **Licht** an, ohne **Kollisionen erkennen**, in der Layer-Liste **über** der Figur. Stell bei der Ebene den **Mischmodus: Leuchten** ein.
3. Setz einen Lichtschein über jede Fackel. Alles darin – die Tapete, die Fackel und die Figur – wird heller.
4. **Schatten:** Füll ein Sprite mit dunklem Blau aus der untersten Reihe der Palette, oben etwas kräftiger als unten. Stell diesmal beim **Sprite** den **Mischmodus: Abdunkeln** ein.
5. Leg die Schatten in eine Ebene über der Figur, direkt unter einen Vorsprung.
6. Spiel es aus: Pip leuchtet warm auf, wenn er an einer Fackel vorbeikommt, und wird im Schatten dunkel.

## Die Mischmodi

- **Normal:** Die Farbe deckt so viel ab, wie sie undurchsichtig ist.
- **Leuchten:** Die Farben werden **addiert**. Gut für Licht, Feuer, Funken, Glühwürmchen, Zaubersprüche.
- **Aufhellen:** Wie Leuchten, aber sanfter – nichts wird grell. Gut für Geister, Nebel und Spiegelungen.
- **Abdunkeln:** Die Farben werden **multipliziert**. Gut für Schatten, getöntes Glas und farbige Scheiben.

Wie das genau funktioniert, zeigt das Rezept *Mischmodi verstehen*. Beim **Sprite** gilt der Mischmodus überall, wo der Sprite liegt. Bei der **Ebene** gilt er für alle Sprites darin – so kannst du denselben Sprite einmal normal und einmal leuchtend benutzen.

## Tipps

> **Tipp:** Leuchten und Abdunkeln wirken am besten in dunklen Levels. Auf einem hellen Himmel ist schon fast alles weiß – da gibt es nichts mehr aufzuhellen.

- Mit **Leuchten** ist Schwarz unsichtbar. Was im Licht-Sprite schwarz ist, ändert gar nichts.
- Mit **Abdunkeln** ist Weiß unsichtbar. Ein weißer Fleck im Schatten ist eine Stelle, an der kein Schatten liegt.
- Auch Hintergrund-Ebenen mit Effekten haben einen Mischmodus: **Glühwürmchen** mit **Leuchten** strahlen richtig.
- Ein Lichtschein kann sich bewegen: Gib ihm zwei Bilder, eines ein bisschen größer, dann flackert er wie das Feuer.

## Wenn's nicht klappt

- **Das Licht ist ein grelles Viereck:** Die Pixel um den Lichtschein sind nicht ganz durchsichtig. Radier sie weg.
- **Alles wird weiß:** Die Farben im Lichtschein sind zu kräftig. Nimm durchsichtigere Stufen.
- **Die Figur wird nicht heller:** Die Licht-Ebene liegt in der Layer-Liste unter der Figur. Schieb sie nach oben.
- **Der Schatten färbt nichts:** Er hat noch **Normal**. Stell beim Sprite **Abdunkeln** ein.

## Mach mehr draus

Bau eine Höhle, in der nur ein paar leuchtende Pilze Licht geben, oder einen Keller, in dem eine Laterne die Figur begleitet.
