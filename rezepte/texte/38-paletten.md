---
titel: Farben, die Stimmung machen
kategorie: Level gestalten
stufe: 2
kurz: Derselbe Leuchtturm, dieselbe Pip – nur eine andere Palette. Und plötzlich ist es Abend, Nacht, Sturm oder ein Traum.
standbild: 3.4
szene:
  palette: Cling
  himmel: ['#55beed', '#c3def1']
  legende: { T: leuchtturm, K: klippe, F: fels, '=': steg, '|': stegpfosten, '~': meer, B: boot, o: sonne, C: schaefchenwolke }
  ebenen:
    - name: Hintergrund
      kollision: false
      karte: |
        .........o..
        ...C........
        ............
        .T..........
        .....|..|.B.
        ............
    - name: Welt
      karte: |
        ............
        ............
        ............
        ....P.......
        KKKKK====...
        FFFFF~~~~~~~
beschriftung:
  - { text: 'Cling: ein sonniger Tag', spalte: 5.5, zeile: 0 }
# The same scene again, each time converted to another palette – with a sky
# picked from that palette (the conversion keeps light things light).
varianten:
  - szene: { palette: SLSO8, himmel: ['#203c56', '#ffaa5e'] }
    beschriftung: [{ text: 'SLSO8: Abend', spalte: 5.5, zeile: 0 }]
  - szene: { palette: Nyx8, himmel: ['#08141e', '#20394f'] }
    beschriftung: [{ text: 'Nyx8: Nacht', spalte: 5.5, zeile: 0 }]
  - szene: { palette: Cryptic Ocean, himmel: ['#2a173b', '#4c5c87'] }
    beschriftung: [{ text: 'Cryptic Ocean: kalt und stürmisch', spalte: 5.5, zeile: 0 }]
  - szene: { palette: Midnight ablaze, himmel: ['#130208', '#7c183c'] }
    beschriftung: [{ text: 'Midnight ablaze: Gefahr!', spalte: 5.5, zeile: 0 }]
  - szene: { palette: pastel qt, himmel: ['#a8c8a6', '#f6edcd'] }
    beschriftung: [{ text: 'pastel qt: ein Traum', spalte: 5.5, zeile: 0 }]
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.45 }
dauer: 1.4
erwartet:
  figur_rechts_von: 5
---
## Kurz gesagt

1. Eine **Palette** ist die Auswahl an Farben, mit der du malst. Im Studio gibt es fast hundert davon.
2. Die Palette bestimmt die **Stimmung**: Warme Farben wirken gemütlich oder heiß, kalte Farben still oder unheimlich, blasse Farben verträumt.
3. Hier ist es sechsmal dieselbe Küste mit denselben Sprites. Nur die Palette und der Himmel sind anders – und damit die Tageszeit, das Wetter und das Gefühl.

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
