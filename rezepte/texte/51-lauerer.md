---
titel: Der Lauerer stürmt los
kategorie: Gegner
stufe: 3
farben: 256
kurz: Der Keiler wartet still, dann rast er los. Prallt er gegen die Wand, ist er benommen – jetzt zuschlagen!
szene:
  legende: { P: pip_schwert }
  karte: |
    ..............
    ..............
    M............M
    M............M
    M.P.......a..M
    ##############
ablauf:
  - { t: 0.5, halten: rechts, dauer: 0.2 }
  - { t: 1.65, drücken: springen }
  - { t: 2.5, halten: links, dauer: 0.22 }
  - { t: 2.8, drücken: nahkampf }
  - { t: 3.3, drücken: nahkampf }
  - { t: 3.8, drücken: nahkampf }
dauer: 4.6
erwartet:
  gegner_modi: [windup, charge, rest]
  gegner_besiegt: 1
---
## Kurz gesagt

1. Der **Lauerer** steht still und wartet.
2. Kommt die Spielfigur in Sicht, holt er kurz Anlauf und stürmt geradeaus los.
3. Rennt er gegen eine Wand, ist er **benommen** – die beste Zeit für einen Angriff.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer ruhigen Steh-Animation und einer schnellen Lauf-Animation.
- **Das kannst du später dazumalen:** ein Bild für den Angriff (tief gesenkter Kopf, Staub), eins für „benommen“ (Sternchen über dem Kopf) und Treffer und Tot.

![Keiler steht](katalog:keiler/stehen 3)
![Keiler stürmt](katalog:keiler/stuermen 18)
![Keiler ist benommen](katalog:keiler/benommen 6)

## Schritt für Schritt

1. Gib dem Keiler die Eigenschaft **Gegner** und stell **Verhalten: Lauerer** ein.
2. **Sichtweite: 168 px.** Der Lauerer schaut nach links und rechts.
3. **Tempo beim Angriff: 5×.** So schnell ist er, wenn er losstürmt.
4. **benommen nach Aufprall: 1,5 s.** So lange bleibt er nach dem Aufprall stehen.
5. Stell die **Energie** auf **60** – dann braucht Pips Schwert drei Treffer.
6. Zwei Zustände machen ihn lebendig: **Gegner jagt nach rechts** für den Angriff und **Gegner ist benommen (rechts)** für die Zeit nach dem Aufprall.
7. Spiel es aus: Warte, bis er losrennt, spring drüber und schlag zu, solange er benommen ist.

## Tipps

> **Tipp:** Der Keiler bewegt sich nur geradeaus. Wer rechtzeitig springt, ist sicher – das Spiel wird zum Timing-Rätsel.

- Die Steh-Animation darf langsam sein (hier 3 fps), die Lauf-Animation sehr schnell (hier 16 fps). So sieht man den Unterschied sofort.
- An einer Kante bremst der Lauerer, statt hinunterzufallen. Nur Wände machen ihn benommen.
- Mit **zeigt „!“** warnt er, bevor er losrennt.
- Nach dem Angriff ruht er sich kurz aus und lauert dann wieder.
- **Intelligenz** braucht der Lauerer nicht: Er stürmt immer geradeaus. Bei ihm gibt es dort nichts einzustellen.

## Wenn's nicht klappt

- **Er rennt nie los:** Die Spielfigur ist nicht auf seiner Höhe, oder eine Wand ist dazwischen.
- **Er ist sofort wieder da:** Stell **benommen nach Aufprall** höher.
- **Er rennt aus dem Level:** Setz Wände an die Enden seines Wegs.

## Mach mehr draus

Bau einen Gang mit einer Wand in der Mitte, die man umgehen muss – der Keiler prallt jedes Mal dagegen.
