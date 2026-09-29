---
titel: Bomben legen
kategorie: Kampf
stufe: 3
kurz: Bombe ablegen, schnell weglaufen – Bumm!
szene:
  legende: { P: pip_bombe }
  anpassen: { glibber: { baddie: { patrols: false } } }
  karte: |
    ..........
    ..........
    .P......g.
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.9 }
  - { t: 1.3, drücken: fernkampf }
  - { t: 1.5, halten: links, dauer: 0.8 }
dauer: 3.8
erwartet:
  gegner_besiegt: 1
---
## Kurz gesagt

1. Zeichne eine Bombe mit **Zündschnur** und **Explosion**.
2. **Fernkampfangriff** mit **Art: Bombe** und **Geschwindigkeit 0** – dann wird sie abgelegt.
3. Nach der **Zündzeit** explodiert sie und trifft alles im **Explosionsradius**.

## Das brauchst du

- **Das musst du zeichnen:** eine Bombe.
- **Das kannst du später dazumalen:** eine Zündschnur-Animation und eine Explosion.

![Zündschnur](katalog:welt/bombe_zuendschnur 8)
![Explosion](katalog:welt/bombe_explosion 12)

## Schritt für Schritt

1. Zeichne die Bombe: **Eigenschaft hinzufügen → Kampf → Bombe**.
2. Erster Zustand: Zündschnur mit der Zustands-Eigenschaft **Zündschnur**. Zweiter Zustand: Explosion mit **Explosion**.
3. Bei deiner Figur: **Fernkampfangriff**, **Art: Bombe**, **Projektilsprite: Bombe**.
4. **Geschwindigkeit 0** (ablegen), **Zündzeit 1,6 s**, **Explosionsradius 40 px**, **Schaden 100**.
5. Lauf zum Gegner, drück **K** und renn weg!

## Tipps

> **Achtung:** Schaltest du **Eigene Spielfigur verletzen** ein, musst du wirklich rechtzeitig weglaufen.

- Mit **Geschwindigkeit** größer als 0 wird die Bombe geworfen – eine Granate.
- **Bodenerschütterung** lässt die Kamera wackeln. Pip benutzt 3.
- Die Zündschnur läuft einmal ab und bleibt beim letzten Bild stehen, bis es knallt.

## Wenn's nicht klappt

- **Die Bombe explodiert, aber der Gegner überlebt:** Er war außerhalb des **Explosionsradius** oder sein **Energie**-Wert ist höher als der Schaden.
- **Man sieht keine Explosion:** Dem zweiten Zustand fehlt die Zustands-Eigenschaft **Explosion**.
- **Die Bombe fällt durch den Boden:** Der Boden braucht *man kann nicht von oben reinfallen*.

## Mach mehr draus

Leg eine Bombe auf einen Stapel Gegner – der Explosionsradius trifft alle gleichzeitig.
