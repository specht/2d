---
titel: Ein Sprite zeichnen
kurz: Farbe wählen, malen, füllen, schattieren und verbessern.
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
    titel: Malen
    ausschnitt: ['.menu:has(#tool_menu)', '.menu:has(#color_menu)', '.menu:has(#color_variations_menu)', '#canvas']
    schritte:
      - { hinweis: Eine Farbe anklicken, nr: 1, mehr: "Oben die Palette, darunter Abwandlungen der gewählten Farbe." }
      - klick: '#color_menu .button:nth-child(28)'
      - { hinweis: Den Stift auswählen, nr: 2, mehr: "Oben links bei den Werkzeugen, Taste Q." }
      - klick: '#tool_menu .button[title^="Zeichnen"]'
      - { hinweis: Mit gedrückter Maustaste malen, nr: 3, mehr: "Ein einzelner Klick malt genau ein Pixel." }
      - malen: [{ pixel: [12, 3] }, { pixel: [19, 10] }, { pixel: [12, 20] }, { pixel: [5, 10] }, { pixel: [12, 3] }]
      - malen: [{ pixel: [6, 10] }, { pixel: [18, 10] }]
      - pause: 0.6

  - name: fuellen
    art: video
    titel: Füllen und schattieren
    ausschnitt: ['.menu:has(#tool_menu)', '.menu:has(#color_menu)', '.menu:has(#color_variations_menu)', '#canvas']
    schritte:
      - { hinweis: Eine helle Farbe, nr: 4 }
      - klick: '#color_menu .button:nth-child(24)'
      - { hinweis: Den Farbeimer auswählen, nr: 5, mehr: "„Fläche füllen“, Taste A." }
      - klick: '#tool_menu .button[title^="Fläche füllen"]'
      - { hinweis: In die Fläche klicken, nr: 6, mehr: "Sie wird bis zum Rand gefüllt. Der Rand muss geschlossen sein – sonst läuft die Farbe hinaus." }
      - klick: { pixel: [12, 7] }
      - { hinweis: Ein Schatten aus den Abwandlungen, nr: 7, mehr: "Unter der Palette steht die gewählte Farbe mit einem Punkt. Zwei Kästchen weiter links in „Licht und Schatten“ ist sie dunkler – und ein bisschen bläulicher, wie echte Schatten." }
      - bewegen: { ziel: '#color_variations_menu', x: 0.5, y: 0.2 }
      - pause: 0.8
      - klick: '#color_variations_menu .button:nth-child(n+12):nth-child(-n+22):has(+ .button + .button.basis)'
      - klick: { pixel: [12, 14] }
      - { hinweis: Ein Glanzpunkt mit dem Stift, nr: 8, mehr: "Ein paar weiße Pixel lassen den Stein glänzen." }
      - klick: '#color_menu .button:nth-child(44)'
      - klick: '#tool_menu .button[title^="Zeichnen"]'
      - klick: { pixel: [10, 6] }
      - klick: { pixel: [9, 7] }
      - pause: 0.6

  - name: verbessern
    art: video
    titel: Verbessern
    ausschnitt: ['.menu:has(#tool_menu)', '.menu:has(#color_menu)', '.menu:has(#color_variations_menu)', '#canvas']
    schritte:
      - { hinweis: Ups – ein Strich zu viel, nr: 9, mehr: "Daneben gemalt? Kein Problem." }
      - klick: '#color_menu .button:nth-child(8)'
      - malen: [{ pixel: [3, 17] }, { pixel: [8, 21] }, { pixel: [15, 18] }, { pixel: [21, 22] }]
      - pause: 0.4
      - { hinweis: Strg + Z macht ihn rückgängig, nr: 10, mehr: "Mehrmals drücken geht weiter zurück. Strg + Y holt es wieder." }
      - taste: Control+KeyZ
      - { hinweis: X macht den Stift zum Radiergummi, nr: 11, mehr: "X wechselt zu „durchsichtig“: Stift, Formen und Farbeimer radieren dann." }
      - taste: KeyX
      - klick: { pixel: [9, 7] }
      - { hinweis: Noch einmal X – wieder malen, nr: 12, mehr: "Du malst wieder mit deiner Farbe." }
      - taste: KeyX
      - bewegen: { ziel: '#canvas', x: 0.9, y: 0.92 }
      - pause: 0.6

---
## Kurz gesagt

1. Klick eine **Farbe** an, wähle den **Stift** und male mit gedrückter Maustaste.
2. Mit dem **Farbeimer** füllst du eine ganze Fläche auf einmal.
3. Ein Fehler? **Strg + Z** macht ihn rückgängig. Mit **X** radierst du.
4. Unter der Palette stehen **Abwandlungen** deiner Farbe: heller, dunkler, kräftiger, blasser.

## So sieht der Sprite-Editor aus

Klick oben auf **Sprites**. Hier zeichnest du alles, was in deinem Spiel vorkommt: Figuren, Boden, Türen, Münzen …

![Der Sprite-Editor](aufnahme:ueberblick)

1. **Sprites** – alle Bilder deines Spiels. Mit **+** fängst du ein neues an.
2. **Werkzeuge** – Stift, Linie, Rechteck, Farbeimer und mehr.
3. **Palette** – die Farben. Darunter stehen Abwandlungen der gewählten Farbe: ähnliche Farbtöne, Licht und Schatten, kräftiger und blasser.
4. **Zeichenfläche** – hier malst du. Jedes Kästchen ist ein Pixel.
5. **Frames** – die Bilder einer Animation.
6. **Eigenschaften** – was das Sprite im Spiel *ist*: Spielfigur, Boden, Tür … (siehe [Deine Spielfigur](rezept:spielfigur)).
7. **Zustände** – zum Beispiel *stehen* und *laufen*, jeder mit eigenen Frames.

## Malen

![Farbe wählen, Stift auswählen, malen](aufnahme:malen)

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

- **Der Farbeimer füllt alles:** Im Rand ist eine Lücke. Mach es mit <kbd>Strg</kbd> + <kbd>Z</kbd> rückgängig, mal die Lücke zu und klick noch einmal hinein.
- **Der Stift malt nicht:** Vielleicht ist *durchsichtig* gewählt – drück <kbd>X</kbd>.
- **Strg + Z tut nichts:** In einem Textfeld macht Strg + Z nur das Tippen rückgängig. Klick einmal auf die Zeichenfläche und versuch es noch einmal.

## Mach mehr draus

Zeichne einen Boden-Block mit Gras oben und Erde unten – den brauchst du für dein erstes Level. Wie aus einem Bild eine Figur wird, zeigt [Deine Spielfigur](rezept:spielfigur); wie es sich bewegt, [Animieren](rezept:animieren).
