---
titel: Sammeln und Gefahren
kurz: Münzen, Stacheln und eine Fahne aus dem Sprite-Katalog holen, ins Level setzen und ausprobieren.
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
  - name: holen
    art: video
    titel: Aus dem Sprite-Katalog holen
    ausschnitt: [0, 44, 1600, 818]
    standbild: 9
    schritte:
      - { hinweis: Rechtsklick bei den Sprites – Sprites holen, nr: 1, mehr: "Der Sprite-Katalog: fertige Sprites, die schon wissen, was sie im Spiel tun." }
      - rechtsklick: '#menu_sprites ._dnd_item:nth-child(1)'
      - menue: 'Sprites holen (Katalog oder anderes Spiel) …'
      - warten: 0.8
      - { hinweis: "Suchen: Münze – anklicken", nr: 2, mehr: "Ein Haken zeigt: Sie liegt im Korb." }
      - klick: '#basket_search'
      - tippen: Münze
      - klick: '.basket-card:has(.basket-card-name:text-is("Münze")):visible'
      - { hinweis: Stacheln und eine Fahne dazu, nr: 3 }
      - klick: '#basket_search'
      - taste: Control+KeyA
        zeigen: false
      - tippen: Stacheln
      - klick: '.basket-card:has(.basket-card-name:text-is("Stacheln")):visible'
      - klick: '#basket_search'
      - taste: Control+KeyA
        zeigen: false
      - tippen: Fahne
      - klick: '.basket-card:has(.basket-card-name:text-is("Fahne")):visible'
      - { hinweis: In mein Spiel holen, nr: 4 }
      - klick: 'button:has-text("In mein Spiel holen")'
      - warten: 0.6
      - { hinweis: Die Eigenschaften sind schon da, nr: 5, mehr: "Die Münze kann man einsammeln, die Stacheln sind eine Falle, die Fahne ein Checkpoint." }
      - klick: '#menu_sprites ._dnd_item:nth-child(4)'
      - bewegen: { ziel: '#menu_sprite_properties_variable_part_following', x: 0.5, y: 0.2 }
      - pause: 1.6
      - pruefen: |
          ['pickup', 'trap', 'checkpoint'].every(t => game.data.sprites.some(s => t in (s.traits ?? {})))
        meldung: Münze, Stacheln und Fahne sollten mit ihren Eigenschaften im Spiel sein

  - name: ausprobieren
    art: video
    titel: Ins Level und ausprobieren
    vorher:
      - klick: '#mi_level'
      - ansicht: [-1, -1, 16, 6]
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Münzen in eine Reihe malen, nr: 6, mehr: "Münze anklicken, Zeichnen auswählen und ziehen." }
      - klick: '#tool_menu_level .button[title^="Zeichnen"]'
      - klick: '#menu_level_sprites .button[title="Münze"]'
      - malen: [{ feld: [4, 1] }, { feld: [6, 1] }]
      - { hinweis: Die Fahne – hier geht's nach einem Treffer weiter, nr: 7 }
      - klick: '#menu_level_sprites .button[title="Fahne"]'
      - klick: { feld: [8, 1] }
      - { hinweis: Dahinter die Stacheln, nr: 8 }
      - klick: '#menu_level_sprites .button[title="Stacheln"]'
      - malen: [{ feld: [10, 1] }, { feld: [11, 1] }]
      - { hinweis: Testen – einsammeln und hineinlaufen, nr: 9, mehr: "Vorher Verschieben (Q) auswählen – dann setzt der Stift nichts aus Versehen. Oben rechts zählen die Punkte. Jede Berührung der Stacheln kostet Energie – ist sie aufgebraucht, ist ein Herz weg." }
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
      - { hinweis: Eine Taste – weiter an der Fahne, nr: 10, mehr: "Die Fahne war grün: Dort steht Pip wieder." }
      - taste: Space
      - warten: 1.4
      - taste: Escape
      - warten: 0.6
---
## Kurz gesagt

1. Rechtsklick bei den **Sprites** → **Sprites holen** öffnet den **Sprite-Katalog**. Was du anklickst, kommt in den Korb, **In mein Spiel holen** holt alles auf einmal.
2. Die Sprites aus dem Katalog haben ihre **Eigenschaften** schon: Die Münze kann man **einsammeln**, die Stacheln sind eine **Falle**, die Fahne ist ein **Checkpoint**.
3. Setz sie ins Level und probier es mit <kbd>T</kbd> aus.

## Aus dem Sprite-Katalog holen

![Sprites holen: Münze, Stacheln, Fahne](aufnahme:holen)

> **Tipp:** Die Sprites aus dem Katalog gehören jetzt dir. Du kannst sie im Sprite-Editor übermalen – oder dir von ihnen abschauen, wie man so etwas zeichnet.

## Ins Level und ausprobieren

![Münzen, Fahne und Stacheln ins Level, testen](aufnahme:ausprobieren)

Was die Eigenschaften im Spiel tun:

- **man kann es einsammeln** – es verschwindet und gibt Punkte (bei der Münze 10),
- **Falle** – jede Berührung kostet Energie (bei den Stacheln 25 von 100). Ist sie aufgebraucht, ist ein Leben weg,
- **Checkpoint** – berührt die Figur die Fahne, fängt sie nach einem verlorenen Leben dort wieder an.

Wie viele Leben man hat, steht unter **Einstellungen → Gesundheit**.

## Wenn's nicht klappt

- **Die Münze verschwindet nicht:** Die Münze liegt in einer Ebene ohne *Kollisionen erkennen*.
- **Pip läuft durch die Stacheln, ohne dass etwas passiert:** Den Stacheln fehlt die Eigenschaft **Falle** – oder sie liegen in einer Ebene ohne Kollisionen.
- **Nach einem Treffer fängt Pip ganz vorn an:** Er ist noch nicht an der Fahne vorbeigekommen.

## Mach mehr draus

Im Katalog gibt es noch viel mehr: Leitern, Türen, Schalter, Gegner. Die Rezepte [Münzen einsammeln](rezept:muenzen), [Stacheln und Fallen](rezept:stacheln) und [Checkpoints](rezept:checkpoint) zeigen, was du daran einstellen kannst. Als Nächstes: [Signale](rezept:signale) – ein Schalter öffnet ein Tor.
