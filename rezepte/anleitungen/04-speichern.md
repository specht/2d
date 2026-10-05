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
      - { hinweis: Titel und Autor eintippen, nr: 2 }
      - klick: '#game-settings-here .item:has-text("Titel") input'
      - tippen: Pips Abenteuer
      - klick: '#game-settings-here .item:has-text("Autor") input'
      - tippen: Mia
      - bewegen: { punkt: [800, 820] }
      - { hinweis: Strg + S – speichern, nr: 3 }
      - taste: Control+KeyS
      - warten: 1
      - { hinweis: Das ist der Code deines Spiels, nr: 4 }
      - bewegen: '#game_code'
      - pause: 2
      - pruefen: "/^[a-z0-9]{7}$/.test($('#game_code').text())"
        meldung: Nach dem Speichern steht kein Code da

  - name: laden
    art: video
    titel: Laden
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Strg + O – laden, nr: 5 }
      - taste: Control+KeyO
      - warten: 1
      - { hinweis: Dein Spiel anklicken, nr: 6 }
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

1. Klick oben auf **Einstellungen**.
2. Gib deinem Spiel einen **Titel** und schreib bei **Autor** deinen Namen hin. So findest du es später leichter.
3. Drück <kbd>Strg</kbd> + <kbd>S</kbd>. Unten rechts erscheint kurz ein Tier – das Zeichen, dass gespeichert wurde.
4. Unter **Link zum Spiel** steht jetzt der **Code** deines Spiels und ein Link. Mit dem Link können andere dein Spiel spielen.

> **Tipp:** Schreib dir den Code auf! Mit ihm findest du genau diesen Stand wieder.

## Laden

![Strg + O und ein Klick](aufnahme:laden)

5. <kbd>Strg</kbd> + <kbd>O</kbd> öffnet **Spiel laden**.
6. Klick auf dein Spiel – es ist sofort wieder da, mit allen Sprites und Leveln.

Hast du ein Spiel öfter gespeichert, steht bei **Versionen** ein Knopf. Dort kannst du auch einen älteren Stand laden.

## Alles auch in der Statusleiste

![Unten rechts: Rückgängig, Wiederholen, Laden, Speichern, Vollbild, Hilfe](aufnahme:statusleiste)

Unten rechts im Studio stehen die wichtigsten Knöpfe immer bereit – mit ihren Tasten, damit du sie dir merken kannst:

- <kbd>Strg</kbd> + <kbd>Z</kbd> **Rückgängig** und <kbd>Strg</kbd> + <kbd>Y</kbd> **Wiederholen**
- <kbd>Strg</kbd> + <kbd>O</kbd> **Laden** und <kbd>Strg</kbd> + <kbd>S</kbd> **Speichern**
- **Vollbild** – das Studio füllt den ganzen Bildschirm (auch mit <kbd>F11</kbd>)
- **Hilfe** – gedrückt halten (<kbd>H</kbd>): Jeder Knopf zeigt seine Taste.

## Wenn's nicht klappt

- **Strg + S tut nichts:** Steht der Cursor in einem Textfeld? Klick einmal daneben und drück noch einmal.
- **Ich finde mein Spiel nicht:** Hast du einen Titel eingetragen? Der Code steht unter *Einstellungen → Link zum Spiel*.
- **Der Browser ist abgestürzt:** Keine Sorge – das Studio hebt deine ungespeicherte Arbeit auf und bietet sie dir beim nächsten Öffnen wieder an.

## Mach mehr draus

Willst du von vorn anfangen? **Neues Spiel …** steht unter *Einstellungen → Spiel* und unten in *Spiel laden*. Weiter geht's mit [Signale: Schalter und Tor verbinden](rezept:signale).
