---
titel: Ziel und mehrere Level
kurz: Ein Ziel beendet das Level, die Karte „Level geschafft“ zeigt, wohin es weitergeht – und mit Duplizieren hast du schnell ein zweites Level.
start:
  eine_ebene: true
  szene:
    legende:
      P: { sprite: pip }
    zusaetzlich: [ziel]
    karte: |
      ..............
      .P............
      ##############
aufnahmen:
  - name: ziel
    art: video
    titel: Ein Ziel
    vorher:
      # as if the child had just drawn the flag: no Eigenschaften yet
      - js: |
          const ziel = game.data.sprites.find(s => s.properties?.name === 'Ziel');
          ziel.traits = {};
          for (const st of ziel.states) st.traits = {};
          game._load();
      - klick: '#menu_sprites ._dnd_item:nth-child(1)'
    ausschnitt: [0, 0, 1600, 862]
    standbild: 12
    schritte:
      - { hinweis: Dein Ziel anklicken, nr: 1, mehr: "Links bei „Sprites“. Hier ist es eine Fahne mit Karomuster – zeichne dein eigenes: ein Tor, eine Höhle, eine Rakete …" }
      - klick: '#menu_sprites ._dnd_item:nth-child(3)'
      - { hinweis: "Eigenschaft: Level → Levelwechsel", nr: 2, mehr: "Wer das Ziel berührt, hat das Level geschafft." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Level, Levelwechsel]
      - { hinweis: Im Level ans Ende setzen, nr: 3, mehr: "Ziel anklicken, Zeichnen auswählen und ein Klick." }
      - klick: '#mi_level'
      - ansicht: [-1, -1, 14, 5]
      - klick: '#menu_level_sprites .button[title="Ziel"]'
      - klick: '#tool_menu_level .button[title^="Zeichnen"]'
      - klick: { feld: [12, 1] }
      - { hinweis: S – die Karte „Level geschafft“, nr: 4, mehr: "Ganz oben in der Signale-Übersicht: Wenn die Spielfigur das Ziel erreicht, dann ist das Level geschafft." }
      - taste: KeyS
      - bewegen: { ziel: '.signal-rule-complete', x: 0.5, y: 0.45 }
      - pause: 1.8
      - pruefen: |
          (() => {
            const ziel = game.data.sprites.find(s => s.properties?.name === 'Ziel');
            return 'level_complete' in ziel.traits &&
              game.data.levels[0].layers.some(l => (l.sprites ?? []).some(p => p[0] === ziel.id));
          })()
        meldung: Das Ziel sollte Levelwechsel haben und im Level stehen
    nachher:
      - taste: KeyS

  - name: zweites-level
    art: video
    titel: Ein zweites Level
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Rechtsklick auf das Level – Duplizieren, nr: 5, mehr: "Rechts unter „Level“. Die Kopie hat schon Boden, Figur und Ziel – du baust sie nur noch um." }
      - rechtsklick: '#menu_levels ._dnd_item:nth-child(1)'
      - menue: Duplizieren
      - pause: 0.8
      - { hinweis: "Im zweiten Level: S und „→ weiter: zum Spielende“", nr: 6, mehr: "Nach dem zweiten Level soll das Spiel zu Ende sein. Ohne diese Wahl ginge es zum nächsten Level – das gibt es nicht, also käme auch das Ende." }
      - klick: '#menu_levels ._dnd_item:nth-child(2)'
      - taste: KeyS
      - pause: 0.6
      - klick: '.signal-rule-complete .dropdown-button'
      - menue: zum Spielende (THE END)
      - pause: 1
      - taste: KeyS
      - pruefen: |
          game.data.levels[1].layers.some(l => (l.sprites ?? []).some(p => p[3]?.level_complete?.target === '@end'))
        meldung: Das Ziel im zweiten Level sollte zum Spielende führen
      - { hinweis: L – die Levelübersicht, nr: 7, mehr: "Jedes Level ist ein Kästchen. Der graue Pfeil führt vom ersten ins zweite Level, der grüne vom zweiten zum Ende." }
      - taste: KeyL
      - pause: 2.4
      - taste: KeyL
      - pruefen: "game.data.levels.length === 2"
        meldung: Es sollte zwei Level geben
      - { hinweis: "Testen: das erste Level, Maus vors Ziel, T", nr: 8, mehr: "Mit Verschieben (Q) setzt der Stift nichts aus Versehen. Dann lauf ins Ziel." }
      - klick: '#menu_levels ._dnd_item:nth-child(1)'
      - ansicht: [-1, -1, 14, 5]
      - klick: '#tool_menu_level .button[title^="Verschieben"]'
      - bewegen: { feld: [9, 1] }
      - taste: KeyT
      - warten: 1
        bis: "document.getElementById('play_iframe').contentWindow.game?.running === true && !!document.getElementById('play_iframe').contentWindow.game.player_character"
        meldung: Der Test ist nicht losgegangen
      - taste: ArrowRight
        halten: 1.2
      - warten: 2
      - { hinweis: Geschafft! Eine Taste – weiter, nr: 9, mehr: "Der Vorhang sagt, welches Level jetzt kommt." }
      - taste: Space
      - warten: 1.6
      - pruefen: "document.getElementById('play_iframe').contentWindow.game.level_index === 1"
        meldung: Das Ziel hat nicht ins zweite Level geführt
      - { hinweis: Esc – zurück, nr: 10 }
      - taste: Escape
      - warten: 0.6
---
## Kurz gesagt

1. Ein Sprite mit der Eigenschaft **Level → Levelwechsel** ist ein **Ziel** (oder eine Tür, ein Ausgang …): Wer es berührt, hat das Level geschafft.
2. In der Signale-Übersicht (<kbd>S</kbd>) steht ganz oben die Karte **Level geschafft**. Bei **→ weiter:** stellst du ein, wohin es danach geht – zum nächsten Level, zu einem bestimmten oder zum Spielende.
3. Rechtsklick auf ein Level → **Duplizieren** macht ein zweites. <kbd>L</kbd> zeigt alle Level und wie sie zusammenhängen.

## Ein Ziel

![Levelwechsel, ins Level setzen, die Karte Level geschafft](aufnahme:ziel)

In der Karte **Level geschafft** steht jedes Ziel des Levels als eigene Zeile. Dort kannst du auch einstellen:

- **→ weiter:** – zum nächsten Level, zu einem bestimmten Level, *zurück, woher man kam* oder *zum Spielende*,
- **nur mit F** – die Figur geht erst hindurch, wenn man vor dem Ziel <kbd>F</kbd> drückt (gut für Türen).

Dasselbe steht auch rechts bei **Auswahl**, wenn du das Ziel im Level mit **Auswählen** (<kbd>E</kbd>) anklickst.

## Ein zweites Level

![Duplizieren, Levelübersicht, testen](aufnahme:zweites-level)

> **Tipp:** Gib deinen Leveln Namen: Rechtsklick → **Umbenennen**. In der Levelübersicht und bei **→ weiter:** findest du sie dann leichter.

## Wenn's nicht klappt

- **In der Karte steht ein Warndreieck:** Kein Sprite in diesem Level hat **Levelwechsel** – oder das Ziel liegt in einer Ebene ohne *Kollisionen erkennen*.
- **Nach dem Ziel kommt gleich „THE END“:** Es gibt kein nächstes Level in der Liste. Dupliziere eins oder wähle bei **→ weiter:** ein bestimmtes.
- **Die Figur läuft durchs Ziel und nichts passiert:** Steht bei der Zeile **nur mit F**? Dann drück vor dem Ziel <kbd>F</kbd>. Steht 🔒 davor, öffnet es erst bei einem Signal – siehe [Signale](rezept:signale).

## Mach mehr draus

Das Rezept [So wird ein Level geschafft](rezept:level-geschafft) zeigt Türen, Ziele mit F und ein Level, das erst nach einem Signal geschafft ist. Als Nächstes machst du dein Level schöner: [Hintergrund und Ebenen](rezept:hintergrund-ebenen).
