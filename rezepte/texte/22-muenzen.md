---
titel: Münzen einsammeln
kategorie: Welt bauen
stufe: 1
skala: 2
kurz: Münzen verschwinden beim Berühren und bringen Punkte.
szene:
  karte: |
    ............
    ............
    ............
    ........o.o.
    ..P.oooo....
    ############
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.1 }
  - { t: 0.93, drücken: springen }
dauer: 2.2
erwartet:
  punkte: 60
---
## Kurz gesagt

1. Zeichne eine Münze (gerne mit Dreh-Animation).
2. Gib ihr **man kann es einsammeln** und stell **gibt Punkte** ein.
3. Verteil Münzen im Level – auch in der Luft, damit man springen muss.

## Das brauchst du

- **Das musst du zeichnen:** eine Münze.
- **Das kannst du später dazumalen:** eine Dreh-Animation – rund, schmal, ganz dünn, schmal.

![Münze](katalog:welt/muenze 8)

## Schritt für Schritt

1. Zeichne die Münze in einem Zustand mit vier Frames. Framerate 8.
2. **Eigenschaft hinzufügen → Einsammeln → man kann es einsammeln**.
3. Stell **gibt Punkte** auf 10.
4. Setz im **Level** ein paar Münzen auf den Weg und zwei weiter oben, die man nur im Sprung erreicht.

## Tipps

- Mit **Ausblenden** und **Bewegung** stellst du ein, wie schnell und wie weit die Münze nach dem Einsammeln nach oben schwebt.
- Damit sich nicht alle Münzen gleichzeitig drehen, sorgt die **Phase** (bei den Zustand-Einstellungen) für kleine Unterschiede.
- Statt Punkten kann ein Gegenstand auch **Leben** oder **Energie** geben – ein Herz zum Beispiel.
- Im Spiel zählt oben rechts deine Münze mit: Das Bild ist das Sprite, das Punkte gibt, daneben steht, wie viele du hast. Gibt ein Sprite Leben, sind die Herzen oben links dieses Sprite.

## Wenn's nicht klappt

- **Die Münze verschwindet nicht:** Sie liegt vielleicht in einem Layer ohne Kollisionen. Leg sie in denselben Layer wie den Boden.
- **Man kommt an die Münze in der Luft nicht ran:** Häng sie tiefer. Beim Sprung muss die Figur die Münze berühren.

## Mach mehr draus

Leg eine Münzspur, die zeigt, wo ein geheimer Weg anfängt.
