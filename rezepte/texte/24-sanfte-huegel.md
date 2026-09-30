---
titel: Sanfte Hügel mit großen Schrägen
kategorie: Welt bauen
stufe: 2
kurz: Schrägen dürfen breiter sein als ein Block – 48 × 24 ergibt sanfte Hügel. Mit passenden Übergängen sieht man keine Ecken.
schleife: true
szene:
  # f / F: the foot pieces under the low end of each slope
  legende: { f: hang_fuss, F: hang_fuss_ab }
  karte: |
    ................
    ................
    .......(.##)....
    .P...(.f====F)..
    #####f========F#
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.5 }
  - { t: 2.2, halten: links, dauer: 1.516667 }
  - { t: 4.1, halten: rechts, dauer: 0.016667 }
dauer: 4.5
---
## Kurz gesagt

1. Eine Schräge darf **breiter** sein als ein Block: **48 × 24** Pixel.
2. Sie steigt nur halb so steil – so entstehen sanfte Hügel.
3. Die Eigenschaft ist dieselbe wie bei der kleinen Schräge: **Schräge / Treppe**. Damit keine Ecken entstehen, bekommt der Hang dieselbe Graskante wie der Boden – und unten ein Übergangsstück.

## Das brauchst du

- **Das musst du zeichnen:** einen sanften Hang nach oben, 48 × 24 Pixel, einen nach unten und für beide einen **Hangfuß**.
- **Das kannst du später dazumalen:** Blumen oder Grasbüschel auf den Hügeln – in einer eigenen Deko-Ebene.

![Sanfter Hang](katalog:welt/hang_flach)
![Sanfter Hang abwärts](katalog:welt/hang_flach_ab)
![Hangfuß](katalog:welt/hang_fuss)
![Hangfuß abwärts](katalog:welt/hang_fuss_ab)
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

## Warum man Ecken sieht

- **Die Graskante ist unterschiedlich dick:** Wo ein dünner Strich auf dicken Rasen trifft, sieht man sofort eine Ecke. Mal alle Stücke mit derselben Kante.
- **Unter dem Hügel liegt Gras:** Der Boden unter einem Hügel wird von Erde bedeckt. Nimm dort Erde, sonst läuft ein grüner Streifen mitten durch den Berg.
- **Steil und sanft gemischt:** Ein steiles Stück zwischen sanften Hängen wirkt wie ein Knick. Bleib bei einer Steigung, oder mach den Übergang ganz bewusst, zum Beispiel an einer Felskante.

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
