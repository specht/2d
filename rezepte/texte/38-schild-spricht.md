---
titel: Ein Schild, das von selbst spricht
kategorie: Signale
stufe: 2
skala: 3
kurz: Pip läuft am Schild vorbei – und es spricht ihn an, ohne dass jemand F drückt.
szene:
  signale: { 6: Am Schild }
  legende:
    S: { sprite: schild, platziert: { text: { text: "Halt, Wanderer! Im Wald wohnt der Glibber.", speaker: self, color: "#ffcd75", speaks_on_signal: true, signal_code: 6 } } }
  bereiche:
    - { name: Vor dem Schild, code: 6, rechtecke: [[3, 1, 4, 3]] }
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
2. Ein **Schild** mit **spricht bei Signal** und demselben Signal fängt dann von selbst an zu sprechen.
3. Im Spiel: Man läuft vorbei – und das Schild redet, ohne dass jemand **F** drückt.

## Das brauchst du

- **Das musst du zeichnen:** ein Schild – oder eine Figur, die etwas zu sagen hat.
- **Das kannst du später dazumalen:** nichts – die Schrift kommt vom Spiel.

![Schild](katalog:welt/schild)

## Schritt für Schritt

1. Bau das Schild wie in *Ein Schild, das Pip vorliest*: **Eigenschaft hinzufügen → Text → Hinweistext**, im **Level** den **Text** hineinschreiben.
2. Stell beim platzierten Schild **Wer spricht** auf **das Sprite spricht selbst** und such eine **Textfarbe** aus – so sieht man, dass das Schild redet und nicht die Spielfigur.
3. Schalte beim Schild **spricht bei Signal** an. Es bekommt einen eigenen **Code**. Gib dem Signal einen Namen: neben dem Code **ohne Namen** → **Namen geben …**, zum Beispiel **Am Schild**.
4. Leg eine neue Ebene über **+ → Signalbereich** an und wähle neben **Code** aus der Liste **Am Schild**. Zieh das Rechteck vor das Schild, dorthin, wo die Figur vorbeiläuft.
5. Probier es mit **Level testen** (Taste T) aus: Sobald die Mitte der Figur im Rechteck ist, spricht das Schild.

In der **Signale-Übersicht (Taste S)** steht die Regel als Satz: *Wenn die Spielfigur in den Signalbereich »Vor dem Schild« läuft, dann spricht »Schild«*.

## Tipps

- Mit **F** kann man den Text trotzdem noch einmal lesen.
- Läuft die Figur wieder hinaus und noch einmal hinein, spricht das Schild noch einmal. Soll es nur einmal sprechen, mach den Signalbereich klein und leg ihn so, dass man nicht zurückkommt – oder nimm stattdessen einen **Schalter** oder eine **Druckplatte**.
- Ein Schild kann auf jedes Signal hören: auf einen besiegten Gegner („Gut gemacht!“), einen eingesammelten Edelstein oder einen Schalter.
- Bleibt **Wer spricht** auf **die Spielfigur liest vor**, liest die Figur das Schild vor – als würde sie es im Vorbeigehen lesen.

## Wenn's nicht klappt

- **Das Schild sagt nichts:** Beim Schild ist **spricht bei Signal** aus, oder Schild und Signalbereich haben nicht dasselbe Signal (schau in die Signale-Übersicht). Oder der **Text** ist leer.
- **Es spricht schon, wenn das Level anfängt:** Die Figur startet im Rechteck des Signalbereichs. Schieb das Rechteck ein Stück weiter.
- **Die Spielfigur spricht statt des Schilds:** Bei **Wer spricht** steht noch **die Spielfigur liest vor**.

## Mach mehr draus

Stell eine Figur an den Wegesrand, die jeden begrüßt, der vorbeikommt – und eine zweite, die etwas anderes sagt, sobald man den Schlüssel gefunden hat.
