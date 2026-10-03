---
titel: Ein Begleiter kommt mit
kategorie: Begleiter
stufe: 1
skala: 3
kurz: Gib einem Sprite die Eigenschaft Begleiter – dann läuft es der Spielfigur hinterher und bleibt in ihrer Nähe.
szene:
  legende: { h: hund }
  karte: |
    ..................
    ..................
    ..................
    .h.P.....#........
    ##################
    ==================
ablauf:
  - { t: 0.5, halten: rechts, dauer: 1.15 }
  - { t: 1.05, drücken: springen }
  - { t: 3.3, halten: rechts, dauer: 0.55 }
dauer: 5.6
erwartet:
  figur_rechts_von: 13
  begleiter_weg: 180
  begleiter_folgt: 56
  begleiter_nie_verloren: true
---
## Kurz gesagt

1. Zeichne ein Tier, einen Roboter oder ein Glibberwesen – deinen **Begleiter**.
2. Gib dem Sprite die Eigenschaft **Begleiter** und setz es ins Level.
3. Spiel das Level: Der Begleiter läuft dir hinterher und bleibt in deiner Nähe.

## Das brauchst du

- **Das musst du zeichnen:** deinen Begleiter, nach rechts schauend – ein Bild zum Stehen reicht schon.
- **Das kannst du später dazumalen:** eine Lauf-Animation und ein Bild zum Springen.

![Hund steht](katalog:hund/stehen 3)
![Hund läuft](katalog:hund/laufen 10)
![Hund springt](katalog:hund/springen)

## Schritt für Schritt

1. Zeichne deinen Begleiter in ein neues Sprite. Er schaut nach **rechts** – nach links dreht ihn das Spiel von selbst um.
2. Wähle **Eigenschaft hinzufügen → Begleiter → Begleiter**.
3. Hast du mehrere Bilder gezeichnet, sag dem Spiel, welches wofür ist: Zustand mit dem Laufen → **Eigenschaft hinzufügen → Begleiter → Laufen → Begleiter läuft nach rechts**. Genauso **Begleiter schaut nach rechts** fürs Stehen und **Begleiter springt nach rechts** fürs Springen. Fehlt ein Bild, nimmt das Spiel einfach das erste.
4. Setz den Begleiter im Level neben deine Spielfigur.
5. Spiel das Level. Der Begleiter folgt dir von selbst – du musst nichts weiter einstellen.

## Was der Begleiter macht

- Er läuft dir nach, bis er nah genug ist. Dann bleibt er stehen und schaut dich an. Er drängelt sich nicht in dich hinein und steht dir nie im Weg.
- Läufst du nur ein kleines Stück, bleibt er, wo er ist. Erst wenn du weiter weg bist, kommt er nach.
- Ist er weit weg, rennt er ein bisschen schneller, um dich einzuholen.
- Kleine Hindernisse überspringt er – so hoch, wie **seine eigene Sprungkraft** reicht.

> **Tipp:** Ein Begleiter hat seine **eigenen** Fähigkeiten. Er kann nicht automatisch alles, was deine Spielfigur kann. Das Rezept *Mein Begleiter springt nicht so hoch* zeigt, was dann passiert.

## Tipps

- Ein Begleiter ist **kein Gegner**: Er macht keinen Schaden, Gegner greifen ihn nicht an, und für „alle Gegner besiegt“ zählt er nicht.
- Er sammelt nichts ein, öffnet keine Türen und tritt nicht auf Druckplatten – das macht nur deine Spielfigur.
- Wie schnell er läuft, stellst du bei **Geschwindigkeit** ein. Ist er langsamer als deine Spielfigur, holt er erst auf, wenn du stehen bleibst.

## Wenn's nicht klappt

- **Er bewegt sich gar nicht:** Hat das Sprite die Eigenschaft **Begleiter**? Ist dein Sprite gleichzeitig **Gegner** oder **Spielfigur**, zählt es als das – ein Begleiter braucht ein eigenes Sprite.
- **Er läuft, aber sieht dabei aus, als würde er stehen:** Gib dem Zustand mit dem Laufen das Häkchen **Begleiter läuft nach rechts**.
- **Er schwebt in der Luft:** Ist **kann fliegen** an? Dann fliegt er (siehe *Ein Vogel fliegt mit*).

## Mach mehr draus

- Mach aus dem Hund eine Katze, einen kleinen Roboter, einen Schleim oder ein Küken.
- Zeichne einen Zustand **Begleiter springt nach rechts** – dann sieht man, wenn er über ein Hindernis hüpft.
- Gib deinem Begleiter einen Namen als **Titel** des Sprites. Dann findest du ihn in der Sprite-Liste sofort.
