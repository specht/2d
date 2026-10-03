---
titel: Erst alle drei Schalter
kategorie: Signale
stufe: 3
skala: 2
kurz: Das Tor geht erst auf, wenn alle drei Schalter umgelegt sind. Ein Zähler zählt mit – und schickt dann sein eigenes Signal.
einzelbilder: true
szene:
  signale: { 2: Hebel, 5: Tor auf }
  legende:
    S: { sprite: schalter, platziert: { switch: { signal_code: 2 } } }
    z: { sprite: zaehler, platziert: { counter: { signal_code: 2, count: 3, send_code: 5 } } }
    G: { sprite: gittertor, platziert: { door: { signal_code: 5, door_reaction: follow } } }
  karte: |
    ..........M...
    ..........M...
    .......z..M...
    ..........M...
    .P.S.S.S..G...
    ##############
# Pip legt die drei Hebel nacheinander um; beim dritten ist der Zähler voll
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.27 }
  - { t: 0.75, drücken: aktion }
  - { t: 1.05, halten: rechts, dauer: 0.27 }
  - { t: 1.5, drücken: aktion }
  - { t: 1.8, halten: rechts, dauer: 0.27 }
  - { t: 2.25, drücken: aktion }
  - { t: 2.9, halten: rechts, dauer: 0.6 }
dauer: 4.0
erwartet:
  signale: ['2 an', '2 an', '2 an', '5 an']
  tuer_offen: true
  figur_rechts_von: 11
  lebt: true
varianten:
  # 1: fünf Münzen – jede sendet beim Einsammeln, der Zähler mit fünf Lampen zählt mit
  - szene:
      signale: { 2: Münze, 5: Tor auf }
      legende:
        o: { sprite: muenze, platziert: { pickup: { signal_on_collect: true, signal_code: 2 } } }
        z: { sprite: zaehler_5, platziert: { counter: { signal_code: 2, count: 5, send_code: 5 } } }
        G: { sprite: gittertor, platziert: { door: { signal_code: 5, door_reaction: open } } }
      karte: |
        ..........M...
        ..........M...
        .......z..M...
        ..........M...
        .P.ooooo..G...
        ##############
    ablauf:
      - { t: 0.3, halten: rechts, dauer: 1.5 }
    dauer: 2.6
    erwartet:
      signale: ['2 an', '2 an', '2 an', '2 an', '2 an', '5 an']
      tuer_offen: true
      figur_rechts_von: 11
      punkte: 50
---
## Kurz gesagt

1. Ein **Zähler** zählt Signale: Jedes „an“ mit seinem Code zählt eins dazu, jedes „aus“ eins weg.
2. Hat er seine **Anzahl** erreicht, sendet er sein **eigenes Signal** – zum Beispiel an ein Tor.
3. Drei Schalter mit demselben Code und **Anzahl 3** heißt: Erst wenn **alle drei** an sind, geht das Tor auf.

## Das brauchst du

- **Das musst du zeichnen:** einen Zähler – zum Beispiel eine Tafel mit drei Lämpchen. Dazu die Schalter und ein Tor wie bei *Ein Schalter öffnet das Tor*.
- **Das kannst du später dazumalen:** für jede Zahl ein eigenes Bild, in dem eine Lampe mehr leuchtet, und ein Bild, wenn der Zähler voll ist.

![Zähler wartet](katalog:welt/zaehler_wartet)
![Zähler zeigt 1](katalog:welt/zaehler_1)
![Zähler zeigt 2](katalog:welt/zaehler_2)
![Zähler erreicht](katalog:welt/zaehler_voll 3)

## Schritt für Schritt

1. Zeichne den Zähler und gib ihm **Eigenschaft hinzufügen → Schalter → ist ein Zähler**. Er braucht keine Block-Eigenschaft – man läuft einfach an ihm vorbei.
2. Gib seinen Bildern die Zustände **Zähler wartet**, **Zähler zeigt 1**, **Zähler zeigt 2** und **Zähler erreicht**. Fehlt ein Bild, zeigt er einfach weiter das letzte.
3. Setz drei **Schalter**, den **Zähler** und ein **Gittertor** ins Level.
4. Klicke den Zähler an. Er hat schon zwei Codes bekommen: **zählt Code** (was er zählt) und **sendet Code** (was er sendet, wenn er voll ist). Stell **Anzahl** auf **3**.
5. Nimm das Werkzeug **Verbinden**: Klicke auf jeden Schalter und dann auf den Zähler. So zählt der Zähler alle drei. Dann klicke auf den Zähler und auf das Tor. Beim Tor wählst du unter **Bei Signal** **offen, solange an**.
6. Probier es aus: Leg die Hebel nacheinander um. Bei jedem leuchtet eine Lampe mehr – beim dritten geht das Tor auf.

In der **Signale-Übersicht** (S) steht jetzt: *Wenn »Schalter« umgelegt wird, dann zählt »Zähler« mit* und *Wenn »Zähler« bis 3 gezählt hat, dann öffnet sich »Gittertor«*.

## Tipps

> **Tipp:** Legst du einen Hebel zurück, zählt der Zähler eins weg – und das Tor mit **offen, solange an** geht wieder zu. Soll es offen bleiben, nimm beim Tor **öffnen**.

- **Münzen zählen:** Schalte bei fünf Münzen **sendet, wenn eingesammelt** an und gib ihnen den Code, den der Zähler zählt. Mit **Anzahl 5** geht das Tor erst auf, wenn alle fünf eingesammelt sind:

![Fünf Münzen öffnen das Tor](variante:1)

- Auch **Druckplatten**, **Signalbereiche**, **Schlüssel** und besiegte **Gegner** kann ein Zähler zählen – alles, was ein Signal sendet.
- Ein Zähler kann auch einen anderen Zähler füttern: zwei Räume mit je drei Schaltern, und erst wenn beide fertig sind, öffnet sich der Ausgang.
- Mit **Verzögerung** sendet der Zähler sein Signal etwas später.

## Wenn's nicht klappt

- **Das Tor geht schon beim ersten Schalter auf:** Das Tor hat denselben Code wie die Schalter. Es muss den Code haben, den der Zähler **sendet**.
- **Der Zähler zählt nicht:** Die Schalter haben einen anderen Code als **zählt Code** beim Zähler. Unter jedem Code steht, was im Level noch dazugehört.
- **Das Tor bleibt zu, obwohl alle Schalter an sind:** Die **Anzahl** ist größer als die Zahl der Schalter.

## Mach mehr draus

Bau einen Tempel mit vier gut versteckten Schaltern in vier Räumen – erst wenn alle umgelegt sind, öffnet sich die Schatzkammer. Oder ein Level, in dem man zehn Edelsteine finden muss, bevor das Ziel erscheint.
