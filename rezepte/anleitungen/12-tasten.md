---
titel: Tasten im Spiel
kurz: Mit welchen Tasten man dein Spiel spielt – und wie du unter Einstellungen → Steuerung eigene festlegst.
start:
  eine_ebene: true
  szene:
    legende:
      P: { sprite: pip }
    karte: |
      .........H......
      .........HMMM...
      .........HMMM...
      .P.......HMMM...
      ################
aufnahmen:
  - name: spielen
    art: video
    titel: Die Tasten im Spiel
    vorher:
      - klick: '#mi_level'
      - ansicht: [-1, -1, 16, 7]
    ausschnitt: [0, 44, 1600, 856]
    standbild: 4
    schritte:
      - { hinweis: Die Maus auf Pip – T, nr: 1, mehr: "Der Test fängt dort an, wo die Maus ist." }
      - bewegen: { feld: [1, 1] }
      - taste: KeyT
      - warten: 0.8
      - { hinweis: → und ← – laufen, nr: 2, mehr: "Oder D und A." }
      - taste: ArrowRight
        halten: 0.6
      - { hinweis: Leertaste – springen, nr: 3 }
      - taste: Space
      - warten: 0.2
      - taste: ArrowRight
        halten: 1.4
      - warten: 0.3
      - { hinweis: ↑ – an der Leiter klettern, nr: 4, mehr: "Oder W. Mit ↓ (S) geht es wieder hinunter." }
      - taste: ArrowUp
        halten: 1.6
      - taste: ArrowRight
        halten: 0.5
      - warten: 0.5
      - { hinweis: R – noch einmal von vorn, nr: 5 }
      - taste: KeyR
      - warten: 1
      - { hinweis: Esc – zurück zum Level, nr: 6 }
      - taste: Escape
      - warten: 0.6

  - name: steuerung
    art: video
    titel: Eigene Tasten
    ausschnitt: [0, 44, 1600, 856]
    schritte:
      - { hinweis: Einstellungen – Steuerung, nr: 7, mehr: "Jede Aktion hat bis zu zwei Tasten." }
      - klick: '#mi_settings'
      - bewegen: { ziel: '.controls-settings', x: 0.5, y: 0.4 }
      - pause: 1.2
      - { hinweis: "Bei Springen: das + anklicken", nr: 8, mehr: "Dort steht dann „Taste drücken …“." }
      - klick: '.controls-row:has-text("Springen") .controls-key.empty'
      - pause: 0.6
      - { hinweis: Die neue Taste drücken – ↑, nr: 9, mehr: "Esc bricht ab, Entf entfernt eine Taste." }
      - taste: ArrowUp
      - pause: 0.8
      - { hinweis: Der Hinweis – doppelt belegt, nr: 10, mehr: "↑ ist auch für „Hoch (Leiter)“ belegt – die Taste tut dann beides. Willst du das nicht, wähl eine andere Taste." }
      - bewegen: { ziel: '.controls-warning', x: 0.4, y: 0.5 }
      - pause: 2
      - pruefen: "game.data.properties.controls?.jump?.includes('ArrowUp')"
        meldung: Springen sollte jetzt auch ↑ haben
      - { hinweis: Testen – ↑ springt, nr: 11 }
      - klick: '#mi_level'
      - bewegen: { feld: [1, 1] }
      - taste: KeyT
      - warten: 0.8
      - taste: ArrowUp
      - warten: 0.4
      - taste: ArrowRight
        halten: 0.8
      - warten: 0.4
      - taste: Escape
      - warten: 0.6
---
## Kurz gesagt

1. Man spielt mit den **Pfeiltasten** (oder <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>), springt mit der **Leertaste** und benutzt Türen, Schalter und Schilder mit <kbd>F</kbd>.
2. Unter **Einstellungen → Steuerung** legst du eigene Tasten fest: die Taste anklicken, dann die neue drücken.
3. **Standard-Tasten** stellt alles wieder so ein wie am Anfang.

## Die Tasten im Spiel

![Laufen, springen, klettern, neu starten](aufnahme:spielen)

| Taste | Im Spiel |
| --- | --- |
| <kbd>←</kbd> <kbd>→</kbd> oder <kbd>A</kbd> <kbd>D</kbd> | laufen |
| <kbd>Leertaste</kbd> | springen |
| <kbd>↑</kbd> <kbd>↓</kbd> oder <kbd>W</kbd> <kbd>S</kbd> | an Leitern klettern |
| <kbd>F</kbd> | Aktion: Tür, Schalter, Schild |
| <kbd>J</kbd> / <kbd>K</kbd> | Nahkampf / Fernkampf (wenn deine Figur das kann) |
| <kbd>.</kbd> | im Text sofort zum nächsten Satz |
| <kbd>R</kbd> | im Test: noch einmal von vorn |
| <kbd>Esc</kbd> | im Test: zurück zum Level |

## Eigene Tasten

![Einstellungen → Steuerung](aufnahme:steuerung)

> **Tipp:** Denk an die, die dein Spiel spielen: Die meisten erwarten die Pfeiltasten und die Leertaste. Eine zweite Taste dazu ist oft besser, als die alte zu ersetzen.

## Wenn's nicht klappt

- **Eine Taste lässt sich nicht belegen:** <kbd>Esc</kbd>, <kbd>F5</kbd>, <kbd>F11</kbd> und <kbd>F12</kbd> gehören dem Spiel oder dem Browser.
- **Die Taste tut im Spiel zwei Dinge:** Sie ist doppelt belegt – der Hinweis unter der Zeile sagt, womit.
- **Ich will alles wie vorher:** **Standard-Tasten** anklicken.

## Mach mehr draus

Das Rezept [Eigene Tasten festlegen](rezept:eigene-tasten) zeigt mehr dazu – zum Beispiel ein Spiel für zwei Hände: eine läuft, die andere kämpft. Und jetzt: Bau dein Spiel weiter – in der **Hilfe** findest du viele Rezepte zum Nachbauen.
