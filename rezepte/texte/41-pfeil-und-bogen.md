---
titel: Pfeil und Bogen
kategorie: Kampf
stufe: 2
kurz: Mit K fliegen Pfeile – Pip übt an einer Strohpuppe und trifft jedes Mal mitten ins Ziel.
szene:
  # a training dummy, 48 px tall: the arrows fly at Pip's height and hit it
  legende: { P: pip_bogen, t: strohpuppe }
  karte: |
    ..........
    ..........
    .P......t.
    ##########
ablauf:
  - { t: 0.4, drücken: fernkampf }
  - { t: 1.1, drücken: fernkampf }
  - { t: 1.8, drücken: fernkampf }
dauer: 3.4
erwartet:
  gegner_besiegt: 1
---
## Kurz gesagt

1. Zeichne einen Pfeil, der nach **rechts** zeigt.
2. Gib deiner Figur **Fernkampfangriff** und wähle den Pfeil als **Projektilsprite**.
3. Mit **K** wird geschossen.

## Das brauchst du

- **Das musst du zeichnen:** einen Pfeil (ein Bild genügt). Einen extra Bogen-Sprite brauchst du nicht.
- **Das kannst du später dazumalen:** einen **Angriff**-Zustand, in dem die Figur den Bogen spannt – und ein Ziel zum Üben.

![Bogen spannen](katalog:pip/angriff_bogen 8)
![Strohpuppe](katalog:strohpuppe/stehen)
![Strohpuppe getroffen](katalog:strohpuppe/treffer 12)
![Strohpuppe fällt zusammen](katalog:strohpuppe/tot 8)

## Schritt für Schritt

1. Zeichne den Pfeil als eigenen Sprite. Er braucht **keine** Eigenschaft.
2. Bei deiner Figur: **Eigenschaft hinzufügen → Kampf → Fernkampfangriff**.
3. **Art: Projektil**, **Zielen: waagerecht**.
4. Pip schießt mit **Schaden 15**, **Reichweite 220 px**, **Geschwindigkeit 260 px/s**, **Cooldown 0,6 s**.
5. Bei **Projektilsprite** wählst du den Pfeil.
6. **Das Ziel:** Eine Strohpuppe, 24 × 48 Pixel groß, als **Gegner** mit **Verhalten: Steht still** und **Energie 45**. Sie ist so groß wie Pip und noch mehr – der Pfeil fliegt auf Pips Höhe und trifft sie sicher.
7. Gib ihr einen Zustand **Gegner: Treffer (rechts)**, in dem sie wackelt, und einen Zustand **Gegner tot**, in dem das Stroh am Pfahl hinunterrutscht.
8. Probier es mit **K** aus: Drei Pfeile, drei Treffer – und die Puppe sackt zusammen.

## Tipps

> **Tipp:** Der Pfeil wird in Flugrichtung gedreht. Du musst ihn nur einmal nach rechts zeichnen.

- Ein Feuerball ist dasselbe Rezept – nur mit einem animierten Feuerball-Sprite.
- Mit **Zielen: Maus** schießt man mit Linksklick in Richtung Mauszeiger.
- Der Pfeil fliegt waagerecht auf der Höhe der Figur. Ein Gegner, der viel kleiner ist, wird darum leicht verfehlt. Mach dein Ziel mindestens so groß wie die Figur – oder stell **Zielen: Maus** ein.

## Wenn's nicht klappt

- **K macht nichts:** Der Fernkampfangriff muss bei der **Spielfigur** sein.
- **Man sieht keinen Pfeil:** Bei **Projektilsprite** ist nichts ausgewählt.
- **Der Pfeil verschwindet zu früh:** Erhöhe die **Reichweite**.
- **Der Pfeil fliegt über den Gegner hinweg:** Der Gegner ist zu klein, oder seine **Kollisionsbox oben** (unter **Erweitert**) ist zu niedrig eingestellt.
- **Pfeile fliegen durch Wände:** Die Wand braucht *man kann nicht von den Seiten reinlaufen*.

## Mach mehr draus

Gib einem Gegner denselben Fernkampfangriff – dann schießt er zurück (Rezept *Ein Gegner, der zurückschießt*).
