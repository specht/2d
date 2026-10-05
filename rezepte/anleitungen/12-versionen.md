---
titel: Versionen und Stammbaum
kurz: Jedes Speichern ist eine neue Version. In „Spiel laden“ suchst du nach Titel, Name oder Code – und der Stammbaum zeigt jeden Stand deines Spiels.
start:
  eine_ebene: true
  szene:
    karte: |
      ..........
      .P........
      ##########
aufnahmen:
  - name: suchen
    art: video
    titel: Suchen und eine ältere Version laden
    vorher:
      # what a class has saved before: two games of others, and Mia's game
      # in three versions (each with another level name, so each is new)
      - js: |
          (async () => {
            const save = () => new Promise((resolve, reject) => game.send_save(resolve, reject));
            const p = game.data.properties;
            const level = game.data.levels[0];
            level.properties ??= {};
            const codes = {};
            game.data.parent = null; p.title = 'Weltraum-Rennen'; p.author = 'Ben';
            codes.ben = await save();
            game.data.parent = null; p.title = 'Lavahöhle'; p.author = 'Ali';
            level.properties.name = 'Feuer';
            codes.ali1 = await save();
            level.properties.name = 'Feuer und Eis';
            codes.ali2 = await save();
            game.data.parent = null; p.title = 'Pips Abenteuer'; p.author = 'Mia';
            level.properties.name = 'Wiese';
            codes.v1 = await save();
            level.properties.name = 'Wiese mit Leiter';
            codes.v2 = await save();
            level.properties.name = 'Wiese mit Münzen';
            codes.v3 = await save();
            window.anleitung_codes = codes;
            game._load();
          })()
      - klick: '#mi_level'
    ausschnitt: [0, 0, 1600, 862]
    standbild: 6
    schritte:
      - { hinweis: Strg + O – Spiel laden, nr: 1, mehr: "Die Liste zeigt die neueste Version jedes Spiels, die neuesten oben." }
      - taste: Control+KeyO
      - warten: 0.6
        bis: "document.querySelectorAll('#load_games_list tr[data-tag]').length === 3"
        meldung: In der Liste sollten drei Spiele stehen
      - pause: 0.8
      - { hinweis: "Ins Suchfeld tippen: Mia", nr: 2, mehr: "Gesucht wird in Titel, Autor und Code. Groß oder klein ist egal." }
      - klick: '#ti_load_games_search'
      - tippen: Mia
      - pause: 1
      - pruefen: "document.querySelectorAll('#load_games_list tr[data-tag]').length === 1"
        meldung: Die Suche sollte nur Mias Spiel übrig lassen
      - { hinweis: „3 Versionen“ anklicken, nr: 3, mehr: "Mia hat dreimal gespeichert. Jedes Speichern ist eine eigene Version mit eigenem Code." }
      - klick: '#load_games_list .game-list-versions'
      - warten: 0.6
        bis: "document.querySelectorAll('#games_sublist_graph g.family-node').length === 3"
        meldung: Der Stammbaum sollte drei Versionen zeigen
      - { hinweis: Der Stammbaum, nr: 4, mehr: "Jeder Punkt ist eine Version – links die erste, rechts die neueste. Die Maus auf einem Punkt zeigt Code und Datum." }
      - bewegen: '#games_sublist_graph g.family-node:nth-of-type(3) circle'
      - pause: 0.8
      - bewegen: '#games_sublist_graph g.family-node:nth-of-type(2) circle'
      - pause: 0.8
      - { hinweis: Die erste Version anklicken, nr: 5, mehr: "Unten steht jetzt diese Version mit allen davor – bei der ersten ist das nur sie selbst." }
      - klick: '#games_sublist_graph g.family-node:nth-of-type(1) circle'
      - pause: 1
      - pruefen: "$('#load_games_sublist tr[data-tag]').length === 1 && $('#load_games_sublist tr[data-tag]').data('tag') === window.anleitung_codes.v1"
        meldung: Unten sollte nur die erste Version stehen
      - { hinweis: Die Zeile anklicken – geladen, nr: 6, mehr: "Das Level heißt wieder „Wiese“: Das ist der Stand von damals." }
      - klick: { ziel: '#load_games_sublist tr[data-tag]', x: 0.3 }
      - warten: 1.2
        bis: "game.data.parent === window.anleitung_codes.v1 && game.data.levels[0].properties.name === 'Wiese'"
        meldung: Die erste Version wurde nicht geladen
      - pause: 1

  - name: abzweigen
    art: video
    titel: Ein neuer Zweig
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Weiterbauen – zum Beispiel ein zweites Level, nr: 7, mehr: "Rechtsklick auf das Level, Duplizieren." }
      - rechtsklick: '#menu_levels ._dnd_item:nth-child(1)'
      - menue: Duplizieren
      - pause: 0.6
      - { hinweis: Strg + S – speichern, nr: 8, mehr: "Die neue Version hängt an der ersten. Version 2 und 3 bleiben, wie sie sind." }
      - taste: Control+KeyS
      - warten: 0.6
        bis: "/^[a-z0-9]{7}$/.test($('#game_code').text()) && !Object.values(window.anleitung_codes).includes($('#game_code').text())"
        meldung: Nach dem Speichern steht kein neuer Code da
      - pause: 0.6
      - { hinweis: Strg + O – „4 Versionen“, nr: 9, mehr: "Die Suche ist noch da. Ein Wort tippen ersetzt sie." }
      - taste: Control+KeyO
      - warten: 0.6
        bis: "$('#load_games_list .game-list-versions:contains(\"4 Versionen\")').length === 1"
        meldung: Mias Spiel sollte jetzt vier Versionen haben
      - klick: '#load_games_list .game-list-versions'
      - warten: 0.6
        bis: "document.querySelectorAll('#games_sublist_graph g.family-node').length === 4"
        meldung: Der Stammbaum sollte vier Versionen zeigen
      - { hinweis: Zwei Zweige, nr: 10, mehr: "Oben der neue Zweig mit zwei Leveln, darunter die alten Versionen 2 und 3. Nichts geht verloren." }
      - bewegen: '#games_sublist_graph g.family-node:nth-of-type(2) circle'
      - pause: 1
      - bewegen: '#games_sublist_graph g.family-node:nth-of-type(4) circle'
      - pause: 1
      - pruefen: |
          (() => {
            const ys = [...document.querySelectorAll('#games_sublist_graph g.family-node circle')].map(c => c.getAttribute('cy'));
            return new Set(ys).size === 2;
          })()
        meldung: Der Stammbaum sollte zwei Zweige haben
      - { hinweis: Abbrechen – zurück ins Studio, nr: 11 }
      - klick: '.modal:visible .modal-footer button:has-text("Abbrechen")'
      - pause: 0.6

  - name: code
    art: video
    titel: Mit dem Code laden
    ausschnitt: [0, 0, 1600, 862]
    schritte:
      - { hinweis: Strg + O – den Code ins Suchfeld, nr: 12, mehr: "Mit einem Code holst du genau diesen Stand – auch eine ältere Version, die die Liste nicht zeigt." }
      - taste: Control+KeyO
      - warten: 0.6
      - tippen: { js: "window.anleitung_codes.v3" }
      - warten: 0.4
        bis: "$('#load_games_code button.green').length === 1"
        meldung: Zum Code erscheint kein Laden-Knopf
      - pause: 1
      - { hinweis: Enter – geladen, nr: 13, mehr: "Oder auf Laden klicken." }
      - taste: Enter
      - warten: 1.2
        bis: "game.data.parent === window.anleitung_codes.v3"
        meldung: Die Version mit dem Code wurde nicht geladen
      - pause: 1
---
## Kurz gesagt

1. Jedes Mal, wenn du speicherst, entsteht eine neue **Version** mit einem eigenen **Code**. Ältere Versionen gehen nie verloren.
2. In **Spiel laden** (<kbd>Strg</kbd> + <kbd>O</kbd>) steht die neueste Version jedes Spiels. Das **Suchfeld** findet Spiele nach Titel, Name oder Code.
3. Der Knopf **Versionen** zeigt den **Stammbaum**: jeden gespeicherten Stand als Punkt. Klick einen an – eine Zeile darunter anklicken lädt ihn.
4. Lädst du eine ältere Version und speicherst, entsteht ein neuer **Zweig**.
5. Ein **Code** im Suchfeld lädt genau diesen Stand – mit <kbd>Enter</kbd>.

## Suchen und eine ältere Version laden

![Suchen, Stammbaum, die erste Version laden](aufnahme:suchen)

## Ein neuer Zweig

![Weiterbauen, speichern, zwei Zweige](aufnahme:abzweigen)

So kannst du ausprobieren, ohne Angst zu haben: Geht etwas schief, lädst du einfach eine frühere Version und baust von dort weiter.

## Mit dem Code laden

![Code eintippen, Enter](aufnahme:code)

Den Code deines Spiels findest du nach dem Speichern unter **Einstellungen → Link zum Spiel**. Ein ganzer Link zum Spiel geht im Suchfeld übrigens auch.

> **Tipp:** Gib deinem Spiel einen **Titel** und dich als **Autor** an (**Einstellungen**) – dann findest du es mit der Suche sofort. Auch nach einem alten Titel kannst du suchen.

## Wenn's nicht klappt

- **Mein Spiel ist nicht in der Liste:** Tipp deinen Namen oder einen Teil des Titels ins Suchfeld. Steht dort noch ein altes Suchwort? Lösch es.
- **„Ein Spiel mit dem Code gibt es nicht“:** Prüf jedes Zeichen – 0 und o, 1 und l sehen sich ähnlich.
- **Im Stammbaum fehlen Punkte:** Bei Spielen mit sehr vielen Versionen werden lange gerade Strecken zusammengefasst; die Zahl über der Linie sagt, wie viele Versionen dazwischen liegen. Unten in der Tabelle stehen trotzdem alle.

## Mach mehr draus

Speichere oft – jede Version ist ein Rettungspunkt. Mit dem Code kann auch jemand anders deine Bilder in sein Spiel holen: siehe [Speichern, laden, teilen](rezept:speichern). Und jetzt: Bau dein Spiel weiter – in der **Hilfe** findest du viele Rezepte zum Nachbauen, zum Beispiel [Eigene Tasten festlegen](rezept:eigene-tasten).
