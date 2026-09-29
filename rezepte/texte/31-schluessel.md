---
titel: Schlüssel und verschlossene Tür
kategorie: Türen & Schlüssel
stufe: 2
kurz: Erst den Schlüssel holen – dann öffnet sich die Tür von selbst.
szene:
  legende:
    L: { sprite: schlosstuer, platziert: { door: { door_code: 7 } } }
    k: { sprite: schluessel, platziert: { key: { door_code: 7 } } }
  karte: |
    ..........
    ..........
    .P.k...L..
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.3 }
dauer: 2.6
erwartet:
  schluessel: [7]
  tuer_offen: true
  figur_rechts_von: 7
---
## Kurz gesagt

1. Eine Tür mit **ist verschließbar** öffnet sich nur mit einem Schlüssel.
2. Schlüssel und Tür bekommen im Level **denselben Code**.
3. Schlüssel einsammeln – und die Tür geht auf.

## Das brauchst du

- **Das musst du zeichnen:** einen Schlüssel und eine Tür (geschlossen + geöffnet). Ein Schloss auf der Tür zeigt, dass man einen Schlüssel braucht.
- **Das kannst du später dazumalen:** ein Glitzern am Schlüssel und einen **Übergang** für die Tür.

![Schlüssel](katalog:welt/schluessel 3)

## Schritt für Schritt

1. Tür wie im Rezept *Eine Tür mit F öffnen*, aber lass **ist verschließbar** an. Pips Tür ist außerdem eine **automatische Tür**: Sie geht auf, sobald man davor steht.
2. Zeichne den Schlüssel: **Eigenschaft hinzufügen → Schlüssel → ist ein Schlüssel**.
3. Setz Tür und Schlüssel ins **Level**.
4. Klicke im Level auf die Tür und trage bei **Code** eine Zahl ein, z. B. **7**.
5. Klicke auf den Schlüssel und trage **denselben Code** ein.

> **Achtung:** Der Code wird am **platzierten** Sprite im Level eingestellt, nicht beim Zeichnen. So kann derselbe Schlüssel-Sprite mehrmals mit verschiedenen Codes vorkommen.

## Tipps

- Mehrere Türen und Schlüssel? Gib jedem Paar einen anderen Code: rote Tür 1, blaue Tür 2 …
- Ohne automatische Tür erscheint nach dem Einsammeln ein F – dann öffnet man die Tür selbst.

## Wenn's nicht klappt

- **Die Tür bleibt trotz Schlüssel zu:** Die Codes sind verschieden. Prüfe Tür *und* Schlüssel im Level.
- **Die Tür geht auch ohne Schlüssel auf:** **ist verschließbar** ist aus.
- **Der Schlüssel lässt sich nicht einsammeln:** Er liegt in einem Layer ohne Kollisionen, oder ihm fehlt **ist ein Schlüssel**.

## Mach mehr draus

Versteck den Schlüssel oben auf einer Leiter oder hinter einer zweiten Tür.
