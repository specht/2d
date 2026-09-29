---
titel: Schnee, Regen und Nordlicht
kategorie: Level gestalten
stufe: 2
kurz: Wetter und Lichter kommen aus einer Hintergrund-Ebene mit Effekt – ganz ohne Zeichnen.
farben: 256
toleranz: 16            # tiny shimmer changes are not stored again
skala: 2
schritte: 3             # the effects change every pixel: fewer frames keep the file small
szene:
  himmel: ['#566c86', '#94b0c2']
  effekte:
    - { effekt: snow, farbe: '#ffffffff', skala: 1.0, tempo: 1.0, pixel: true }
  ebenen:
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
dauer: 2.0
varianten:
  - szene:
      himmel: ['#333c57', '#566c86']
      effekte:
        - { effekt: rain, farbe: '#94b0c2dd' }
  - szene:
      himmel: ['#1a1c2c', '#257179']
      effekte:
        - { effekt: fireflies, farbe: '#a7f070ff', pixel: true }
  - szene:
      himmel: ['#1a1c2c', '#29366f']
      effekte:
        - { effekt: aurora, farbe: '#73eff7cc', vorne: false, pixel: true }
        - { effekt: stars, farbe: '#f4f4f4ff', vorne: false }
---
## Kurz gesagt

1. Eine Ebene **Hintergrund** kann statt Farben einen **Effekt** zeigen.
2. Es gibt **Schnee**, **Regen**, **Rauch**, **Feuer**, **Lichtstrahlen**, **Sternenhimmel**, **Nordlicht**, **Wolken**, **Glühwürmchen** und **Blasen**.
3. Farbe, **Skalierung** und **Geschwindigkeit** stellst du selbst ein – gezeichnet wird nichts.

## Das brauchst du

- **Das musst du zeichnen:** nichts für das Wetter selbst.
- **Das kannst du später dazumalen:** Schnee auf den Dächern und Tannen, Pfützen für den Regen – damit das Wetter zur Welt passt.

## Schritt für Schritt

1. Leg zuerst den Himmel an (siehe *Himmel mit Farbverlauf*).
2. Neue Ebene über **+ → Hintergrund**, dann **Art: Effekt**.
3. Wähl bei **Effekt** zum Beispiel **Schnee** und bei **Farbe** Weiß.
4. Zieh das Rechteck über den Teil des Levels, in dem es schneien soll.
5. Mit **Skalierung** werden die Flocken größer oder kleiner, mit **Geschwindigkeit** fallen sie schneller oder langsamer.
6. Setz das Häkchen bei **pixelig (wie Sprites)**: Dann besteht auch der Schnee aus echten Spielpixeln.
7. Wo die Ebene in der Layer-Liste steht, entscheidet, was verdeckt wird: ganz oben schneit es **vor** der Figur, ganz unten nur **hinter** den Bergen.

## Tipps

> **Tipp:** Die Farbe darf halb durchsichtig sein. Halb durchsichtiges Grau ergibt feinen **Regen**, warmes Gelb sanfte **Lichtstrahlen** im Wald.

- **Nordlicht:** Die beiden weißen Punkte bestimmen, wo es beginnt (erster Punkt) und wo es ausblendet (zweiter Punkt). Leg eine Ebene **Sternenhimmel** dazu.
- **Glühwürmchen** leuchten am schönsten in einem dunkelgrünen Wald, **Blasen** in einem Unterwasser-Level, **Wolken** ziehen über einen Tageshimmel.
- Ein Effekt über dem ganzen Level kann viel sein. Oft reicht ein Rechteck an einer besonderen Stelle: Rauch über einem Kamin, Glühwürmchen auf einer Lichtung.
- Effekte haben keine Kollisionen – die Figur läuft einfach hindurch.

## Wenn's nicht klappt

- **Man sieht nichts:** Das Rechteck ist sehr klein, die Farbe ist ganz durchsichtig, oder die Ebene liegt hinter dem Himmel.
- **Der Effekt verdeckt die ganze Welt:** Nimm eine durchsichtigere Farbe oder schieb die Ebene in der Layer-Liste nach unten.
- **Es schneit zu hektisch:** Stell die **Geschwindigkeit** kleiner.
- **Das Nordlicht ist nicht zu sehen:** Die beiden Punkte liegen außerhalb des Rechtecks. Setz den ersten Punkt etwa in die Mitte, den zweiten nach oben.

## Mach mehr draus

Lass es erst im letzten Level schneien – oder bau eine Unterwasserwelt mit **Blasen** und eine Nacht mit **Nordlicht**.
