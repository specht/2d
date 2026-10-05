---
titel: Hintergrund und Ebenen
kurz: Ein Himmel als Farbverlauf, Berge in einer eigenen Ebene – und Parallaxe, damit sie weit weg wirken.
start:
  szene:
    legende:
      P: { sprite: pip }
    zusaetzlich: [berge, wolke]
    karte: |
      ..............................
      .P............................
      ##############################
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
      - ansicht: [-6, -3, 35, 11]
    ausschnitt: [0, 44, 1600, 818]
    standbild: 5
    schritte:
      - { hinweis: "Bei Ebenen: + und Hintergrund", nr: 1, mehr: "Ein Hintergrund ist ein Farbverlauf – zum Beispiel ein Himmel. Er kommt hinter deine Sprites." }
      - klick: '#menu_layers ._dnd_item.add'
      - klick: '.add_choice:has-text("Hintergrund")'
      - pause: 0.8
      - { hinweis: Farbe 1 oben – Farbe 2 unten, nr: 2, mehr: "Ein Klick auf eine Farbe öffnet die Palette. Bei „Farben“ gehen auch drei oder mehr." }
      - bewegen: { ziel: '#menu_layer_properties .item:has-text("Farbe 1")', x: 0.6, y: 0.5 }
      - pause: 1
      - bewegen: { ziel: '#menu_layer_properties .item:has-text("Farbe 2")', x: 0.6, y: 0.5 }
      - pause: 1
      - { hinweis: Die Griffe – so groß wie dein Level, nr: 3, mehr: "Der Hintergrund ist ein Rechteck. An den kleinen Quadraten ziehst du es größer oder kleiner." }
      - bewegen: { ziel: '#level', x: 0.95, y: 0.5 }
      - pause: 1.2
      - pruefen: "game.data.levels[0].layers.at(-1).type === 'backdrop'"
        meldung: Der Hintergrund sollte ganz hinten liegen

  - name: berge
    art: video
    titel: Berge in einer eigenen Ebene
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Mit dem Mausrad näher heran, nr: 4, mehr: "Das Mausrad zoomt dorthin, wo die Maus ist." }
      - rad: { ziel: '#level', x: 0.15, y: 0.75 }
        um: -4
      - { hinweis: "+ und Sprites: eine neue Ebene", nr: 5, mehr: "Sie kommt vor den Himmel, aber hinter deine erste Ebene. Was in der Liste oben steht, ist vorn." }
      - klick: '#menu_layers ._dnd_item.add'
      - klick: '.add_choice:has-text("Sprites")'
      - pause: 0.6
      - { hinweis: Berge hineinsetzen, nr: 6, mehr: "In der neuen Ebene: Berge anklicken, Zeichnen auswählen, klicken." }
      - klick: '#menu_level_sprites .button[title="Berge"]'
      - klick: '#tool_menu_level .button[title^="Zeichnen"]'
      - klick: { feld: [3, 1] }
      - klick: { feld: [12, 1] }
      - klick: { feld: [21, 1] }
      - { hinweis: Einstellungen der Ebene öffnen, nr: 7 }
      - klick: '#layer_settings_head'
      - { hinweis: Kollisionen erkennen ausschalten, nr: 8, mehr: "Die Berge sind nur Bild: Pip soll nicht dagegenlaufen." }
      - klick: { ziel: '#menu_layer_properties .item:has-text("Kollisionen erkennen")', x: 0.93, y: 0.5 }
      - { hinweis: "Parallaxe: 0.5 und Enter", nr: 9, mehr: "Die Ebene wandert halb so schnell mit wie die Kamera – so wirken die Berge weit weg." }
      - klick: { ziel: '#menu_layer_properties .item:has-text("Parallaxe") input' }
      - taste: Control+KeyA
        zeigen: false
      - tippen: "0.5"
      - taste: Enter
      - pause: 0.6
      - pruefen: |
          (() => {
            const l = game.data.levels[0].layers[1];
            return l.type === 'sprites' && l.sprites.length === 3 && Number(l.properties.parallax) === 0.5 && !l.properties.collision_detection;
          })()
        meldung: Die Berge-Ebene sollte drei Berge, Parallaxe 0.5 und keine Kollisionen haben
      - { hinweis: Testen – und nach rechts laufen, nr: 10, mehr: "Mit Verschieben (Q) setzt der Stift nichts aus Versehen. Im Test zieht der Boden schnell vorbei, die Berge langsam." }
      - klick: '#tool_menu_level .button[title^="Verschieben"]'
      - bewegen: { feld: [1, 1] }
      - taste: KeyT
      - warten: 1
      - taste: ArrowRight
        halten: 2.6
      - warten: 0.6
      - taste: Escape
      - warten: 0.6
---
## Kurz gesagt

1. Ein Level besteht aus **Ebenen**, die übereinanderliegen. Was in der Liste oben steht, ist vorn.
2. **+ → Hintergrund** macht einen Farbverlauf – einen Himmel, ein Abendrot, eine Höhle.
3. **+ → Sprites** macht eine neue Ebene für Dinge, die nur Bild sind: Berge, Wolken, Bäume.
4. Mit **Parallaxe** bewegt sich eine Ebene langsamer – sie wirkt weit weg.

## Ein Himmel

![Hintergrund hinzufügen](aufnahme:himmel)

## Berge in einer eigenen Ebene

![Neue Ebene, Berge, Parallaxe, testen](aufnahme:berge)

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
