---
titel: Deine Spielfigur
kurz: Aus einem Bild wird eine Figur, die läuft und springt – und aus einem anderen ein Boden, auf dem sie steht.
start:
  szene:
    legende:
      P: { sprite: pip_einfach }
    karte: |
      P..
      ###
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
      - { hinweis: Geschwindigkeit und Sprungkraft, nr: 4, mehr: "Größere Zahlen machen die Figur schneller oder lassen sie höher springen." }
      - bewegen: { ziel: '#menu_sprite_properties_variable_part_following', x: 0.5, y: 0.25 }
      - pause: 0.8
      - { hinweis: „Wer zeigt was?“ – was du noch zeichnen kannst, nr: 5, mehr: "Unter den Zuständen – mehr dazu weiter unten." }
      - bewegen: { ziel: '#who_shows_what', x: 0.4, y: 0.15 }
      - pause: 1.2

  - name: boden
    art: video
    titel: Ein Boden
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Den Boden anklicken, nr: 6 }
      - klick: '#menu_sprites ._dnd_item:nth-child(2)'
      - { hinweis: Blöcke → nicht von oben reinfallen, nr: 7, mehr: "Die Figur steht darauf." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Blöcke, man kann nicht von oben reinfallen]
      - { hinweis: … nicht von den Seiten reinlaufen, nr: 8, mehr: "Sie läuft nicht hinein." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Blöcke, man kann nicht von den Seiten reinlaufen]
      - { hinweis: … nicht von unten reinspringen, nr: 9, mehr: "Sie stößt sich den Kopf." }
      - klick: '#menu_sprite_traits_add .item'
      - menue: [Blöcke, man kann nicht von unten reinspringen]
      - pause: 1
      - pruefen: "!!game.data.sprites[0].traits.actor && ['block_above', 'block_sides', 'block_below'].every(t => game.data.sprites[1].traits[t])"
        meldung: Pip ist keine Spielfigur oder der Boden kein ganzer Block

  - name: wer-zeigt-was
    art: bild
    vorher:
      - klick: '#menu_sprites ._dnd_item:nth-child(1)'
    ausschnitt: ['.menu:has(#menu_states)']
    rand: 6
---
## Kurz gesagt

1. Ein Sprite ist zuerst nur ein Bild. Was es im Spiel **ist**, sagst du bei **Eigenschaften**.
2. Deine Figur bekommt **Eigenschaft hinzufügen → Spielfigur → Spielfigur**.
3. Der Boden bekommt drei **Blöcke**-Eigenschaften, damit niemand hindurchfällt.

## Das brauchst du

Zwei Sprites: deine Figur und einen Boden-Block. Wie man zeichnet, zeigt [Ein Sprite zeichnen](rezept:sprite-zeichnen). Hier sind sie schon fertig – Pip und ein Stück Wiese.

> **Tipp:** Zeichne deine Figur so, dass sie nach **rechts** schaut, und lass unten keinen leeren Rand. Nach links spiegelt das Spiel sie von selbst.

## Die Spielfigur

![Eigenschaft hinzufügen → Spielfigur](aufnahme:spielfigur)

## Der Boden

![Drei Blöcke-Eigenschaften für den Boden](aufnahme:boden)

Nur *von oben* ergibt eine Plattform, durch die man von unten hindurchspringen kann.

## Wer zeigt was?

![Wer zeigt was?](aufnahme:wer-zeigt-was)

Hier siehst du, welches Bild deine Figur gerade zeigt, wenn sie steht, läuft, springt oder fällt – und in welche Richtung. Ein Bild für alles reicht schon zum Spielen! **Platz für … Bilder** sagt dir, wie viele du noch dazumalen kannst. Wie das geht, zeigt das Rezept [Laufen, Springen und Fallen animieren](rezept:laufen-animieren).

## Wenn's nicht klappt

- **Die Eigenschaft ist beim falschen Sprite:** Klick beim falschen Sprite neben der Eigenschaft auf den Mülleimer und füg sie beim richtigen hinzu.
- **Die Figur fällt durch den Boden:** Dem Boden fehlt *man kann nicht von oben reinfallen*.

## Mach mehr draus

Jetzt geht's ins Level: [Das erste Level](rezept:erstes-level) zeigt, wie du Boden und Figur hineinsetzt und spielst.
