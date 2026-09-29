---
titel: Sanfte Hügel mit großen Schrägen
kategorie: Welt bauen
stufe: 2
kurz: Schrägen dürfen breiter sein als ein Block – 48 × 24 ergibt sanfte Hügel.
schleife: true
szene:
  karte: |
    ..............
    ..............
    ......./#)....
    .P.(.##====)..
    ##############
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.5 }
  - { t: 2.2, halten: links, dauer: 1.516667 }
  - { t: 4.1, halten: rechts, dauer: 0.016667 }
dauer: 4.5
---
## Kurz gesagt

1. Eine Schräge darf **breiter** sein als ein Block: **48 × 24** Pixel.
2. Sie steigt nur halb so steil – so entstehen sanfte Hügel.
3. Die Eigenschaft ist dieselbe wie bei der kleinen Schräge: **Schräge / Treppe**.

## Das brauchst du

- **Das musst du zeichnen:** einen sanften Hang nach oben, 48 × 24 Pixel, und dazu passend einen nach unten.
- **Das kannst du später dazumalen:** Blumen oder Grasbüschel auf den Hügeln – in einer eigenen Deko-Ebene.

![Sanfter Hang](katalog:welt/hang_flach)
![Sanfter Hang abwärts](katalog:welt/hang_flach_ab)
![Schräge](katalog:welt/schraege)

## Schritt für Schritt

1. Neuer Sprite, dann **Funktionen → Sprite → Größe ändern** auf **48 × 24**.
2. Mal den Hang: unten links beginnt die Oberkante, oben rechts endet sie. Darunter kommt Erde – so wie beim Boden.
3. Gib dem Sprite die Eigenschaft **Schräge / Treppe** mit **Richtung: nach rechts oben**.
4. Den Hang nach unten bekommst du am schnellsten mit einer gespiegelten Kopie. Stell **Richtung: nach rechts unten** ein.
5. Im Level-Editor: Wähl den Hang aus und stell **Gittergröße** auf **24 × 24** und **Gitteroffset** auf **12 : 0**. Jetzt sitzt der Hang genau zwischen den Blöcken.
6. Bau Hügel: Hang hoch, oben ein paar Böden, Hang runter. Unter jeden Hügel kommt Erde.

## Tipps

> **Tipp:** Große und kleine Schrägen kann man mischen. Oben auf dem Hügel ist hier eine steile 24er-Schräge – ein kleiner Buckel.

- Die Figur läuft auf dem Hang so schnell wie auf dem Boden. Sanfte Hügel machen ein Level ruhiger, steile Schrägen spannender.
- Die Oberkante muss beim Übergang zum Boden genau auf derselben Höhe enden. Sonst sieht man eine Stufe.
- Probier auch **96 × 48**: noch breiter, genauso sanft – ein großer Berg in einem Sprite.

## Wenn's nicht klappt

- **Der Hang sitzt einen halben Block daneben:** Stell den **Gitteroffset** auf **12 : 0**. Beim Auswählen eines anderen Sprites setzt der Editor das Gitter zurück.
- **Die Figur läuft in den Hang hinein oder schwebt darüber:** Die **Richtung** passt nicht zur Zeichnung.
- **Die Figur bleibt oben an der Kante hängen:** Neben dem höchsten Punkt des Hangs muss ein Block mit derselben Höhe liegen.

## Mach mehr draus

Bau eine Landschaft aus Hügeln und Tälern – und setz Münzen genau auf die Hügelkuppen.
