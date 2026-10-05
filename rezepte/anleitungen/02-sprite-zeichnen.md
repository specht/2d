---
titel: Ein Sprite zeichnen
kurz: "Einen Edelstein Schritt für Schritt: Umriss, Schliffkanten, Licht und Schatten – und was tun, wenn etwas danebengeht."
aufnahmen:
  - name: ueberblick
    art: bild
    ausschnitt: ganz
    marken:
      - { ziel: '.menu.sprite-library-menu > h3', nr: 1, x: 0.12, y: 0.5 }
      - { ziel: '.menu:has(#tool_menu) > h3', nr: 2, x: 0.12, y: 0.5 }
      - { ziel: '.menu:has(#color_menu) > h3', nr: 3, x: 0.12, y: 0.5 }
      - { ziel: '#canvas', nr: 4, x: 0.04, y: 0.04 }
      - { ziel: '#menu_frames', nr: 5, x: 0.04, y: 0.5 }
      - { ziel: '#menu_sprite_properties_variable_part_following > h3', nr: 6, x: 0.1, y: 0.5 }
      - { ziel: '.menu:has(#menu_states) > h3', nr: 7, x: 0.1, y: 0.5 }

  - name: malen
    art: video
    titel: Der Umriss
    ausschnitt: ['.menu:has(#tool_menu)', '.menu:has(#color_menu)', '.menu:has(#color_variations_menu)', '#canvas']
    standbild: 12
    schritte:
      - { hinweis: Eine dunkle Farbe anklicken, nr: 1, mehr: "Für den Umriss: ein dunkles Blau. Oben steht die Palette, darunter Abwandlungen der gewählten Farbe." }
      - klick: '#color_menu .button:nth-child(29)'
      - { hinweis: Die Linie auswählen (W), nr: 2, mehr: "Drücken, ziehen, loslassen – dazwischen entsteht eine gerade Linie. Mit dem Stift (Q) malst du frei Hand." }
      - klick: '#tool_menu .button[title^="Linie"]'
      - { hinweis: "Oben die Kante, dann die Seiten", nr: 3, mehr: "Jede Linie einzeln ziehen. Ein Edelstein ist oben breit und flach." }
      - ziehen: { von: { pixel: [8, 6] }, nach: { pixel: [15, 6] } }
      - ziehen: { von: { pixel: [7, 7] }, nach: { pixel: [4, 10] } }
      - ziehen: { von: { pixel: [16, 7] }, nach: { pixel: [19, 10] } }
      - { hinweis: Unten läuft er spitz zu, nr: 4, mehr: "Von beiden Seiten schräg nach unten, bis sich die Linien treffen." }
      - ziehen: { von: { pixel: [5, 11] }, nach: { pixel: [11, 17] } }
      - ziehen: { von: { pixel: [18, 11] }, nach: { pixel: [12, 17] } }
      - { hinweis: Eine Linie quer durch, nr: 5, mehr: "Sie trennt das helle Oberteil vom dunkleren Unterteil." }
      - ziehen: { von: { pixel: [5, 10] }, nach: { pixel: [18, 10] } }
      - { hinweis: "Die Schliffkanten: kurze Linien nach innen", nr: 6, mehr: "Oben zwei kurze, unten zwei lange – so sieht der Stein geschliffen aus, und es entstehen Flächen zum Füllen." }
      - ziehen: { von: { pixel: [10, 7] }, nach: { pixel: [9, 9] } }
      - ziehen: { von: { pixel: [13, 7] }, nach: { pixel: [14, 9] } }
      - ziehen: { von: { pixel: [9, 11] }, nach: { pixel: [11, 16] } }
      - ziehen: { von: { pixel: [14, 11] }, nach: { pixel: [12, 16] } }
      - bewegen: { ziel: '#canvas', x: 0.9, y: 0.92 }
      - pause: 0.6

  - name: fuellen
    art: video
    titel: Füllen und schattieren
    ausschnitt: ['.menu:has(#tool_menu)', '.menu:has(#color_menu)', '.menu:has(#color_variations_menu)', '#canvas']
    schritte:
      - { hinweis: Den Farbeimer auswählen (A), nr: 7, mehr: "„Fläche füllen“: Ein Klick füllt eine Fläche bis zu ihrem Rand." }
      - klick: '#tool_menu .button[title^="Fläche füllen"]'
      - { hinweis: "Oben hell: das Licht kommt von links oben", nr: 8, mehr: "Die Mitte am hellsten, links hell, rechts schon etwas dunkler." }
      - klick: '#color_menu .button:nth-child(23)'
      - klick: { pixel: [11, 8] }
      - klick: '#color_menu .button:nth-child(24)'
      - klick: { pixel: [7, 9] }
      - klick: '#color_menu .button:nth-child(25)'
      - klick: { pixel: [16, 9] }
      - { hinweis: Unten dunkler, nr: 9, mehr: "Das Unterteil liegt im Schatten: zwei dunklere Blautöne." }
      - klick: '#color_menu .button:nth-child(26)'
      - klick: { pixel: [7, 12] }
      - klick: '#color_menu .button:nth-child(27)'
      - klick: { pixel: [11, 12] }
      - { hinweis: Der dunkelste Teil aus den Abwandlungen, nr: 10, mehr: "Unter der Palette steht die gewählte Farbe mit einem Punkt. Zwei Kästchen weiter links in „Licht und Schatten“ ist sie dunkler – und ein bisschen bläulicher, wie echte Schatten." }
      - bewegen: { ziel: '#color_variations_menu', x: 0.5, y: 0.2 }
      - pause: 0.6
      - klick: '#color_variations_menu .button:nth-child(n+12):nth-child(-n+22):has(+ .button + .button.basis)'
      - klick: { pixel: [15, 12] }
      - { hinweis: Zwei Pixel sind noch leer – der Stift (Q), nr: 11, mehr: "Unten an der Spitze kam der Farbeimer nicht hin. Mit dem Stift malst du sie einzeln aus: ein Klick, ein Pixel." }
      - bewegen: { pixel: [11, 15] }
      - pause: 0.8
      - klick: '#tool_menu .button[title^="Zeichnen"]'
      - klick: '#color_menu .button:nth-child(26)'
      - klick: { pixel: [10, 15] }
      - { hinweis: Die Pipette (Z) holt eine Farbe aus dem Bild, nr: 12, mehr: "„Farbe auswählen“: Ein Klick ins Bild, und genau diese Farbe ist gewählt – praktisch für eine Abwandlung, die nicht in der Palette steht." }
      - klick: '#tool_menu .button[title^="Farbe auswählen"]'
      - klick: { pixel: [15, 12] }
      - klick: '#tool_menu .button[title^="Zeichnen"]'
      - klick: { pixel: [13, 15] }
      - { hinweis: Zwei Glanzpunkte, nr: 13, mehr: "Weiß, oben links – dort, wo das Licht hinfällt." }
      - klick: '#color_menu .button:nth-child(44)'
      - klick: { pixel: [11, 7] }
      - klick: { pixel: [10, 8] }
      - bewegen: { ziel: '#canvas', x: 0.9, y: 0.92 }
      - pause: 0.8

  - name: verbessern
    art: video
    titel: Verbessern
    ausschnitt: ['.menu:has(#tool_menu)', '.menu:has(#color_menu)', '.menu:has(#color_variations_menu)', '#canvas']
    schritte:
      - { hinweis: Ups – ein Strich zu viel, nr: 14, mehr: "Daneben gemalt? Kein Problem." }
      - klick: '#color_menu .button:nth-child(8)'
      - malen: [{ pixel: [3, 17] }, { pixel: [8, 21] }, { pixel: [15, 18] }, { pixel: [21, 22] }]
      - pause: 0.4
      - { hinweis: Strg + Z macht ihn rückgängig, nr: 15, mehr: "Mehrmals drücken geht weiter zurück. Strg + Y holt es wieder." }
      - taste: Control+KeyZ
      - pause: 0.4
      - { hinweis: Ein Pixel daneben getippt, nr: 16 }
      - klick: { pixel: [20, 4] }
      - pause: 0.4
      - { hinweis: X – und der Stift radiert, nr: 17, mehr: "X wechselt zu „durchsichtig“: Stift, Formen und Farbeimer radieren dann." }
      - taste: KeyX
      - klick: { pixel: [20, 4] }
      - { hinweis: Noch einmal X – wieder malen, nr: 18, mehr: "Du malst wieder mit deiner Farbe." }
      - taste: KeyX
      - bewegen: { ziel: '#canvas', x: 0.9, y: 0.92 }
      - pause: 0.6
      - pruefen: |
          (() => {
            const c = document.createElement('canvas'); c.width = 24; c.height = 24;
            const g = c.getContext('2d'); g.drawImage(canvas.bitmap, 0, 0);
            const px = (x, y) => [...g.getImageData(x, y, 1, 1).data];
            // the stray pixel is gone, the gem is whole (also at its tip), its top left is white
            return px(20, 4)[3] === 0 && px(12, 6)[3] === 255 && px(10, 15)[3] === 255 && px(13, 15)[3] === 255
              && px(11, 7).join() === '255,255,255,255';
          })()
        meldung: Der Edelstein ist nicht so geworden wie gedacht (oder der Punkt daneben ist noch da)

---
## Kurz gesagt

1. Klick eine **Farbe** an und wähle ein **Werkzeug**: die **Linie** für gerade Kanten, den **Stift** für alles andere.
2. Mit dem **Farbeimer** füllst du eine ganze Fläche auf einmal – hell, wo das Licht hinfällt, dunkel im Schatten. Was er nicht erreicht, malst du mit dem Stift aus; die **Pipette** holt dir dafür die Farbe aus dem Bild.
3. Unter der Palette stehen **Abwandlungen** deiner Farbe: heller, dunkler, kräftiger, blasser.
4. Ein Fehler? **Strg + Z** macht ihn rückgängig. Mit **X** radierst du.

## So sieht der Sprite-Editor aus

Klick oben auf **Sprites**. Hier zeichnest du alles, was in deinem Spiel vorkommt: Figuren, Boden, Türen, Münzen …

![Der Sprite-Editor](aufnahme:ueberblick)

1. **Sprites** – alle Bilder deines Spiels. Mit **+** fängst du ein neues an.
2. **Werkzeuge** – Stift, Linie, Rechteck, Farbeimer und mehr. Sie stehen genauso da wie ihre Tasten auf der Tastatur: oben <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>T</kbd> <kbd>Y</kbd>, darunter <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd> <kbd>G</kbd>, ganz unten <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> <kbd>V</kbd> <kbd>B</kbd> – so findest du die Taste, ohne zu suchen.
3. **Palette** – die Farben. Darunter stehen Abwandlungen der gewählten Farbe: ähnliche Farbtöne, Licht und Schatten, kräftiger und blasser.
4. **Zeichenfläche** – hier malst du. Jedes Kästchen ist ein Pixel.
5. **Frames** – die Bilder einer Animation.
6. **Eigenschaften** – was das Sprite im Spiel *ist*: Spielfigur, Boden, Tür … (siehe [Deine Spielfigur](rezept:spielfigur)).
7. **Zustände** – zum Beispiel *stehen* und *laufen*, jeder mit eigenen Frames.

## Der Umriss

![Mit der Linie: Umriss und Schliffkanten](aufnahme:malen)

> **Tipp:** Wie dick der Stift malt, stellst du mit den Zahlentasten <kbd>1</kbd> bis <kbd>6</kbd> ein – <kbd>1</kbd> ist genau ein Pixel.

## Füllen und schattieren

![Mit dem Farbeimer füllen, mit einer Abwandlung schattieren](aufnahme:fuellen)

Die Abwandlungen unter der Palette, Reihe für Reihe:

- **Ähnliche Farbtöne** – genauso hell und kräftig, nur ein anderer Ton,
- **Licht und Schatten** – nach links dunkler und kühler, nach rechts heller und wärmer,
- **Dunkler und heller** – in drei Reihen: kräftig, mittel und blass,
- **Durchsichtiger** – ganz links fast unsichtbar.

Der Punkt zeigt, wo deine Farbe selbst steht. Fährst du mit der Maus über ein Kästchen, steht da, wofür die Reihe gut ist.

## Verbessern: Rückgängig und Radieren

![Strg + Z und X](aufnahme:verbessern)

> **Tipp:** Rückgängig und Wiederholen stehen auch unten rechts in der Statusleiste, mit ihren Tasten. Daneben findest du **Speichern** (<kbd>Strg</kbd> + <kbd>S</kbd>).

## Wenn's nicht klappt

- **Der Farbeimer füllt alles:** Im Rand ist eine Lücke. Mach es mit <kbd>Strg</kbd> + <kbd>Z</kbd> rückgängig, mal die Lücke zu und klick noch einmal hinein. Zwei Pixel, die sich nur an der Ecke berühren, sind dicht – da läuft nichts durch.
- **Der Stift malt nicht:** Vielleicht ist *durchsichtig* gewählt – drück <kbd>X</kbd>.
- **Strg + Z tut nichts:** In einem Textfeld macht Strg + Z nur das Tippen rückgängig. Klick einmal auf die Zeichenfläche und versuch es noch einmal.

## Mach mehr draus

Zeichne als Nächstes deine eigene Figur und einen Boden-Block mit Gras oben und Erde unten – die brauchst du für dein erstes Level. Wie aus einem Bild eine Figur wird, zeigt [Deine Spielfigur](rezept:spielfigur); wie es sich bewegt, [Animieren](rezept:animieren).
