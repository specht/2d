---
titel: Pfeil und Bogen
kategorie: Kampf
stufe: 2
kurz: Mit K fliegen Pfeile – im hohen Bogen über die Strohballen oder geradeaus, und immer mitten ins Ziel.
standbild: 1.55
szene:
  # Pip shoots at 45° with gravity: the arrows arc over the hay bales and come
  # down at their start height – exactly into the white centre of the dummy's
  # target (10 px above the ground). Launch 44 px, dummy face 196 px:
  # range v²·sin(2·45°)/g = 240² / 380 ≈ 152 px
  legende: { P: pip_bogen_schraeg, t: strohpuppe, h: strohballen }
  karte: |
    ..........
    ..........
    ..........
    .P..hh..t.
    ##########
ablauf:
  - { t: 0.4, drücken: fernkampf }
  - { t: 1.1, drücken: fernkampf }
  - { t: 1.8, drücken: fernkampf }
dauer: 3.8
erwartet:
  gegner_besiegt: 1
# a picture of its own in the text: the same bow without angle and gravity –
# the arrows fly straight
einzelbilder: true
varianten:
  - szene:
      legende: { P: pip_bogen, t: strohpuppe }
      karte: |
        ..........
        ..........
        ..........
        .P......t.
        ##########
    dauer: 3.4
    erwartet:
      gegner_besiegt: 1
---
## Kurz gesagt

1. Zeichne einen Pfeil, der nach **rechts** zeigt.
2. Gib deiner Figur **Fernkampfangriff** und wähle den Pfeil als **Projektilsprite**.
3. Stell einen **Winkel** und etwas **Schwerkraft** ein – mit **K** fliegt der Pfeil im Bogen.

## Das brauchst du

- **Das musst du zeichnen:** einen Pfeil (ein Bild genügt). Einen extra Bogen-Sprite brauchst du nicht.
- **Das kannst du später dazumalen:** einen **Angriff**-Zustand, in dem die Figur den Bogen spannt – und ein Ziel zum Üben.

![Bogen spannen](katalog:pip/angriff_bogen 8)
![Strohpuppe](katalog:strohpuppe/stehen)
![Strohpuppe getroffen](katalog:strohpuppe/treffer 12)
![Strohpuppe fällt zusammen](katalog:strohpuppe/tot 8)
![Strohballen](katalog:strohpuppe/strohballen)

## Schritt für Schritt

1. Zeichne den Pfeil als eigenen Sprite. Er braucht **keine** Eigenschaft.
2. Bei deiner Figur: **Eigenschaft hinzufügen → Kampf → Fernkampfangriff**.
3. **Art: Projektil**, **Zielen: Blickrichtung**.
4. Pip schießt mit **Schaden 15** und **Cooldown 0,6 s**.
5. Bei **Projektilsprite** wählst du den Pfeil.
6. **Der Bogenschuss:** **Winkel 45°** (schräg nach oben), **Schwerkraft 380 px/s²**, **Geschwindigkeit 240 px/s** und **Reichweite 260 px**. Der Pfeil steigt, wird langsamer, kippt und fällt wieder – und dreht sich dabei immer in Flugrichtung.
7. **Das Ziel:** Eine Strohpuppe, 24 × 32 Pixel groß, als **Gegner** mit **Verhalten: Steht still** und **Energie 45**. Gib ihr einen Zustand **Gegner: Treffer (rechts)**, in dem sie wackelt, und einen Zustand **Gegner tot**, in dem sie in sich zusammensackt.
8. Stell die Puppe so weit weg, wie der Bogen reicht – hier sieben Felder. Dazwischen liegen zwei **Strohballen** mit *man kann nicht von den Seiten reinlaufen*: Geradeaus käme kein Pfeil hindurch, im Bogen fliegen sie einfach darüber.
9. Probier es mit **K** aus: Drei Pfeile, drei Treffer – und die Puppe sackt zusammen.

## Einfach geradeaus

Lässt du **Winkel** und **Schwerkraft** auf **0**, fliegt der Pfeil schnurgerade in Blickrichtung. Pip schießt hier mit **Geschwindigkeit 260 px/s** und **Reichweite 220 px** – ohne Strohballen im Weg.

![Pip schießt geradeaus](variante:1)

Der Pfeil fliegt ungefähr auf halber Höhe von Pip – der Schaft von Pips Pfeil genau 10 Pixel über dem Boden. Genau dort hat die Puppe ihre Zielscheibe auf der Brust, darum trifft jeder Pfeil mitten ins Weiße.

## Tipps

> **Tipp:** Der Pfeil wird in Flugrichtung gedreht. Du musst ihn nur einmal nach rechts zeichnen.

> **Tipp:** Wie weit der Bogen reicht, hängt an **Winkel**, **Geschwindigkeit** und **Schwerkraft**. Am weitesten fliegt er bei 45°. Mehr Schwerkraft oder weniger Tempo macht den Bogen kürzer, ein flacher Winkel wie 20° macht ihn flacher. Probier so lange, bis der Pfeil genau am Ziel wieder herunterkommt.

- **Was passiert an einer Wand?** Trifft der Pfeil etwas Festes – eine Wand, einen Strohballen oder im Bogen den Boden –, bleibt er dort stehen und verschwindet. Der **Treffereffekt** erscheint nur, wenn er eine Figur trifft.
- Die **Reichweite** ist der Weg, den der Pfeil höchstens zurücklegt. Ist sie kürzer als der Bogen, verschwindet der Pfeil mitten in der Luft.
- Negative Winkel schießen schräg nach unten – praktisch von einem Turm herab.
- Mit **Zielen: Maus** schießt man mit Linksklick in Richtung Mauszeiger; der Winkel gilt dann nicht.
- Ein Feuerball ist dasselbe Rezept – nur mit einem animierten Feuerball-Sprite.

## Wenn's nicht klappt

- **K macht nichts:** Der Fernkampfangriff muss bei der **Spielfigur** sein.
- **Man sieht keinen Pfeil:** Bei **Projektilsprite** ist nichts ausgewählt.
- **Der Pfeil verschwindet zu früh:** Erhöhe die **Reichweite**.
- **Der Pfeil landet vor dem Ziel:** Weniger **Schwerkraft**, mehr **Geschwindigkeit** – oder stell das Ziel näher.
- **Der Pfeil fliegt über den Gegner hinweg:** Mehr **Schwerkraft**, weniger **Geschwindigkeit** – oder der Gegner ist zu klein, oder seine **Kollisionsbox oben** (unter **Erweitert**) ist zu niedrig eingestellt.
- **Der Winkel fehlt:** Er steht nur bei **Zielen: Blickrichtung** zur Auswahl.

## Mach mehr draus

Gib einem Gegner denselben Fernkampfangriff – dann schießt er zurück (Rezept *Ein Gegner, der zurückschießt*). Mit Winkel und Schwerkraft wirft er dir Pfeile im Bogen zu.
