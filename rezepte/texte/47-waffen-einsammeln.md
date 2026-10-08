---
titel: Waffen einsammeln und wechseln
kategorie: Kampf
stufe: 3
skala: 2
kurz: Pip sammelt einen Bogen und eine Steinschleuder ein. Oben links stehen sie mit ihrer Zahl – mit 1 und 2 wählst du, womit K schießt.
tasten_zeigen: true
# the whole screen, so the HUD with the weapons and their numbers is in the picture
hud: true
# the camera a little higher: more sky, no edge below the ground
bild_hoch: 2
standbild: 2.2
szene:
  # Pip has no attack of her own: the weapons bring them. The stone flies at 45°
  # over the hay bales (like "Pfeil und Bogen": 152 px to the dummy's target),
  # the arrow flies straight into them.
  kamera: { bildhoehe: 189 }
  legende: { b: bogen, s: schleuder, t: strohpuppe, h: strohballen }
  karte: |
    ..............
    ..............
    ..............
    ..............
    ..............
    Pbs.....hh..t.
    ##############
    ==============
    ==============
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.6667 }
  - { t: 1.4, drücken: fernkampf }
  - { t: 2.3, drücken: Digit1 }
  - { t: 2.6, drücken: fernkampf }
  - { t: 3.4, drücken: Digit2 }
  - { t: 3.7, drücken: fernkampf }
dauer: 5.0
erwartet:
  gegner_besiegt: 1
  inventar: { Bogen: 1, Steinschleuder: 1 }
  waffe: Steinschleuder
---
## Kurz gesagt

1. Zeichne eine Waffe – einen Bogen, ein Schwert, einen Zauberstab.
2. Gib ihr **man kann es einsammeln** mit **bleibt fürs ganze Spiel** und dazu einen **Fernkampfangriff** (oder **Nahkampfangriff**).
3. Hat die Spielfigur die Waffe eingesammelt, greift sie damit an. Hat sie mehrere, wählst du mit den **Zahlentasten**.

## Das brauchst du

- **Das musst du zeichnen:** eine Waffe zum Einsammeln und, für einen Fernkampfangriff, das Geschoss (einen Pfeil, einen Stein).
- **Das kannst du später dazumalen:** ein Ziel zum Üben, wie die Strohpuppe aus *Pfeil und Bogen*.

![Bogen](katalog:extra/bogen 5)
![Steinschleuder](katalog:extra/schleuder 5)
![Schwert](katalog:extra/schwert 5)

## Schritt für Schritt

1. Zeichne den Bogen als eigenen Sprite – so, wie er auf dem Boden liegt.
2. **Eigenschaft hinzufügen → Einsammeln → man kann es einsammeln**. Stell darunter **bleibt fürs ganze Spiel** an.
3. Gib dem Bogen **Eigenschaft hinzufügen → Kampf → Fernkampfangriff**. Alles darin stellst du ein wie bei einer Figur – **Projektilsprite**, **Schaden**, **Cooldown**. Hier: der Pfeil, Schaden 15, geradeaus.
4. Mach dasselbe mit der Steinschleuder: Ihr Stein fliegt im **Winkel 45°** mit **Schwerkraft 380 px/s²** im Bogen, Schaden 25.
5. Deine Spielfigur braucht selbst keinen Angriff. Leg Bogen und Schleuder ins Level, wo sie sie einsammeln kann.
6. Probier es aus: Pip sammelt beide ein. Die neue Waffe ist sofort ausgewählt – mit **K** fliegt ein Stein über die Strohballen. Mit **1** wählst du den Bogen (der Pfeil bleibt im Stroh stecken), mit **2** wieder die Schleuder.

## Welche Zahl hat welche Waffe?

Oben links im Spiel steht alles, was die Spielfigur für das ganze Spiel hat. Vor jeder Waffe steht ihre Zahl, und die ausgewählte Waffe hat einen hellen Rahmen. Wie die Zahlen verteilt werden, bestimmst du:

- **Taste: die nächste freie** – die erste Waffe, die man einsammelt, bekommt **1**, die nächste **2** und so weiter.
- **Taste: 1 … 9** – die Waffe hat immer diese Zahl, egal wann man sie findet. So ist das Schwert in deinem Spiel zum Beispiel immer die **1**.

> **Tipp:** Nahkampfwaffen greifen mit **J** an, Fernkampfwaffen mit **K**. Ein Schwert und ein Bogen gehen also gleichzeitig – die Zahlentasten brauchst du nur, wenn die Spielfigur mehrere Waffen derselben Art hat.

## Tipps

- Was die Spielfigur einsammelt und **bleibt fürs ganze Spiel**, behält sie auch im nächsten Level und wenn sie ein Leben verliert. Erst ein neues Spiel fängt ohne an.
- Hat die Spielfigur selbst einen Angriff (wie Pip mit dem Schwert), ersetzt die ausgewählte Waffe ihn, solange sie ausgewählt ist.
- Waffen kann man auch kaufen: Gib ihnen im Level einen **Preis** (Rezept *Ein Laden*).

## Wenn's nicht klappt

- **Die Waffe verschwindet, aber die Figur greift nicht an:** Ist **bleibt fürs ganze Spiel** an? Ohne das ist die Waffe nur etwas zum Einsammeln.
- **Die Zahlentasten tun nichts:** Hast du eine Zahl in **Einstellungen → Steuerung** für etwas anderes vergeben? Dann gilt sie dafür.

## Mach mehr draus

Versteck eine starke Waffe in einem Geheimraum – oder gib sie erst dem, der den Boss besiegt hat (als **Beute** des Gegners).
