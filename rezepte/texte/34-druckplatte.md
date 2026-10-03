---
titel: Eine Druckplatte baut eine Brücke
kategorie: Signale
stufe: 2
skala: 2
kurz: Pip tritt auf eine Druckplatte – und über dem Stachelgraben erscheint eine Brücke.
szene:
  signale: { 4: Brücke bauen }
  legende:
    p: { sprite: druckplatte, platziert: { pressure_plate: { signal_code: 4 } } }
  ebenen:
    - name: Welt
      karte: |
        .............M
        .............M
        .............M
        .P.p.........M
        ######....####
        ======^^^^====
    - name: Brücke
      signal: { code: 4, reaktion: erscheint }
      karte: |
        ..............
        ..............
        ..............
        ..............
        ......----....
        ..............
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.3 }
  - { t: 1.1, halten: rechts, dauer: 1.3 }
dauer: 2.9
erwartet:
  signale: ['4 an', '4 aus']
  figur_rechts_von: 10
  lebt: true
---
## Kurz gesagt

1. Eine **Druckplatte** sendet ihren **Code**, sobald jemand darauf tritt – und noch einmal, wenn er wieder heruntergeht.
2. Eine **Ebene** mit demselben Signal kann darauf reagieren: Sie **erscheint**.
3. Leg die Brücke in diese Ebene – erst nach dem Tritt auf die Platte kann man darüber laufen.

## Das brauchst du

- **Das musst du zeichnen:** eine Druckplatte in zwei Zuständen (oben und gedrückt) und ein Brett für die Brücke.
- **Das kannst du später dazumalen:** ein Klicken oder Leuchten, wenn die Platte gedrückt ist.

![Druckplatte oben](katalog:welt/druckplatte_oben) ![Druckplatte gedrückt](katalog:welt/druckplatte_unten)

## Schritt für Schritt

1. Zeichne die Druckplatte: **Eigenschaft hinzufügen → Schalter → ist eine Druckplatte**.
2. Leg zwei Zustände an und gib ihnen **Druckplatte nicht gedrückt** und **Druckplatte gedrückt**.
3. Bau im **Level** einen Graben mit Stacheln und leg die Druckplatte davor auf den Boden.
4. Klicke auf die Druckplatte. Sie hat schon einen eigenen **Code** bekommen. Gib dem Signal einen Namen: neben dem Code **ohne Namen** → **Namen geben …**, zum Beispiel **Brücke bauen**.
5. Leg eine **neue Ebene** an, nenne sie **Brücke** und lass **Kollisionen erkennen** an.
6. Stell bei dieser Ebene **Bei Signal** auf **erscheint** und wähle neben **Code** aus der Liste das Signal **Brücke bauen**.
7. Setz in der Ebene *Brücke* Bretter über den Graben.

Unter dem Code der Ebene steht, wer ihr Signale sendet: *»Brücke bauen« (Code 4) in diesem Level – sendet: 1 Druckplatte · reagiert: Ebene »Brücke«*.

> **Achtung:** Spielfigur und Gegner gehören nicht in eine Ebene, die erscheint oder verschwindet. Eine solche Ebene reagiert sonst gar nicht.

## Tipps

- Eine Ebene, die weg ist, ist wirklich weg: Man sieht sie nicht, man kann nicht auf ihr stehen, und ihre Stacheln oder Münzen tun nichts.
- **da, solange an** lässt die Brücke nur erscheinen, solange jemand auf der Platte steht. **verschwindet** macht das Gegenteil – praktisch für eine Wand, die nach dem Tritt auf die Platte weg ist.
- Statt einer Druckplatte kann auch ein **Schalter** oder ein **Schlüssel** mit demselben Signal die Brücke bauen. Mit einem Schalter und zwei Ebenen tauschst du Mauer und Brücke hin und her – siehe *Rote und grüne Blöcke*.

## Wenn's nicht klappt

- **Die Brücke ist schon am Anfang da:** Unter **Bei Signal** steht nicht **erscheint**, oder die Bretter liegen in einer anderen Ebene.
- **Die Brücke erscheint nicht:** Platte und Ebene haben nicht dasselbe Signal (schau in die Signale-Übersicht (Taste S)), oder die Druckplatte liegt in einer Ebene ohne **Kollisionen erkennen**.
- **Man fällt durch die Brücke:** In der Ebene *Brücke* ist **Kollisionen erkennen** aus.
- **Die Ebene reagiert gar nicht:** Die Spielfigur oder ein Gegner liegt in dieser Ebene.

## Mach mehr draus

Mach den Graben so breit, dass man nicht hinüberspringen kann. Oder lass mit **verschwindet** eine Mauer vor dem Ziel verschwinden.
