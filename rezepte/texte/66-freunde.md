---
titel: Freunde kommen mit
kategorie: Begleiter
stufe: 2
skala: 3
kurz: Eine Abenteurerin, ein Ritter und eine Zauberin begleiten Pip. Mehrere Begleiter reihen sich hintereinander auf – jeder bewegt sich auf seine Art.
standbild: 4.2
szene:
  legende: { a: abenteurerin, r: ritter, z: zauberin }
  karte: |
    ....................
    ....................
    ....................
    z...................
    .r.a.P......#.......
    ####################
    ====================
ablauf:
  - { t: 0.5, halten: rechts, dauer: 1.65 }
  - { t: 1.22, drücken: springen }
dauer: 5.4
erwartet:
  figur_rechts_von: 16
  begleiter_einzeln:
    Abenteurerin: { folgt: 64, rechts_von: 13, nie_verloren: true }
    Ritter: { folgt: 96, rechts_von: 12, nie_verloren: true }
    Zauberin: { folgt: 72, rechts_von: 12, immer_hoeher_als: 2 }
---
## Kurz gesagt

1. Ein Begleiter muss kein Tier sein: Zeichne Menschen – Freundinnen, Ritter, Zauberer.
2. Gib jedem die Eigenschaft **Begleiter**. Mehrere Begleiter stellen sich hintereinander auf.
3. Jeder bekommt seine eigenen Bewegungseinstellungen – so hat jeder seinen eigenen Charakter.

## Das brauchst du

- **Das musst du zeichnen:** für jeden Begleiter ein Bild zum Stehen, nach rechts schauend.
- **Das kannst du später dazumalen:** Laufen, Springen und Fallen.

![Abenteurerin steht](katalog:abenteurerin/stehen 3)
![Abenteurerin läuft](katalog:abenteurerin/laufen 8)
![Abenteurerin springt](katalog:abenteurerin/springen)
![Ritter läuft](katalog:ritter/laufen 8)
![Ritter springt](katalog:ritter/springen)
![Zauberin schwebt](katalog:zauberin/schweben 4)

## Schritt für Schritt

1. Zeichne deine Freunde, jeden in ein eigenes Sprite. Schreib ihren Namen als **Titel** dazu.
2. Gib jedem die Eigenschaft **Begleiter** und markiere die Zustände: **Begleiter schaut nach rechts**, **Begleiter läuft nach rechts**, **Begleiter springt nach rechts**, **Begleiter fällt nach rechts**.
3. Stell ein, wie jeder sich bewegt:
   - **Abenteurerin:** Sprungkraft **7** wie Pip und **kann schwimmen** – sie kommt fast überallhin mit.
   - **Ritter:** In der schweren Rüstung ist er langsamer (**Geschwindigkeit 2,5**) und springt nicht hoch (**Sprungkraft 5**). Schwimmen kann er nicht.
   - **Zauberin:** **kann fliegen** – sie schwebt neben dir her. Ihr Bild bekommt **Begleiter fliegt nach rechts**.
4. Setz alle ins Level und spiel: Sie folgen dir als kleine Gruppe. Der erste bleibt dicht hinter dir, der nächste etwas weiter hinten. Die Zauberin schwebt darüber.

> **Tipp:** Begleiter sagt, dass die Figur dir folgt. Die Bewegungseinstellungen bestimmen, wie sie dir folgen kann. Auch bei Menschen!

## Tipps

- Wer zuerst im Level steht (von oben nach unten, von links nach rechts), stellt sich zuerst hinter dich. Läufer und Flieger haben jeder ihre eigene Reihe.
- Begleiter blockieren dich nicht und kämpfen nicht – sie kommen einfach mit.
- Ein Freund, der eine Stufe nicht schafft, bleibt zurück und findet dich später wieder (siehe *Mein Begleiter springt nicht so hoch*). Das kannst du in deinem Level nutzen: Wer schafft den Weg, wer nicht?

## Wenn's nicht klappt

- **Zwei Begleiter stehen aufeinander:** Das passiert nur kurz, bis jeder seinen Platz gefunden hat. Wird einer nicht fertig, ist er vielleicht viel langsamer – gib ihm mehr **Geschwindigkeit**.
- **Der Ritter bleibt hängen:** Seine **Sprungkraft** ist für die Stufe zu klein. Das ist Absicht – oder gib ihm etwas mehr.
- **Die Zauberin läuft am Boden:** Schalte bei ihr **kann fliegen** ein.

## Mach mehr draus

- Hol dir die drei mit **Sprites aus einem anderen Spiel holen** aus dieser Szene in dein eigenes Spiel – oder zeichne deine eigene Gruppe.
- Gib deiner Gruppe einen Hund dazu: Wer läuft vorn, wer hinten?
- Ein Ritter ohne Sprung (**kann springen** aus) braucht Rampen – ein Level, in dem du für ihn Wege bauen musst.
