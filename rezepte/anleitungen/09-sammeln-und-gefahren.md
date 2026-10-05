---
titel: Sammeln und Gefahren
kurz: Eine Münze, Stacheln und eine Fahne selbst zeichnen, ihnen ihre Eigenschaften geben und im Level ausprobieren.
start:
  eine_ebene: true
  szene:
    legende:
      P: { sprite: pip }
    karte: |
      ................
      .P..............
      ################
aufnahmen:
  - name: muenze
    art: video
    titel: Eine Münze
    ausschnitt: [0, 44, 1600, 818]
    standbild: 14
    schritte:
      - { hinweis: + – ein neues Sprite, nr: 1, mehr: "Bei „Sprites“ hinter dem letzten. Es ist leer und wartet auf dein Bild." }
      - klick: '#menu_sprites ._dnd_item.add'
      - pause: 0.4
      - { hinweis: "Titel: Münze und Enter", nr: 2, mehr: "Mit Titel findest du es im Level leichter wieder." }
      - klick: '#main_div_sprites .item:has-text("Titel") input'
      - taste: Control+KeyA
        zeigen: false
      - tippen: Münze
      - taste: Enter
      - { hinweis: Gelb und „Ellipse füllen“ (F), nr: 3 }
      - klick: '#color_menu .button:nth-child(2)'
      - klick: '#tool_menu .button[title^="Ellipse füllen"]'
      - { hinweis: Eine Münze aufziehen, nr: 4, mehr: "Von einer Ecke zur anderen: schmal und hoch, so sieht sie aus, als würde sie sich drehen." }
      - ziehen: { von: { pixel: [8, 5] }, nach: { pixel: [15, 18] } }
      - { hinweis: Ein dunklerer Rand und eine Kerbe, nr: 5, mehr: "„Ellipse zeichnen“ (R) malt nur den Rand, die Linie (W) die Kerbe in der Mitte." }
      - klick: '#color_menu .button:nth-child(4)'
      - klick: '#tool_menu .button[title^="Ellipse zeichnen"]'
      - ziehen: { von: { pixel: [8, 5] }, nach: { pixel: [15, 18] } }
      - klick: '#tool_menu .button[title^="Linie"]'
      - ziehen: { von: { pixel: [11, 9] }, nach: { pixel: [11, 14] } }
      - { hinweis: Ein Glanz mit dem Stift (Q), nr: 6 }
      - klick: '#color_menu .button:nth-child(44)'
      - klick: '#tool_menu .button[title^="Zeichnen"]'
      - klick: { pixel: [10, 7] }
      - klick: { pixel: [9, 8] }
      - { hinweis: "Eigenschaft: Einsammeln", nr: 7, mehr: "„man kann es einsammeln“: Im Spiel verschwindet die Münze bei Berührung und gibt Punkte." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Einsammeln, man kann es einsammeln]
      - { hinweis: "gibt Punkte: 10 und Enter", nr: 8, mehr: "Ohne Punkte verschwindet sie nur. Mit 10 zählt das Spiel oben rechts mit." }
      - klick: { ziel: '#main_div_sprites .item:has-text("gibt Punkte") input' }
      - taste: Control+KeyA
        zeigen: false
      - tippen: "10"
      - taste: Enter
      - pause: 0.6
      - pruefen: "'pickup' in (game.data.sprites.find(s => s.properties?.name === 'Münze')?.traits ?? {})"
        meldung: Die Münze sollte man einsammeln können

  - name: stacheln
    art: video
    titel: Stacheln
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: "+ und Titel: Stacheln", nr: 9 }
      - klick: '#menu_sprites ._dnd_item.add'
      - pause: 0.3
      - klick: '#main_div_sprites .item:has-text("Titel") input'
      - taste: Control+KeyA
        zeigen: false
      - tippen: Stacheln
      - taste: Enter
      - { hinweis: Grau und die Linie (W) – drei Zacken, nr: 10, mehr: "Erst der Boden, dann hoch und runter. Die Spitzen dürfen ruhig bis fast nach oben gehen: Der ganze Block ist gefährlich." }
      - klick: '#color_menu .button:nth-child(40)'
      - klick: '#tool_menu .button[title^="Linie"]'
      - ziehen: { von: { pixel: [1, 23] }, nach: { pixel: [22, 23] } }
      - ziehen: { von: { pixel: [1, 22] }, nach: { pixel: [4, 13] } }
      - ziehen: { von: { pixel: [5, 14] }, nach: { pixel: [7, 22] } }
      - ziehen: { von: { pixel: [8, 22] }, nach: { pixel: [11, 13] } }
      - ziehen: { von: { pixel: [12, 14] }, nach: { pixel: [14, 22] } }
      - ziehen: { von: { pixel: [15, 22] }, nach: { pixel: [18, 13] } }
      - ziehen: { von: { pixel: [19, 14] }, nach: { pixel: [22, 22] } }
      - { hinweis: Hellgrau hinein (A), nr: 11, mehr: "Der Farbeimer füllt jeden Zacken mit einem Klick." }
      - klick: '#color_menu .button:nth-child(39)'
      - klick: '#tool_menu .button[title^="Fläche füllen"]'
      - klick: { pixel: [4, 20] }
      - klick: { pixel: [11, 20] }
      - klick: { pixel: [18, 20] }
      - { hinweis: "Eigenschaft: Fallen und Gegner → Falle", nr: 12, mehr: "Jede Berührung kostet jetzt Energie." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Fallen und Gegner, Falle]
      - { hinweis: "Schaden: 25 und Enter", nr: 13, mehr: "Mit 100 wäre nach einer einzigen Berührung ein Leben weg. Mit 25 übersteht man drei." }
      - klick: { ziel: '#main_div_sprites .item:has-text("Schaden") input' }
      - taste: Control+KeyA
        zeigen: false
      - tippen: "25"
      - taste: Enter
      - pause: 0.6
      - pruefen: "'trap' in (game.data.sprites.find(s => s.properties?.name === 'Stacheln')?.traits ?? {})"
        meldung: Die Stacheln sollten eine Falle sein

  - name: fahne
    art: video
    titel: Eine Fahne
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: "+ und Titel: Fahne", nr: 14 }
      - klick: '#menu_sprites ._dnd_item.add'
      - pause: 0.3
      - klick: '#main_div_sprites .item:has-text("Titel") input'
      - taste: Control+KeyA
        zeigen: false
      - tippen: Fahne
      - taste: Enter
      - { hinweis: Eine Stange und ein Wimpel, nr: 15, mehr: "Mit der Linie (W): die Stange gerade nach unten, der Wimpel als Dreieck – dann füllt ihn der Farbeimer (A)." }
      - klick: '#color_menu .button:nth-child(42)'
      - klick: '#tool_menu .button[title^="Linie"]'
      - ziehen: { von: { pixel: [6, 2] }, nach: { pixel: [6, 23] } }
      - klick: '#color_menu .button:nth-child(20)'
      - ziehen: { von: { pixel: [7, 2] }, nach: { pixel: [17, 6] } }
      - ziehen: { von: { pixel: [16, 7] }, nach: { pixel: [7, 10] } }
      - klick: '#tool_menu .button[title^="Fläche füllen"]'
      - klick: { pixel: [9, 6] }
      - { hinweis: "Eigenschaft: Level → Checkpoint", nr: 16, mehr: "Berührt die Figur die Fahne, fängt sie nach einem verlorenen Leben dort wieder an." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Level, Checkpoint]
      - pause: 0.8
      - pruefen: "'checkpoint' in (game.data.sprites.find(s => s.properties?.name === 'Fahne')?.traits ?? {})"
        meldung: Die Fahne sollte ein Checkpoint sein

  - name: ausprobieren
    art: video
    titel: Ins Level und ausprobieren
    vorher:
      - klick: '#mi_level'
      - ansicht: [-1, -1, 16, 6]
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Münzen in eine Reihe malen, nr: 17, mehr: "Münze anklicken, Zeichnen auswählen und ziehen." }
      - klick: '#tool_menu_level .button[title^="Zeichnen"]'
      - klick: '#menu_level_sprites .button[title="Münze"]'
      - malen: [{ feld: [4, 1] }, { feld: [6, 1] }]
      - { hinweis: Die Fahne – hier geht's nach einem Treffer weiter, nr: 18 }
      - klick: '#menu_level_sprites .button[title="Fahne"]'
      - klick: { feld: [8, 1] }
      - { hinweis: Dahinter die Stacheln, nr: 19 }
      - klick: '#menu_level_sprites .button[title="Stacheln"]'
      - malen: [{ feld: [10, 1] }, { feld: [11, 1] }]
      - { hinweis: Testen – einsammeln und hineinlaufen, nr: 20, mehr: "Vorher Verschieben (Q) auswählen – dann setzt der Stift nichts aus Versehen. Oben rechts zählen die Punkte. Jede Berührung der Stacheln kostet Energie – ist sie aufgebraucht, ist ein Herz weg." }
      - klick: '#tool_menu_level .button[title^="Verschieben"]'
      - bewegen: { feld: [2, 1] }
      - taste: KeyT
      - warten: 0.8
      - taste: ArrowRight
        halten: 2
      - warten: 1.6
      - pruefen: |
          (() => { const g = document.getElementById('play_iframe').contentWindow.game; return g.points === 30 && (g.lives < 3 || g.energy < 100); })()
        meldung: Im Test sollten drei Münzen eingesammelt sein und die Stacheln getroffen haben
      - { hinweis: Eine Taste – weiter an der Fahne, nr: 21, mehr: "Pip war an der Fahne vorbei: Dort steht er wieder." }
      - taste: Space
      - warten: 1.4
      - taste: Escape
      - warten: 0.6
---
## Kurz gesagt

1. Zeichne für jede Sache ein eigenes Sprite: **+** bei den Sprites, ein **Titel**, dann malen.
2. Was es im Spiel tut, sagt seine **Eigenschaft**: Die Münze kann man **einsammeln**, die Stacheln sind eine **Falle**, die Fahne ein **Checkpoint**.
3. Setz alles ins Level und probier es mit <kbd>T</kbd> aus.

## Eine Münze

![Ellipse füllen, Rand, Glanz – und einsammeln](aufnahme:muenze)

## Stacheln

![Zacken mit der Linie, gefüllt – und eine Falle](aufnahme:stacheln)

## Eine Fahne

![Stange, Wimpel – und ein Checkpoint](aufnahme:fahne)

## Ins Level und ausprobieren

![Münzen, Fahne und Stacheln ins Level, testen](aufnahme:ausprobieren)

Was die Eigenschaften im Spiel tun:

- **man kann es einsammeln** – es verschwindet und gibt die Punkte, die du bei der Eigenschaft einträgst,
- **Falle** – jede Berührung kostet so viel Energie, wie bei **Schaden** steht (von 100). Ist sie aufgebraucht, ist ein Leben weg,
- **Checkpoint** – berührt die Figur die Fahne, fängt sie nach einem verlorenen Leben dort wieder an.

Wie viele Leben man hat, steht unter **Einstellungen → Gesundheit**.

> **Tipp:** Deine eigenen Bilder machen dein Spiel zu *deinem* Spiel. Wenn du nicht weißt, wie man etwas zeichnet: Unter **Sprites → Rechtsklick → Sprites holen** stehen fertige Bilder aus den Rezepten. Du bekommst nur die Bilder – schau dir an, wie sie gemacht sind, und mal sie um. Was sie im Spiel tun, stellst du wie hier selbst ein.

## Wenn's nicht klappt

- **Die Münze verschwindet nicht:** Ihr fehlt die Eigenschaft *man kann es einsammeln* – oder sie liegt in einer Ebene ohne *Kollisionen erkennen*.
- **Pip läuft durch die Stacheln, ohne dass etwas passiert:** Den Stacheln fehlt die Eigenschaft **Falle**.
- **Nach einem Treffer fängt Pip ganz vorn an:** Er ist noch nicht an der Fahne vorbeigekommen.

## Mach mehr draus

Zeichne einen Edelstein, der mehr Punkte gibt (wie in [Ein Sprite zeichnen](rezept:sprite-zeichnen)), oder Stacheln, die von der Decke hängen. Die Rezepte [Münzen einsammeln](rezept:muenzen), [Stacheln und Fallen](rezept:stacheln) und [Checkpoints](rezept:checkpoint) zeigen, was du daran noch einstellen kannst. Als Nächstes: [Signale](rezept:signale) – ein Schalter öffnet ein Tor.
