---
titel: Eine Katze, der man nichts tun kann
kategorie: Gegner
stufe: 2
skala: 2
kurz: Pip schlägt nach der Katze – nichts passiert. Den Glibber daneben besiegt er mit zwei Schlägen.
szene:
  anpassen:
    # both stay where they are, so the swings land where the text says
    glibber: { baddie: { patrols: false, behavior: { type: still } } }
  legende: { P: pip_schwert, K: katze }
  karte: |
    ..........
    ..........
    ..g.PK....
    ##########
ablauf:
  - { t: 0.3, drücken: nahkampf }
  - { t: 0.9, drücken: nahkampf }
  - { t: 1.4, drücken: links }
  - { t: 1.8, drücken: nahkampf }
  - { t: 2.4, drücken: nahkampf }
dauer: 3.4
standbild: 1.0
erwartet:
  gegner_besiegt: 1
  gegner_leben: 1
  energie_gleich: 100
  lebt: true
---
## Kurz gesagt

1. Beim Gegner gibt es **unverwundbar**.
2. Ist es an, kann man diesem Gegner nichts tun: Schwert, Pfeile, Steine, Bomben und herabfallende Blöcke machen ihm nichts.
3. Er selbst kann trotzdem kratzen – wer ihn berührt, verliert Energie.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner, zum Beispiel eine Katze. Ein Bild reicht!
- **Das kannst du später dazumalen:** eine Lauf-Animation, falls deine Katze herumlaufen soll.

![Katze](katalog:katze/stehen 3)
![Katze läuft](katalog:katze/laufen 10)

## Schritt für Schritt

1. Zeichne die Katze und gib ihr **Eigenschaft hinzufügen → Fallen und Gegner → Gegner**.
2. Schalte beim Gegner **unverwundbar** an.
3. Stell **Schaden** ein: So viel Energie verliert die Spielfigur, wenn sie die Katze berührt. Die Katze hier hat **20**.
4. Unter **Verhalten** wählst du, was die Katze macht – hier **Steht still**, aber sie darf auch herumlaufen.
5. Setz die Katze ins **Level**.

Beim Spielen schlägt Pip mit **J** nach der Katze: Es passiert nichts. Der Glibber daneben ist nach zwei Schlägen weg.

> **Tipp:** **unverwundbar** stellst du beim Zeichnen ein, nicht beim platzierten Gegner. Willst du eine Katze, die man doch besiegen kann, brauchst du eine zweite Zeichnung.

## Tipps

- Für **sendet, wenn alle Gegner besiegt** zählt eine unverwundbare Katze nicht mit. Sonst könnte man das Level nie schaffen.
- Ein Pfeil oder Stein, der die Katze trifft, ist weg – er fliegt nicht durch sie hindurch.
- Soll die Katze gar nicht kratzen, stell **Schaden** auf **0**. Dann ist sie nur ein Tier, das im Weg herumläuft.
- Auch ein riesiger Wächter, ein Geist oder ein Stein, der hin und her rollt, kann **unverwundbar** sein – dann muss man ihm ausweichen.

## Wenn's nicht klappt

- **Die Katze verschwindet doch:** **unverwundbar** ist bei einer anderen Zeichnung an, nicht bei der, die im Level steht.
- **Die Katze kratzt nicht:** Ihr **Schaden** ist **0**.
- **Das Tor mit „alle Gegner besiegt“ geht nicht auf:** Ein anderer Gegner lebt noch – oder liegt auf einer Ebene, die noch nicht erschienen ist.

## Mach mehr draus

Bau ein Level, in dem eine Katze vor der Tür schläft und man über sie springen muss. Oder lass mehrere Katzen herumlaufen, zwischen denen man durch muss, ohne gekratzt zu werden.
