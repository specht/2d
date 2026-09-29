---
titel: Ein Gegner, der wegläuft
kategorie: Gegner
stufe: 2
kurz: Die Maus ist ein Angsthase. Kommt Pip zu nah, rennt sie davon – bis sie in der Ecke sitzt und zittert.
szene:
  karte: |
    ..............
    ..............
    ..............
    M.P.....@....M
    ##############
ablauf:
  - { t: 0.6, halten: rechts, dauer: 0.7 }
  - { t: 2.2, halten: rechts, dauer: 0.5 }
dauer: 4.0
erwartet:
  gegner_ausrufezeichen: true
  gegner_weg: 72
  gegner_leben: 1
---
## Kurz gesagt

1. Beim Gegner gibt es **Verhalten**. Der **Angsthase** läuft erst hin und her wie immer.
2. Kommt die Spielfigur zu nah, rennt er davon – schneller als sonst.
3. Sitzt er in einer Ecke fest, bleibt er stehen und zittert. Dann ist er leicht zu fangen.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer Lauf-Animation.
- **Das kannst du später dazumalen:** ein Bild für die Flucht – große Augen, ein Schweißtropfen – und Treffer und Tot für den Kampf.

![Maus steht](katalog:maus/stehen)
![Maus läuft](katalog:maus/laufen 10)
![Maus flieht](katalog:maus/fliehen 16)

## Schritt für Schritt

1. Mach aus dem Sprite einen **Gegner** und wähl bei **Verhalten** den **Angsthasen**.
2. **Angst ab: 72 px.** Ist die Spielfigur näher als drei Blöcke, flieht er – egal, wohin er gerade schaut.
3. **Tempo auf der Flucht: 2,5 ×.** So viel schneller als sonst rennt er weg.
4. Setz das Häkchen bei **zeigt „!“**: Dann sieht man, wann er erschrickt.
5. Leg einen Zustand mit **Gegner flieht nach rechts** an und nimm dafür das Bild mit den großen Augen. Nach links wird er automatisch gespiegelt.
6. Spiel es aus: Pip geht auf die Maus zu, sie erschrickt und flitzt davon, bis die Mauer sie aufhält.

## Tipps

> **Tipp:** Ein Angsthase ist die perfekte Beute: ein Gegner, den man jagen muss, statt vor ihm wegzulaufen. Gib ihm etwas Wertvolles – zum Beispiel stellt das Level erst fertig, wenn er besiegt ist.

- Hat der Angsthase kein Bild für die Flucht, rennt er einfach mit seiner Lauf-Animation davon.
- Mit einer großen **Angst ab**-Entfernung ist er kaum zu erwischen. Dann hilft nur eine Sackgasse.
- An einer Kante springt er nicht hinunter, sondern bleibt zitternd stehen – genau wie an einer Wand.

## Wenn's nicht klappt

- **Er flieht nicht:** Die Spielfigur ist weiter weg als **Angst ab**, oder beim Gegner ist ein anderes **Verhalten** eingestellt.
- **Er rennt auf die Spielfigur zu:** Das ist ein **Jäger**, kein Angsthase.
- **Er zittert gar nicht:** Er hat noch Platz zum Weglaufen. Setz eine Mauer oder eine Kante in seinen Weg.

## Mach mehr draus

Bau eine Wiese voller Angsthasen, die alle vor Pip davonstieben – oder einen Hasen, der erst flieht und dich dann zum Schatz führt.
