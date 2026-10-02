---
titel: Ein Tor, das nur kurz offen bleibt
kategorie: Türen & Schlüssel
stufe: 2
skala: 2
kurz: Pip tritt auf eine Druckplatte, rennt los – und hinter ihm fährt das Gittertor wieder herunter.
szene:
  legende:
    p: { sprite: druckplatte, platziert: { pressure_plate: { signal_code: 3 } } }
    G: { sprite: gittertor, platziert: { door: { signal_code: 3, door_reaction: open, close_after: 1.5 } } }
  karte: |
    .......M..
    .......M..
    .......M..
    .......M..
    .P.p...G..
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.25 }
  - { t: 1.0, halten: rechts, dauer: 0.75 }
dauer: 4.4
standbild: 1.4
erwartet:
  signale: ['3 an', '3 aus']
  figur_rechts_von: 8
  tuer_offen: false
  lebt: true
---
## Kurz gesagt

1. Eine **Druckplatte** öffnet ein Tor, sobald die Spielfigur darauftritt.
2. Beim Tor stellst du **schließt wieder nach** ein, zum Beispiel **1,5 s**.
3. Im Spiel: auf die Platte treten und schnell sein – danach geht das Tor von selbst wieder zu.

## Das brauchst du

- **Das musst du zeichnen:** eine Druckplatte in zwei Zuständen (oben und gedrückt) und ein Tor (geschlossen und geöffnet).
- **Das kannst du später dazumalen:** einen **Übergang**, in dem das Tor hoch- und wieder herunterfährt.

![Druckplatte oben](katalog:welt/druckplatte_oben) ![Druckplatte gedrückt](katalog:welt/druckplatte_unten)

![Das Gitter fährt hoch](katalog:welt/gitter_uebergang 10)

## Schritt für Schritt

1. Zeichne die Druckplatte (**Eigenschaft hinzufügen → Schalter → ist eine Druckplatte**) und das Tor (**ist eine Tür**, mit **ist verschließbar** und **automatische Tür**). Wie das geht, steht in *Eine Druckplatte baut eine Brücke* und *Ein Schalter öffnet das Tor*.
2. Setz beide ins **Level**. Die Druckplatte hat schon einen eigenen **Code** bekommen – gib dem Tor denselben (oder verbinde beide mit dem Werkzeug **Verbinden**, Taste R).
3. Klicke auf das Tor und wähle unter **Bei Signal** **öffnen**.
4. Trag bei **schließt wieder nach** ein, wie viele Sekunden das Tor offen bleibt, z. B. **1,5**.
5. Teste mit **Level testen** (Taste T): Schaffst du es durch das Tor? Ist es zu leicht, nimm weniger Sekunden – ist es zu schwer, mehr.

Die Zeit läuft ab dem Moment, in dem das Tor **ganz offen** ist. Bei **0** bleibt das Tor offen, wie bisher.

> **Achtung:** Nimm bei **Bei Signal** wirklich **öffnen**, nicht **offen, solange an**. Sonst geht das Tor schon wieder zu, sobald die Figur von der Platte heruntersteigt. Mit **öffnen** reagiert das Tor nur auf das Drauftreten, und die Uhr bestimmt, wann es zugeht.

> **Tipp:** Auch **schließt wieder nach** stellst du am **platzierten** Tor im Level ein. So kann dieselbe Zeichnung einmal ein normales Tor sein und einmal eines, das schnell wieder zugeht.

## Tipps

- Jedes Mal, wenn die Figur wieder auf die Platte tritt, geht das Tor wieder auf.
- Niemand wird eingeklemmt: Steht die Spielfigur oder ein Gegner gerade **in** dem Tor, wartet es, bis der Weg frei ist.
- Eine **automatische Tür** bleibt offen, solange die Spielfigur davorsteht. Die Zeit läuft erst los, wenn sie weggeht.
- Ein **Schalter** passt hier weniger gut: Er bleibt auf „an“ stehen, auch wenn das Tor längst wieder zu ist, und man müsste ihn zweimal umlegen, bis das Tor wieder aufgeht.
- **Verzögerung:** Schalter, Druckplatten, Schlüssel, Bereiche und Gegner können ihren Code auch erst später senden. Klicke im Level auf den Sender und stell **Verzögerung** ein. Eine Druckplatte mit **1 s** Verzögerung lässt eine Brücke (Ebene mit **verschwindet**) erst kurz nach dem Drauftreten einstürzen.

## Wenn's nicht klappt

- **Das Tor bleibt offen:** Bei **schließt wieder nach** steht **0**, oder du hast den Wert bei einem anderen Tor eingetragen.
- **Das Tor geht zu, sobald die Figur von der Platte steigt:** Unter **Bei Signal** steht **offen, solange an** – nimm **öffnen**.
- **Das Tor geht nicht zu, obwohl die Zeit um ist:** Die Spielfigur oder ein Gegner steht noch im Tor – oder die Figur steht noch direkt vor einer automatischen Tür.
- **Das Tor geht gar nicht erst auf:** Die Codes von Platte und Tor sind verschieden, oder die Druckplatte liegt in einer Ebene ohne **Kollisionen erkennen**.

## Mach mehr draus

Leg die Druckplatte weit weg vom Tor oder hinter ein paar Sprünge. Oder bau mehrere Tore hintereinander mit verschiedenen Zeiten – das letzte schließt am schnellsten.
