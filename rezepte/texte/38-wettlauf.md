---
titel: Wettlauf gegen die Zeit
kategorie: Signale
stufe: 2
skala: 2
kurz: Kurz nach dem Start fällt das Tor zu – Pip muss sich beeilen, um noch durchzukommen.
szene:
  signale: { 3: Zeit um }
  legende:
    G: { sprite: gittertor, platziert: { door: { door_closed: false, signal_code: 3, door_reaction: close } } }
  beim_start: { code: 3, verzoegerung: 2 }
  karte: |
    ...........M..
    ...........M..
    ...........M..
    ...........M..
    .P.........G..
    ##############
ablauf:
  - { t: 0.2, halten: rechts, dauer: 1.6 }
dauer: 3.2
erwartet:
  signale: ['3 an']
  tuer_offen: false
  figur_rechts_von: 12
  lebt: true
---
## Kurz gesagt

1. Das **Level** kann beim Start ein **Signal** senden – mit einer **Verzögerung** erst nach ein paar Sekunden. Das ist eine Uhr.
2. Ein Tor mit demselben Signal **schließt** sich, sobald die Zeit um ist.
3. Im Spiel: losrennen und durch das Tor, bevor es zufällt.

## Das brauchst du

- **Das musst du zeichnen:** ein Tor (geschlossen und geöffnet).
- **Das kannst du später dazumalen:** einen **Übergang**, in dem das Tor herunterfährt.

![Das Gitter fährt hoch](katalog:welt/gitter_uebergang 10)

## Schritt für Schritt

1. Zeichne das Tor wie im Rezept *Ein Schalter öffnet das Tor* (**ist verschließbar** und **automatische Tür** an) und setz es ins **Level** in eine hohe Mauer.
2. Klicke auf eine leere Stelle im Level. Bei den **Level-Eigenschaften** schaltest du **sendet beim Start** an. Gib dem Signal neben **Code** einen Namen: **ohne Namen** → **Namen geben …**, zum Beispiel **Zeit um**.
3. Stell darunter die **Verzögerung** ein: so viele Sekunden hat man Zeit. Hier sind es nur **2** – in deinem Spiel nimm lieber mehr, zum Beispiel **20**.
4. Klicke auf das Tor. Schalte **Tür geschlossen** aus – am Anfang ist es offen. Neben **Code** wählst du aus der Liste **Zeit um**, unter **Bei Signal** **schließen**.
5. Probier es mit **Level testen** (Taste T) aus: Schaffst du es durch das Tor? Ist es zu leicht, nimm weniger Sekunden – ist es zu schwer, mehr.

In der **Signale-Übersicht (Taste S)** steht die Regel als Satz: *Wenn das Level startet (kommt nach 2 s an), dann schließt sich »Gittertor«*.

> **Achtung:** Die Uhr läuft weiter, wenn die Spielfigur ein Leben verliert – sie fängt nur von vorn an, wenn das ganze Level neu beginnt (im Test mit **R**).

## Tipps

- Die Uhr kann alles auslösen, was auf ein Signal hört: Nach ein paar Sekunden **erscheint** eine Brücke, eine Wand **verschwindet**, ein Schild sagt „Beeil dich!“ – oder das Level ist **geschafft**, wenn man so lange durchgehalten hat (siehe *So wird ein Level geschafft*).
- Ohne **Verzögerung** sendet das Level sein Signal gleich beim Start. So kannst du zum Beispiel eine Ebene sofort erscheinen lassen.
- Die Spielfigur sieht die Uhr nicht. Sag ihr mit einem Schild am Anfang, dass sie sich beeilen muss.

## Wenn's nicht klappt

- **Das Tor ist schon am Anfang zu:** Beim Tor ist **Tür geschlossen** noch an.
- **Das Tor bleibt offen:** Level und Tor haben nicht dasselbe Signal (schau in die Signale-Übersicht), oder beim Tor steht nicht **schließen**.
- **Das Tor fällt sofort zu:** Bei **sendet beim Start** ist die **Verzögerung** noch **0**.

## Mach mehr draus

Bau eine ganze Strecke mit mehreren Toren, die nacheinander zufallen: Vor jedem weiteren Tor liegt eine **Druckplatte** mit **Verzögerung** – wer drauftritt, startet die nächste Uhr.
