---
titel: Bewegte Plattformen und Aufzüge
kategorie: Welt bauen
stufe: 2
skala: 2
kurz: Eine Schwebeplattform trägt Pip über die Stachelgrube, ein Aufzug bringt ihn hinauf. Wer obendrauf steht, fährt mit.
# the gallery card: Pip on the platform above the spikes
standbild: 4.0
einzelbilder: true
szene:
  # wider than the screen: the camera follows Pip (and every variant has the same size)
  kamera: { bildhoehe: 216 }
  legende:
    # the platform starts on the right and comes over to Pip first
    p: { sprite: plattform, platziert: { moving: { path_x: -168 } } }
    a: { sprite: aufzug, platziert: { moving: { path_x: 0, path_y: 168, start: ride } } }
  # taller than the screen: the camera follows Pip up in the Aufzug
  karte: |
    ..........................
    ..........................
    ....................######
    ....................======
    ....................======
    ....................======
    ....................======
    ....................======
    .P..................======
    #####.......p..###a.======
    =====^^^^^^^^^^===========
    ==========================
# Pip waits at the edge until the platform is there, steps on and rides across the
# spikes. On the other side the Aufzug: it starts as soon as Pip stands on it.
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.4 }
  - { t: 2.1, halten: rechts, dauer: 0.4 }
  - { t: 4.9, halten: rechts, dauer: 0.8 }
  - { t: 7.6, halten: rechts, dauer: 0.8 }
dauer: 9.6
erwartet:
  figur_rechts_von: 21
  figur_hoeher_als: 10
  figur_mitgefahren: 250
  plattform_weg: 168
  lebt: true
varianten:
  # 1: a Schalter slides a bridge out of the cliff (bei Signal)
  - szene:
      signale: { 3: Brücke }
      legende:
        S: { sprite: schalter, platziert: { switch: { signal_code: 3 } } }
        p: { sprite: plattform, platziert: { moving: { path_x: 72, start: signal, signal_code: 3 } } }
      ebenen:
        # behind the cliff: the bridge waits inside it
        - name: Brücke
          karte: |
            ................
            ................
            ................
            ................
            ................
            ................
            ...p............
            ................
            ................
        - name: Welt
          karte: |
            ................
            ................
            ................
            ................
            ................
            .P.S............
            ######...#######
            ======^^^=======
            ================
    # the camera centres on what is placed: lift it to the bottom of the scene
    bild_hoch: 2.5
    ablauf:
      - { t: 0.3, halten: rechts, dauer: 0.25 }
      - { t: 0.8, drücken: aktion }
      - { t: 1.9, halten: rechts, dauer: 1.1 }
    dauer: 3.6
    erwartet:
      signale: ['3 an']
      figur_rechts_von: 10
      plattform_weg: 72
      lebt: true
  # 2: up at a slant, back and forth all the time
  - bild_hoch: 1
    szene:
      legende:
        p: { sprite: plattform, platziert: { moving: { path_x: -96, path_y: -96 } } }
      karte: |
        ................
        ................
        ........p..#####
        ...........=====
        ...........=====
        .P.........=====
        ####...#########
        ================
        ================
    ablauf:
      - { t: 1.2, halten: rechts, dauer: 0.6 }
      - { t: 4.1, halten: rechts, dauer: 0.6 }
    dauer: 5.2
    erwartet:
      figur_rechts_von: 11
      figur_hoeher_als: 6
      figur_mitgefahren: 120
      lebt: true
---
## Kurz gesagt

1. Gib einem Sprite die Eigenschaft **bewegt sich (Plattform, Aufzug)** – und *man kann nicht von oben reinfallen*, damit man darauf stehen kann.
2. Klicke es im Level an und stell seinen **Weg** ein: so weit nach rechts, so weit nach oben.
3. Unter **Fährt** wählst du, wann es losfährt: immer hin und her, als **Aufzug**, sobald die Spielfigur draufsteht, oder **bei Signal**.

## Das brauchst du

- **Das musst du zeichnen:** eine Plattform, ganz **oben** im Sprite – dort ist die Oberfläche, auf der man steht. Breiter als ein Block geht gut: Die Schwebeplattform ist 72 × 24 Pixel groß.
- **Das kannst du später dazumalen:** kleine Düsen mit flackernden Flammen unter der Plattform, beim Aufzug ein Lämpchen, das blinkt, und ein Zahnrad, das sich dreht.

![Schwebeplattform](katalog:welt/plattform 12)
![Aufzug](katalog:welt/aufzug 6)

## Schritt für Schritt

1. Leg ein neues Sprite an und mach es **72 Pixel breit** (für den Aufzug 48). Zeichne die Plattform in die obersten Pixelreihen. Darunter darf etwas hängen – Düsen, ein Zahnrad –, darauf steht niemand.
2. **Eigenschaft hinzufügen → Blöcke → man kann nicht von oben reinfallen**. So steht man oben und springt von unten hindurch.
3. **Eigenschaft hinzufügen → Plattformen → bewegt sich (Plattform, Aufzug)**. Die Schwebeplattform hat **Geschwindigkeit 1,5** und **Pause am Ende 1** Sekunde. Zum Vergleich: Pip läuft mit 3.
4. Setz die Plattform ins **Level** – in eine Ebene, in der *Kollisionen erkennen* an ist – und klicke sie an. Unter **Weg nach rechts** und **Weg nach oben** steht, wohin sie fährt, in Pixeln: **24 Pixel sind ein Block**. Mit Minus fährt sie nach links oder unten. Im Level siehst du ihren Weg als **gestrichelte Linie** und das Ende als **gestrichelten Rahmen**. Noch einfacher: Wähl die Plattform mit dem **Auswahl-Werkzeug** aus und zieh den runden **Griff** im Rahmen dorthin, wo sie hinfahren soll – er rastet im Gitter ein.
5. Hier steht die Plattform am Anfang rechts über der Grube und hat **Weg nach rechts: -168** – sieben Blöcke nach links. **Fährt: immer hin und her** – sie kommt zu Pip herüber, wartet kurz und fährt mit ihm zurück.
6. **Der Aufzug:** Er sitzt in einer Lücke im Boden, genau auf Bodenhöhe. **Weg nach rechts: 0**, **Weg nach oben: 168** (sieben Blöcke) und **Fährt: wenn die Spielfigur draufsteht (Aufzug)**. Er wartet, bis Pip draufsteigt, und bringt ihn nach oben – die Kamera fährt mit. Bleibt er oben leer, fährt er nach der Pause von allein wieder hinunter. Wie schnell er fährt, stellst du beim Sprite unter **Geschwindigkeit** ein (ohne Angabe 1; dieser Aufzug fährt mit 1,5 und wartet oben 1,5 Sekunden).
7. Probier es aus: Warte an der Kante, bis die Plattform da ist, steig auf und lass dich über die Stacheln tragen.

## Tipps

> **Tipp:** Alles auf der Plattform fährt mit – Pip, Gegner und Begleiter. Einen **Aufzug** startet aber nur die Spielfigur: Ein Begleiter, der allein draufsteht, schickt ihn nicht los.

- **Bei Signal:** Stell **Fährt: bei Signal** ein und gib der Plattform den **Code** eines Schalters. Bei „an“ fährt sie ans Ende ihres Wegs, bei „aus“ zurück. Hier schiebt ein Schalter eine Brücke aus der Felswand – die Brücke liegt in einer Ebene **hinter** dem Felsen und wartet darin:

![Ein Schalter schiebt die Brücke heraus](variante:1)

- **Schräg:** Gibst du **beide** Wege an, fährt die Plattform schräg – hier 96 Pixel nach links und 96 nach unten, und wieder zurück:

![Schräg nach oben](variante:2)

- Eine Plattform **zerquetscht nie** jemanden. Würde ein Aufzug Pip mit dem Kopf an die Decke drücken, wartet er, bis Pip abgestiegen ist. Eine Plattform mit festen Seiten (*man kann nicht seitlich hineinlaufen*) wartet, wenn jemand im Weg steht – sie schiebt niemanden weg.
- Läuft Pip auf der fahrenden Plattform gegen eine Wand, bleibt er dort stehen und die Plattform fährt unter ihm weiter.
- Auch Münzen, Stacheln oder Gegner-Fallen können sich bewegen: Gib ihnen einfach **bewegt sich** dazu.

## Wenn's nicht klappt

- **Pip fällt durch die Plattform:** Es fehlt *man kann nicht von oben reinfallen*.
- **Die Plattform bewegt sich nicht:** Ihr Weg ist 0, oder sie liegt in einer Ebene ohne *Kollisionen erkennen* oder mit Parallaxe. Bewegen kann sich nur, was in einer Ebene mit Kollisionen liegt.
- **Der Aufzug fährt nicht los:** **Fährt** steht nicht auf *Aufzug*, oder Pip steht nicht mit der Mitte seiner Füße darauf.
- **Pip schwebt über der Plattform:** Die Plattform ist nicht ganz oben im Sprite gemalt. Das Spiel nimmt immer die Oberkante.
- **Die Plattform hält mitten auf dem Weg an:** Jemand steht ihr im Weg, oder wer obendrauf steht, würde mit dem Kopf an die Decke stoßen.

## Mach mehr draus

Bau einen Turm aus Aufzügen und Schwebeplattformen, die abwechselnd hin- und herfahren – und oben wartet der Edelstein. Oder eine Fabrik, in der ein Schalter eine ganze Reihe Plattformen auf einmal losschickt.
