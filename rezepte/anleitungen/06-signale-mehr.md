---
titel: "Signale: mehr Tore, Verzögerung, aufräumen"
kurz: Ein Signal für zwei Tore, ein Tor, das erst später aufgeht – und wie du eine Verbindung wieder löst.
start:
  eine_ebene: true
  szene:
    signale: { 1: Tor auf }
    legende:
      S: { sprite: schalter, platziert: { switch: { signal_code: 1 } } }
      G: { sprite: gittertor, platziert: { door: { signal_code: 1, door_reaction: open } } }
      K: { sprite: gittertor, platziert: { door: { signal_code: null } } }
    karte: |
      .......M...M..
      .......M...M..
      .......M...M..
      .......M...M..
      .P.S...G...K.M
      ##############
aufnahmen:
  - name: zweites-tor
    art: video
    titel: Ein Signal für zwei Tore
    vorher:
      - klick: '#mi_level'
      - ansicht: [-1, -1, 13, 5]
      - taste: KeyS
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Auswählen (E) und das zweite Tor anklicken, nr: 1 }
      - klick: '#tool_menu_level .button[title^="Auswählen"]'
      - klick: { feld: [11, 1] }
      - { hinweis: "Neben Code: das Signal aus der Liste wählen", nr: 2 }
      - klick: '#menu_placed_properties .signal-code-pick'
      - pause: 1
      - menue: Tor auf · 1
      - { hinweis: "Bei Signal: öffnen", nr: 3 }
      - klick: { ziel: '#menu_placed_properties .item:has-text("Bei Signal")', x: 0.85 }
      - pause: 0.8
      - menue: öffnen
      - { hinweis: Die Übersicht zählt mit, nr: 4 }
      - bewegen: { ziel: '.signal-overview .signal-rule', x: 0.6, y: 0.6 }
      - pause: 1.8
      - pruefen: |
          game.data.levels[0].layers[0].sprites.filter(p => p[3]?.door?.signal_code === 1 && p[3].door.door_reaction === 'open').length === 2
        meldung: Beide Tore sollten auf „Tor auf“ mit „öffnen“ reagieren

  - name: verzoegerung
    art: video
    titel: Verzögerung
    ausschnitt: [0, 44, 1600, 818]
    standbild: 9
    schritte:
      - { hinweis: Den Schalter anklicken, nr: 5 }
      - klick: { feld: [3, 1] }
      - { hinweis: Verzögerung – in Sekunden, nr: 6 }
      - klick: { ziel: '#menu_placed_properties .item:has-text("Verzögerung") input' }
      - taste: Control+KeyA
        zeigen: false
      - tippen: "1.5"
      - taste: Enter
      - klick: '#placed_properties_title'
      - bewegen: { feld: [5, 3] }
      - pause: 1.5
      - { hinweis: "Testen: Maus auf den Schalter, T, dann F", nr: 7 }
      - bewegen: { feld: [3, 1] }
      - taste: KeyT
      - bewegen: { punkt: [1420, 640] }
      - warten: 0.8
      - taste: KeyF
      - warten: 2.2
      - taste: ArrowRight
        halten: 1.3
      - warten: 0.6
      - pruefen: "document.getElementById('play_iframe').contentWindow.game.signals.sent.length > 0"
        meldung: Im Test kam kein Signal an
      - { hinweis: Esc – zurück zum Level, nr: 8 }
      - taste: Escape
      - warten: 0.6
    ende: 0.8

  - name: loesen
    art: video
    titel: Eine Verbindung lösen
    ausschnitt: [0, 44, 1600, 818]
    schritte:
      - { hinweis: Das zweite Tor anklicken, nr: 9 }
      - klick: { feld: [11, 1] }
      - { hinweis: "Neben Code: Kein Signal", nr: 10 }
      - klick: '#menu_placed_properties .signal-code-pick'
      - pause: 0.8
      - menue: Kein Signal
      - bewegen: { ziel: '.signal-overview .signal-rule', x: 0.6, y: 0.6 }
      - pause: 1.5
      - { hinweis: Strg + Z holt die Verbindung zurück, nr: 11 }
      - taste: Control+KeyZ
      - pause: 1.5
      - pruefen: |
          game.data.levels[0].layers[0].sprites.filter(p => p[3]?.door?.signal_code === 1).length === 2
        meldung: Strg + Z hat die Verbindung nicht zurückgeholt
---
## Kurz gesagt

1. Mehrere Empfänger können auf **dasselbe Signal** hören: Wähl es neben **Code** aus der Liste.
2. Eine **Verzögerung** am Sender lässt das Signal erst ein paar Sekunden später ankommen.
3. **Kein Signal** in derselben Liste löst eine Verbindung wieder. <kbd>Strg</kbd> + <kbd>Z</kbd> holt sie zurück.

## Das brauchst du

Einen Schalter, der schon ein Tor öffnet – so wie am Ende von [Signale: Schalter und Tor verbinden](rezept:signale). Dahinter steht ein zweites Tor, das noch auf nichts hört.

## Ein Signal für zwei Tore

![Das zweite Tor bekommt dasselbe Signal](aufnahme:zweites-tor)

1. Nimm **Auswählen** (<kbd>E</kbd>) und klick auf das zweite Tor.
2. Klick rechts neben **Code** auf den Knopf (*kein Signal*). Die Liste zeigt alle Signale dieses Levels mit ihren Namen. Wähl **Tor auf**.
3. Stell **Bei Signal** auf **öffnen**.
4. In der Signale-Übersicht steht jetzt *öffnet sich »Gittertor« (2×)*: Beide Tore hören auf denselben Schalter.

> **Tipp:** Du kannst auch wieder **Verbinden** (<kbd>R</kbd>) nehmen: Schalter anklicken, dann das zweite Tor. Hat der Schalter schon ein Signal, bekommt das Tor genau dieses.

## Verzögerung

![Das Signal kommt 1,5 Sekunden später an](aufnahme:verzoegerung)

5. Klick auf den Schalter.
6. Tipp bei **Verzögerung** eine Zahl ein, zum Beispiel **1.5**, drück <kbd>Enter</kbd> und klick einmal neben das Feld. Auf der Linie steht jetzt **⏱ 1,5 s**, und die Übersicht sagt *kommt nach 1,5 s an*.
7. Teste es: Maus auf den Schalter, <kbd>T</kbd>, dann <kbd>F</kbd>. Der Schalter springt sofort um, die Tore gehen aber erst nach 1,5 Sekunden auf.
8. <kbd>Esc</kbd> bringt dich zurück zum Level.

Damit baust du Fallen, die kurz nach dem Betreten zuschnappen, oder ein Tor, zu dem man nach dem Umlegen erst hinrennen muss.

## Eine Verbindung lösen

![Kein Signal – und Strg + Z](aufnahme:loesen)

9. Klick auf das Tor, das nicht mehr reagieren soll.
10. Wähl neben **Code** den Eintrag **Kein Signal**. Das Tor hört auf nichts mehr, und die Übersicht zeigt nur noch das erste Tor.
11. Doch falsch? <kbd>Strg</kbd> + <kbd>Z</kbd> macht es rückgängig.

> **Tipp:** In der Signale-Übersicht hat jede Zeile beim Darüberfahren ein **×** (nimmt genau das aus dem Signal heraus), und jede Karte einen Mülleimer (löst das ganze Signal auf).

## Wenn's nicht klappt

- **„Tor auf“ steht nicht in der Liste:** Die Liste zeigt nur Signale aus *diesem* Level. Signale gehen nicht von einem Level ins andere.
- **Das zweite Tor geht im Spiel nicht auf:** Schau bei **Bei Signal**. Steht dort **aufschließen**, wartet das Tor, bis die Figur davorsteht.
- **Die Verzögerung wirkt nicht:** Sie gehört zum **Sender** (dem Schalter), nicht zum Tor.
- **T startet keinen Test, und im Feld steht plötzlich ein Buchstabe:** Das Feld hatte noch den Cursor – deine Tasten landen dann im Feld. Klick einmal daneben, dann geht es.

## Mach mehr draus

Signale können noch viel mehr: Ebenen erscheinen lassen, Schilder sprechen lassen, Schalter zählen. Schau in die Rezepte unter **Signale**, zum Beispiel [Ein Tor, das nur kurz offen bleibt](rezept:tor-mit-zeit) oder [Erst alle drei Schalter](rezept:zaehler).
