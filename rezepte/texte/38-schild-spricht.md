---
titel: Ein Wichtel, der von selbst spricht
kategorie: Signale
stufe: 2
skala: 3
kurz: Pip läuft am Wichtel vorbei – und der spricht ihn an, ohne dass jemand F drückt. Beim Reden bewegt er den Mund.
szene:
  signale: { 6: Beim Wichtel }
  legende:
    S: { sprite: wichtel, platziert: { text: { text: "Halt, Wanderer! Im Wald wohnt der Glibber.", speaker: self, color: "#ffcd75", speaks_on_signal: true, signal_code: 6 } } }
  bereiche:
    - { name: Beim Wichtel, code: 6, rechtecke: [[3, 1, 4, 3]] }
  karte: |
    ..........
    ..........
    ..........
    .P....S...
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.45 }
dauer: 5.0
standbild: 1.6
erwartet:
  signale: ['6 an']
  gesagt: ['Halt, Wanderer!', 'Im Wald wohnt der Glibber.']
  lebt: true
---
## Kurz gesagt

1. Ein **Signalbereich** sendet sein Signal, sobald die Spielfigur hineinläuft.
2. Ein Sprite mit **Hinweistext**, **spricht bei Signal** und demselben Signal fängt dann von selbst an zu sprechen – hier ein Wichtel am Wegesrand.
3. Gib ihm einen Zustand **spricht gerade**: Den zeigt er, solange seine Sprechblasen zu sehen sind – er bewegt den Mund und winkt.

## Das brauchst du

- **Das musst du zeichnen:** eine Figur am Wegesrand – oder ein Schild. Ein paar Frames, in denen sie atmet und blinzelt, machen sie lebendig.
- **Das kannst du später dazumalen:** einen zweiten Zustand, in dem sie spricht: der Mund geht auf und zu, eine Hand bewegt sich. Die Schrift kommt vom Spiel.

![Wichtel](katalog:welt/wichtel_stehen 3)
![Wichtel spricht](katalog:welt/wichtel_spricht 6)

## Schritt für Schritt

1. Zeichne den Wichtel und gib ihm **Eigenschaft hinzufügen → Text → Hinweistext**. Er braucht keine Block-Eigenschaft – man läuft an ihm vorbei. (Ein Gegner oder Begleiter kann keinen Text haben: Nimm ein ganz normales Sprite.)
2. Setz ihn ins **Level** und schreib den **Text** hinein. Stell **Wer spricht** auf **das Sprite spricht selbst** und such eine **Textfarbe** aus – so sieht man, dass der Wichtel redet und nicht die Spielfigur.
3. Schalte **spricht bei Signal** an. Er bekommt einen eigenen **Code**. Gib dem Signal einen Namen: neben dem Code **ohne Namen** → **Namen geben …**, zum Beispiel **Beim Wichtel**.
4. Leg eine neue Ebene über **+ → Signalbereich** an und wähle neben **Code** aus der Liste **Beim Wichtel**. Zieh das Rechteck vor den Wichtel, dorthin, wo die Figur vorbeiläuft.
5. Zeichne einen zweiten Zustand, in dem der Wichtel redet, und gib ihm **Eigenschaft hinzufügen → Hinweistext → spricht gerade**. Solange seine Sprechblasen zu sehen sind, zeigt das Spiel diesen Zustand, danach wieder den ersten.
6. Probier es mit **Level testen** (Taste T) aus: Sobald die Mitte der Figur im Rechteck ist, spricht der Wichtel.

In der **Signale-Übersicht (Taste S)** steht die Regel als Satz: *Wenn die Spielfigur in den Signalbereich »Beim Wichtel« läuft, dann spricht »Wichtel (spricht)«*.

## Tipps

- Mit **F** kann man den Text trotzdem noch einmal hören.
- Läuft die Figur wieder hinaus und noch einmal hinein, spricht der Wichtel noch einmal. Soll er nur einmal sprechen, mach den Signalbereich klein und leg ihn so, dass man nicht zurückkommt – oder nimm stattdessen einen **Schalter** oder eine **Druckplatte**.
- Er kann auf jedes Signal hören: auf einen besiegten Gegner („Gut gemacht!“), einen eingesammelten Edelstein oder einen Schalter.
- **spricht gerade** gibt es nur, wenn das Sprite **selbst** spricht. Liest die Spielfigur vor (**Wer spricht: die Spielfigur liest vor**), bleibt es im ersten Zustand – ein Schild bewegt ja keinen Mund.
- Ein **Schild** geht genauso: Es braucht nur keinen Zustand **spricht gerade**.

## Wenn's nicht klappt

- **Der Wichtel sagt nichts:** **spricht bei Signal** ist aus, oder Wichtel und Signalbereich haben nicht dasselbe Signal (schau in die Signale-Übersicht). Oder der **Text** ist leer.
- **Er spricht, aber bewegt den Mund nicht:** Dem zweiten Zustand fehlt **spricht gerade** – oder bei **Wer spricht** steht **die Spielfigur liest vor**.
- **Es spricht schon, wenn das Level anfängt:** Die Figur startet im Rechteck des Signalbereichs. Schieb das Rechteck ein Stück weiter.
- **Die Spielfigur spricht statt des Wichtels:** Bei **Wer spricht** steht noch **die Spielfigur liest vor**.

## Mach mehr draus

Stell ein ganzes Dorf an den Wegesrand: einen Wichtel, der jeden begrüßt, der vorbeikommt – und einen zweiten, der etwas anderes sagt, sobald man den Schlüssel gefunden hat.
