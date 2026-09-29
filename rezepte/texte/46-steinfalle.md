---
entwurf: true          # hidden for now, so the gallery has full rows
titel: Eine Steinfalle für Gegner
kategorie: Kampf
stufe: 3
kurz: Pip läuft über bröckelnde Steine – sie stürzen auf den Glibber darunter.
szene:
  anpassen:
    broeckel: { falls_down: { timeout: 0.35, damage: 100 } }
    glibber: { baddie: { vrun: 0.3 } }
  karte: |
    ............
    ............
    .P..........
    ###BBBB#####
    ###..g.#####
    ############
ablauf:
  - { t: 0.4, halten: rechts, dauer: 1.2 }
dauer: 2.8
erwartet:
  gegner_besiegt: 1
---
## Kurz gesagt

1. Bröckelsteine fallen herunter, wenn die Figur auf ihnen steht.
2. Mit **Schaden** treffen sie Gegner, auf die sie fallen.
3. So baut man eine Falle: oben ein Weg aus Bröckelsteinen, unten der Gegner.

## Das brauchst du

- **Das musst du zeichnen:** einen Bröckelstein (siehe *Bröckelsteine*) und einen Gegner.
- **Das kannst du später dazumalen:** Risse, die zeigen, dass die Steine gleich nachgeben.

![Bröckelstein](katalog:welt/broeckel)
![Zerfall](katalog:welt/broeckel_zerfall 8)
![Glibber](katalog:glibber/laufen 8)

## Schritt für Schritt

1. Bau eine Grube, gerade hoch genug für den Gegner. Setz den Gegner hinein.
2. Leg über die Grube eine Reihe **Bröckelsteine**. Links und rechts davon liegt fester Boden.
3. Beim Bröckelstein: **fällt runter, wenn man drauf steht** mit **fällt nach 0,35 s** – schnell genug, dass die Figur nicht mitfällt, wenn sie weiterläuft.
4. Stell **Schaden** auf **100**, damit ein Stein den Gegner besiegt.
5. Spiel es aus: Lauf ohne anzuhalten über die Steine. Hinter dir stürzen sie auf den Glibber.

## Tipps

> **Tipp:** Die Grube darf nur so breit sein, dass die Figur im Laufen darüber kommt. Bleibt sie stehen, fällt sie selbst hinunter.

- Ein langsamer Gegner ist leichter zu treffen. Hier läuft der Glibber mit **Geschwindigkeit 0,3**.
- Mit weniger **Schaden** braucht es mehrere Steine. Dann hilft auch **Pause nach Treffer** beim Gegner.
- Soll der Gegner die Steine selbst zum Einsturz bringen, schalt **fällt auch bei Gegnern** ein.

## Wenn's nicht klappt

- **Der Gegner überlebt:** Der **Schaden** ist kleiner als seine **Energie**.
- **Die Figur fällt mit hinunter:** Stell **fällt nach** etwas länger, oder lauf ohne Pause darüber.
- **Die Steine fallen, aber verfehlen den Gegner:** Der Gegner läuft unten hin und her. Mach die Grube schmaler, damit er immer unter den Steinen ist.

## Mach mehr draus

Bau eine Falle, die man nur mit einem Trick auslöst – zum Beispiel über eine Leiter oben auf die Steine.
