---
titel: Schneller arbeiten
kurz: Zoomen, die Ansicht verschieben, mehrere Sprites auf einmal auswählen, verschieben und duplizieren.
start:
  eine_ebene: true
  szene:
    legende:
      P: { sprite: pip }
    karte: |
      ......................
      .............---......
      ......................
      .P..ooo...............
      ######################
aufnahmen:
  - name: ansicht
    art: video
    titel: Zoomen und verschieben
    vorher:
      - klick: '#mi_level'
      - ansicht: [-1, -1, 16, 7]
    ausschnitt: [0, 44, 1600, 856]
    standbild: 3
    schritte:
      - { hinweis: Mausrad – näher heran, nr: 1, mehr: "Es zoomt dorthin, wo die Maus steht." }
      - rad: { ziel: '#level', x: 0.25, y: 0.6 }
        um: -3
      - pause: 0.4
      - { hinweis: Mausrad – weiter weg, nr: 2 }
      - rad: { ziel: '#level', x: 0.25, y: 0.6 }
        um: 4
      - pause: 0.4
      - { hinweis: Leertaste halten und ziehen, nr: 3, mehr: "Mit jedem Werkzeug: Die Ansicht wandert mit der Maus. Die mittlere Maustaste geht auch." }
      - ziehen: { von: { ziel: '#level', x: 0.7, y: 0.5 }, nach: { ziel: '#level', x: 0.35, y: 0.5 } }
        mit: Space
      - pause: 0.6
      - { hinweis: M – die Karte, nr: 4, mehr: "Unten links das ganze Level im Kleinen. Ein Klick darauf springt dorthin." }
      - taste: KeyM
      - pause: 1.6
      - taste: KeyM
      - pause: 0.4

  - name: auswahl
    art: video
    titel: Mehrere auf einmal
    vorher:
      - ansicht: [-1, -1, 16, 7]
    ausschnitt: [0, 44, 1600, 856]
    schritte:
      - { hinweis: Auswählen (E) und ein Rechteck aufziehen, nr: 5, mehr: "Fang neben den Sprites an. Alles im Rechteck ist ausgewählt – rechts steht, wie viele." }
      - klick: '#tool_menu_level .button[title^="Auswählen"]'
      - ziehen: { von: { feld: [3, 3] }, nach: { feld: [7, 1] } }
      - pause: 0.6
      - pruefen: "game.level_editor.selection?.length === 3"
        meldung: Drei Münzen sollten ausgewählt sein
      - { hinweis: Ziehen – alle zusammen verschieben, nr: 6 }
      - ziehen: { von: { feld: [5, 1] }, nach: { feld: [5, 3] } }
      - { hinweis: Strg + D – duplizieren, nr: 7, mehr: "Die Kopie liegt halb versetzt über dem Original. Zieh sie an ihren Platz." }
      - taste: Control+KeyD
      - ziehen: { von: { feld: [5.5, 3.5] }, nach: { feld: [14, 4] } }
      - pause: 0.6
      - { hinweis: Entf – löschen, nr: 8, mehr: "Strg + Z holt sie zurück." }
      - taste: Delete
      - pause: 0.6
      - taste: Control+KeyZ
      - pause: 1
      - pruefen: "game.data.levels[0].layers.find(l => l.type === 'sprites').sprites.filter(p => p[0] === game.data.sprites.find(s => s.properties?.name === 'Münze').id).length === 6"
        meldung: Es sollten sechs Münzen im Level sein
---
## Kurz gesagt

1. **Mausrad** zoomt, **Leertaste + ziehen** verschiebt die Ansicht – mit jedem Werkzeug.
2. Mit **Auswählen** (<kbd>E</kbd>) ziehst du ein Rechteck auf: Alles darin ist ausgewählt.
3. Ausgewähltes ziehst du zusammen weiter, <kbd>Strg</kbd> + <kbd>D</kbd> dupliziert es, <kbd>Entf</kbd> löscht es.

## Zoomen und verschieben

![Mausrad, Leertaste und die Karte](aufnahme:ansicht)

## Mehrere auf einmal

![Rechteck aufziehen, verschieben, duplizieren](aufnahme:auswahl)

Mehr mit einer Auswahl:

- <kbd>Strg</kbd> + <kbd>A</kbd> wählt alles in der Ebene aus,
- die **Pfeiltasten** schieben die Auswahl ein Kästchen weiter (mit <kbd>Shift</kbd> ein Pixel),
- **Rechtsklick** zeigt alles, was geht: kopieren, in eine andere Ebene schieben, im Sprite-Editor bearbeiten …,
- **Alle gleichen** wählt alle Sprites dieser Art aus – zum Beispiel jede Münze im Level,
- **Ersetzen durch …** tauscht sie gegen ein anderes Sprite.

## Tasten, die Zeit sparen

Die Werkzeuge stehen so nebeneinander wie ihre Tasten auf der Tastatur: Der linke Knopf ist <kbd>Q</kbd>, der rechts daneben <kbd>W</kbd> und so weiter. Mit der linken Hand auf der Tastatur und der rechten an der Maus wechselst du blitzschnell.

| Taste | Im Level |
| --- | --- |
| <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>T</kbd> | Verschieben, Zeichnen, Auswählen, Verbinden, Testen – in der Reihe der Knöpfe |
| <kbd>Alt</kbd> + <kbd>1</kbd> … <kbd>5</kbd> | die Reiter: Sprites, Level, Einstellungen, Spielen, Hilfe |
| <kbd>X</kbd> | Zeichnen wird zum Radiergummi – und zurück |
| <kbd>G</kbd> <kbd>S</kbd> <kbd>M</kbd> <kbd>L</kbd> | Gitter, Signale, Karte, Levelübersicht |
| <kbd>Strg</kbd> + <kbd>Z</kbd> / <kbd>Y</kbd> | Rückgängig / Wiederholen |
| <kbd>Strg</kbd> + <kbd>S</kbd> | Speichern |

## Wenn's nicht klappt

- **Beim Aufziehen verschiebe ich ein Sprite:** Du hast auf einem Sprite angefangen. Fang daneben an.
- **Es wird nichts ausgewählt:** Auswählen wirkt in der Ebene, die in der Liste ausgewählt ist. Mit einem **Doppelklick** findest du ein Sprite in jeder Ebene.
- **Die Leertaste springt nur:** Das war im Test. Drück <kbd>Esc</kbd>, dann bist du wieder im Level.

## Mach mehr draus

Das Rezept [Level dekorieren](rezept:dekorieren) zeigt, wie du mit diesen Griffen schnell viel Deko verteilst. Zum Schluss: [Versionen und Stammbaum](rezept:versionen).
