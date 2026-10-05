---
titel: Animieren
kurz: Ein zweites Bild, die Vorschau mit P – und ein Zustand fürs Laufen, damit deine Figur sich bewegt.
start:
  eine_ebene: true
  szene:
    legende:
      P: { sprite: pip_einfach }
    karte: |
      ......................
      .P....................
      ######################
aufnahmen:
  - name: huepfen
    art: video
    titel: Ein zweites Bild
    vorher:
      - klick: '#menu_sprites ._dnd_item:nth-child(1)'
    ausschnitt: [0, 44, 1600, 818]
    standbild: 7
    schritte:
      - { hinweis: Rechtsklick auf das Bild unten, nr: 1, mehr: "Unter der Zeichenfläche stehen die Frames – die Bilder der Animation. „Duplizieren“ macht ein zweites, gleiches Bild." }
      - rechtsklick: '#menu_frames ._dnd_item:nth-child(1)'
      - menue: Duplizieren
      - { hinweis: Sprite verschieben auswählen, nr: 2, mehr: "Bei den Werkzeugen: das Kreuz mit den Pfeilen." }
      - klick: '#tool_menu .button[title^="Sprite verschieben"]'
      - { hinweis: Mit Shift nach oben ziehen, nr: 3, mehr: "Mit Shift bewegt sich nur dieses Bild. Ohne Shift würden alle Frames mitwandern." }
      - ziehen: { von: { pixel: [12, 15] }, nach: { pixel: [12, 13] } }
        mit: Shift
      - { hinweis: P – die Vorschau, nr: 4, mehr: "Oben rechts hüpft Pip jetzt: erstes Bild, zweites Bild, erstes Bild …" }
      - taste: KeyP
      - warten: 2.4
      - { hinweis: "Framerate: wie schnell", nr: 5, mehr: "Bilder pro Sekunde. 4 ist gemütlich, 10 ist flott." }
      - klick: { ziel: '#menu_state_properties_fixed .item:has-text("Framerate") input' }
      - taste: Control+KeyA
        zeigen: false
      - tippen: "4"
      - taste: Enter
      - warten: 2.4
      - pruefen: "game.data.sprites[0].states[0].frames.length === 2 && Number(game.data.sprites[0].states[0].properties.fps) === 4"
        meldung: Der Zustand sollte zwei Frames und die Framerate 4 haben
    nachher:
      - taste: KeyP

  - name: laufen
    art: video
    titel: Ein Zustand fürs Laufen
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Rechtsklick auf den Zustand, nr: 6, mehr: "„Duplizieren“: Ein Zustand ist eine eigene Animation, zum Beispiel Stehen oder Laufen." }
      - rechtsklick: '#menu_states ._dnd_item:nth-child(1)'
      - menue: Duplizieren
      - { hinweis: "Titel: laufen", nr: 7, mehr: "Jeder Zustand bekommt gleich einen Namen – „stehen (Kopie)“ verwechselst du schnell. Ein Doppelklick auf den Zustand geht auch." }
      - klick: { ziel: '#menu_state_properties_fixed .item:has-text("Titel") input' }
      - taste: Control+KeyA
        zeigen: false
      - tippen: laufen
      - taste: Enter
      - { hinweis: "Rolle: Spielfigur → Laufen → rechts", nr: 8, mehr: "So weiß das Spiel, wann es diese Bilder zeigt. Nach links spiegelt es sie von selbst. Unten bei „Wer zeigt was?“ steht er jetzt bei Laufen." }
      - klick: '#menu_state_properties .item'
      - menue: [Spielfigur, Laufen, rechts]
      - { hinweis: "Framerate 10 – beim Laufen flott", nr: 9 }
      - klick: { ziel: '#menu_state_properties_fixed .item:has-text("Framerate") input' }
      - taste: Control+KeyA
        zeigen: false
      - tippen: "10"
      - taste: Enter
      - pause: 0.8
      - pruefen: "game.data.sprites[0].states.length === 2 && 'walk_right' in (game.data.sprites[0].states[1].traits.actor ?? {})"
        meldung: Der zweite Zustand sollte die Rolle „Laufen rechts“ haben
      - { hinweis: Im Level mit T testen, nr: 10, mehr: "Steht Pip, zeigt er den ersten Zustand. Läuft er, hüpft er schnell." }
      - klick: '#mi_level'
      - ansicht: [-1, -2, 14, 5]
      - bewegen: { feld: [1, 1] }
      - taste: KeyT
      - warten: 1.2
        bis: "document.getElementById('play_iframe').contentWindow.game?.running === true && !!document.getElementById('play_iframe').contentWindow.game.player_character"
        meldung: Der Test ist nicht losgegangen
      - taste: ArrowRight
        halten: 1.2
      - warten: 0.8
      - taste: Escape
      - warten: 0.6
---
## Kurz gesagt

1. Eine Animation ist eine Reihe von Bildern, den **Frames**. Rechtsklick auf ein Bild → **Duplizieren** macht das nächste.
2. Ändere im neuen Bild nur ein bisschen. <kbd>P</kbd> zeigt die **Vorschau**, die **Framerate** sagt, wie schnell sie läuft.
3. Für jede Bewegung gibt es einen **Zustand**: Stehen, Laufen, Springen … Mit **Rolle zuweisen** sagst du dem Spiel, wofür er ist.

## Ein zweites Bild

![Duplizieren, verschieben, Vorschau](aufnahme:huepfen)

> **Tipp:** Mit <kbd>O</kbd> (*Onion Skinning*) scheint das Bild davor rötlich durch – so siehst du, was sich von Bild zu Bild bewegt.

## Ein Zustand fürs Laufen

![Zustand duplizieren, Rolle zuweisen, testen](aufnahme:laufen)

Hier hüpft Pip beim Laufen nur. Echt sieht es aus, wenn du in jedem Frame die Beine ein bisschen anders malst: einmal vorn, einmal hinten. Genauso geht es mit **Springen** und **Fallen** – jeder Zustand mit seiner Rolle.

## Wenn's nicht klappt

- **Bei „Rolle zuweisen“ steht keine Spielfigur:** Das Sprite ist noch keine Spielfigur – siehe [Deine Spielfigur](rezept:spielfigur).
- **Beim Verschieben wandern alle Bilder mit:** Halt <kbd>Shift</kbd> gedrückt, während du ziehst. Sonst: <kbd>Strg</kbd> + <kbd>Z</kbd>.
- **Die Vorschau zeigt den falschen Zustand:** Sie zeigt immer den Zustand, den du gerade ausgewählt hast.

## Mach mehr draus

Das Rezept [Laufen, Springen und Fallen animieren](rezept:laufen-animieren) zeigt eine Figur mit allen Zuständen. Als Nächstes bekommt dein Level ein Ziel: [Ziel und mehrere Level](rezept:ziel-und-level).
