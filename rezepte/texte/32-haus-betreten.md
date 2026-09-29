---
titel: Ein Haus betreten
kategorie: Level gestalten
stufe: 3
kurz: Draußen sieht man das Fachwerkhaus, drinnen das Zimmer – mit einem großen Sprite und einem Sichtbarkeitsbereich.
farben: 256
skala: 2
schleife: true
szene:
  ebenen:
    - name: Innenraum
      kollision: false
      karte: |
        ..............
        ..............
        ....wwwwww....
        ....wwwwww....
        ....wwwwww....
        ..............
    - name: Möbel
      kollision: false
      karte: |
        ..............
        ..............
        ....l...l.....
        ......b.......
        ....p..d......
        ..............
    - name: Haus
      karte: |
        ..............
        ...RRRRRRRR...
        ...M......M...
        ...M......M...
        .P.e......M...
        ##############
    - name: Hausfront
      id: fassade
      kollision: false
      karte: |
        ..............
        ..............
        ..............
        ..............
        ...X..........
        ..............
  bereiche:
    - { ziel: fassade, rechtecke: [[4, 2, 6, 3]], im_bereich: versteckt, ueberblendung: 0.4 }
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.0 }
  - { t: 2.3, halten: links, dauer: 1.016667 }
  - { t: 3.9, halten: rechts, dauer: 0.016667 }
dauer: 4.4
---
## Kurz gesagt

1. Das Haus hat vier Ebenen: **Innenraum**, **Möbel**, **Haus** (Mauern, Dach, Eingang) und **Hausfront**.
2. Die Hausfront ist **ein großes Sprite** über dem ganzen Haus. Wo die Tür ist, bleibt es durchsichtig.
3. Ein **Sichtbarkeitsbereich** versteckt die Hausfront, sobald die Figur drin ist – mit **Überblendung** ganz sanft.

## Das brauchst du

- **Das musst du zeichnen:** eine Tapete für innen, eine Hausfront für außen, Mauer, Dach und einen offenen Eingang.
- **Das kannst du später dazumalen:** Lampen, Bilder, einen Tisch, eine Pflanze – als eigene Sprites mit durchsichtigem Hintergrund.

![Hausfront](katalog:welt/hausfront)
![Tapete](katalog:welt/innenwand)
![Lampe](katalog:welt/lampe)
![Bild](katalog:welt/bild)
![Tisch](katalog:welt/tisch)
![Pflanze](katalog:welt/pflanze)

## Schritt für Schritt

1. Ebene **Haus**: Boden, Mauern links und rechts, Dach oben. Unten in der linken Mauer lässt du ein Feld frei und setzt dort einen **offenen Eingang** hin – ein Bild ohne Eigenschaften, durch das man einfach durchläuft.
2. Ebene **Innenraum** (**Kollisionen erkennen** aus): die Tapete zwischen die Mauern.
3. Ebene **Möbel** (**Kollisionen erkennen** aus) über dem Innenraum: Lampen, Bilder, Tisch und Pflanze. Diese Sprites haben einen **durchsichtigen** Hintergrund – die Tapete malst du **nicht** mit hinein. So passt jede Lampe auf jede Tapete.
4. Neuer Sprite für die Hausfront: **Funktionen → Sprite → Größe ändern**, bei Pip **192 × 72** – genau so breit und hoch wie das ganze Haus mit beiden Mauern. Fenster, Balken und Blumenkästen malst du direkt hinein. Das Feld vor dem Eingang bleibt **durchsichtig**.
5. Ebene **Hausfront** (**Kollisionen erkennen** aus) ganz oben in der Layer-Liste. Wähl die Hausfront aus und stell dann **Gittergröße** auf **24 × 24** und **Gitteroffset** auf **12 : 0**. Jetzt passt sie genau auf die Mauern. Große Sprites hängen **mittig** am Mauszeiger und stehen auf der Unterkante des Feldes.
6. Neue Ebene über **+ → Sichtbarkeitsbereich**. Wähle **Zielebene: Hausfront** und **Im Bereich: versteckt**.
7. Zieh das Rechteck genau über den Innenraum. Stell **Überblendung** auf **0,4 s**.
8. Spiel es aus: durch den Eingang rein – die Hausfront verschwindet – und wieder raus.

## Tipps

> **Tipp:** Entscheidend ist die **Mitte der Spielfigur**: Liegt sie im Rechteck, gilt *Im Bereich*. Das Rechteck muss also nicht bis zum Boden reichen.

- Die Hausfront deckt auch die Mauern ab. Von außen sieht man deshalb nur das Fachwerkhaus – und keine Mauersteine, die innen und außen gleich aussehen.
- Weil der Eingang durchsichtig ist, sieht man ihn auch von außen: Man weiß sofort, wo es reingeht.
- Möbel ohne eigene Tapete kannst du beliebig verschieben und in anderen Häusern wiederverwenden.
- Für zwei Häuser brauchst du zwei Hausfront-Ebenen und zwei Sichtbarkeitsbereiche. Jede Hausfront gehört zu genau einem Bereich.
- Der Sichtbarkeitsbereich verändert nur, was man **sieht**. Wände und Böden funktionieren weiter wie gewohnt.

## Wenn's nicht klappt

- **Die Figur bleibt an der Hausfront hängen:** Bei der Hausfront-Ebene ist **Kollisionen erkennen** noch an.
- **Man kommt nicht ins Haus:** Im Eingangsfeld liegt noch eine Mauer, oder der Eingang hat eine Block-Eigenschaft. Er braucht keine.
- **Die Hausfront sitzt einen halben Block daneben:** Sprites, die eine gerade Zahl von Blöcken breit sind (48, 192 Pixel), brauchen **Gitteroffset 12 : 0**. Beim Auswählen eines Sprites wird das Gitter wieder zurückgesetzt – danach also neu einstellen.
- **Um die Lampe ist ein Tapeten-Kasten zu sehen:** Im Lampen-Sprite ist noch die Tapete gemalt. Radier sie weg.
- **Die Wand verschwindet nicht:** Die **Zielebene** ist falsch gewählt, oder das Rechteck liegt nicht dort, wo die Figur läuft.
- **Innen und außen sind vertauscht:** Stell **Im Bereich** auf *versteckt*, nicht auf *sichtbar*.

## Mach mehr draus

Versteck im Haus einen Schlüssel für eine Tür draußen – oder bau einen Keller mit einer Leiter nach unten.
