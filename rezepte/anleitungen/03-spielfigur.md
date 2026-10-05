---
titel: Deine Spielfigur
kurz: Aus einem Bild wird eine Figur, die läuft und springt – und aus einem anderen ein Boden, auf dem sie steht.
start:
  eine_ebene: true
  szene:
    legende:
      P: { sprite: pip_einfach }
    karte: |
      ............
      .P..........
      ############
aufnahmen:
  - name: spielfigur
    art: video
    titel: Eine Spielfigur
    vorher:
      # so, as if the child had just drawn them: no Eigenschaften yet
      - js: |
          for (const s of game.data.sprites) { s.traits = {}; for (const st of s.states) st.traits = {}; }
          game.data.sprites[0].properties = { ...(game.data.sprites[0].properties ?? {}), name: 'Pip' };
          game._load();
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Deine Figur anklicken, nr: 1, mehr: "Links bei „Sprites“." }
      - klick: '#menu_sprites ._dnd_item:nth-child(1)'
      - { hinweis: Eigenschaft hinzufügen, nr: 2, mehr: "Rechts, unter dem Namen des Sprites." }
      - klick: '#menu_sprite_traits_add .item'
      - { hinweis: Spielfigur → Spielfigur, nr: 3 }
      - menue: [Spielfigur, Spielfigur]
      - { hinweis: "Sprungkraft: 10 und Enter", nr: 4, mehr: "Größere Zahlen lassen die Figur höher springen, eine größere Geschwindigkeit macht sie schneller. Gleich probierst du es aus." }
      - klick: { ziel: '#main_div_sprites .item:has-text("Sprungkraft") input' }
      - taste: Control+KeyA
        zeigen: false
      - tippen: "10"
      - taste: Enter
      - pause: 0.6
      - pruefen: "Number(game.data.sprites[0].traits.actor?.vjump) === 10"
        meldung: Die Sprungkraft sollte 10 sein

  - name: boden
    art: video
    titel: Ein Boden
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Den Boden anklicken, nr: 5 }
      - klick: '#menu_sprites ._dnd_item:nth-child(2)'
      - { hinweis: Blöcke → nicht von oben reinfallen, nr: 6, mehr: "Die Figur steht darauf." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Blöcke, man kann nicht von oben reinfallen]
      - { hinweis: … nicht von den Seiten reinlaufen, nr: 7, mehr: "Sie läuft nicht hinein." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Blöcke, man kann nicht von den Seiten reinlaufen]
      - { hinweis: … nicht von unten reinspringen, nr: 8, mehr: "Sie stößt sich den Kopf." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Blöcke, man kann nicht von unten reinspringen]
      - pause: 1
      - pruefen: "!!game.data.sprites[0].traits.actor && ['block_above', 'block_sides', 'block_below'].every(t => game.data.sprites[1].traits[t])"
        meldung: Pip ist keine Spielfigur oder der Boden kein ganzer Block

  - name: testen
    art: video
    titel: Ausprobieren
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Oben auf „Level“ klicken, nr: 9, mehr: "Pip steht schon auf dem Boden." }
      - klick: '#mi_level'
      - ansicht: [-1, -2, 12, 6]
      - { hinweis: Die Maus auf Pip – T, nr: 10, mehr: "T testet das Level. Der Test fängt dort an, wo die Maus ist." }
      - bewegen: { feld: [1, 1] }
      - taste: KeyT
      - warten: 1
        bis: "document.getElementById('play_iframe').contentWindow.game?.running === true && !!document.getElementById('play_iframe').contentWindow.game.player_character"
        meldung: Der Test ist nicht losgegangen
      - { hinweis: Leertaste – so hoch springt Pip jetzt, nr: 11, mehr: "Mit den Pfeiltasten läuft er. Zu hoch, zu niedrig? Ändere die Sprungkraft und teste noch einmal." }
      - taste: Space
      - warten: 1
      - taste: ArrowRight
        halten: 0.6
      - taste: Space
      - taste: ArrowRight
        halten: 0.6
      - warten: 0.8
      - { hinweis: Esc – zurück, nr: 12 }
      - taste: Escape
      - warten: 0.6

  - name: wer-zeigt-was
    art: bild
    vorher:
      - klick: '#mi_sprites'
      - klick: '#menu_sprites ._dnd_item:nth-child(1)'
      # the panel lies under the Zustände, at the bottom of the right column
      - js: "document.getElementById('who_shows_what').scrollIntoView({ block: 'end' })"
      - pruefen: "$('#who_shows_what .wsw-row:not(.wsw-head)').length >= 4 && $('#who_shows_what details').prop('open') === true"
        meldung: Wer zeigt was? sollte offen sein und Pips Bewegungen zeigen
    ausschnitt: ['.menu:has(#menu_states)', '#who_shows_what']
    rand: 6
    marken:
      - { ziel: '#menu_states ._dnd_item:nth-child(1)', nr: 1, x: 0.94, y: 0.5 }
      - { ziel: '#who_shows_what .wsw-head', nr: 2, x: 0.44, y: 0.9 }
      - { ziel: '#who_shows_what .wsw-row:has-text("Springen")', nr: 3, rahmen: true, x: 0.38, y: 0.5 }
      - { ziel: '#who_shows_what .wsw-count', nr: 4, x: 1.13, y: 0.5 }
---
## Kurz gesagt

1. Ein Sprite ist zuerst nur ein Bild. Was es im Spiel **ist**, sagst du bei **Eigenschaften**.
2. Deine Figur bekommt **Eigenschaft hinzufügen → Spielfigur → Spielfigur**.
3. Der Boden bekommt drei **Blöcke**-Eigenschaften, damit niemand hindurchfällt.
4. **Sprungkraft** und **Geschwindigkeit** stellst du bei der Spielfigur ein – und probierst sie mit <kbd>T</kbd> gleich aus.

## Das brauchst du

Zwei Sprites, die du selbst gezeichnet hast: deine Figur und einen Boden-Block. Wie man zeichnet, zeigt [Ein Sprite zeichnen](rezept:sprite-zeichnen). Im Video sind es Pip und ein Stück Wiese – bei dir sind es deine eigenen.

> **Tipp:** Zeichne deine Figur so, dass sie nach **rechts** schaut, und lass unten keinen leeren Rand. Nach links spiegelt das Spiel sie von selbst.

## Die Spielfigur

![Eigenschaft hinzufügen → Spielfigur](aufnahme:spielfigur)

## Der Boden

![Drei Blöcke-Eigenschaften für den Boden](aufnahme:boden)

Nur *von oben* ergibt eine Plattform, durch die man von unten hindurchspringen kann.

## Ausprobieren

![Im Level mit T testen und springen](aufnahme:testen)

> **Tipp:** Probier verschiedene Zahlen aus: Sprungkraft, Geschwindigkeit und die Gravitation (unter *Einstellungen → Physik*). Ein Spiel fühlt sich ganz anders an, wenn die Figur flink oder schwerfällig ist.

## Wer zeigt was?

Sobald ein Sprite eine Spielfigur ist, steht bei den **Sprites** rechts unter den **Zuständen** die Tabelle **Wer zeigt was?** – hier für Pip:

![Wer zeigt was? für Pip: jede Bewegung in jede Richtung](aufnahme:wer-zeigt-was)

1. Pip hat bis jetzt **einen** Zustand: *stehen*, mit einem einzigen Bild.
2. Die Spalten sind die Richtungen: nach **links**, nach **rechts** – und **vorn**, so steht die Figur ganz am Anfang da.
3. Jede Zeile ist eine Bewegung: Stehen, Laufen, Springen, Fallen, Klettern und Tot. In jedem Kästchen siehst du, welches Bild das Spiel dann zeigt. Bei Pip ist es überall dasselbe – nach links einfach gespiegelt.
4. **Platz für 10 Bilder** heißt: An zehn Stellen zeigt Pip ein Bild, das schon für etwas anderes da ist. Dort kannst du eigene Bilder malen – zum Beispiel ein Sprungbild.

Ein Bild für alles reicht schon zum Spielen! Die Farbe um ein Kästchen sagt, woher sein Bild kommt (die Erklärung steht unter der Tabelle), und ein Klick auf ein Kästchen zeigt dir diesen Zustand. Wie du Pip laufen, springen und fallen lässt, zeigt [Animieren](rezept:animieren) und das Rezept [Laufen, Springen und Fallen animieren](rezept:laufen-animieren).

## Wenn's nicht klappt

- **Die Eigenschaft ist beim falschen Sprite:** Klick beim falschen Sprite neben der Eigenschaft auf den Mülleimer und füg sie beim richtigen hinzu.
- **Die Figur fällt durch den Boden:** Dem Boden fehlt *man kann nicht von oben reinfallen*.

## Mach mehr draus

Jetzt baust du dein eigenes Level: [Das erste Level](rezept:erstes-level) zeigt, wie du Boden und Figur hineinsetzt und spielst.
