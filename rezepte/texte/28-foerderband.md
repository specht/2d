---
titel: Förderbänder und Rolltreppen
kategorie: Welt bauen
stufe: 2
farben: 256
kurz: Pip steht still – und fährt trotzdem. Erst übers Band, dann die Rolltreppe hinauf.
tasten_zeigen: true
szene:
  ausschnitt: [0, 1, 14, 6]
  karte: |
    ..............
    ..............
    ..............
    .........s____
    .P......s_____
    ###[>>]#######
    ==============
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.4 }
  - { t: 1.9, halten: rechts, dauer: 0.2 }
dauer: 3.6
erwartet:
  figur_hoeher_als: 3
  figur_rechts_von: 9
---
## Kurz gesagt

1. Ein Block mit der Eigenschaft **Förderband / Rolltreppe** nimmt jede Figur mit, die darauf steht.
2. **Richtung** und **Geschwindigkeit** stellst du selbst ein.
3. Hat derselbe Sprite auch **Schräge / Treppe**, wird daraus eine Rolltreppe.

## Das brauchst du

- **Das musst du zeichnen:** ein Band-Stück, das man aneinanderreihen kann, mit ein paar Bildern, in denen die Streifen weiterwandern. Für die Rolltreppe eine Treppe mit wandernden Stufen.
- **Das kannst du später dazumalen:** runde Enden mit Rollen und einen Maschinenblock darunter.

![Förderband (Anfang)](katalog:welt/band_anfang 60)
![Förderband](katalog:welt/band 60)
![Förderband (Ende)](katalog:welt/band_ende 60)
![Rolltreppe](katalog:welt/rolltreppe 60)
![Maschine](katalog:welt/maschine)

## Schritt für Schritt

1. Zeichne das Band: oben die Lauffläche mit schrägen Streifen, darunter Rollen. Im nächsten Bild wandern die Streifen **1 Pixel** weiter. Wiederholt sich das Muster alle 8 Pixel, brauchst du 8 Bilder – dann passt das letzte wieder zum ersten.
2. Gib dem Sprite die Block-Eigenschaften (*man kann nicht von oben reinfallen* usw.) – man soll ja darauf stehen können.
3. **Eigenschaft hinzufügen → Förderbänder → Förderband / Rolltreppe**. Pip benutzt **Richtung: nach rechts** und **Geschwindigkeit 1**.
4. Im Zustand: **Framerate 60** und **Phase** überall auf **0**. Dann laufen alle Band-Stücke im Gleichtakt, und die Streifen passen über die ganze Länge.
5. Für die Rolltreppe: eine Treppe mit Stufen, die schräg nach oben wandern – auch hier 1 Pixel pro Bild (bei 6 Pixel breiten Stufen also 6 Bilder). Sie bekommt **Schräge / Treppe** mit **Richtung: nach rechts oben** und **Förderband / Rolltreppe** mit **Richtung: nach rechts**.
6. Setz unter jede Rolltreppe einen festen Block, damit sie nicht in der Luft hängt.
7. Probier es aus: Stell dich aufs Band und lass alle Tasten los.

## Tipps

> **Tipp:** Die Animation soll zur Geschwindigkeit passen. Wandern die Streifen 1 Pixel pro Bild, dann gilt: **Framerate = Geschwindigkeit × 60**. Bei Geschwindigkeit 1 also 60 fps. Kleine Schritte von 1 Pixel sehen viel ruhiger aus als große – große Sprünge flimmern.

- Läuft die Figur **mit** dem Band, ist sie schneller. Läuft sie **dagegen**, wird sie langsamer – und auf einem schnellen Band kommt sie kaum vom Fleck, wie auf einem Laufband.
- Ein Band **nach links** ist einfach das gespiegelte Bild – die Bewegung dreht sich beim Spiegeln mit.
- Normalerweise fahren auch Gegner mit. Ein Band kann einen Gegner also direkt in die Stacheln tragen. Soll er stehen bleiben, schalte **nimmt auch Gegner mit** aus.
- Beim Springen nimmt das Band dich nicht mit. Erst wenn du wieder landest, geht es weiter.
- Auf der Rolltreppe schaut die Figur weiter in ihre Richtung – anders als auf einer Leiter.

## Wenn's nicht klappt

- **Die Figur bewegt sich nicht:** Die Eigenschaft sitzt beim falschen Sprite, oder die **Geschwindigkeit** ist 0.
- **Die Figur fällt durchs Band:** Es fehlt die Block-Eigenschaft *man kann nicht von oben reinfallen*.
- **Die Streifen springen an den Übergängen:** Stell die **Phase** auf 0 – sonst beginnt jedes Stück an einer anderen Stelle der Animation.
- **Die Rolltreppe fährt nach unten statt nach oben:** Die **Richtung** des Förderbands passt nicht zur Schräge. Bei einer Treppe nach rechts oben muss das Band **nach rechts** laufen.

## Mach mehr draus

Bau eine Fabrik: Bänder in beide Richtungen, dazwischen Lücken und Stacheln – und einen Glibber, der auf dem Band herumfährt.
