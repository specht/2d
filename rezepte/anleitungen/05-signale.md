---
titel: "Signale: Schalter und Tor verbinden"
kurz: Ein Schalter sendet ein Signal, ein Tor reagiert darauf. Mit dem Werkzeug Verbinden ist das in drei Klicks gemacht.
start:
  eine_ebene: true
  szene:
    legende:
      S: { sprite: schalter, platziert: { switch: { signal_code: null } } }
      G: { sprite: gittertor, platziert: { door: { signal_code: null } } }
    karte: |
      .......M..
      .......M..
      .......M..
      .......M..
      .P.S...G..
      ##########
aufnahmen:
  - name: verbinden
    art: video
    titel: Verbinden
    vorher:
      - klick: '#mi_level'
      - ansicht: [-1, -1, 10, 5]
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Das Werkzeug Verbinden nehmen (R), nr: 1 }
      - klick: '#tool_menu_level .button[title^="Verbinden"]'
      - { hinweis: "Zuerst, was sendet: der Schalter", nr: 2 }
      - klick: { feld: [3, 1] }
      - { hinweis: "Dann, was reagiert: das Tor", nr: 3 }
      - klick: { feld: [7, 1] }
      - pause: 0.8
      - { hinweis: Dem Signal einen Namen geben – Enter, nr: 4 }
      - tippen: Tor auf
      - taste: Enter
      - bewegen: { feld: [5, 3] }
      - pause: 1
      - pruefen: |
          (() => {
            const sprites = game.data.levels[0].layers[0].sprites;
            const sw = sprites.find(p => p[3]?.switch), door = sprites.find(p => p[3]?.door);
            const code = sw?.[3].switch.signal_code;
            return code != null && door?.[3].door.signal_code === code && game.data.levels[0].properties.signal_names?.[code] === 'Tor auf';
          })()
        meldung: Schalter und Tor haben nicht dasselbe Signal „Tor auf“

  - name: uebersicht
    art: video
    titel: Die Signale-Übersicht
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: S zeigt alle Signale des Levels, nr: 5 }
      - taste: KeyS
      - bewegen: { ziel: '.signal-overview .signal-rule', x: 0.5, y: 0.5 }
      - pause: 1.5
      - { hinweis: Auswählen (E) und das Tor anklicken, nr: 6 }
      - klick: '#tool_menu_level .button[title^="Auswählen"]'
      - klick: { feld: [7, 1] }
      - bewegen: '#menu_placed_properties .signal-code-pick'
      - pause: 1
      - { hinweis: Bei Signal – was das Tor dann tut, nr: 7 }
      - klick: { ziel: '#menu_placed_properties .item:has-text("Bei Signal")', x: 0.85 }
      - pause: 1.5
      - menue: öffnen
      - pause: 0.6

  - name: testen
    art: video
    titel: Testen
    ausschnitt: [0, 44, 1600, 818]
    standbild: 4
    schritte:
      - { hinweis: "Die Maus auf den Schalter, dann T", nr: 8 }
      - bewegen: { feld: [3, 1] }
      - taste: KeyT
      - bewegen: { punkt: [1420, 640] }
      - warten: 0.8
      - { hinweis: F legt den Schalter um, nr: 9 }
      - taste: KeyF
      - warten: 0.8
      - { hinweis: Das Tor geht auf – und die Regel leuchtet auf, nr: 10 }
      - taste: ArrowRight
        halten: 0.6
      - warten: 0.8
      - pruefen: "document.getElementById('play_iframe').contentWindow.game.signals.sent.length > 0"
        meldung: Im Test kam kein Signal an
      - { hinweis: Esc – zurück zum Level, nr: 11 }
      - taste: Escape
      - warten: 0.6
    ende: 0.8
---
## Kurz gesagt

1. Ein **Signal** verbindet zwei Dinge im Level: eins **sendet**, eins **reagiert**.
2. Nimm das Werkzeug **Verbinden** (<kbd>R</kbd>), klick erst den Schalter an, dann das Tor.
3. Gib dem Signal einen **Namen** – zum Beispiel *Tor auf*.
4. Mit <kbd>S</kbd> siehst du alle Signale als Regeln: *Wenn … dann …*

## Was ist ein Signal?

Stell dir eine unsichtbare Leitung vor. Am einen Ende sitzt ein **Sender**: ein Schalter, eine Druckplatte, ein Schlüssel, ein Signalbereich oder ein Gegner, der besiegt wird. Am anderen Ende sitzt ein **Empfänger**: eine Tür, ein Tor, eine ganze Ebene, ein Schild, das spricht. Wenn der Sender etwas tut, reagiert der Empfänger.

Jedes Signal hat eine Nummer, den **Code**. Was denselben Code hat, gehört zusammen. Damit du dir keine Nummern merken musst, gibst du dem Signal einen Namen.

## Verbinden

![Mit dem Werkzeug Verbinden: Schalter, Tor, Name](aufnahme:verbinden)

1. Nimm bei den Werkzeugen **Verbinden** (<kbd>R</kbd>).
2. Klick zuerst auf das, was **sendet** – hier den Schalter.
3. Klick dann auf das, was **reagieren** soll – das Tor. Eine gestrichelte Linie zeigt die Verbindung.
4. Tipp einen Namen ein und drück <kbd>Enter</kbd>. Mit <kbd>Esc</kbd> bleibt das Signal ohne Namen.

## Die Signale-Übersicht

![Die Übersicht und die Einstellungen des Tors](aufnahme:uebersicht)

5. <kbd>S</kbd> öffnet rechts die **Signale-Übersicht**. Jedes Signal ist eine Karte mit einem Satz: *Wenn »Schalter« umgelegt wird, dann öffnet sich »Gittertor«*. Fährst du mit der Maus über eine Karte, siehst du nur ihre Linien.
6. Nimm **Auswählen** (<kbd>E</kbd>) und klick auf das Tor. Rechts unter **Auswahl** steht sein **Code** mit dem Namen des Signals.
7. **Bei Signal** sagt, was das Tor tut, wenn das Signal kommt:
   - **öffnen** – es geht auf und bleibt offen,
   - **offen, solange an** – es ist offen, solange der Schalter an ist,
   - **wechseln** – jedes Umlegen macht es auf oder zu,
   - **schließen** – es geht zu,
   - **aufschließen** – es wartet, bis die Figur davorsteht (wie mit einem Schlüssel).

## Testen

![Im Test leuchtet die Regel auf](aufnahme:testen)

8. Halt die Maus über den Schalter und drück <kbd>T</kbd>. Der Test beginnt genau dort, wo die Maus ist – die Figur steht gleich am Schalter.
9. Drück <kbd>F</kbd>: Die Figur legt den Schalter um.
10. Das Tor geht auf. Ist die Übersicht an, steht sie neben dem Spiel: Die Karte leuchtet auf, sobald ihr Signal ankommt, und zeigt **an** oder **aus**.

11. <kbd>Esc</kbd> bringt dich zurück zum Level.

> **Tipp:** Leuchtet im Test keine Karte auf, kommt das Signal gar nicht an – dann liegt es am Sender. Leuchtet sie, aber nichts passiert, schau beim Empfänger unter **Bei Signal**.

## Wenn's nicht klappt

- **Beim Klicken mit Verbinden passiert nichts:** Der Schalter liegt vielleicht in einer anderen Ebene. Verbinden findet ihn trotzdem – aber nur, wenn die Ebene sichtbar ist (das Auge bei *Ebenen*).
- **Über dem Schalter erscheint im Spiel kein F:** Dem Sprite fehlt die Eigenschaft **Schalter → ist ein Schalter**.
- **Die Karte sagt „noch nichts reagiert darauf“:** Der Empfänger hat ein anderes Signal. Verbinde die beiden noch einmal.

## Mach mehr draus

Weiter geht's mit [Signale: mehr Tore, Verzögerung, aufräumen](rezept:signale-mehr). Fertige Beispiele zum Öffnen findest du in den Rezepten unter **Signale**, zum Beispiel [Ein Schalter öffnet das Tor](rezept:schalter).
