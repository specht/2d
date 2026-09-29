---
titel: Ein Gegner, der wegläuft
kategorie: Gegner
stufe: 2
kurz: Die Maus ist ein Angsthase. Kommt Pip zu nah, rennt sie davon – und wer sie erwischt, bekommt ihren Schlüssel.
szene:
  legende: { P: pip_schwert }
  anpassen:
    # Beute: the mouse leaves a key (code 1) behind
    maus: { baddie: { drop: { sprite_index: { sprite: schluessel }, door_code: 1 } } }
  karte: |
    ..............
    ..............
    ..............
    M.P.....@....M
    ##############
ablauf:
  - { t: 0.6, halten: rechts, dauer: 1.15 }
  - { t: 1.95, drücken: nahkampf }
  - { t: 2.7, halten: rechts, dauer: 0.3 }
dauer: 4.2
erwartet:
  gegner_ausrufezeichen: true
  gegner_weg: 72
  gegner_besiegt: 1
  schluessel: [1]
---
## Kurz gesagt

1. Beim Gegner gibt es **Verhalten**. Der **Angsthase** läuft erst hin und her wie immer.
2. Kommt die Spielfigur zu nah, rennt er davon – schneller als sonst.
3. Sitzt er in einer Ecke fest, bleibt er stehen und zittert. Wer ihn erwischt, bekommt seine **Beute** – hier einen Schlüssel.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer Lauf-Animation.
- **Das kannst du später dazumalen:** ein Bild für die Flucht – große Augen, ein Schweißtropfen – und ein Bild, wenn er besiegt ist.

![Maus steht](katalog:maus/stehen)
![Maus läuft](katalog:maus/laufen 10)
![Maus flieht](katalog:maus/fliehen 16)
![Maus besiegt](katalog:maus/tot 8)

## Schritt für Schritt

1. Mach aus dem Sprite einen **Gegner** und wähl bei **Verhalten** den **Angsthasen**.
2. **Angst ab: 72 px.** Ist die Spielfigur näher als drei Blöcke, flieht er – egal, wohin er gerade schaut.
3. **Tempo auf der Flucht: 6 ×.** So viel schneller als sonst rennt er weg – die Maus ist dann flinker als Pip.
4. Setz das Häkchen bei **zeigt „!“**: Dann sieht man, wann er erschrickt.
5. Leg einen Zustand mit **Gegner flieht nach rechts** an und nimm dafür das Bild mit den großen Augen. Nach links wird er automatisch gespiegelt.
6. **Beute:** Wähl beim Gegner unter **Beute** den Schlüssel aus und gib ihm einen **Schlüssel-Code**. Ist der Gegner besiegt, bleibt der Schlüssel an seiner Stelle liegen.
7. Spiel es aus: Pip geht auf die Maus zu, sie erschrickt und flitzt davon, bis die Mauer sie aufhält. Ein Schwerthieb – und Pip sammelt den Schlüssel ein.

## Tipps

> **Tipp:** Ein Angsthase ist die perfekte Beute: ein Gegner, den man jagen muss, statt vor ihm wegzulaufen. Gib ihm etwas Wertvolles – einen Schlüssel für die nächste Tür oder ein Extraleben.

- **Beute** kann jedes Sprite sein, das man einsammeln kann: ein Schlüssel, ein Herz mit **gibt Leben**, eine Münze mit **gibt Punkte**. Das geht bei jedem Gegner, nicht nur beim Angsthasen.

- Hat der Angsthase kein Bild für die Flucht, rennt er einfach mit seiner Lauf-Animation davon.
- Mit einer großen **Angst ab**-Entfernung ist er kaum zu erwischen. Dann hilft nur eine Sackgasse.
- An einer Kante springt er nicht hinunter, sondern bleibt zitternd stehen – genau wie an einer Wand.

## Wenn's nicht klappt

- **Er flieht nicht:** Die Spielfigur ist weiter weg als **Angst ab**, oder beim Gegner ist ein anderes **Verhalten** eingestellt.
- **Er rennt auf die Spielfigur zu:** Das ist ein **Jäger**, kein Angsthase.
- **Er zittert gar nicht:** Er hat noch Platz zum Weglaufen. Setz eine Mauer oder eine Kante in seinen Weg.
- **Es bleibt keine Beute liegen:** Das gewählte Sprite braucht die Eigenschaft **man kann es einsammeln** oder **ist ein Schlüssel**.

## Mach mehr draus

Bau eine Wiese voller Angsthasen, die alle vor Pip davonstieben – oder einen Hasen, der erst flieht und dich dann zum Schatz führt.
