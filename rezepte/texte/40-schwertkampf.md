---
titel: Schwertkampf
kategorie: Kampf
stufe: 2
kurz: Mit J schwingt Pip das Schwert – zwei Treffer, und der Glibber ist weg.
szene:
  anpassen: { glibber: { baddie: { hit_pause: 0.5 } } }
  legende: { P: pip_schwert }
  karte: |
    ..........
    ..........
    .P.....g..
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.5 }
  - { t: 1.0, drücken: nahkampf }
  - { t: 1.6, drücken: nahkampf }
dauer: 3.0
erwartet:
  gegner_besiegt: 1
---
## Kurz gesagt

1. Gib deiner Figur die Eigenschaft **Nahkampfangriff**.
2. Mit **J** greift sie an. Ein Swoosh zeigt den Schlag – auch ohne eigene Bilder.
3. Gib dem Gegner genug **Energie** und stell **Schaden** passend ein.

## Das brauchst du

- **Das musst du zeichnen:** deine Spielfigur und einen Gegner. Ein Stehbild reicht für beide!
- **Das kannst du später dazumalen:** einen **Angriff**-Zustand mit Schwert, einen **Treffer**- und einen **Tot**-Zustand für den Gegner.

![Angriff](katalog:pip/angriff_schwert 14)
![Glibber tot](katalog:glibber/tot 8)

## Schritt für Schritt

1. Bei deiner Figur: **Eigenschaft hinzufügen → Kampf → Nahkampfangriff**.
2. Pip hat **Schaden 20**, **Angriffsreichweite 24 px** und **Cooldown 0,45 s**.
3. Beim Gegner (Eigenschaft *Gegner*): **Energie 40**. Nach zwei Treffern ist er besiegt. Mit **Pause nach Treffer 0,5 s** bleibt er nach dem ersten Schlag kurz stehen.
4. Probier es mit **J** aus.
5. Jetzt die Bilder: neuer Zustand „Angriff“ mit **Spielfigur greift nach rechts an**. Pips Schwert ist direkt in die Figur gemalt: ausholen, zuschlagen, nachschwingen.
6. Beim Gegner: Zustand mit **Gegner: Treffer (rechts)** und einer mit **Gegner tot**.

## Tipps

> **Tipp:** Die Bilder ändern nichts am Schaden oder an der Reichweite. Erst muss der Kampf funktionieren – schön machen kannst du ihn danach.

- **Treffereffekt:** Wähle einen kleinen Sprite (bei Pip ein Funke), der beim Treffer erscheint.
- **Swoosh** *hoch* oder *runter* bestimmt, in welche Richtung der Schwung gezeichnet wird.
- Die **Trefferreaktion** beim Gegner lässt ihn kurz rot aufleuchten.
- **Pause nach Treffer** beim Gegner gibt dir nach jedem Schlag etwas Luft. Mehr dazu im Rezept *Gegner nach einem Treffer anhalten*.

## Wenn's nicht klappt

- **J macht nichts:** Die Eigenschaft Nahkampfangriff muss bei der **Spielfigur** sein.
- **Der Gegner verletzt dich trotzdem bei Berührung:** Das ist der **Schaden** beim *Gegner* (Berührungsschaden). Stell ihn auf 0, wenn nur die Waffe zählen soll.
- **Der Gegner stirbt nie:** Seine **Energie** ist zu hoch oder der **Schaden** zu klein.
- **Man trifft erst, wenn man fast drinsteht:** Erhöhe die **Angriffsreichweite**.

## Mach mehr draus

Gib auch dem Gegner einen Nahkampfangriff! Gegner benutzen dieselben Angriffe wie die Spielfigur.
