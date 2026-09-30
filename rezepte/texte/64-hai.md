---
titel: Ein Hai, der dich jagt
kategorie: Wasser & Weltall
stufe: 3
kurz: Auch Gegner können schwimmen. Der Hai patrouilliert am Grund, entdeckt Pip und schwimmt ihr in alle Richtungen nach – nur aus dem Wasser kommt er nicht.
skala: 2
# the gallery card: the shark hunts Pip, she swims up and away
standbild: 2.0
szene:
  himmel: ['#41a6f6', '#c3e6f6']
  legende: { P: pip_taucher, H: hai, R: fels, _: sand, o: perle, w: seegras, k: koralle, K: koralle_gruen, '~': wasser_oben, '=': wasser }
  effekte:
    - { effekt: farbe, name: Tiefe, farben: ['#e8f0ff', '#6078c0'], mischmodus: abdunkeln, bereich: [4, 2.3, 15, 3.7] }
  bewegungsbereiche:
    - { name: Lagune, art: schwimmen, rechtecke: [[4, 2.25, 15, 3.75]] }
  ebenen:
    - name: Deko
      kollision: false
      karte: |
        ....................
        ....................
        ....................
        ....................
        .....w.......w......
        .......k..K.....k...
        ....................
    - name: Welt
      karte: |
        ....................
        .P..................
        RRRR...............R
        RRRR...............R
        RRRR...............R
        RRRR...o......H....R
        ____________________
    - name: Wasser
      kollision: false
      vorne: true
      karte: |
        ....................
        ....................
        ....~~~~~~~~~~~~~~~.
        ....===============.
        ....===============.
        ....===============.
        ....................
# Pip jumps in, dives to the pearl – right in front of the shark. He sees her
# ("!") and hunts her; she swims back up and leaps out onto the rock. He is
# slower than she is (1.8 against 2.4 px per step) and stays in the water.
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.5 }
  - { t: 0.55, drücken: springen }
  - { t: 1.1, halten: [rechts, runter], dauer: 0.4 }
  - { t: 1.5, halten: [links, hoch], dauer: 1.5 }
  # a swim stroke for speed – and at the surface one more: out of the water
  - { t: 2.45, drücken: springen }
  - { t: 2.8, drücken: springen }
  # safe on the rock she turns round and looks at the shark
  - { t: 3.3, halten: rechts, dauer: 0.02 }
dauer: 4.8
erwartet:
  punkte: 10
  gegner_modi: [chase]
  gegner_ausrufezeichen: true
  figur_hoeher_als: 4
  energie_gleich: 100
---
## Kurz gesagt

1. Auch Gegner schwimmen in einem **Bewegungsbereich** – und ein **Jäger** schwimmt der Spielfigur in alle Richtungen nach.
2. Stell beim Hai **beeinflusst durch Schwerkraft** aus: Dann sinkt er nicht, sondern patrouilliert in seiner Tiefe hin und her.
3. Gegner bleiben in ihrem Wasser. Wer schnell genug hinausspringt, ist in Sicherheit.

## Das brauchst du

- **Das musst du zeichnen:** einen Hai (48 × 24 Pixel), der nach rechts schwimmt.
- **Das kannst du später dazumalen:** einen Hai mit offenem Maul für die Jagd – und Bilder für Pip, auf denen sie abtaucht, auftaucht und im Wasser treibt.

![Hai](katalog:meer/hai 5)
![Hai jagt](katalog:meer/hai_jagt 10)
![Pip taucht ab](katalog:pip/abtauchen 8)
![Pip taucht auf](katalog:pip/auftauchen 8)
![Pip treibt](katalog:pip/treiben 4)

## Schritt für Schritt

1. **Die Lagune:** Wasser wie im Rezept *Pip taucht* – Wasser-Sprites vor der Figur und ein **Bewegungsbereich** mit **Bewegung: Schwimmen** darüber. Links ist ein Felsen, auf den man hinaufspringen kann.
2. **Der Hai:** **Gegner** mit **Verhalten: Jäger**, **Sichtweite 168 px**, **Tempo beim Verfolgen 1,8 ×** und **zeigt „!“**. **Schaden 20** – ein Biss tut weh.
3. **Beeinflusst durch Schwerkraft: aus.** So bleibt der Hai in seiner Tiefe, statt auf den Grund zu sinken, und schwimmt dort hin und her.
4. Leg die Zustände an: **Gegner schwimmt nach rechts** und **Gegner jagt nach rechts** (mit offenem Maul). Ohne Schwimm-Bild nimmt das Spiel das Bild fürs Laufen.
5. **Pip im Wasser:** Neben **Spielfigur schwimmt** gibt es noch mehr Zustände: **Spielfigur taucht ab** (mit ↓), **Spielfigur taucht auf** (mit ↑ und nach einem Schwimmzug) und **Spielfigur treibt** (wenn du nichts drückst). Alle sind freiwillig – was fehlt, ersetzt das Spiel durch **schwimmt**.
6. Leg eine Perle nah vor den Hai.
7. Probier es aus: Pip springt ins Wasser und taucht ab zur Perle. Der Hai entdeckt sie – „!“ – und jagt ihr nach, schräg nach oben, genau hinter ihr her. Pip ist schneller, taucht auf und springt mit der Sprungtaste auf den Felsen. Der Hai kommt nicht hinterher: Er bleibt im Wasser, nur seine Flosse ragt heraus.

## Tipps

> **Tipp:** Im Wasser jagt ein Jäger auf dem kürzesten Weg – nach links, rechts, oben und unten. Lücken, Kanten und Leitern braucht er dort nicht.

- Mach den Hai **langsamer als die Spielfigur** (hier 1,8 gegen 2,4 Pixel pro Schritt). Dann kann man ihm entkommen – aber nur, wenn man nicht trödelt.
- Ein **Angsthase** im Wasser flieht ebenfalls in alle Richtungen – ein kleiner Fisch, den man fangen will.
- Nur Gegner, die laufen, schwimmen. **Flatterer** und **Stampfer** bewegen sich selbst und merken vom Wasser nichts.

## Wenn's nicht klappt

- **Der Hai liegt auf dem Meeresgrund:** **Beeinflusst durch Schwerkraft** ist noch an.
- **Der Hai jagt nicht:** Er schaut in die falsche Richtung, oder Pip ist weiter weg als seine **Sichtweite**.
- **Pip wird gebissen, obwohl sie wegschwimmt:** Der Hai ist zu schnell. Verringere **Tempo beim Verfolgen**.

## Mach mehr draus

Bau einen Schatz in eine Höhle, vor der ein Hai Wache schwimmt – und eine Luftblase, in der Pip kurz verschnaufen kann.
