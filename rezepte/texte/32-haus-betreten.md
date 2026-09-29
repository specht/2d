---
titel: Ein Haus betreten
kategorie: Level gestalten
stufe: 3
kurz: Draußen sieht man die Hauswand, drinnen das Zimmer – mit einem Sichtbarkeitsbereich.
farben: 256            # many colours: avoid banding in the sky
szene:
  ebenen:
    - name: Innenraum
      kollision: false
      karte: |
        ..............
        ..............
        ....wlwwlw....
        ....wwbwww....
        ....wwwwww....
        ..............
    - name: Haus
      karte: |
        ..............
        ...RRRRRRRR...
        ...M......M...
        ...M......M...
        .P.h....o.M...
        ##############
    - name: Fassade
      id: fassade
      kollision: false
      karte: |
        ..............
        ..............
        ....FVFFVF....
        ....FFFFFF....
        ....FFVFFF....
        ..............
  bereiche:
    - { ziel: fassade, rechtecke: [[4, 2, 6, 3]], im_bereich: versteckt, ueberblendung: 0.4 }
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.3 }
  - { t: 2.1, halten: links, dauer: 1.4 }
dauer: 4.4
erwartet:
  punkte: 10
---
## Kurz gesagt

1. Das Haus hat drei Ebenen: **Innenraum**, **Haus** (Wände, Dach, Tür) und **Fassade**.
2. Ein **Sichtbarkeitsbereich** über dem Innenraum versteckt die Fassade, sobald die Figur drin ist.
3. Mit **Überblendung** verschwindet die Wand sanft statt schlagartig.

## Das brauchst du

- **Das musst du zeichnen:** eine Tapete für innen, eine Hauswand (Fassade) für außen, Mauer, Dach und eine Tür.
- **Das kannst du später dazumalen:** Bilder, Lampen, Fenster mit Blumenkasten.

![Fassade](katalog:welt/fassade_fenster)
![Tapete mit Lampe](katalog:welt/lampe)
![Bild](katalog:welt/bild)

## Schritt für Schritt

1. Ebene **Haus**: Boden, Mauern links und rechts, Dach oben und eine Tür in der linken Mauer. Pips Haustür ist eine **automatische Tür**, nicht verschließbar.
2. Ebene **Innenraum** (**Kollisionen erkennen** aus): Tapete, Bilder und Lampen zwischen die Mauern.
3. Ebene **Fassade** (**Kollisionen erkennen** aus): die Hauswand genau **über** den Innenraum, an dieselben Stellen.
4. In der Layer-Liste muss die Fassade **über** dem Innenraum stehen – dann liegt sie davor.
5. Neue Ebene über **+ → Sichtbarkeitsbereich**. Wähle **Zielebene: Fassade** und **Im Bereich: versteckt**.
6. Zieh das Rechteck genau über den Innenraum. Stell **Überblendung** auf **0,4 s**.
7. Spiel es aus: durch die Tür rein – die Wand verschwindet – und wieder raus.

## Tipps

> **Tipp:** Entscheidend ist die **Mitte der Spielfigur**: Liegt sie im Rechteck, gilt *Im Bereich*. Das Rechteck muss also nicht bis zum Boden reichen.

- Für zwei Häuser brauchst du zwei Fassaden-Ebenen und zwei Sichtbarkeitsbereiche. Jede Fassade gehört zu genau einem Bereich.
- Ein Bereich kann aus mehreren Rechtecken bestehen – praktisch für Häuser mit mehreren Stockwerken.
- Der Sichtbarkeitsbereich verändert nur, was man **sieht**. Wände und Böden funktionieren weiter wie vorher.

## Wenn's nicht klappt

- **Die Figur bleibt an der Fassade hängen:** Bei der Fassaden-Ebene ist **Kollisionen erkennen** noch an.
- **Die Wand verschwindet nicht:** Die **Zielebene** ist falsch gewählt, oder das Rechteck liegt nicht dort, wo die Figur läuft.
- **Innen und außen sind vertauscht:** Stell **Im Bereich** auf *versteckt*, nicht auf *sichtbar*.
- **Die Fassade verdeckt die Figur nicht, sondern umgekehrt:** Verschieb die Fassade in der Layer-Liste nach oben.

## Mach mehr draus

Versteck im Haus einen Schlüssel für eine Tür draußen – oder bau einen Keller mit einer Leiter nach unten.
