---
titel: Ein Gegner, der wegläuft
kategorie: Gegner
stufe: 2
skala: 4
kurz: Die Maus hat den Schlüssel stibitzt! Kommt Pip zu nah, rennt sie davon – wer sie einholt, bekommt den Schlüssel zurück.
szene:
  anpassen:
    # Beute: the mouse carries a key (code 1) and hands it over when caught
    maus: { baddie: { damage: 0, drop: { sprite_index: { sprite: schluessel }, signal_code: 1, on_touch: true } } }
  karte: |
    ..............
    ..............
    ..............
    M.P.....@....M
    ##############
ablauf:
  - { t: 0.6, halten: rechts, dauer: 1.9 }
dauer: 4.2
erwartet:
  gegner_ausrufezeichen: true
  gegner_weg: 72
  schluessel: [1]
---
## Kurz gesagt

1. Beim Gegner gibt es **Verhalten**. Der **Angsthase** läuft erst hin und her wie ein Wächter.
2. Kommt die Spielfigur zu nah, rennt er davon – schneller als sonst.
3. Sitzt er in einer Ecke fest, bleibt er stehen und zittert. Wer ihn einholt und berührt, bekommt seine **Beute** – hier den Schlüssel, den die Maus stibitzt hat. Kämpfen muss man dafür nicht.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer Lauf-Animation.
- **Das kannst du später dazumalen:** ein Bild für die Flucht – große Augen, ein Schweißtropfen.

![Maus steht](katalog:maus/stehen)
![Maus läuft](katalog:maus/laufen 10)
![Maus flieht](katalog:maus/fliehen 16)

## Schritt für Schritt

1. Mach aus dem Sprite einen **Gegner** und wähl bei **Verhalten** den **Angsthasen**.
2. **Angst ab: 72 px.** Ist die Spielfigur näher als drei Blöcke, flieht er – egal, wohin er gerade schaut.
3. **Tempo auf der Flucht: 6 ×.** So viel schneller als sonst rennt er weg – die Maus ist dann flinker als Pip.
4. Setz das Häkchen bei **zeigt „!“**: Dann sieht man, wann er erschrickt.
5. Leg einen Zustand mit **Gegner flieht nach rechts** an und nimm dafür das Bild mit den großen Augen. Nach links wird er automatisch gespiegelt.
6. **Schaden: 0.** Die Maus tut niemandem etwas – sie will nur weg.
7. **Beute:** Wähl beim Gegner unter **Beute** den Schlüssel aus, gib ihm einen **Schlüssel-Code** und setz das Häkchen bei **gibt die Beute ab, wenn man ihn berührt**.
8. Probier es aus: Pip geht auf die Maus zu, sie erschrickt und flitzt davon, bis die Mauer sie aufhält. Pip holt sie ein – und hat den Schlüssel wieder.

## Mit Intelligenz

Mit der Eigenschaft **Intelligenz** (unter **Fallen und Gegner**) ist der Dieb schwerer zu fangen (siehe *Intelligente Gegner*):

- **Solange er keine Angst hat,** läuft er wie ein Wächter hin und her – mit Schrägen, Hindernissen, Lücken und Kanten, je nach Häkchen.
- **Auf der Flucht** rennt er einfach weg. Mit **Leitern klettern** flüchtet er jede Leiter hoch oder runter, an der er vorbeikommt – nur nie dir entgegen.
- **In der Ecke** helfen ihm **über Hindernisse springen**, **über Lücken springen** und **von Kanten hinunterspringen** hinaus. Nur wenn nichts davon geht, bleibt er zitternd stehen – und du erwischst ihn.

## Tipps

> **Tipp:** Ein Angsthase ist der perfekte Dieb: eine Figur, die man jagen muss, statt vor ihr wegzulaufen. Gib ihm etwas Wertvolles – einen Schlüssel für die nächste Tür oder ein Extraleben.

- **Beute** kann jedes Sprite sein, das man einsammeln kann: ein Schlüssel, ein Herz mit **gibt Leben**, eine Münze mit **gibt Punkte**. Das geht bei jedem Gegner, nicht nur beim Angsthasen. Ohne das Häkchen **gibt die Beute ab, wenn man ihn berührt** bekommt man sie erst, wenn der Gegner besiegt ist.

- Hat der Angsthase kein Bild für die Flucht, rennt er einfach mit seiner Lauf-Animation davon.
- Mit einer großen **Angst ab**-Entfernung ist er kaum zu erwischen. Dann hilft nur eine Sackgasse.
- An einer Kante springt er nicht hinunter, sondern bleibt zitternd stehen – genau wie an einer Wand. Außer du gibst ihm **Intelligenz**.

## Wenn's nicht klappt

- **Er flieht nicht:** Die Spielfigur ist weiter weg als **Angst ab**, oder beim Gegner ist ein anderes **Verhalten** eingestellt.
- **Er rennt auf die Spielfigur zu:** Das ist ein **Jäger**, kein Angsthase.
- **Er zittert gar nicht:** Er hat noch Platz zum Weglaufen. Setz eine Mauer oder eine Kante in seinen Weg.
- **Es gibt keine Beute:** Das gewählte Sprite braucht die Eigenschaft **man kann es einsammeln** oder **ist ein Schlüssel**. Und ohne das Häkchen **gibt die Beute ab, wenn man ihn berührt** muss man den Gegner erst besiegen.
- **Pip verliert Energie, wenn sie die Maus berührt:** Stell den **Schaden** auf 0.

## Mach mehr draus

Andere Diebe, die man einholen muss: eine Elster mit einer glänzenden Münze, ein Hund, der mit deinem Ball davonrennt, ein entlaufenes Huhn mit einem goldenen Ei oder ein Kobold mit der Schatzkarte. Gib ihm **Intelligenz** (siehe *Intelligente Gegner*) – dann springt er über Lücken und klettert Leitern hoch, und die Jagd wird richtig spannend.
