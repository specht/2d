---
titel: Pfeil und Bogen
kategorie: Kampf
stufe: 2
kurz: Mit K fliegen Pfeile – Pip trifft den Glibber aus sicherer Entfernung.
szene:
  legende: { P: pip_bogen }
  karte: |
    ..........
    ..........
    .P......g.
    ##########
ablauf:
  - { t: 0.4, drücken: fernkampf }
  - { t: 1.1, drücken: fernkampf }
  - { t: 1.8, drücken: fernkampf }
dauer: 3.2
erwartet:
  gegner_besiegt: 1
---
## Kurz gesagt

1. Zeichne einen Pfeil, der nach **rechts** zeigt.
2. Gib deiner Figur **Fernkampfangriff** und wähle den Pfeil als **Projektilsprite**.
3. Mit **K** wird geschossen.

## Das brauchst du

- **Das musst du zeichnen:** einen Pfeil (ein Bild genügt). Einen extra Bogen-Sprite brauchst du nicht.
- **Das kannst du später dazumalen:** einen **Angriff**-Zustand, in dem die Figur den Bogen spannt.

![Bogen spannen](katalog:pip/angriff_bogen 8)

## Schritt für Schritt

1. Zeichne den Pfeil als eigenen Sprite. Er braucht **keine** Eigenschaft.
2. Bei deiner Figur: **Eigenschaft hinzufügen → Kampf → Fernkampfangriff**.
3. **Art: Projektil**, **Zielen: waagerecht**.
4. Pip schießt mit **Schaden 15**, **Reichweite 220 px**, **Geschwindigkeit 260 px/s**, **Cooldown 0,6 s**.
5. Bei **Projektilsprite** wählst du den Pfeil.
6. Probier es mit **K** aus. Der Gegner (Energie 40) ist nach drei Treffern besiegt.

## Tipps

> **Tipp:** Der Pfeil wird in Flugrichtung gedreht. Du musst ihn nur einmal nach rechts zeichnen.

- Ein Feuerball ist dasselbe Rezept – nur mit einem animierten Feuerball-Sprite.
- Mit **Zielen: Maus** schießt man mit Linksklick in Richtung Mauszeiger.

## Wenn's nicht klappt

- **K macht nichts:** Der Fernkampfangriff muss bei der **Spielfigur** sein.
- **Man sieht keinen Pfeil:** Bei **Projektilsprite** ist nichts ausgewählt.
- **Der Pfeil verschwindet zu früh:** Erhöhe die **Reichweite**.
- **Pfeile fliegen durch Wände:** Die Wand braucht *man kann nicht von den Seiten reinlaufen*.

## Mach mehr draus

Gib einem Gegner denselben Fernkampfangriff – dann schießt er zurück (Rezept *Ein Gegner, der zurückschießt*).
