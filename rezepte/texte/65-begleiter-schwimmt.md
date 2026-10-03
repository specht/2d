---
titel: Ein Begleiter kann schwimmen
kategorie: Begleiter
stufe: 3
skala: 3
kurz: Pip springt ins Wasser. Der Otter kann schwimmen und folgt ihm durch den See – der Hund kann es nicht und wartet am Ufer.
standbild: 3.0
szene:
  himmel: ['#41a6f6', '#c3e6f6']
  legende: { h: hund, o: otter, '_': sand, '~': wasser_oben, w: wasser }
  bewegungsbereiche:
    # the lake: from just below the shore down to its sandy floor
    - { name: See, art: schwimmen, rechtecke: [[7, 3.25, 9, 2.75]] }
  ebenen:
    - name: Welt
      karte: |
        ......................
        ......................
        .h.o.P................
        #######.........######
        =======.........======
        =======.........======
        =======_________======
        ======================
    - name: Wasser
      kollision: false
      vorne: true
      karte: |
        ......................
        ......................
        ......................
        .......~~~~~~~~~......
        .......wwwwwwwww......
        .......wwwwwwwww......
        ......................
        ......................
ablauf:
  - { t: 0.4, halten: rechts, dauer: 3.6 }
  - { t: 2.3, halten: hoch, dauer: 1.6 }
  - { t: 2.9, drücken: springen }
  - { t: 3.3, drücken: springen }
dauer: 7.0
erwartet:
  figur_rechts_von: 17
  begleiter_einzeln:
    Otter: { schwimmt: true, rechts_von: 16, folgt: 80 }
    Hund: { schwimmt: false, bleibt_zurueck: { links_von: 7, bis: 7 } }
---
## Kurz gesagt

1. Wasser ist bei dir ein **Bewegungsbereich** mit **Schwimmen** (siehe *Pip taucht*).
2. Schalte beim Begleiter **kann schwimmen** ein – dann folgt er dir ins Wasser.
3. Ohne das Häkchen wartet er am Ufer. Ein Hund wartet, ein Otter schwimmt hinterher, ein Vogel fliegt einfach darüber.

## Das brauchst du

- **Das musst du zeichnen:** einen Begleiter, der schwimmen kann – zum Beispiel einen Otter.
- **Das kannst du später dazumalen:** ein Schwimmbild. Ohne es nimmt er im Wasser sein Lauf- oder Sprungbild.

![Otter steht](katalog:otter/stehen 3)
![Otter läuft](katalog:otter/laufen 10)
![Otter schwimmt](katalog:otter/schwimmen 8)

## Schritt für Schritt

1. Bau einen See: Wasser-Sprites und darüber einen **Bewegungsbereich** mit **Schwimmen**, so groß wie das Wasser.
2. Gib deinem Begleiter die Eigenschaft **Begleiter** und schalte **kann schwimmen** ein.
3. Gib dem Schwimmbild **Eigenschaft hinzufügen → Begleiter → Schwimmen → Begleiter schwimmt nach rechts**.
4. Spiel: Springst du ins Wasser, schwimmt der Otter hinterher. Kommst du am anderen Ufer heraus, springt er mit einem Schwimmzug aus dem Wasser – so hoch, wie seine **Sprungkraft** reicht.
5. Der Hund hat **kann schwimmen** aus: Er bleibt am Ufer stehen und schaut dir nach.

> **Tipp:** Begleiter sagt, dass die Figur dir folgt. Die Bewegungseinstellungen bestimmen, wie sie dir folgen kann. Ein Hund könnte am Ufer warten, während ein Otter hinterherschwimmt. Ein Vogel fliegt einfach darüber.

## Tipps

- Ein Begleiter, der nicht schwimmen kann, geht nie ins Wasser. Fällt er doch einmal hinein, schwimmt er nicht, sondern sinkt wie ein Stein – und findet dich später wieder.
- Bau das Ufer nicht zu hoch: Aus dem Wasser kommt dein Begleiter nur so hoch, wie er springen kann.
- Die Abenteurerin aus *Freunde kommen mit* kann auch schwimmen. Der Ritter in seiner Rüstung nicht.

## Wenn's nicht klappt

- **Er bleibt am Ufer stehen:** Ist **kann schwimmen** an? Liegt über dem Wasser ein **Bewegungsbereich** mit **Schwimmen**?
- **Er kommt nicht aus dem Wasser:** Das Ufer ist zu hoch für seine **Sprungkraft**. Mach es niedriger oder gib ihm mehr Sprungkraft.
- **Er wartet am Ufer, obwohl er schwimmen kann:** Er folgt dir erst, wenn du weiter weg bist. Schwimm ein Stück hinaus.

## Mach mehr draus

- Ein Rätsel für den Spieler: Der Hund kann nicht schwimmen – baut man ihm eine Brücke, kommt er mit.
- Lass einen Vogel über den See fliegen, während der Otter schwimmt und der Hund wartet: drei Begleiter, drei Arten zu folgen.
