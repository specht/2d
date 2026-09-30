---
titel: Sanfte Hügel mit großen Schrägen
kategorie: Welt bauen
stufe: 2
kurz: Breite und steile Hänge im Wechsel – so wird aus einer flachen Wiese eine Hügellandschaft. Mit passenden Übergängen sieht man keine Ecken.
skala: 4
# the camera shows the whole landscape, down to the ground
bild_hoch: 1
schritte: 2
# the gallery card: Pip on the first hilltop
standbild: 1.4
szene:
  himmel: ['#41a6f6', '#73eff7']
  # a landscape wider than the screen: the camera follows Pip
  kamera: { bildhoehe: 144 }
  # ( ) wide slopes (48 × 24), k K steep slopes (24 × 24);
  # f F j J: the foot pieces under the low end of each slope
  legende: { f: hang_fuss, F: hang_fuss_ab, k: huegel_steil, K: huegel_steil_ab, j: huegel_steil_fuss, J: huegel_steil_fuss_ab }
  ebenen:
    - name: Wolken
      parallaxe: 0.85
      kollision: false
      karte: |
        ...C...........C........C.....
        ..............................
        ..............................
        ..............................
        ..............................
        ..............................
    - name: Ferne Berge
      parallaxe: 0.6
      kollision: false
      karte: |
        ..............................
        ..............................
        ..............................
        ..............................
        A.......A.......A.......A.....
        ..............................
    - name: Welt
      karte: |
        ..............................
        ..............................
        .........oo..........oo.......
        ........k##K.......(.##K......
        .P..(.##j==J)....(.f===J).....
        ####f========F###f=======F####
    - name: Gras
      kollision: false
      karte: |
        ..............................
        ..............................
        ..............................
        ..............................
        ..v...........v.v..........v..
        ..............................
ablauf:
  - { t: 0.3, halten: rechts, dauer: 3.6 }
dauer: 4.4
erwartet:
  punkte: 40
  figur_rechts_von: 26
---
## Kurz gesagt

1. Eine Schräge darf **breiter** sein als ein Block: **48 × 24** Pixel. Sie steigt nur halb so steil – so entstehen sanfte Hügel.
2. Mischst du breite mit steilen Hängen (**24 × 24**), wird die Landschaft abwechslungsreich: sanft hinauf, steil zur Kuppe, und hinten wieder sanft hinunter.
3. Die Eigenschaft ist dieselbe wie bei der kleinen Schräge: **Schräge / Treppe**. Damit keine Ecken entstehen, bekommt der Hang dieselbe Graskante wie der Boden – und unten ein Übergangsstück.

## Das brauchst du

- **Das musst du zeichnen:** einen sanften Hang nach oben, 48 × 24 Pixel, einen steilen, 24 × 24 Pixel, jeweils auch nach unten – und für jeden einen **Hangfuß**.
- **Das kannst du später dazumalen:** Blumen oder Grasbüschel auf den Hügeln – in einer eigenen Deko-Ebene.

![Sanfter Hang](katalog:welt/hang_flach)
![Sanfter Hang abwärts](katalog:welt/hang_flach_ab)
![Hangfuß](katalog:welt/hang_fuss)
![Hangfuß abwärts](katalog:welt/hang_fuss_ab)
![Steiler Hang](katalog:welt/huegel_steil)
![Steiler Hang abwärts](katalog:welt/huegel_steil_ab)
![Fuß (steiler Hang)](katalog:welt/huegel_steil_fuss)
![Fuß (steiler Hang abwärts)](katalog:welt/huegel_steil_fuss_ab)
![Boden](katalog:welt/boden)

## Schritt für Schritt

1. Neuer Sprite, dann **Funktionen → Sprite → Größe ändern** auf **48 × 24**.
2. Mal den Hang: unten links beginnt die Oberkante, oben rechts endet sie. Alle zwei Pixel nach rechts geht es einen Pixel nach oben. Die **Graskante** ist genau so dick wie beim Boden – dunkle Linie, zwei Reihen helles Gras, zwei Reihen Gras, Fransen – nur schräg. Darunter kommt Erde.
3. Gib dem Sprite die Eigenschaft **Schräge / Treppe** mit **Richtung: nach rechts oben**.
4. Den Hang nach unten bekommst du am schnellsten mit einer gespiegelten Kopie. Stell **Richtung: nach rechts unten** ein.
5. Im Level-Editor: Wähl den Hang aus und stell **Gittergröße** auf **24 × 24** und **Gitteroffset** auf **12 : 0**. Jetzt sitzt der Hang genau zwischen den Blöcken.
6. **Hangfuß:** Unten am Hang ist die Graskante zu dick für den Hang allein – sie reicht in den Block darunter. Mal deshalb einen Block, in dem die Graskante vom Hang weiterläuft und nach rechts in Erde übergeht. Er kommt **unter** das untere Ende des Hangs. Für den Hang abwärts spiegelst du ihn.
7. Bau Hügel: Hang hoch, oben ein paar Böden, Hang runter. Unter jeden Hügel kommt **Erde ohne Gras** – nur unter dem Fuß des Hangs liegt der Hangfuß.
8. Zwei Hänge direkt hintereinander, einer eine Reihe höher, ergeben einen doppelt so hohen Hügel ohne Knick.
9. **Steile Hänge** malst du genauso: Kante von links unten nach rechts oben, mit derselben Graskante, und dazu einen eigenen Fuß. Ein steiler Hang kann direkt an einen sanften anschließen – ein Knick in der Landschaft, aber ohne Ecke in der Graskante.
10. **Die Landschaft:** Wiese, sanft hinauf, eine kleine Stufe, steil zur Kuppe, steil und sanft wieder hinunter, ein Tal mit Blumen, ein doppelt hoher Hügel. Setz auf die Kuppen Münzen, hinten ferne Berge und Wolken – und schon will man hinüberlaufen.
11. Probier es aus: Pip läuft über alle Hügel und sammelt oben die Münzen ein.

## Warum man Ecken sieht

- **Die Graskante ist unterschiedlich dick:** Wo ein dünner Strich auf dicken Rasen trifft, sieht man sofort eine Ecke. Mal alle Stücke mit derselben Kante.
- **Unter dem Hügel liegt Gras:** Der Boden unter einem Hügel wird von Erde bedeckt. Nimm dort Erde, sonst läuft ein grüner Streifen mitten durch den Berg.
- **Steil und sanft gemischt:** Das geht – aber nur, wenn beide Hänge dieselbe Graskante haben und jeder seinen eigenen Fuß bekommt. Sonst sieht man am Übergang eine Stufe.

## Tipps

> **Tipp:** Übergänge sind eigene Stücke. Profis malen für jede Stelle, an der zwei Formen sich treffen, ein eigenes Teil – dann sieht die Welt aus wie aus einem Guss.

- Die Figur läuft auf dem Hang so schnell wie auf dem Boden. Sanfte Hügel machen ein Level ruhiger, steile Schrägen spannender.
- Die Oberkante muss beim Übergang zum Boden genau auf derselben Höhe enden. Sonst sieht man eine Stufe.
- Der Hangfuß ist ein ganz normaler fester Block – nur mit anders gemalter Oberfläche.
- Probier auch **96 × 48**: noch breiter, genauso sanft – ein großer Berg in einem Sprite.

## Wenn's nicht klappt

- **Der Hang sitzt einen halben Block daneben:** Stell den **Gitteroffset** auf **12 : 0**. Beim Auswählen eines anderen Sprites setzt der Editor das Gitter zurück.
- **Die Figur läuft in den Hang hinein oder schwebt darüber:** Die **Richtung** passt nicht zur Zeichnung.
- **Die Figur bleibt oben an der Kante hängen:** Neben dem höchsten Punkt des Hangs muss ein Block mit derselben Höhe liegen.
- **Unten am Hang ist die Graskante abgeschnitten:** Unter dem Fuß des Hangs fehlt der Hangfuß – dort liegt noch normaler Boden oder Erde.
- **Ein grüner Streifen läuft durch den Hügel:** Unter dem Hügel liegt Boden mit Gras. Nimm Erde.

## Mach mehr draus

Bau eine Landschaft aus Hügeln und Tälern – und setz Münzen genau auf die Hügelkuppen.
