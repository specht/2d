---
titel: Farben, die Stimmung machen
kategorie: Level gestalten
stufe: 2
skala: 2
kurz: Derselbe Leuchtturm, dieselbe Pip – nur eine andere Palette. Und plötzlich ist es Abend, Nacht, Sturm oder ein Traum.
# The recording (and the gallery card) shows the night; every palette also
# appears as a recording of its own in the text, one after another (variante:0 …).
einzelbilder: true
standbild: 1.5
# a little less sea, a little more sky
bild_hoch: 0.5
szene:
  palette: Nyx8
  himmel: ['#08141e', '#20394f']
  legende: { T: leuchtturm, K: klippe, F: fels, '=': steg, '|': stegpfosten, '~': meer, B: boot_im_wasser, o: sonne, C: schaefchenwolke }
  ebenen:
    # the pier's posts and the boat stand in the water: behind the waves
    - name: Hintergrund
      kollision: false
      karte: |
        .........o..
        ...C........
        ............
        .T..........
        .....|..|...
        .....|..|.B.
    - name: Welt
      karte: |
        ............
        ............
        ............
        ......P.....
        KKKKK====...
        FFFFF~~~~~~~
# The same scene, each time converted to another palette – with a sky picked
# from that palette (the conversion keeps light things light). Pip just stands
# on the pier: the waves, the boat and the lamp move.
varianten:
  # Cling: the sprites exactly as they are drawn – not converted, not dithered
  - szene: { palette: null, himmel: ['#55beed', '#c3def1'] }
  - szene: { palette: SLSO8, himmel: ['#203c56', '#ffaa5e'] }
  - szene: { palette: Cryptic Ocean, himmel: ['#2a173b', '#4c5c87'] }
  - szene: { palette: Midnight ablaze, himmel: ['#130208', '#7c183c'] }
  - szene: { palette: pastel qt, himmel: ['#a8c8a6', '#f6edcd'] }
ablauf: []
dauer: 3.0
erwartet:
  lebt: true
---
## Kurz gesagt

1. Eine **Palette** ist die Auswahl an Farben, mit der du malst. Im Studio gibt es fast hundert davon.
2. Die Palette bestimmt die **Stimmung**: Warme Farben wirken gemütlich oder heiß, kalte Farben still oder unheimlich, blasse Farben verträumt.
3. Oben siehst du die Küste bei Nacht. Weiter unten kommt dieselbe Küste in sechs Paletten – mit denselben Sprites. Nur die Palette und der Himmel sind anders, und damit die Tageszeit, das Wetter und das Gefühl.

## Das brauchst du

- **Das musst du zeichnen:** eine kleine Szene – hier einen Leuchtturm auf einer Klippe, einen Steg, das Meer, ein Boot, eine Wolke und die Sonne.
- **Das kannst du später dazumalen:** was zur Stimmung passt: Sterne für die Nacht, Regen für den Sturm, Blumen für den Traum.

![Leuchtturm](katalog:kueste/leuchtturm 2)
![Klippe](katalog:kueste/klippe)
![Steg](katalog:kueste/steg)
![Meer](katalog:kueste/meer 4)
![Boot](katalog:kueste/boot 2)
![Sonne](katalog:kueste/sonne)
![Wolke](katalog:kueste/wolke)

## Sechs Stimmungen

Schau dir die Bilder nacheinander an und frag dich jedes Mal: Wie fühlt sich das an? Wärst du gern dort?

![Cling: ein sonniger Tag](variante:1)

Kräftiges Blau, sattes Grün, ein rot-weißer Leuchtturm: So sehen die Sprites aus, wie sie mit der Palette **Cling** gemalt sind – nichts ist umgefärbt. Alles ist klar und fröhlich – ein guter Anfang für ein Spiel.

![SLSO8: Abend](variante:2)

Unten am Himmel Orange, oben schon dunkles Blau. Der Leuchtturm wird braun und warm. Es fühlt sich an wie das Ende eines langen Tages: gemütlich und ein bisschen müde.

![Nyx8: Nacht](variante:0)

Fast alles ist dunkelblau. Übrig bleiben nur wenige helle, warme Farben – genau die richtigen für Lichter. Geheimnisvoll: Was wartet da draußen auf dem Meer?

![Cryptic Ocean: kalt und stürmisch](variante:3)

Lila, Grau und kühles Blau, dazu ein fahles Grün. Keine einzige warme Farbe – es wirkt kalt, nass und ein bisschen unheimlich. Gleich zieht ein Sturm auf.

![Midnight ablaze: Gefahr!](variante:4)

Nur Rot und Schwarz. Alles glüht, als würde es brennen. So sieht ein Level aus, in dem es ernst wird – kurz vor dem Endgegner.

![pastel qt: ein Traum](variante:5)

Blasse, weiche Farben und kein echtes Schwarz. Nichts wirkt hart oder gefährlich. So sieht ein Traum aus – oder ein Märchen.

## Schritt für Schritt

1. Überleg dir zuerst, wie sich dein Level anfühlen soll: fröhlich, gemütlich, kalt, gefährlich, geheimnisvoll?
2. Öffne **Funktionen → Palette → Palette wählen**. Jede Palette zeigt ihre Farben als kleine Kästchen. Such dir eine aus, die zu deiner Stimmung passt, und klick auf **Palette wählen**.
3. Jetzt malst du mit den Farben dieser Palette. Sie wird mit deinem Spiel gespeichert.
4. Ein Bild, das schon fertig ist, färbst du mit **Funktionen → Palette → Sprite an Palette anpassen** um. Jeder Pixel bekommt die Farbe aus der Palette, die ihm am ähnlichsten ist. Das gilt immer für das Bild, das du gerade bearbeitest – bei einer Animation also für jedes Bild einzeln.
5. Gefällt es dir nicht, klick in der Bilderleiste unter der Zeichenfläche auf das Bild von vorher – dann ist die alte Version wieder da.
6. Stell zum Schluss den Himmel auf zwei Farben aus der Palette (siehe *Himmel mit Farbverlauf*). Das ist der wichtigste Schritt: Beim Umfärben bleibt Helles hell und Dunkles dunkel. Ob es Tag oder Nacht ist, entscheidet vor allem der Himmel.

## Welche Palette für welche Stimmung?

- **Fröhlich und bunt:** viele kräftige Farben, zum Beispiel **Cling**, **PICO-8** oder **Sweetie 16**.
- **Abend, gemütlich:** Orange, Braun und ein dunkles Blau, zum Beispiel **SLSO8**.
- **Nacht, geheimnisvoll:** dunkle Blautöne und ein paar helle, warme Farben für Lichter, zum Beispiel **Nyx8** oder **PurpleMorning8**.
- **Heiß, Wüste, Feuer:** Gelb, Orange und Braun, zum Beispiel **Hot Sand 6**.
- **Kalt, Sturm, Tiefsee:** Blau, Lila und Grau, zum Beispiel **Cryptic Ocean**.
- **Gefährlich:** fast nur Rot und Schwarz, zum Beispiel **Midnight ablaze**.
- **Verträumt, Märchen:** blasse Farben, zum Beispiel **pastel qt**.
- **Wie früher:** Mit nur vier Farben, zum Beispiel **Ice Cream GB**, sieht es aus wie auf einem alten Game Boy.

## Tipps

> **Tipp:** Je weniger Farben eine Palette hat, desto stärker ist die Stimmung – aber desto mehr Einzelheiten gehen beim Umfärben verloren. Mit acht bis sechzehn Farben kann man gut malen.

- Wähl die Palette am besten, **bevor** du anfängst zu malen. Umfärben geht, aber selbst gemalt sieht es fast immer schöner aus.
- Beim Umfärben gibt es drei Arten: **Ordered Dithering** macht ein gleichmäßiges Muster, **Diffusion** und **Atkinson** verteilen die Pixel eher zufällig. Probier aus, was dir besser gefällt.
- Ein Spiel darf mehrere Stimmungen haben: Der Wald am Anfang ist fröhlich, die Höhle am Ende gefährlich. Mal jede Welt mit anderen Farben.
- Die Spielfigur darf ruhig ein bisschen herausstechen. Dann findet man sie auch in einem dunklen Level sofort.

## Wenn's nicht klappt

- **Nach dem Umfärben ist alles eine Fläche:** Die Palette hat zu wenige helle und dunkle Farben. Nimm eine mit mehr Farben oder mal die wichtigen Stellen nach.
- **Nur ein Bild der Animation hat die neuen Farben:** Umgefärbt wird immer nur das Bild, das du gerade bearbeitest. Geh die anderen Bilder nacheinander durch.
- **Das Level wirkt immer noch bunt:** Der Himmel und die Sprites, die du noch nicht umgefärbt hast, haben die alten Farben.
- **Es sieht nach Tag aus, obwohl die Palette dunkel ist:** Der Himmel ist noch hell. Nimm für den Himmel die dunkelsten Farben der Palette.

## Mach mehr draus

Erfinde deine eigene kleine Szene – einen Bahnhof, einen Jahrmarkt, einen Garten – und bau sie dreimal: einmal fröhlich, einmal unheimlich, einmal verträumt. Lass jemanden spielen und frag: Wie hat es sich angefühlt?
