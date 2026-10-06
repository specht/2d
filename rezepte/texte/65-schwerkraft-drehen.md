---
titel: Die Schwerkraft drehen
kategorie: Wasser & Weltall
stufe: 3
kurz: In einem Bewegungsbereich kann die Schwerkraft nach links, oben oder rechts ziehen. Pip läuft dort die Wand hinauf – und die Kamera dreht sich mit.
schritte: 2
# the gallery card: Pip walks up the wall, the camera has turned
standbild: 2.9
szene:
  # the whole screen: the camera turns with Pip
  kamera: { bildhoehe: 216 }
  himmel: ['#29366f', '#3b5dc9']
  legende: { o: muenze }
  effekte:
    # snow falls down the screen – also when the camera has turned
    - { effekt: snow, name: Schnee, farbe: '#f4f4f4ff', menge: 0.6 }
  bewegungsbereiche:
    # the right part of the room: gravity pulls to the right
    - { name: Schwerkraft nach rechts, art: laufen, schwerkraft_nach: rechts, drehdauer: 0.6, rechtecke: [[10, 1, 5, 14]] }
  karte: |
    MMMMMMMMMMMMMMMM
    M..............M
    M..............M
    M.............oM
    M.............oM
    M.............oM
    M..............M
    M..............M
    M..............M
    M..............M
    M..............M
    M..............M
    M..............M
    M..............M
    M.P............M
    MMMMMMMMMMMMMMMM
ablauf:
  # Pip keeps walking to the right – on the wall that is up
  - { t: 0.3, halten: rechts, dauer: 3.2 }
dauer: 4.4
erwartet:
  figur_schwerkraft: rechts
  punkte_gleich: 30
  lebt: true
# a picture of its own in the text: a Schalter turns gravity upside down
einzelbilder: true
varianten:
  - szene:
      kamera: { bildhoehe: 216 }
      himmel: ['#29366f', '#3b5dc9']
      signale: { 1: Schwerkraft }
      legende:
        o: muenze
        S: { sprite: schalter, platziert: { switch: { signal_code: 1 } } }
      effekte:
        - { effekt: snow, name: Schnee, farbe: '#f4f4f4ff', menge: 0.6 }
      bewegungsbereiche:
        # the whole room, switched on by the Schalter: gravity pulls up
        - { name: Schwerkraft nach oben, art: laufen, schwerkraft_nach: oben, drehdauer: 0.8,
            signal: { code: 1, reaktion: erscheint }, rechtecke: [[0, 0, 16, 16]] }
      karte: |
        MMMMMMMMMMMMMMMM
        M.....o.o.o....M
        M..............M
        M..............M
        M..............M
        M..............M
        M..............M
        M..............M
        M..............M
        M..............M
        M..............M
        M..............M
        M..............M
        M..............M
        M.P.S..........M
        MMMMMMMMMMMMMMMM
    ablauf:
      - { t: 0.3, halten: rechts, dauer: 0.3 }
      - { t: 1.0, drücken: aktion }
      # on the ceiling the room stands on its head: the coins are now to the left on the screen
      - { t: 2.4, halten: links, dauer: 1.0 }
    dauer: 5.2
    erwartet:
      signale: ['1 an']
      figur_schwerkraft: oben
      punkte_gleich: 30
      lebt: true
---
## Kurz gesagt

1. Leg im Level einen **Bewegungsbereich** an: **+** in der Ebenenliste → Bewegungsbereich, und zieh ein Rechteck auf.
2. Stell **Bewegung** auf **Laufen – andere Schwerkraft** und **Schwerkraft zieht nach** auf **links**, **oben** oder **rechts**.
3. Kommt die Spielfigur hinein, dreht sie sich: Ihr Boden ist jetzt eine Wand oder die Decke. Die Kamera dreht sich mit.

## Das brauchst du

- **Das musst du zeichnen:** einen Raum mit Wänden, an denen die Spielfigur entlanglaufen kann.
- **Das kannst du später dazumalen:** etwas zum Einsammeln oben an der Wand, einen Schalter, Schnee oder Regen.

## Schritt für Schritt

1. Bau einen Raum aus Mauersteinen, die von allen Seiten fest sind (**von oben**, **von der Seite** und **von unten**).
2. Leg einen Bewegungsbereich über den rechten Teil des Raums. **Bewegung:** Laufen – andere Schwerkraft. **Schwerkraft zieht nach:** rechts.
3. Bei **Drehdauer** stellst du ein, wie lange das Drehen dauert – hier 0,6 Sekunden. Genau in der Mitte wechselt die Schwerkraft. 0 Sekunden: sofort.
4. Leg drei Münzen oben an die rechte Wand.
5. Probier es aus: Pip läuft nach rechts. Sobald ihre Mitte im Bereich ist, dreht sich alles: Pip fällt an die rechte Wand, und die Kamera dreht sich, bis die Wand unten ist. Pip hält weiter **rechts** gedrückt – auf der Wand ist das nach oben. Sie läuft die Wand hinauf und sammelt die Münzen ein.

Der Pfeil im Rechteck zeigt dir im Level-Editor, wohin die Schwerkraft dort zieht.

## Mit einem Schalter umdrehen

Ein Bewegungsbereich kann bei einem Signal an- und ausgehen – genau wie eine Ebene. Leg einen Bereich über den ganzen Raum mit **Schwerkraft zieht nach: oben** und stell **Bei Signal** auf **erscheint** mit dem Code des Schalters. Am Anfang ist der Bereich aus. Drückt Pip am Schalter **F**, geht er an: Pip fällt an die Decke, und die Kamera dreht sich ganz herum.

![Ein Schalter dreht die Schwerkraft](variante:1)

Mit **wechselt** dreht jeder Druck auf den Schalter die Schwerkraft wieder um.

## Was dreht sich mit?

- **Die Spielfigur und Gegner, die laufen:** Für sie ist unten, wohin die Schwerkraft zieht. Gegner laufen die Wand entlang und drehen an ihrem Ende um.
- **Die Pfeiltasten:** Rechts ist immer rechts auf dem Bildschirm. Weil sich die Kamera mitdreht, läuft die Spielfigur auf der rechten Wand mit **rechts** nach oben.
- **Schnee, Regen, Rauch, Feuer, Blasen und Gewitter:** Sie fallen oder steigen auf dem Bildschirm immer nach unten oder oben – auch wenn sich die Kamera gedreht hat.
- **Blöcke von oben:** Ein Brett, auf dem man von oben stehen kann, ist auf der Wand ein Brett, das man nur von einer Seite aus betritt.

## Tipps

- Mach den Raum ungefähr so hoch wie breit. Ist die Kamera gedreht, sieht man vom Level mehr in die Höhe und weniger in die Breite.
- Ein Bereich mit **Schwerkraft zieht nach: unten** in einem Bereich mit gedrehter Schwerkraft ist eine Insel, auf der alles wieder normal ist.
- Mit einer kurzen **Drehdauer** wird es wild, mit einer langen gemütlich.

## Wenn's nicht klappt

- **Die Spielfigur dreht sich nicht:** Ist ihre Mitte im Rechteck? Und ist **Bewegung** auf **Laufen**, **Schwimmen** oder **Schweben** gestellt (nicht **wie darunter**)?
- **Die Spielfigur fällt durch eine Wand:** Ist die Wand **von der Seite** fest? Für eine gedrehte Spielfigur ist eine Wand ihr Boden.
- **Schräge und Leitern gehen nicht mehr:** Sie gehen nur, wenn die Schwerkraft nach unten zieht. Sonst ist eine Schräge ein Block, und an einer Leiter kann man nicht klettern.
- **Fliegende Gegner, Stampfer und Begleiter drehen sich nicht mit:** Das ist so – sie behalten ihre Schwerkraft.
