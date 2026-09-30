---
titel: Ein Gegner, der zurückschießt
kategorie: Kampf
stufe: 3
skala: 2
kurz: Der Spuckpilz bewegt sich nicht, aber er spuckt Sporen.
szene:
  karte: |
    ..........
    ..........
    .P......m.
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.6 }
dauer: 3.6
erwartet:
  energie_unter: 100
---
## Kurz gesagt

1. Ein **Gegner** mit **Geschwindigkeit 0** bleibt stehen – ein Geschützturm.
2. Gib ihm einen **Fernkampfangriff**, genau wie der Spielfigur.
3. Er schießt, sobald die Spielfigur in Reichweite und auf seiner Höhe ist.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner und ein Geschoss (Pips Spuckpilz spuckt Sporen).
- **Das kannst du später dazumalen:** einen **Angriff**-Zustand, in dem der Gegner sich aufbläht und spuckt.

![Spucken](katalog:spuckpilz/angriff 10)

## Schritt für Schritt

1. Beim Gegner: **Geschwindigkeit 0**, **patrouilliert** aus, **Startrichtung links** (zur Spielfigur hin).
2. **Eigenschaft hinzufügen → Kampf → Fernkampfangriff**, **Projektilsprite: Spore**.
3. Der Spuckpilz: **Schaden 10**, **Reichweite 190 px**, **Geschwindigkeit 110 px/s**, **Cooldown 1,4 s**.
4. Stell beim Gegner den **Schaden** (Berührung) auf 0 – sonst tut schon das Anfassen weh.
5. Zustand „Angriff“ mit **Gegner greift nach rechts an**.

## Tipps

> **Tipp:** Langsame Geschosse und ein langer Cooldown machen den Turm fair: Man kann über die Sporen drüberspringen.

- Mit **Zielen: Maus** zielt ein Gegner direkt auf die Spielfigur – auch schräg nach oben.
- Die rote Farbe beim Treffer stellst du bei der Spielfigur unter **Trefferreaktion** ein.

## Wenn's nicht klappt

- **Der Turm schießt nie:** Die Spielfigur ist zu weit weg, nicht auf derselben Höhe, oder der Turm schaut in die falsche Richtung (**Startrichtung**).
- **Der Turm läuft weg:** **Geschwindigkeit** auf 0 und **patrouilliert** aus.
- **Die Spielfigur stirbt sofort:** Der **Schaden** des Geschosses ist zu hoch oder der Cooldown zu kurz.

## Mach mehr draus

Stell zwei Türme übereinander auf verschiedene Plattformen. Jetzt muss man den richtigen Moment abpassen!
