---
titel: Ein Schalter öffnet das Tor
kategorie: Türen & Schlüssel
stufe: 2
skala: 2
kurz: Pip legt einen Schalter um – und weiter hinten fährt ein Gittertor hoch.
szene:
  legende:
    S: { sprite: schalter, platziert: { switch: { signal_code: 3 } } }
    G: { sprite: gittertor, platziert: { door: { signal_code: 3, door_reaction: open } } }
  karte: |
    .......M..
    .......M..
    .......M..
    .......M..
    .P.S...G..
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.25 }
  - { t: 0.8, drücken: aktion }
  - { t: 1.4, halten: rechts, dauer: 0.75 }
dauer: 2.6
erwartet:
  signale: ['3 an']
  tuer_offen: true
  figur_rechts_von: 7
  lebt: true
---
## Kurz gesagt

1. Ein **Schalter** sendet beim Umlegen ein Signal mit seinem **Code**.
2. Eine Tür mit **demselben Code** reagiert darauf – zum Beispiel, indem sie aufgeht.
3. Im Spiel: zum Schalter laufen, **F** drücken, durchs Tor.

## Das brauchst du

- **Das musst du zeichnen:** einen Schalter in zwei Zuständen (aus und an) und ein Tor (geschlossen und geöffnet).
- **Das kannst du später dazumalen:** einen **Übergang**, in dem das Tor hochfährt.

![Schalter aus](katalog:welt/schalter_aus) ![Schalter an](katalog:welt/schalter_an)

![Das Gitter fährt hoch](katalog:welt/gitter_uebergang 10)

## Schritt für Schritt

1. Zeichne den Schalter: **Eigenschaft hinzufügen → Schalter → ist ein Schalter**.
2. Leg zwei Zustände an und gib ihnen **Schalter ist aus** und **Schalter ist an**.
3. Zeichne das Tor wie eine Tür (**ist eine Tür**, Zustände **geschlossen** und **geöffnet**). Schalte **ist verschließbar** und **automatische Tür** an – so kommt man nur mit dem Schalter hinein, nicht mit F.
4. Setz das Tor ins **Level** in eine Mauer, die höher ist als ein Sprung. Den Schalter stellst du davor.
5. Klicke im Level auf den Schalter. Er hat schon einen **Code** bekommen, den sonst nichts im Level hat. Du kannst ihn ändern, z. B. in **3**.
6. Klicke auf das Tor: **Code** auch **3**, und unter **Bei Signal** wählst du **öffnen**.

Unter dem Code steht, was im Level noch denselben Code hat: *Code 3 in diesem Level – sendet: 1 Schalter · reagiert: 1 Tür*. Steht dort „noch nichts reagiert darauf“, stimmt ein Code nicht.

> **Achtung:** Wie beim Schlüssel stellst du den Code am **platzierten** Sprite im Level ein, nicht beim Zeichnen.

> **Nur eine Tür gezeichnet?** Du brauchst kein zweites Tor: Klicke im Level auf die Tür und stell **ist verschließbar** und **automatische Tür** auf **ja**. Das gilt nur für diese eine Tür – die anderen bleiben, wie du sie gezeichnet hast.

## Tipps

- Schneller geht's mit dem Werkzeug **Verbinden** (Taste R): erst den Schalter anklicken, dann das Tor. Beide bekommen denselben Code.
- **Bei Signal** kann noch mehr: **schließen**, **offen, solange an** (der Schalter macht das Tor auf und wieder zu) oder **wechseln** (jedes Umlegen macht es auf oder zu).
- Mehrere Tore mit demselben Code gehen alle gleichzeitig auf.
- Ein Schalter kann auch eine **Ebene** erscheinen oder verschwinden lassen – siehe *Eine Druckplatte baut eine Brücke*.

## Wenn's nicht klappt

- **Über dem Schalter erscheint kein F:** Er liegt in einer Ebene ohne **Kollisionen erkennen**, oder ihm fehlt **ist ein Schalter**.
- **Der Schalter bewegt sich, aber das Tor nicht:** Die Codes sind verschieden, oder beim Tor steht unter **Bei Signal** noch **aufschließen** – dann wartet das Tor, bis die Figur davorsteht.
- **Das Tor geht auch mit F auf:** **ist verschließbar** ist aus – beim Zeichnen oder bei diesem einen Tor im Level.
- **Der Schalter zeigt kein „an“:** Der zweite Zustand heißt nicht **Schalter ist an**.

## Mach mehr draus

Stell den Schalter auf eine hohe Plattform, sodass man erst eine Leiter hochklettern muss – oder hinter ein zweites Tor mit einem eigenen Schalter.
