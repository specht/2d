---
titel: Hintergrund und Ebenen
kurz: Ein Himmel als Farbverlauf, Berge in einer eigenen Ebene – und Parallaxe, damit sie weit weg wirken.
start:
  szene:
    legende:
      P: { sprite: pip }
    zusaetzlich: [berge, wolke]
    # longer than the screen: in the test the camera follows Pip, and the
    # mountains behind him move more slowly
    kamera: { bildhoehe: 216 }
    karte: |
      ................................................
      ........P.......................................
      ################################################
aufnahmen:
  - name: himmel
    art: video
    titel: Ein Himmel
    vorher:
      # a child's level: one layer, no sky yet
      - js: |
          const L = game.data.levels[0];
          const sprite_layers = L.layers.filter(l => l.type === 'sprites');
          const main = sprite_layers.find(l => l.properties?.name === 'Welt');
          for (const l of sprite_layers) if (l !== main) main.sprites.push(...l.sprites);
          L.layers = [main];
          main.properties.name = 'Ebene 1';
          delete L.properties.name;
          game._load();
      - klick: '#mi_level'
      - ansicht: [-12, -3, 50, 11]
    ausschnitt: [0, 44, 1600, 818]
    standbild: 5
    schritte:
      - { hinweis: "Bei Ebenen: + und Hintergrund", nr: 1, mehr: "Ein Hintergrund ist ein Farbverlauf – zum Beispiel ein Himmel. Er kommt hinter deine Sprites." }
      - klick: '#menu_layers ._dnd_item.add'
      - klick: '.add_choice:has-text("Hintergrund")'
      - pause: 0.8
      - { hinweis: "Farbe 1 (oben): ein Lila", nr: 2, mehr: "Ein Klick auf die Farbe öffnet die Palette, ein Klick daneben schließt sie wieder." }
      - klick: '#menu_layer_properties .item:has-text("Farbe 1") input'
      - pause: 0.6
      - klick: '#clr-swatches button:nth-child(16)'
      - pause: 0.4
      - klick: { punkt: [160, 780] }
      - { hinweis: "Farbe 2 (unten): ein Orange – Abendrot", nr: 3, mehr: "Dazwischen läuft der Verlauf von selbst. Bei „Farben“ gehen auch drei oder mehr." }
      - klick: '#menu_layer_properties .item:has-text("Farbe 2") input'
      - pause: 0.6
      - klick: '#clr-swatches button:nth-child(5)'
      - pause: 0.4
      - klick: { punkt: [160, 780] }
      - bewegen: { ziel: '#level', x: 0.5, y: 0.3 }
      - pause: 1
      - pruefen: "game.data.levels[0].layers.at(-1).type === 'backdrop' && game.data.levels[0].layers.at(-1).colors.map(c => c[0].slice(0, 7)).join() === '#5f3577,#f1753f'"
        meldung: Der Hintergrund sollte ganz hinten liegen und von Lila nach Orange gehen

  - name: berge
    art: video
    titel: Berge in einer eigenen Ebene
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Mit dem Mausrad näher heran, nr: 4, mehr: "Das Mausrad zoomt dorthin, wo die Maus ist." }
      - rad: { ziel: '#level', x: 0.3, y: 0.75 }
        um: -2
      - { hinweis: "+ und Sprites: eine neue Ebene", nr: 5, mehr: "Sie kommt vor den Himmel, aber hinter deine erste Ebene. Was in der Liste oben steht, ist vorn." }
      - klick: '#menu_layers ._dnd_item.add'
      - klick: '.add_choice:has-text("Sprites")'
      - pause: 0.6
      - { hinweis: "Doppelklick auf die neue Ebene – Name: Berge", nr: 6, mehr: "Gib jeder Ebene gleich einen Namen. „Ebene 2“ sagt dir später nichts mehr, „Berge“ schon." }
      - doppelklick: '#menu_layers ._dnd_item:nth-child(2)'
      - tippen: Berge
      - taste: Enter
      - pause: 0.4
      - pruefen: "game.data.levels[0].layers[1].properties.name === 'Berge'"
        meldung: Die neue Ebene sollte Berge heißen
      - { hinweis: Eine Bergkette – ohne Lücke, nr: 7, mehr: "In der neuen Ebene: Berge anklicken, Zeichnen auswählen und einen Berg direkt neben den anderen setzen." }
      - klick: '#menu_level_sprites .button[title="Berge"]'
      - klick: '#tool_menu_level .button[title^="Zeichnen"]'
      # one row low: a far layer sits a little higher in the game, and the
      # grass covers their foot
      - klick: { feld: [-8, 0] }
      - klick: { feld: [0, 0] }
      - klick: { feld: [8, 0] }
      - klick: { feld: [16, 0] }
      - klick: { feld: [24, 0] }
      - { hinweis: Einstellungen der Ebene öffnen, nr: 8 }
      - klick: '#layer_settings_head'
      - { hinweis: Kollisionen erkennen ausschalten, nr: 9, mehr: "Die Berge sind nur Bild: Pip soll nicht dagegenlaufen." }
      - klick: { ziel: '#menu_layer_properties .item:has-text("Kollisionen erkennen")', x: 0.93, y: 0.5 }
      - { hinweis: "Parallaxe: 0.5 und Enter", nr: 10, mehr: "Die Ebene wandert halb so schnell mit wie die Kamera – so wirken die Berge weit weg." }
      - klick: { ziel: '#menu_layer_properties .item:has-text("Parallaxe") input' }
      - taste: Control+KeyA
        zeigen: false
      - tippen: "0.5"
      - taste: Enter
      - pause: 0.6
      - pruefen: |
          (() => {
            const l = game.data.levels[0].layers[1];
            return l.type === 'sprites' && l.sprites.length === 5 && Number(l.properties.parallax) === 0.5 && !l.properties.collision_detection;
          })()
        meldung: Die Berge-Ebene sollte fünf Berge, Parallaxe 0.5 und keine Kollisionen haben
      - { hinweis: Auswählen (E) – Doppelklick auf Pip, nr: 11, mehr: "Pip liegt in einer anderen Ebene. Ein Doppelklick findet ein Sprite in jeder Ebene: Die Liste springt in seine Ebene, und rechts unter „Auswahl“ stehen seine Einstellungen." }
      - klick: '#tool_menu_level .button[title^="Auswählen"]'
      - doppelklick: { feld: [8, 1], ebene: 0 }
      - pause: 1.2
      - pruefen: "game.level_editor.layer_index === 0 && game.level_editor.selection?.length === 1"
        meldung: Der Doppelklick sollte Pip in seiner Ebene auswählen
      - { hinweis: Testen – und nach rechts laufen, nr: 12, mehr: "Mit Verschieben (Q) setzt der Stift nichts aus Versehen. Im Test zieht der Boden schnell vorbei, die Berge langsam." }
      - klick: '#tool_menu_level .button[title^="Verschieben"]'
      - bewegen: { feld: [8, 1] }
      - taste: KeyT
      - warten: 1
        bis: "document.getElementById('play_iframe').contentWindow.game?.running === true && !!document.getElementById('play_iframe').contentWindow.game.player_character"
        meldung: Der Test ist nicht losgegangen
      - taste: ArrowRight
        halten: 5
      - warten: 0.6
      - taste: Escape
      - warten: 0.6
---
## Kurz gesagt

1. Ein Level besteht aus **Ebenen**, die übereinanderliegen. Was in der Liste oben steht, ist vorn. Ein **Doppelklick** auf eine Ebene gibt ihr einen Namen.
2. **+ → Hintergrund** macht einen Farbverlauf – einen Himmel, ein Abendrot, eine Höhle.
3. **+ → Sprites** macht eine neue Ebene für Dinge, die nur Bild sind: Berge, Wolken, Bäume.
4. Mit **Parallaxe** bewegt sich eine Ebene langsamer – sie wirkt weit weg.
5. Mit **Auswählen** (<kbd>E</kbd>) wählt ein **Doppelklick** ein Sprite aus, egal in welcher Ebene es liegt.

## Ein Himmel

![Hintergrund hinzufügen](aufnahme:himmel)

## Berge in einer eigenen Ebene

![Neue Ebene, benennen, Berge, Parallaxe, Doppelklick, testen](aufnahme:berge)

**Parallaxe** in Zahlen:

- **0** – die Ebene bewegt sich mit dem Level (wie dein Boden),
- **0.5** – halb so schnell: weit weg,
- **0.8** – kaum: ganz weit weg, zum Beispiel Wolken,
- **1** – gar nicht: sie steht still wie der Himmel.

> **Tipp:** Das Auge neben einer Ebene blendet sie im Studio aus, das Schloss sperrt sie – dann malst du nicht aus Versehen hinein. Die Reihenfolge änderst du, indem du eine Ebene in der Liste nach oben oder unten ziehst.

## Wenn's nicht klappt

- **Ich male, aber nichts erscheint:** Ist die richtige Ebene ausgewählt? Oben links im Level steht, in welcher du gerade malst.
- **Pip läuft gegen die Berge:** In ihrer Ebene ist *Kollisionen erkennen* noch an.
- **Am Rand hört der Himmel auf:** Zieh das Rechteck des Hintergrunds an seinen Griffen größer. Dafür die Hintergrund-Ebene in der Liste anklicken.

## Mach mehr draus

Leg eine zweite Ebene mit Wolken an und gib ihr Parallaxe 0.8. Die Rezepte [Himmel mit Farbverlauf](rezept:himmel) und [Parallaxe – Hintergründe mit Tiefe](rezept:parallaxe) zeigen eine ganze Landschaft mit fünf Ebenen. Als Nächstes kommt Leben ins Level: [Sammeln und Gefahren](rezept:sammeln-und-gefahren).
