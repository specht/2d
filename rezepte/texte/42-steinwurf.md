---
titel: Steine im Bogen werfen
kategorie: Kampf
stufe: 3
kurz: Mit Schwerkraft fliegt der Stein im Bogen nach unten.
szene:
  legende: { P: pip_wurf }
  anpassen: { glibber: { baddie: { patrols: false } } }
  karte: |
    ..........
    .P........
    ###.......
    ###.....g.
    ##########
ablauf:
  - { t: 0.5, drücken: fernkampf }
dauer: 2.4
erwartet:
  gegner_besiegt: 1
---
## Kurz gesagt

1. Ein **Fernkampfangriff** mit **Schwerkraft** fliegt im Bogen.
2. Je größer die Schwerkraft, desto schneller fällt der Stein.
3. So trifft Pip den Gegner unten von der Klippe aus.

## Das brauchst du

- **Das musst du zeichnen:** einen kleinen Stein.
- **Das kannst du später dazumalen:** einen **Angriff**-Zustand zum Ausholen und Werfen.

![Werfen](katalog:pip/angriff_wurf 10)

## Schritt für Schritt

1. Wie bei *Pfeil und Bogen*: **Fernkampfangriff**, **Art: Projektil**, **Projektilsprite: Stein**.
2. Stell **Schwerkraft** auf **220 px/s²** und **Geschwindigkeit** auf **240 px/s**.
3. **Schaden 40** – ein Treffer reicht für den Glibber.
4. Stell deine Figur auf eine Klippe und den Gegner unten davor.
5. Probier mit **K** aus, wie weit der Stein fliegt. Ändere die Geschwindigkeit, bis er trifft.

## Tipps

> **Profi-Tipp:** Schneller Wurf und kleine Schwerkraft: flacher Bogen. Langsamer Wurf und große Schwerkraft: der Stein plumpst direkt vor die Füße.

- Mit **Zielen: Maus** kann man auch nach oben werfen – dann fliegt der Stein über Hindernisse.
- Schwerkraft 0 bedeutet: Der Stein fliegt gerade wie ein Pfeil.

## Wenn's nicht klappt

- **Der Stein fällt zu früh auf den Boden:** Geschwindigkeit erhöhen oder Schwerkraft verringern.
- **Der Stein fliegt über den Gegner hinweg:** Geschwindigkeit verringern.
- **Der Stein verschwindet mitten in der Luft:** Die **Reichweite** ist zu klein.

## Mach mehr draus

Ein Schneeball-Kampf: Gib dem Gegner denselben Wurf mit **Zielen: Maus**. Gegner zielen damit direkt auf die Spielfigur.
