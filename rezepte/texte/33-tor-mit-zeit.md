---
titel: Ein Tor, das nur kurz offen bleibt
kategorie: Türen & Schlüssel
stufe: 2
skala: 2
kurz: Pip legt einen Schalter um, rennt los – und hinter ihm fährt das Gittertor wieder herunter.
szene:
  legende:
    S: { sprite: schalter, platziert: { switch: { signal_code: 3 } } }
    G: { sprite: gittertor, platziert: { door: { signal_code: 3, door_reaction: open, close_after: 1.5 } } }
  karte: |
    .......M..
    .......M..
    .......M..
    .......M..
    .P.S...G..
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.25 }
  - { t: 0.8, drücken: aktion }
  - { t: 1.4, halten: rechts, dauer: 0.75 }
dauer: 4.6
standbild: 2.0
erwartet:
  signale: ['3 an']
  figur_rechts_von: 8
  tuer_offen: false
  lebt: true
---
## Kurz gesagt

1. Ein **Schalter** öffnet ein Tor – wie in *Ein Schalter öffnet das Tor*.
2. Beim Tor stellst du **schließt wieder nach** ein, zum Beispiel **1,5 s**.
3. Im Spiel: Schalter umlegen und schnell sein – danach geht das Tor von selbst wieder zu.

## Das brauchst du

- **Das musst du zeichnen:** einen Schalter in zwei Zuständen (aus und an) und ein Tor (geschlossen und geöffnet).
- **Das kannst du später dazumalen:** einen **Übergang**, in dem das Tor hoch- und wieder herunterfährt.

![Das Gitter fährt hoch](katalog:welt/gitter_uebergang 10)

## Schritt für Schritt

1. Bau zuerst ein Tor, das ein Schalter öffnet: Tor mit **ist verschließbar** und **automatische Tür**, Schalter und Tor mit demselben **Code**, beim Tor unter **Bei Signal** **öffnen**. (Genauer steht es in *Ein Schalter öffnet das Tor*.)
2. Klicke im **Level** auf das Tor.
3. Trag bei **schließt wieder nach** ein, wie viele Sekunden das Tor offen bleibt, z. B. **1,5**.
4. Teste mit **Level testen** (Taste T): Schaffst du es durch das Tor? Ist es zu leicht, nimm weniger Sekunden – ist es zu schwer, mehr.

Die Zeit läuft ab dem Moment, in dem das Tor **ganz offen** ist. Bei **0** bleibt das Tor offen, wie bisher.

> **Achtung:** Auch **schließt wieder nach** stellst du am **platzierten** Tor im Level ein. So kann dieselbe Zeichnung einmal ein normales Tor sein und einmal eines, das schnell wieder zugeht.

## Tipps

- Niemand wird eingeklemmt: Steht die Spielfigur oder ein Gegner gerade **in** dem Tor, wartet es, bis der Weg frei ist.
- Eine **automatische Tür** bleibt offen, solange die Spielfigur davorsteht. Die Zeit läuft erst los, wenn sie weggeht.
- Das Tor geht auch dann wieder zu, wenn es sich sonst gar nicht schließen lässt – egal, ob ein Schalter, eine Druckplatte, ein Schlüssel oder die Spielfigur es geöffnet hat.
- **Verzögerung:** Schalter, Druckplatten, Schlüssel, Bereiche und Gegner können ihren Code auch erst später senden. Klicke im Level auf den Sender und stell **Verzögerung** ein. Eine Druckplatte mit **1 s** Verzögerung lässt eine Brücke (Ebene mit **verschwindet**) erst kurz nach dem Drauftreten einstürzen.

## Wenn's nicht klappt

- **Das Tor bleibt offen:** Bei **schließt wieder nach** steht **0**, oder du hast den Wert bei einem anderen Tor eingetragen.
- **Das Tor geht nicht zu, obwohl die Zeit um ist:** Die Spielfigur oder ein Gegner steht noch im Tor – oder die Figur steht noch direkt vor einer automatischen Tür.
- **Das Tor geht gar nicht erst auf:** Siehe *Ein Schalter öffnet das Tor* – meist sind die Codes verschieden.

## Mach mehr draus

Stell den Schalter weit weg vom Tor oder hinter ein paar Sprünge. Oder bau mehrere Tore hintereinander mit verschiedenen Zeiten – das letzte schließt am schnellsten.
