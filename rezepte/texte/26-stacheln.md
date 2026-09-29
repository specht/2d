---
titel: Stacheln und Fallen
kategorie: Welt bauen
stufe: 1
kurz: Stacheln kosten Energie – also lieber drüberspringen!
szene:
  eigenschaften: { show_energy: true }
  karte: |
    ............
    ............
    ............
    .P..^^...^..
    ############
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.25 }
  - { t: 0.5, drücken: springen }
dauer: 3.0
erwartet:
  energie_unter: 100
---
## Kurz gesagt

1. Stacheln sind ein Sprite mit der Eigenschaft **Falle**.
2. **Schaden** bestimmt, wie viel Energie eine Berührung kostet.
3. Nach einem Treffer blinkt die Figur kurz und ist für den **Cooldown** geschützt.

## Das brauchst du

- **Das musst du zeichnen:** Stacheln, am besten silbern und spitz, damit jeder sofort sieht: Aua!
- **Das kannst du später dazumalen:** einen Glanz auf den Spitzen oder eine Warnschild-Deko daneben.

![Stacheln](katalog:welt/stacheln)

## Schritt für Schritt

1. Zeichne die Stacheln. Sie dürfen den ganzen Block füllen – der ganze Block ist gefährlich.
2. **Eigenschaft hinzufügen → Fallen und Gegner → Falle**.
3. Stell **Schaden** auf **25** und **Cooldown** auf **1 s**. Mit 100 Energie übersteht man so drei Treffer.
4. Unter **Einstellungen** kannst du **Energie anzeigen** einschalten, damit man den Verlust sieht.
5. Leg die Stacheln im **Level** auf den Boden – mal breit zum Drüberspringen, mal schmal.

## Tipps

> **Achtung:** Der voreingestellte **Schaden** ist 100. Bei 100 Energie ist die Figur damit nach einer einzigen Berührung weg.

- Der ganze Sprite zählt als Falle, nicht nur die gemalten Spitzen. Male die Stacheln darum ruhig groß.
- Faire Fallen sieht man rechtzeitig. Stell sie nicht direkt hinter eine Kante, auf die man springen muss.

## Wenn's nicht klappt

- **Die Stacheln tun nichts:** Ihnen fehlt die Eigenschaft **Falle**, oder sie liegen in einer Ebene ohne **Kollisionen erkennen**.
- **Die Figur verliert zu schnell alle Energie:** **Schaden** runter oder **Cooldown** rauf.
- **Man berührt die Stacheln, obwohl man darüber ist:** Die Stacheln sind klein gemalt, der Sprite ist aber groß. Male sie größer oder stell bei der Spielfigur die **Kollisionsbox** kleiner.

## Mach mehr draus

Kombiniere Stacheln mit Bröckelsteinen: Unter der Bröckelbrücke warten die Spitzen.
