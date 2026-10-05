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
      - klick: '#tool_menu_level .button[title^="Zeichnen"]'
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
---
## Kurz gesagt

1. Oben stehen fünf Reiter: **Sprites**, **Level**, **Einstellungen**, **Spielen** und **Hilfe**.
2. Unten in der **Statusleiste** steht links, was das Werkzeug gerade kann, und rechts, was immer gebraucht wird: Rückgängig, Speichern …
3. Halt <kbd>H</kbd> gedrückt: Jeder Knopf zeigt seine Taste. Die Tasten liegen so wie die Knöpfe – oben links steht <kbd>Q</kbd>, wie auf der Tastatur.

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
- **Werkzeuge beim Zeichnen:** drei Reihen wie auf der Tastatur – oben <kbd>Q</kbd> bis <kbd>Y</kbd>, darunter <kbd>A</kbd> bis <kbd>G</kbd>, ganz unten <kbd>Z</kbd> bis <kbd>B</kbd>.
- **Stiftdicke:** die Zahlentasten <kbd>1</kbd> bis <kbd>6</kbd>, von dünn nach dick.

## Welche Taste macht was?

![Statusleiste, H und das ?](aufnahme:hilfe)

> **Tipp:** Du musst dir nicht alle Tasten auf einmal merken. Die Statusleiste zeigt sie dir immer wieder – mit der Zeit drückst du sie ganz von selbst.

## Wenn's nicht klappt

- **Eine Taste tut nichts:** Steht der Cursor noch in einem Textfeld? Drück <kbd>Enter</kbd> oder klick einmal daneben – dann gehören die Tasten wieder dem Studio.
- **Das Studio ist zu klein:** **Vollbild** unten rechts (oder <kbd>F11</kbd>) macht Platz.

## Mach mehr draus

Weiter geht's mit deinem ersten eigenen Bild: [Ein Sprite zeichnen](rezept:sprite-zeichnen).
