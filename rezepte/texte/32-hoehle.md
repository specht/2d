---
titel: Eine Höhle erkunden
kategorie: Level gestalten
stufe: 3
kurz: Von außen ein Felsen mit einem dunklen Loch. Drinnen eine riesige Höhle – mit leuchtenden Pilzen, Tropfsteinen und einem Teich, in den man hineinwaten kann.
skala: 2
schritte: 2
standbild: 3.0
szene:
  himmel: ['#41a6f6', '#73eff7']
  # the cave is wider than the screen: the camera follows Pip
  kamera: { bildhoehe: 144 }
  legende: { F: hoehle_fels, b: hoehle_boden, w: hoehle_wand, Z: hoehle_spalt, '8': tropfstein_oben, '9': tropfstein_unten,
             p: leuchtpilz, g: pilzlicht, Y: lichtschacht, X: bergfront }
  effekte:
    # inside it is dark: a tint only over the cave – behind the lights, so they stay bright
    - { effekt: farbe, name: Höhlendunkel, farben: ['#5a689e', '#4a5890'], mischmodus: abdunkeln, bereich: [6, 0, 28, 6], hinter: Licht }
  ebenen:
    - name: Höhlenwand
      kollision: false
      karte: |
        ......wwwwwwwwwwwwwwwwwwwwwwwwwww.
        ......wwwwwwwwwwwwwwwwwwwwwwwwwww.
        ......wwwwwwwwwwwwwwwwwwwwwwwwwww.
        ......wwwwwwwwwwwwwwwwwwwwwwwwwww.
        ..................wwwww...........
        ..................................
    - name: Tropfsteine und Pilze
      kollision: false
      karte: |
        ..................................
        .........8....8......8.....8......
        ..................................
        v...v.......9...p.......p.9...p...
        ..................................
        ..................................
    - name: Welt
      karte: |
        ......FFFFFFFFFFFFFZ.FFFFFFFFFFFFF
        .................................F
        .................................F
        ..P..............................F
        ######bbbbbbbbbbbb.....bbbbbbbbbbF
        ======FFFFFFFFFFFFbbbbbFFFFFFFFFFF
    # the pool: a dip in the floor with water in front of Pip – he wades right in
    - name: Wasser
      kollision: false
      vorne: true
      karte: |
        ..................................
        ..................................
        ..................................
        ..................................
        ..................SSSSS...........
        ..................................
    - name: Licht
      kollision: false
      vorne: true
      mischmodus: leuchten
      karte: |
        ..................................
        ..................................
        ..................................
        ...................Y..............
        ...............g.......g.....g....
        ..................................
    - name: Berg von außen
      id: bergfront
      kollision: false
      vorne: true
      karte: |
        ..................................
        ..................................
        ..................................
        ......X...........................
        ..................................
        ..................................
  bereiche:
    # inside the cave, the mountain's front disappears
    - { ziel: bergfront, rechtecke: [[7, 0, 27, 6]], im_bereich: versteckt, ueberblendung: 0.5 }
# Pip walks in, into the pool (he stops there for a moment in the light), jumps
# out and walks on to the end of the cave.
ablauf:
  - { t: 0.4, halten: rechts, dauer: 2.35 }
  - { t: 3.5, halten: rechts, dauer: 1.45 }
  - { t: 3.62, drücken: springen }
dauer: 5.6
erwartet:
  figur_rechts_von: 28
---
## Kurz gesagt

1. Von außen sieht man einen **Berg** – ein großes Sprite mit einem durchsichtigen Höhleneingang.
2. Ein **Sichtbarkeitsbereich** versteckt den Berg, sobald die Figur drin ist. Dahinter wartet eine Höhle, die viel größer ist als der Bildschirm.
3. Drinnen ist es dunkel. Nur leuchtende Pilze und ein Lichtstrahl durch einen Felsspalt machen Licht – und in einem Teich kann man sogar waten.

## Das brauchst du

- **Das musst du zeichnen:** den Berg von außen (hier 192 × 96 Pixel) mit einem Loch unten links, Felsen, Höhlenboden und eine dunkle Höhlenwand.
- **Das kannst du später dazumalen:** Tropfsteine, leuchtende Pilze mit ihrem Licht, einen Felsspalt mit einem Lichtstrahl – und Wasser für den Teich.

![Berg von außen](katalog:hoehle/bergfront)
![Höhlenfels](katalog:hoehle/fels)
![Höhlenboden](katalog:hoehle/boden)
![Höhlenwand](katalog:hoehle/wand)
![Tropfstein hängend](katalog:hoehle/tropfstein_oben)
![Tropfstein stehend](katalog:hoehle/tropfstein_unten)
![Leuchtpilze](katalog:hoehle/leuchtpilz)
![Pilzlicht](katalog:hoehle/pilzlicht)
![Felsspalt](katalog:hoehle/spalt)
![Lichtschacht](katalog:hoehle/lichtschacht)

## Schritt für Schritt

1. **Der Weg:** Ebene **Welt** mit Boden draußen, Höhlenboden drinnen, einer Felsdecke oben und einer Felswand am Ende. Die Höhle darf viel breiter sein als der Bildschirm – die Kamera folgt der Figur.
2. **Die Höhlenwand:** eine Ebene **ganz hinten**, ohne **Kollisionen erkennen**. Sie ist sehr dunkel und darf nicht vom Weg ablenken. Mal große, runde Felsformen hinein, dann wirkt sie tief.
3. **Tropfsteine und Pilze:** eine Ebene ohne Kollisionen vor der Wand. Tropfsteine hängen von der Decke und stehen auf dem Boden.
4. **Der Teich:** Lass im Boden eine Mulde frei, einen Block tief. Leg in eine Ebene **vor** der Figur Wasser genau in die Mulde. Die Figur läuft hinein, steht auf dem Grund der Mulde – und steckt bis zum Bauch im Wasser. Raus kommt sie mit einem Sprung.
5. **Dunkelheit:** Neue Ebene über **+ → Hintergrund**, **Art: Farbe**, dunkles Blau, **Mischmodus: Abdunkeln**. Zieh das Rechteck **nur über die Höhle** – draußen bleibt es Tag.
6. **Licht:** eine Ebene mit **Mischmodus: Leuchten**, in der Layer-Liste **über** der Dunkelheit. Um jeden Pilz ein weiches türkises Pilzlicht. Unter den Felsspalt in der Decke ein kühler Lichtschacht, der genau auf den Teich fällt.
7. **Der Berg von außen:** ein großes Sprite, das die Höhle von außen verdeckt – Felsen, Gras oben, und unten links ein **durchsichtiges** Loch als Eingang. Leg es in eine Ebene ganz oben in der Layer-Liste und gib der Ebene einen Namen, zum Beispiel **Berg von außen**.
8. Neue Ebene über **+ → Sichtbarkeitsbereich**, **Zielebene: Berg von außen**, **Im Bereich: versteckt**. Zieh das Rechteck über die ganze Höhle und stell **Überblendung** auf **0,5 s**.
9. Probier es aus: Pip geht auf den dunklen Eingang zu, der Berg verschwindet – und die Höhle öffnet sich. Pip watet in den Teich, bleibt kurz im Lichtstrahl stehen, springt heraus und läuft weiter bis zum Ende der Höhle.

## So wird die Höhle geheimnisvoll

- **Dunkel, aber nicht schwarz:** Die Abdunkeln-Ebene nimmt ein mittleres Blau. So erkennt man Pip noch – und jedes Licht wirkt stark.
- **Wenige Lichter:** Drei Pilzgruppen und ein Lichtstrahl reichen. Zwischen den Lichtern bleibt es dunkel, und man will wissen, was im nächsten Licht wartet.
- **Das Licht erzählt:** Der Lichtstrahl fällt genau auf den Teich. Dahin schaut man zuerst – und dahin geht man.
- **Draußen hell, drinnen dunkel:** Der Unterschied macht den Moment besonders, in dem man hineingeht.

## Tipps

> **Tipp:** Entscheidend ist die **Mitte der Spielfigur**: Liegt sie im Rechteck, gilt *Im Bereich*. Das Rechteck muss also nicht bis zum Boden reichen.

- Weil der Eingang im Berg durchsichtig ist, sieht man schon von außen ins Dunkel hinein. Man weiß sofort, wo es reingeht – und ist neugierig.
- Die Lichter liegen **vor** der Dunkelheit, das Wasser **dahinter**. So bleiben die Pilze hell, und das Wasser ist so dunkel wie die Höhle.
- Der Felsspalt ist ein ganz normaler fester Block – nur mit einem hellen Riss gemalt.
- Der Sichtbarkeitsbereich verändert nur, was man **sieht**. Wände und Böden bleiben, wie sie sind.

## Wenn's nicht klappt

- **Die Figur bleibt am Berg hängen:** Bei der Ebene mit dem Berg ist **Kollisionen erkennen** noch an.
- **Man kommt nicht in die Höhle:** Im Eingang liegt noch ein Fels. Der Eingang ist nur ein Loch im Bild, dahinter muss frei sein.
- **Draußen ist es auch dunkel:** Das Rechteck der Abdunkeln-Ebene reicht bis nach draußen. Zieh es nur über die Höhle.
- **Die Pilze leuchten nicht:** Die Licht-Ebene liegt unter der Abdunkeln-Ebene, oder bei ihr fehlt der **Mischmodus: Leuchten**.
- **Die Figur kommt aus dem Teich nicht heraus:** Die Mulde ist tiefer als ein Sprung. Mach sie nur einen Block tief.
- **Der Berg verschwindet nicht:** Die **Zielebene** ist falsch gewählt, oder das Rechteck liegt nicht dort, wo die Figur läuft.

## Mach mehr draus

Versteck hinten in der Höhle einen Schatz, den nur das Licht eines Pilzes verrät – oder lass eine Fledermaus von der Decke flattern, wenn man den Teich betritt.
