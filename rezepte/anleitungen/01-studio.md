---
titel: Das Studio kennenlernen
kurz: Fünf Reiter oben, die Statusleiste unten – und wie du jederzeit herausfindest, welche Taste was macht.
start:
  szene:
    legende:
      P: { sprite: pip }
      Z: { sprite: ziel }
    zusaetzlich: [muenze]
    karte: |
      ...........
      .P...o...Z.
      ###########
aufnahmen:
  - name: ueberblick
    art: bild
    vorher:
      - klick: '#mi_level'
      - ansicht: [-1, -2, 11, 5]
      - bewegen: { punkt: [1180, 600] }
    ausschnitt: ganz
    marken:
      - { ziel: '#mi_sprites', nr: 1, x: 0.18, y: 0.5 }
      - { ziel: '#mi_level', nr: 2, x: 0.18, y: 0.5 }
      - { ziel: '#mi_settings', nr: 3, x: 0.1, y: 0.5 }
      - { ziel: '#mi_play', nr: 4, x: 0.18, y: 0.5 }
      - { ziel: '#mi_help', nr: 5, x: 0.18, y: 0.5 }
      - { ziel: '#status-bar .status-bar-tools', nr: 6, x: 0.02, y: 0.5 }
      - { ziel: '#status-bar .status-bar-general', nr: 7, x: 0.03, y: 0.5 }

  - name: rundgang
    art: video
    titel: Ein Rundgang
    ausschnitt: ganz
    standbild: 4
    schritte:
      - { hinweis: Sprites – hier zeichnest du, nr: 1, mehr: "Figuren, Boden, Münzen, Türen: alles, was in deinem Spiel vorkommt." }
      - klick: '#mi_sprites'
      - pause: 1.4
      - { hinweis: Level – hier baust du, nr: 2, mehr: "Du setzt die Sprites in deine Level, Block für Block." }
      - klick: '#mi_level'
      - pause: 1.4
      - { hinweis: Einstellungen – fürs ganze Spiel, nr: 3, mehr: "Titel, Leben, Schwerkraft, Tasten und mehr." }
      - klick: '#mi_settings'
      - pause: 1.4
      - { hinweis: Spielen – alles von vorn, nr: 4, mehr: "Dein Spiel vom ersten Level an, so wie andere es spielen." }
      - klick: '#mi_play'
      - warten: 2
      - { hinweis: Alt + 2 – zurück zum Level, nr: 5, mehr: "Ohne Maus: Alt + 1 bis Alt + 5 sind die fünf Reiter, der Reihe nach." }
      - taste: Alt+Digit2
      - pause: 0.8
      - pruefen: "current_pane === 'level'"
        meldung: Das Level ist nicht zu sehen

  - name: hilfe
    art: video
    titel: Welche Taste macht was?
    ausschnitt: ganz
    schritte:
      - { hinweis: "Unten: was das Werkzeug kann", nr: 6, mehr: "Wählst du ein anderes Werkzeug, zeigt die Statusleiste links seine Tasten." }
      # Auswählen, not Zeichnen: the pen would carry Pip around under the mouse
      - klick: '#tool_menu_level .button[title^="Auswählen"]'
      - bewegen: { ziel: '#status-bar .status-bar-tools', x: 0.3, y: 0.5 }
      - pause: 1.6
      - { hinweis: H gedrückt halten, nr: 7, mehr: "Jeder Knopf zeigt seine Taste. Lässt du H los, verschwinden sie wieder." }
      - bewegen: { ziel: '#level', x: 0.5, y: 0.5 }
      - taste: KeyH
        halten: 2
      - { hinweis: Das ? erklärt eine Einstellung, nr: 8, mehr: "Halt H gedrückt und klick ein ? an." }
      - klick: '#mi_settings'
      - pause: 0.6
      - klick: '#game-settings-here .item:has-text("Gravitation") .tooltip_hint'
        mit: KeyH
      - pause: 2.2
      - klick: '.modal-footer button:has-text("Schließen"):visible'
      - pause: 0.6

  - name: schalter
    art: video
    titel: Die Schalter
    vorher:
      - klick: '#mi_level'
      - ansicht: [-1, -2, 11, 5]
      - klick: '#tool_menu_level .button[title^="Verschieben"]'
    ausschnitt: ganz
    schritte:
      - { hinweis: "Links oben: die Schalter", nr: 9, mehr: "Ein Klick oder die Taste schaltet sie an und wieder aus. Sie ändern nur, was du im Studio siehst – nie dein Spiel." }
      - bewegen: { ziel: '#tool_menu_level_settings', x: 0.5, y: 0.45 }
      - pause: 1.4
      - bewegen: { ziel: '#level', x: 0.5, y: 0.75 }
      - { hinweis: G – das Gitter, nr: 10, mehr: "Die Linien, an denen die Sprites einrasten. Ohne Gitter siehst du dein Level so, wie es im Spiel aussieht." }
      - taste: KeyG
      - pause: 1
      - taste: KeyG
      - { hinweis: A – Animieren, nr: 11, mehr: "Münze und Ziel bewegen sich schon hier, so wie im Spiel." }
      - taste: KeyA
      - warten: 2.2
      - taste: KeyA
      - { hinweis: D – Hervorheben, nr: 12, mehr: "Die Ebene, an der du gerade arbeitest, ist deutlich zu sehen – was dahinter liegt, wird dunkler, was davor liegt, durchsichtig." }
      - taste: KeyD
      - pause: 0.8
      - klick: '#menu_layers ._dnd_item:nth-child(2)'
      - pause: 1.4
      - klick: '#menu_layers ._dnd_item:nth-child(1)'
      - pause: 1
      - taste: KeyD
      - { hinweis: M – die Karte, nr: 13, mehr: "Unten links das ganze Level im Kleinen. Ein Klick darauf springt dorthin." }
      - taste: KeyM
      - pause: 1.6
      - taste: KeyM
      - { hinweis: S – die Signale, nr: 14, mehr: "Alle Regeln des Levels: Wenn … dann … Ganz oben: Wann ist das Level geschafft?" }
      - taste: KeyS
      - pause: 2
      - taste: KeyS
      - { hinweis: L – die Levelübersicht, nr: 15, mehr: "Alle Level deines Spiels und wohin ihre Ziele führen." }
      - taste: KeyL
      - pause: 1.8
      - taste: KeyL
      - { hinweis: B – Bereiche, nr: 16, mehr: "Zeigt die Rechtecke von Hintergründen und Bereichen als dünne Linien, auch wenn eine andere Ebene dran ist. In diesem Level gibt es noch keine." }
      - bewegen: { ziel: '#tool_menu_level_settings .view-toggle:has-text("Bereiche")', x: 0.4, y: 0.5 }
      - pause: 1.6
      - pruefen: "!!game.level_editor.show_grid && !game.level_editor.show_minimap && !game.level_editor.show_level_map && !game.level_editor.dim_other_layers && !game.level_editor.animate_level"
        meldung: Die Schalter sollten wieder wie am Anfang stehen
      - { hinweis: "Im Sprite-Editor: P – die Vorschau", nr: 17, mehr: "Oben rechts läuft die Animation des Zustands, so schnell wie im Spiel." }
      - klick: '#mi_sprites'
      - klick: '#menu_sprites ._dnd_item:nth-child(1)'
      - klick: '#menu_states ._dnd_item:nth-child(2)'
      - bewegen: { ziel: '#canvas', x: 0.85, y: 0.85 }
      - taste: KeyP
      - warten: 2
      - { hinweis: O – Onion Skinning, nr: 18, mehr: "Das Bild davor scheint rötlich durch, das danach bläulich – so zeichnest du eine Bewegung Schritt für Schritt." }
      - klick: '#menu_frames ._dnd_item:nth-child(2)'
      - bewegen: { ziel: '#canvas', x: 0.85, y: 0.85 }
      - taste: KeyO
      - pause: 2
      - taste: KeyO
      - { hinweis: M – Spiegelnd zeichnen, nr: 19, mehr: "Was du auf einer Seite malst, erscheint auch auf der anderen. Die gestrichelte Linie ist der Spiegel." }
      - taste: KeyM
      - pause: 2
      - taste: KeyM
      - taste: KeyP
      - pause: 0.6
---
## Kurz gesagt

1. Oben stehen fünf Reiter: **Sprites**, **Level**, **Einstellungen**, **Spielen** und **Hilfe**.
2. Unten in der **Statusleiste** steht links, was das Werkzeug gerade kann, und rechts, was immer gebraucht wird: Rückgängig, Speichern …
3. Halt <kbd>H</kbd> gedrückt: Jeder Knopf zeigt seine Taste. Die Tasten liegen so wie die Knöpfe – oben links steht <kbd>Q</kbd>, wie auf der Tastatur.
4. Unter den Werkzeugen stehen **Schalter** für die Ansicht – im Level und im Sprite-Editor, jeder mit seiner Taste.

## So sieht das Studio aus

![Das Studio mit dem Level-Editor](aufnahme:ueberblick)

1. **Sprites** – hier zeichnest du alles, was in deinem Spiel vorkommt.
2. **Level** – hier baust du deine Level aus den Sprites.
3. **Einstellungen** – was fürs ganze Spiel gilt: Titel, Leben, Schwerkraft, Tasten.
4. **Spielen** – dein Spiel vom ersten Level an.
5. **Hilfe** – diese Anleitungen und viele Rezepte zum Nachbauen.
6. **Was das Werkzeug kann** – mit seinen Tasten.
7. **Immer da** – Rückgängig, Wiederholen, Laden, Speichern, Vollbild und Hilfe.

## Ein Rundgang

![Sprites, Level, Einstellungen, Spielen](aufnahme:rundgang)

## Tasten wie auf der Tastatur

Die Knöpfe stehen so da wie ihre Tasten auf der Tastatur – so findest du eine Taste, ohne zu suchen:

- **Reiter:** <kbd>Alt</kbd> + <kbd>1</kbd> bis <kbd>Alt</kbd> + <kbd>5</kbd> – Sprites, Level, Einstellungen, Spielen, Hilfe, von links nach rechts.
- **Werkzeuge im Level:** <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>T</kbd> – Verschieben, Zeichnen, Auswählen, Verbinden, Testen, genau in der Reihe, in der sie stehen.
- **Werkzeuge beim Zeichnen:** drei Reihen wie auf der Tastatur – oben <kbd>Q</kbd> bis <kbd>Z</kbd>, darunter <kbd>A</kbd> bis <kbd>G</kbd>, ganz unten <kbd>Y</kbd> bis <kbd>B</kbd>.
- **Stiftdicke:** die Zahlentasten <kbd>1</kbd> bis <kbd>6</kbd>, von dünn nach dick.

## Welche Taste macht was?

![Statusleiste, H und das ?](aufnahme:hilfe)

> **Tipp:** Du musst dir nicht alle Tasten auf einmal merken. Die Statusleiste zeigt sie dir immer wieder – mit der Zeit drückst du sie ganz von selbst.

## Die Schalter

![Die Schalter im Level und im Sprite-Editor](aufnahme:schalter)

Unter den Werkzeugen stehen kleine Schalter. Sie ändern nur, was **du** im Studio siehst – dein Spiel bleibt, wie es ist. Ein grüner Punkt heißt: an.

**Im Level:**

- <kbd>G</kbd> **Gitter** – die Linien, an denen die Sprites einrasten.
- <kbd>S</kbd> **Signale** – alle Regeln des Levels als Karten: Wenn … dann … (siehe [Signale](rezept:signale)).
- <kbd>M</kbd> **Karte** – das ganze Level im Kleinen, unten links. Ein Klick springt dorthin.
- <kbd>L</kbd> **Levelübersicht** – alle Level und wohin ihre Ziele führen (siehe [Ziel und mehrere Level](rezept:ziel-und-level)).
- <kbd>B</kbd> **Bereiche** – die Rechtecke von Hintergründen, Signal- und Bewegungsbereichen als dünne Linien.
- <kbd>D</kbd> **Hervorheben** – die Ebene, an der du arbeitest, deutlich; die anderen treten zurück.
- <kbd>A</kbd> **Animieren** – Sprites und Effekte bewegen sich schon im Level, wie im Spiel.

**Im Sprite-Editor:**

- <kbd>O</kbd> **Onion Skinning** – das Bild davor (rötlich) und danach (bläulich) scheinen durch.
- <kbd>P</kbd> **Vorschau** – spielt die Animation des Zustands ab, oben rechts.
- <kbd>M</kbd> **Spiegelnd zeichnen** – was du malst, erscheint auch auf der anderen Seite.

## Wenn's nicht klappt

- **Eine Taste tut nichts:** Steht der Cursor noch in einem Textfeld? Drück <kbd>Enter</kbd> oder klick einmal daneben – dann gehören die Tasten wieder dem Studio.
- **Das Studio ist zu klein:** **Vollbild** unten rechts (oder <kbd>F11</kbd>) macht Platz.

## Mach mehr draus

Weiter geht's mit deinem ersten eigenen Bild: [Ein Sprite zeichnen](rezept:sprite-zeichnen).
