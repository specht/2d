---
titel: Deine erste Spielfigur
kategorie: Loslegen
stufe: 1
kurz: Ein einziges Bild genügt – schon läuft und springt deine Figur.
szene:
  legende: { P: pip_einfach }
  karte: |
    ............
    ............
    ............
    ...P...#....
    ############
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.55 }
  - { t: 0.6, drücken: springen }
dauer: 2.2
erwartet:
  figur_hoeher_als: 2
  figur_rechts_von: 7
---
## Kurz gesagt

1. Zeichne **ein** Bild deiner Figur.
2. Gib dem Sprite die Eigenschaft **Spielfigur**.
3. Setz sie im Level auf den Boden – fertig, du kannst spielen!

## Das brauchst du

- **Das musst du zeichnen:** ein Bild deiner Figur, das nach **rechts** schaut, und einen Boden-Block.
- **Das kannst du später dazumalen:** Lauf-, Sprung- und Fallbilder (siehe Rezept *Laufen, Springen und Fallen animieren*).

![Pip steht](katalog:pip/stehen 3)

## Schritt für Schritt

1. Öffne **Sprites** und zeichne deine Figur. Lass unten keinen leeren Rand – sonst schwebt sie über dem Boden.
2. Klicke bei deiner Figur auf **Eigenschaft hinzufügen → Spielfigur → Spielfigur**.
3. Zeichne einen neuen Sprite für den Boden und gib ihm **Eigenschaft hinzufügen → Blöcke** mit allen drei Eigenschaften: *man kann nicht von oben reinfallen*, *… von den Seiten reinlaufen*, *… von unten reinspringen*.
4. Wechsle zu **Level**, bau eine Reihe Boden und setz deine Figur darüber.
5. Klicke auf **Spielen**. Laufen mit den Pfeiltasten oder A/D, springen mit der Leertaste.

## Tipps

> **Tipp:** Du musst die Figur nur nach rechts zeichnen. Wenn sie nach links läuft, spiegelt das Spiel das Bild automatisch.

- **Geschwindigkeit** und **Sprungkraft** findest du bei der Eigenschaft *Spielfigur*. Pip hat hier eine Sprungkraft von 7.
- Deine Figur darf kleiner sein als 24 × 24 Pixel. Pip ist nur 13 Pixel breit.

## Wenn's nicht klappt

- **Die Figur fällt durch den Boden:** Der Boden braucht die Eigenschaft *man kann nicht von oben reinfallen*.
- **Die Figur bleibt an Kanten hängen oder berührt Dinge zu früh:** Stell bei *Spielfigur* die **Kollisionsbox** kleiner (Pip: links 0,5, rechts 0,5, oben 0,8). Beim Ändern siehst du den Kasten im Zeichenfeld.
- **Du steuerst eine andere Figur als gedacht:** Im Level sollte genau **eine** Spielfigur stehen.

## Mach mehr draus

Stell die **Sprungkraft** mal auf 12 und die **Geschwindigkeit** auf 5. Wie fühlt sich dein Spiel jetzt an?
