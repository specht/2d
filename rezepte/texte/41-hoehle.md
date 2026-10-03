---
titel: Eine Höhle erkunden
kategorie: Level gestalten
stufe: 3
kurz: Ein Berg mit einem dunklen Loch. Dahinter eine riesige Höhle – mit leuchtenden Pilzen, Tropfsteinen und einem Teich, in den man hineinwaten kann.
skala: 4
# a little less floor, a little more sky
bild_hoch: 0.5
schritte: 2
# the gallery card: Pip waiting in the cave mouth, the mountain's front fading
standbild: 1.7
szene:
  signale: { 1: In der Höhle }
  himmel: ['#41a6f6', '#73eff7']
  # the cave is wider than the screen: the camera follows Pip
  kamera: { bildhoehe: 144 }
  legende: { F: hoehle_fels, b: hoehle_boden, w: hoehle_wand, Z: hoehle_spalt, '8': tropfstein_oben, '9': tropfstein_unten,
             p: leuchtpilz, g: pilzlicht, Y: lichtschacht, Q: bergflanke, X: bergfront, U: hoehle_uebergang_boden, E: hoehle_uebergang_erde }
  effekte:
    # only inside does it get dark (the Signalbereich "Höhle" sends Code 1). The
    # darkness begins softly at the entrance (from no tint to blue) …
    - { effekt: farbe, name: Dämmerung, farben: [['#ffffff', 0.0, 1.0], ['#5a689e', 1.0, 1.0], ['#ffffff', 0.0, 0.0], ['#4a5890', 1.0, 0.0]], mischmodus: abdunkeln, bereich: [6, 0, 4, 6], hinter: Licht,
        signal: { code: 1, reaktion: solange_an, ueberblendung: 0.8 } }
    # … and inside it is dark – behind the lights, so they stay bright
    - { effekt: farbe, name: Höhlendunkel, farben: ['#5a689e', '#4a5890'], mischmodus: abdunkeln, bereich: [10, 0, 24, 6], hinter: Licht,
        signal: { code: 1, reaktion: solange_an, ueberblendung: 0.8 } }
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
        vv..........9...p.......p.9...p...
        ..................................
        ..................................
    - name: Welt
      karte: |
        ......FFFFFFFFFFFFFZ.FFFFFFFFFFFFF
        .................................F
        .................................F
        .P...............................F
        ######U.bbbbbbbbbb.....bbbbbbbbbbF
        ======E.FFFFFFFFFFbbbbbFFFFFFFFFFF
    # the mountain's flank with the cave mouth: it always stays (behind Pip)
    - name: Berg
      kollision: false
      karte: |
        ..................................
        ..................................
        ..................................
        ..Q...............................
        ..................................
        ..................................
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
    # the front of the mountain over the cave: it fades out once Pip is inside
    - name: Berg von außen
      kollision: false
      vorne: true
      signal: { code: 1, reaktion: solange_aus, ueberblendung: 0.6 }
      karte: |
        ..................................
        ..................................
        ..................................
        ........X.........................
        ..................................
        ..................................
  # one Signalbereich over the whole cave: while Pip is inside, it sends Code 1 "an".
  # The front of the mountain fades out, the darkness fades in (the eyes get used to it).
  bereiche:
    - { name: Höhle, code: 1, rechtecke: [[6.5, 0, 27.5, 6]] }
# Pip walks up to the mountain and stops right in the mouth (x 165, the Signalbereich
# begins at 156) and waits there while the front fades out and the darkness fades in.
# Then on into the pool (he stops there for a moment in the light), jumps out
# and walks on to the end of the cave.
ablauf:
  - { t: 0.4, halten: rechts, dauer: 0.72 }
  - { t: 2.42, halten: rechts, dauer: 1.78 }
  - { t: 4.9, halten: rechts, dauer: 1.45 }
  - { t: 5.02, drücken: springen }
dauer: 7.0
erwartet:
  signale: ['1 an']
  figur_rechts_von: 28
---
## Kurz gesagt

1. Von außen sieht man einen **Berg**, der sanft aus der Wiese aufsteigt – mit einem dunklen Loch.
2. Der Berg ist **ein Bild in zwei Teilen**: Die Flanke mit dem Eingang bleibt immer stehen. Der Teil über der Höhle verschwindet, sobald die Figur drin ist – ein **Signalbereich** über der Höhle sendet dann ein Signal. Dahinter wartet eine Höhle, die viel größer ist als der Bildschirm.
3. Drinnen ist es dunkel. Nur leuchtende Pilze und ein Lichtstrahl durch einen Felsspalt machen Licht – und in einem Teich kann man sogar waten.

## Das brauchst du

- **Das musst du zeichnen:** den Berg (hier zwei Teile, je 168 × 96 Pixel) mit einem Loch als Eingang, Felsen, Höhlenboden und eine dunkle Höhlenwand.
- **Das kannst du später dazumalen:** Tropfsteine, leuchtende Pilze mit ihrem Licht, einen Felsspalt mit einem Lichtstrahl – und Wasser für den Teich.

![Berg mit Eingang](katalog:hoehle/bergflanke)
![Berg von außen](katalog:hoehle/bergfront)
![Übergang Wiese – Höhle](katalog:hoehle/uebergang_boden)
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
5. **Dunkelheit:** Neue Ebene über **+ → Hintergrund**, **Art: Farbe**, dunkles Blau, **Mischmodus: Abdunkeln**. Zieh das Rechteck **nur über die Höhle** – draußen bleibt es Tag. Damit es am Eingang nicht wie abgeschnitten aussieht, kommt davor ein schmales Rechteck mit einem **Farbverlauf** von Weiß (links, ändert nichts) nach Blau (rechts): Es wird ganz allmählich dunkel, so wie in einer echten Höhle. Stell bei beiden Ebenen **Bei Signal: da, solange an** und **Überblendung 0,8 s** ein. Neben **Code** wählst du bei der ersten **Neues Signal …** und nennst es **In der Höhle**, bei der zweiten wählst du **In der Höhle** aus der Liste: Erst wenn die Figur drin ist, wird es dunkel – als würden sich die Augen an die Dunkelheit gewöhnen. Von außen bleibt der ganze Berg im Tageslicht.
6. **Licht:** eine Ebene mit **Mischmodus: Leuchten**, in der Layer-Liste **über** der Dunkelheit. Um jeden Pilz ein weiches türkises Pilzlicht. Unter den Felsspalt in der Decke ein kühler Lichtschacht, der genau auf den Teich fällt.
7. **Der Berg:** Mal ihn als **ein großes Bild** – eine Flanke, die aus der Wiese aufsteigt, Felsen, Gras oben, und ein **durchsichtiges** Loch als Eingang. Dann zerschneid es in zwei Sprites, und zwar entlang einer **zackigen** Linie rechts neben dem Eingang:
   - **Berg mit Eingang** (die Flanke mit dem Loch) in eine Ebene **hinter** der Figur. Sie bleibt immer stehen. Von innen sieht ihr zackiger Rand aus wie ein Felsvorsprung.
   - **Berg von außen** (der Rest über der Höhle) in eine Ebene ganz oben in der Layer-Liste.
   Von außen passen beide Teile genau zusammen – man sieht einen einzigen Berg.
8. **Übergänge am Boden:** Am Eingang geht die Wiese mit einem gemischten Stück in Höhlenboden über, die Erde darunter in Fels. So gibt es auch unten keine gerade Kante.
9. Neue Ebene über **+ → Signalbereich**, neben **Code** aus der Liste **In der Höhle**. Zieh das Rechteck über die ganze Höhle – es beginnt mitten im Eingang. Solange die Figur darin ist, sendet der Signalbereich dieses Signal mit „an“. Bei der Ebene **Berg von außen** stellst du **Bei Signal: weg, solange an**, das Signal **In der Höhle** und **Überblendung 0,6 s** ein.
10. Probier es aus: Pip geht auf den dunklen Eingang zu und bleibt mitten im Eingang stehen. Der Berg über der Höhle verschwindet, es wird langsam dunkel – und die Höhle öffnet sich. Dann watet Pip in den Teich, bleibt kurz im Lichtstrahl stehen, springt heraus und läuft weiter bis zum Ende der Höhle.

## So wird die Höhle geheimnisvoll

- **Dunkel, aber nicht schwarz:** Die Abdunkeln-Ebene nimmt ein mittleres Blau. So erkennt man Pip noch – und jedes Licht wirkt stark.
- **Wenige Lichter:** Drei Pilzgruppen und ein Lichtstrahl reichen. Zwischen den Lichtern bleibt es dunkel, und man will wissen, was im nächsten Licht wartet.
- **Das Licht erzählt:** Der Lichtstrahl fällt genau auf den Teich. Dahin schaut man zuerst – und dahin geht man.
- **Draußen hell, drinnen dunkel:** Der Unterschied macht den Moment besonders, in dem man hineingeht.
- **Keine geraden Kanten:** In der Natur gibt es kaum senkrechte Linien. Ein Berg steigt an, ein Eingang ist rund, Licht wird allmählich schwächer.

## Tipps

> **Tipp:** Entscheidend ist die **Mitte der Spielfigur**: Liegt sie im Rechteck, sendet der Signalbereich „an“. Das Rechteck muss also nicht bis zum Boden reichen.

> **Tipp:** Ein Signalbereich, drei Ebenen: Berg, Dämmerung und Höhlendunkel hören alle auf **In der Höhle**. In der Signale-Übersicht (Taste S) siehst du, wer sendet und wer reagiert.

- Weil der Eingang im Berg durchsichtig ist, sieht man schon von außen ins Dunkel hinein. Man weiß sofort, wo es reingeht – und ist neugierig.
- Die Lichter liegen **vor** der Dunkelheit, das Wasser **dahinter**. So bleiben die Pilze hell, und das Wasser ist so dunkel wie die Höhle.
- Der Felsspalt ist ein ganz normaler fester Block – nur mit einem hellen Riss gemalt.
- Eine Ebene, die weg ist, ist ganz weg – auch zum Draufstehen. Der Berg von außen hat ohnehin keine Kollisionen, deshalb ändert sich für die Figur nichts.

## Wenn's nicht klappt

- **Die Figur bleibt am Berg hängen:** Bei den Ebenen mit dem Berg ist **Kollisionen erkennen** noch an.
- **Von außen sieht man eine Naht im Berg:** Die beiden Teile sind nicht aus einem Bild geschnitten, oder einer sitzt ein paar Pixel daneben.
- **Innen sieht man eine gerade Kante:** Der Schnitt ist gerade. Schneid die beiden Teile entlang einer zackigen Linie.
- **Man kommt nicht in die Höhle:** Im Eingang liegt noch ein Fels. Der Eingang ist nur ein Loch im Bild, dahinter muss frei sein.
- **Draußen ist es auch dunkel:** Das Rechteck der Abdunkeln-Ebene reicht bis nach draußen. Zieh es nur über die Höhle.
- **Am Eingang ist eine harte Kante zwischen hell und dunkel:** Es fehlt das schmale Rechteck mit dem Farbverlauf von Weiß nach Blau.
- **Die Pilze leuchten nicht:** Die Licht-Ebene liegt unter der Abdunkeln-Ebene, oder bei ihr fehlt der **Mischmodus: Leuchten**.
- **Die Figur kommt aus dem Teich nicht heraus:** Die Mulde ist tiefer als ein Sprung. Mach sie nur einen Block tief.
- **Der Berg verschwindet nicht:** Signalbereich und Ebene haben nicht dasselbe Signal, bei der Ebene steht nicht **weg, solange an**, oder das Rechteck liegt nicht dort, wo die Figur läuft.
- **Draußen ist es dunkel, drinnen hell:** Bei den dunklen Ebenen steht **weg, solange an** statt **da, solange an**.

## Mach mehr draus

Versteck hinten in der Höhle einen Schatz, den nur das Licht eines Pilzes verrät – oder lass eine Fledermaus von der Decke flattern, wenn man den Teich betritt.
