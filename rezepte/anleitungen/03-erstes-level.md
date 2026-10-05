---
titel: Das erste Level
kurz: Boden legen, die Figur hineinsetzen, mit T testen – und Fehler wieder wegmachen.
start:
  szene:
    zusaetzlich: [boden, pip]
    karte: |
      ..........
      ..........
aufnahmen:
  - name: boden
    art: video
    titel: Boden legen
    vorher:
      - js: |
          const L = game.data.levels[0];
          L.layers = L.layers.filter(l => l.properties?.name === 'Welt');
          L.layers[0].properties.name = 'Ebene 1';
          delete L.properties.name;
          game._load();
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Oben auf „Level“ klicken, nr: 1 }
      - klick: '#mi_level'
      - ansicht: [-1, -2, 14, 7]
      - { hinweis: Den Boden anklicken, nr: 2 }
      - klick: '#menu_level_sprites .button[title="Boden"]'
      - { hinweis: Zeichnen nehmen (W), nr: 3 }
      - klick: '#tool_menu_level .button[title^="Zeichnen"]'
      - { hinweis: Ein Klick – ein Block, nr: 4 }
      - klick: { feld: [0, 0] }
      - klick: { feld: [1, 0] }
      - { hinweis: Ziehen – eine ganze Reihe, nr: 5 }
      - malen: [{ feld: [2, 0] }, { feld: [12, 0] }]
      - { hinweis: Strg + ziehen – ein ganzes Rechteck, nr: 6 }
      - malen: [{ feld: [7, 1] }, { feld: [9, 2] }]
        mit: Control
      - pause: 0.6

  - name: testen
    art: video
    titel: Figur hinein und testen
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Die Figur anklicken und hinsetzen, nr: 7 }
      - klick: '#menu_level_sprites .button[title="Pip"]'
      - klick: { feld: [1, 1] }
      - { hinweis: T – das Level testen, nr: 8 }
      - taste: KeyT
      - warten: 1
      - { hinweis: Pfeiltasten und Leertaste, nr: 9 }
      - taste: ArrowRight
        halten: 0.9
      - taste: Space
      - taste: ArrowRight
        halten: 0.9
      - warten: 0.6
      - { hinweis: Esc – zurück zum Level, nr: 10 }
      - taste: Escape
      - warten: 0.8
      - pruefen: "current_pane === 'level'"
        meldung: Esc hat nicht zum Level zurückgeführt

  - name: wegmachen
    art: video
    titel: Wegmachen
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Auswählen (E) und einen Block anklicken, nr: 11 }
      - klick: '#tool_menu_level .button[title^="Auswählen"]'
      - klick: { feld: [12, 0] }
      - { hinweis: Rechtsklick – was kann ich damit tun?, nr: 12 }
      - rechtsklick: { feld: [12, 0] }
      - pause: 1.2
      - menue: Löschen
      - { hinweis: Oder mit dem Stift und X radieren, nr: 13 }
      - klick: '#tool_menu_level .button[title^="Zeichnen"]'
      - klick: '#menu_level_sprites .button[title="Boden"]'
      - taste: KeyX
      - malen: [{ feld: [11, 0] }, { feld: [10, 0] }]
      - taste: KeyX
      - bewegen: { ziel: '#level', x: 0.85, y: 0.3 }
      - pause: 0.6
      - pruefen: "![240, 264, 288].some(x => game.data.levels[0].layers[0].sprites.some(p => p[1] === x && p[2] === 0))"
        meldung: Die drei Blöcke ganz rechts sollten weg sein
---
## Kurz gesagt

1. Klick oben auf **Level**, dann links auf einen Sprite und nimm **Zeichnen** (<kbd>W</kbd>).
2. Klicken setzt einen Block, Ziehen eine Reihe, **Strg + ziehen** ein ganzes Rechteck.
3. Setz deine Spielfigur hinein und drück <kbd>T</kbd> – schon spielst du dein Level.

## Boden legen

![Boden legen](aufnahme:boden)

1. Klick oben auf **Level**. In der Mitte ist dein Level, links stehen **Werkzeuge** und deine **Sprites**.
2. Klick bei **Sprites** auf den Boden.
3. Nimm das Werkzeug **Zeichnen** (der Stift, Taste <kbd>W</kbd>).
4. Jeder Klick ins Level setzt einen Block. Er rastet im Gitter ein.
5. Mit gedrückter Maustaste setzt du eine ganze Reihe.
6. Halt <kbd>Strg</kbd> gedrückt und zieh ein Rechteck auf: Es wird ganz gefüllt.

## Figur hinein und testen

![Spielfigur hineinsetzen und mit T testen](aufnahme:testen)

7. Klick links auf deine Spielfigur und setz sie mit einem Klick über den Boden.
8. <kbd>T</kbd> (oder der grüne Pfeil bei den Werkzeugen) startet einen **Test** dieses Levels.
9. Laufen mit den Pfeiltasten oder <kbd>A</kbd> und <kbd>D</kbd>, springen mit der <kbd>Leertaste</kbd>. Mit <kbd>R</kbd> fängst du von vorn an.
10. <kbd>Esc</kbd> bringt dich zurück zum Level – genau dorthin, wo du warst.

> **Tipp:** Ein Test verändert dein Spiel nicht. Probier ruhig alles aus, so oft du willst.

## Wegmachen

![Auswählen, Rechtsklick und Radieren](aufnahme:wegmachen)

11. Mit **Auswählen** (<kbd>E</kbd>) klickst du einen Block an. Rechts stehen dann seine Einstellungen.
12. Ein **Rechtsklick** zeigt, was du damit machen kannst: Ausschneiden, Kopieren, Duplizieren, **Löschen** und mehr.
13. Schneller geht's mit dem Stift: <kbd>X</kbd> macht ihn zum Radiergummi, noch einmal <kbd>X</kbd> wieder zum Stift.

Daneben gesetzt? <kbd>Strg</kbd> + <kbd>Z</kbd> nimmt es zurück – auch hier im Level.

## Wenn's nicht klappt

- **Beim Test passiert nichts, wenn ich eine Taste drücke:** Klick einmal ins Spiel, dann drück die Taste noch einmal.
- **Die Figur fällt durch den Boden:** Der Boden braucht *man kann nicht von oben reinfallen* – siehe [Deine Spielfigur](rezept:spielfigur).
- **Die Figur schwebt über dem Boden:** Unter der Figur ist im Bild ein leerer Rand. Schieb sie im Sprite-Editor nach unten.

## Mach mehr draus

Bau eine Lücke, über die man springen muss, und ein paar Stufen nach oben. Das Rezept [Deine erste Spielfigur](rezept:erste-spielfigur) zeigt, wie du Geschwindigkeit und Sprungkraft einstellst.
