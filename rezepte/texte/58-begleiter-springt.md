---
titel: Mein Begleiter springt nicht so hoch
kategorie: Begleiter
stufe: 2
skala: 3
schritte: 2
bild_hoch: 1
kurz: Ein Begleiter hat seine eigenen Fähigkeiten. Pip springt auf die hohe Kante, der Hund nicht, der Roboter nicht einmal auf die kleine Stufe – beide bleiben zurück und finden Pip später wieder.
# the gallery card: Pip up on the ledge, the dog waiting below
standbild: 2.6
szene:
  legende: { h: hund, r: roboter }
  anpassen:
    hund: { companion: { vjump: 5 } }
  kamera: { bildhoehe: 144 }
  karte: |
    ..........................................
    ..........................................
    ..........................................
    ............##############################
    rh.P..#.....==============================
    ############==============================
    ==========================================
ablauf:
  - { t: 0.5, halten: rechts, dauer: 1.45 }
  - { t: 0.75, drücken: springen }
  - { t: 1.5, drücken: springen }
  - { t: 3.4, halten: rechts, dauer: 2.5 }
dauer: 11.6
erwartet:
  figur_rechts_von: 30
  begleiter_einzeln:
    # the dog makes the small step, but not the high ledge
    Hund: { bleibt_zurueck: { links_von: 12, bis: 7 }, weg: 150, verloren: 1, folgt: 72 }
    # the robot cannot jump at all: it stays in front of the small step
    Roboter: { bleibt_zurueck: { links_von: 6, bis: 7 }, verloren: 1 }
---
## Kurz gesagt

1. **Begleiter** sagt nur, *dass* die Figur dir folgt. **Wie** sie folgen kann, bestimmen ihre eigenen Bewegungseinstellungen.
2. Gib dem Begleiter eine kleinere **Sprungkraft** als deiner Spielfigur – dann schafft er hohe Kanten nicht.
3. Schafft dein Begleiter einen Weg nicht, darf er zurückbleiben. Wenn er wirklich verloren geht, findet er dich nach einer Weile wieder.

## Das brauchst du

- **Das musst du zeichnen:** einen Begleiter (zum Beispiel den Hund aus *Ein Begleiter kommt mit*).
- **Das kannst du später dazumalen:** ein Sprungbild – dann sieht man, wie er es versucht.

![Hund springt](katalog:hund/springen)
![Hund fällt](katalog:hund/fallen)
![Roboter steht](katalog:roboter/stehen 3)
![Roboter rollt](katalog:roboter/rollen 10)

## Schritt für Schritt

1. Öffne beim Begleiter die Eigenschaft **Begleiter**.
2. Stell die **Sprungkraft** kleiner als die deiner Spielfigur ein. Pip hat **7**, der Hund nur **5**: Über einen Block kommt er, über zwei nicht.
3. Bau eine kleine Stufe (ein Block hoch) und dahinter eine hohe Kante (zwei Blöcke hoch).
4. Spiel das Level: Der Hund hüpft über die kleine Stufe. An der hohen Kante bleibt er stehen und wartet – Pip springt hinauf, der Hund nicht. Der Roboter kann gar nicht springen (**kann springen** ist aus): Er bleibt schon vor der kleinen Stufe stehen.
5. Lauf weiter, bis der Hund nicht mehr zu sehen ist. Nach ein paar Sekunden hat er den Anschluss verloren. Kurz darauf kommt er von hinten angelaufen – er hat dich wiedergefunden.

> **Achtung:** Das ist kein Fehler! Ein Begleiter übernimmt nicht automatisch die Fähigkeiten der Spielfigur. Was er nicht kann, schafft er nicht – und genau das macht ihn zu einem eigenen Charakter.

## So findet er dich wieder

- Solange du deinen Begleiter **sehen** kannst, wartet er einfach – du kannst zu ihm zurückgehen.
- Ist er nicht mehr zu sehen, weit weg, und kommt er ein paar Sekunden lang nicht näher, hat er **den Anschluss verloren**.
- Kurz danach **findet er dich wieder**: Er taucht knapp außerhalb des Bildschirms hinter dir auf und läuft zu dir. Geht das nicht, erscheint er direkt neben dir.
- Fällt er in einen Abgrund, findet er dich auch wieder. Und verliert deine Spielfigur ein Leben, ist er gleich wieder bei ihr.

## Ideen für Begleiter

Begleiter ist immer dasselbe – die Bewegungseinstellungen machen den Unterschied:

- **Hund:** läuft, springt eher niedrig, fliegt nicht. Schwimmen kann er, wenn du **kann schwimmen** einschaltest – oder er wartet am Ufer.
- **Roboter:** läuft, springt gar nicht (**kann springen** aus). Schon eine einzige Stufe hält ihn auf.
- **Otter:** läuft, schwimmt, springt weniger hoch.
- **Vogel, Fee oder Drohne:** **kann fliegen** – dann braucht er keine Sprünge über Lücken (siehe *Ein Vogel fliegt mit*).

## Tipps

- Willst du, dass dein Begleiter immer mitkommt, gib ihm die gleiche **Sprungkraft** wie deiner Spielfigur – oder bau nur Stufen, die er schafft.
- Ein Begleiter, der zurückbleiben kann, macht dein Level spannender: Baut der Spieler eine Treppe für ihn? Wartet er auf ihn?
- Er findet dich nur wieder, wenn er wirklich festhängt. Läuft er dir hinterher und kommt näher, lässt ihn das Spiel in Ruhe.

## Wenn's nicht klappt

- **Er schafft die hohe Kante doch:** Seine **Sprungkraft** ist zu groß, oder die Kante ist zu niedrig.
- **Er kommt nicht wieder:** Er kommt erst, wenn er weit weg und nicht mehr zu sehen ist – lauf weiter. Und er braucht neben dir Platz: Boden, auf dem er stehen kann.
- **Er bleibt schon an der kleinen Stufe hängen:** Ist **kann springen** aus, oder ist die Sprungkraft sehr klein?

## Mach mehr draus

- Baue einen Weg nur für den Begleiter: Eine Treppe aus kleinen Stufen neben der hohen Kante – Pip springt, der Hund nimmt die Treppe.
- Mach einen zweiten Begleiter mit anderer Sprungkraft. Wer kommt mit, wer bleibt zurück?
