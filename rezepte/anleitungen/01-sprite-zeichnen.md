---
titel: Ein Sprite zeichnen
kurz: Farbe wählen, malen, füllen, verbessern – und dein Bild zum Funkeln bringen.
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
    ausschnitt: ['.menu:has(#tool_menu)', '.menu:has(#color_menu)', '#canvas']
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
    titel: Füllen
    ausschnitt: ['.menu:has(#tool_menu)', '.menu:has(#color_menu)', '#canvas']
    schritte:
      - { hinweis: Eine helle Farbe, nr: 4 }
      - klick: '#color_menu .button:nth-child(24)'
      - { hinweis: Den Farbeimer auswählen, nr: 5, mehr: "„Fläche füllen“, Taste A." }
      - klick: '#tool_menu .button[title^="Fläche füllen"]'
      - { hinweis: In die Fläche klicken, nr: 6, mehr: "Sie wird bis zum Rand gefüllt. Der Rand muss geschlossen sein – sonst läuft die Farbe hinaus." }
      - klick: { pixel: [12, 7] }
      - klick: '#color_menu .button:nth-child(26)'
      - klick: { pixel: [12, 14] }
      - { hinweis: Ein Glanzpunkt mit dem Stift, nr: 7, mehr: "Ein paar weiße Pixel lassen den Stein glänzen." }
      - klick: '#color_menu .button:nth-child(44)'
      - klick: '#tool_menu .button[title^="Zeichnen"]'
      - klick: { pixel: [10, 6] }
      - klick: { pixel: [9, 7] }
      - pause: 0.6

  - name: verbessern
    art: video
    titel: Verbessern
    ausschnitt: ['.menu:has(#tool_menu)', '.menu:has(#color_menu)', '#canvas']
    schritte:
      - { hinweis: Ups – ein Strich zu viel, nr: 8, mehr: "Daneben gemalt? Kein Problem." }
      - klick: '#color_menu .button:nth-child(8)'
      - malen: [{ pixel: [3, 17] }, { pixel: [8, 21] }, { pixel: [15, 18] }, { pixel: [21, 22] }]
      - pause: 0.4
      - { hinweis: Strg + Z macht ihn rückgängig, nr: 9, mehr: "Mehrmals drücken geht weiter zurück. Strg + Y holt es wieder." }
      - taste: Control+KeyZ
      - { hinweis: X macht den Stift zum Radiergummi, nr: 10, mehr: "X wechselt zu „durchsichtig“: Stift, Formen und Farbeimer radieren dann." }
      - taste: KeyX
      - klick: { pixel: [9, 7] }
      - { hinweis: Noch einmal X – wieder malen, nr: 11, mehr: "Du malst wieder mit deiner Farbe." }
      - taste: KeyX
      - bewegen: { ziel: '#canvas', x: 0.9, y: 0.92 }
      - pause: 0.6

  - name: animieren
    art: video
    titel: Animieren
    ausschnitt: ['.menu:has(#tool_menu)', '#canvas', '#menu_frames']
    standbild: 9
    schritte:
      - { hinweis: Rechtsklick auf das Bild unten, nr: 12, mehr: "„Duplizieren“ macht ein zweites, gleiches Bild – du malst darin weiter." }
      - rechtsklick: '#menu_frames ._dnd_item:nth-child(1)'
      - menue: Duplizieren
      - { hinweis: Im zweiten Bild funkelt es, nr: 13, mehr: "Ändere nur ein bisschen." }
      - klick: '#color_menu .button:nth-child(44)'
      - klick: { pixel: [17, 4] }
      - klick: { pixel: [16, 5] }
      - klick: { pixel: [18, 5] }
      - klick: { pixel: [17, 6] }
      - klick: { pixel: [17, 5] }
      - { hinweis: P zeigt die Vorschau, nr: 14, mehr: "Oben rechts läuft deine Animation. Wie schnell, stellst du bei „Framerate“ unter Zustände ein." }
      - taste: KeyP
      - warten: 3
    nachher:
      - taste: KeyP
---
## Kurz gesagt

1. Klick eine **Farbe** an, wähle den **Stift** und male mit gedrückter Maustaste.
2. Mit dem **Farbeimer** füllst du eine ganze Fläche auf einmal.
3. Ein Fehler? **Strg + Z** macht ihn rückgängig. Mit **X** radierst du.
4. Mehrere **Frames** hintereinander werden zu einer Animation.

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

## Füllen

![Mit dem Farbeimer füllen](aufnahme:fuellen)

## Verbessern: Rückgängig und Radieren

![Strg + Z und X](aufnahme:verbessern)

> **Tipp:** Rückgängig und Wiederholen stehen auch unten rechts in der Statusleiste, mit ihren Tasten. Daneben findest du **Speichern** (<kbd>Strg</kbd> + <kbd>S</kbd>).

## Animieren

![Ein zweiter Frame und die Vorschau](aufnahme:animieren)

> **Tipp:** Kleine Änderungen von Bild zu Bild sehen am besten aus. Mit <kbd>O</kbd> (*Onion Skinning*) scheint das Bild davor rötlich durch – so siehst du, was sich bewegt.

## Wenn's nicht klappt

- **Der Farbeimer füllt alles:** Im Rand ist eine Lücke. Mach es mit <kbd>Strg</kbd> + <kbd>Z</kbd> rückgängig, mal die Lücke zu und klick noch einmal hinein.
- **Der Stift malt nicht:** Vielleicht ist *durchsichtig* gewählt – drück <kbd>X</kbd>.
- **Strg + Z tut nichts:** In einem Textfeld macht Strg + Z nur das Tippen rückgängig. Klick einmal auf die Zeichenfläche und versuch es noch einmal.

## Mach mehr draus

Zeichne einen Boden-Block mit Gras oben und Erde unten – den brauchst du für dein erstes Level. Wie Figuren laufen und springen, zeigt das Rezept [Laufen, Springen und Fallen animieren](rezept:laufen-animieren).
