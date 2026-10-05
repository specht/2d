---
titel: Speichern und Laden
kurz: Mit Strg + S bekommt dein Spiel einen Code – mit Strg + O holst du es wieder.
start:
  eine_ebene: true
  szene:
    karte: |
      ..........
      .P....-...
      ##########
aufnahmen:
  - name: speichern
    art: video
    titel: Speichern
    ausschnitt: [0, 0, 1600, 862]
    standbild: 9
    schritte:
      - { hinweis: Oben auf „Einstellungen“ klicken, nr: 1 }
      - klick: '#mi_settings'
      - { hinweis: Titel und Autor eintippen, nr: 2, mehr: "Dein Name bei Autor – so findest du dein Spiel später leichter." }
      - klick: '#game-settings-here .item:has-text("Titel") input'
      - tippen: Pips Abenteuer
      - klick: '#game-settings-here .item:has-text("Autor") input'
      - tippen: Mia
      - bewegen: { punkt: [800, 820] }
      - { hinweis: Strg + S – speichern, nr: 3, mehr: "Unten rechts erscheint kurz ein Tier: Es ist gespeichert." }
      - taste: Control+KeyS
      - warten: 1
      - { hinweis: Das ist der Code deines Spiels, nr: 4, mehr: "Mit dem Link darunter können andere dein Spiel spielen." }
      - bewegen: '#game_code'
      - pause: 2
      - pruefen: "/^[a-z0-9]{7}$/.test($('#game_code').text())"
        meldung: Nach dem Speichern steht kein Code da

  - name: laden
    art: video
    titel: Laden
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Strg + O – laden, nr: 5, mehr: "Die Liste deiner Spiele." }
      - taste: Control+KeyO
      - warten: 1
      - { hinweis: Dein Spiel anklicken, nr: 6, mehr: "Es ist sofort wieder da, mit allen Sprites und Leveln." }
      - klick: { ziel: '#load_games_list tr:has-text("Pips Abenteuer")', x: 0.3 }
      - warten: 1.2
      - pruefen: "game.data.properties.title === 'Pips Abenteuer'"
        meldung: Das gespeicherte Spiel wurde nicht geladen

  - name: statusleiste
    art: bild
    ausschnitt: ['#status-bar .status-bar-general']
    rand: 4
---
## Kurz gesagt

1. <kbd>Strg</kbd> + <kbd>S</kbd> speichert dein Spiel. Es bekommt einen **Code** aus sieben Zeichen.
2. <kbd>Strg</kbd> + <kbd>O</kbd> öffnet die Liste deiner Spiele. Ein Klick lädt eins.
3. Speichere oft! Jedes Speichern ist eine neue **Version** – ältere gehen nicht verloren.

## Speichern

![Titel, Autor und Strg + S](aufnahme:speichern)

> **Tipp:** Schreib dir den Code auf! Mit ihm findest du genau diesen Stand wieder.

## Laden

![Strg + O und ein Klick](aufnahme:laden)

Hast du ein Spiel öfter gespeichert, steht bei **Versionen** ein Knopf. Dort kannst du auch einen älteren Stand laden.

## Alles auch in der Statusleiste

![Unten rechts: Rückgängig, Wiederholen, Laden, Speichern, Vollbild, Hilfe](aufnahme:statusleiste)

Unten rechts im Studio stehen die wichtigsten Knöpfe immer bereit – mit ihren Tasten, damit du sie dir merken kannst:

- <kbd>Strg</kbd> + <kbd>Z</kbd> **Rückgängig** und <kbd>Strg</kbd> + <kbd>Y</kbd> **Wiederholen**
- <kbd>Strg</kbd> + <kbd>O</kbd> **Laden** und <kbd>Strg</kbd> + <kbd>S</kbd> **Speichern**
- **Vollbild** – das Studio füllt den ganzen Bildschirm (auch mit <kbd>F11</kbd>)
- **Hilfe** – gedrückt halten (<kbd>H</kbd>): Jeder Knopf zeigt seine Taste.

## Wenn's nicht klappt

- **Ich finde mein Spiel nicht:** Hast du einen Titel eingetragen? Der Code steht unter *Einstellungen → Link zum Spiel*.
- **Der Browser ist abgestürzt:** Keine Sorge – das Studio hebt deine ungespeicherte Arbeit auf und bietet sie dir beim nächsten Öffnen wieder an.

## Mach mehr draus

Willst du von vorn anfangen? **Neues Spiel …** steht unter *Einstellungen → Spiel* und unten in *Spiel laden*. Weiter geht's mit [Signale: Schalter und Tor verbinden](rezept:signale).
