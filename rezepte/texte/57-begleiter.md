---
titel: Ein Begleiter kommt mit
kategorie: Begleiter
stufe: 2
skala: 3
schritte: 2
# the camera a little higher: the end up on the ledge is in the picture
bild_hoch: 2
kurz: Gib einem Sprite die Eigenschaft Begleiter – dann folgt es deiner Spielfigur. Wie es folgen kann, bestimmen seine eigenen Fähigkeiten.
# the gallery card: Pip up on the ledge, the dog waiting below
standbild: 2.6
einzelbilder: true
szene:
  legende: { h: hund }
  kamera: { bildhoehe: 144 }
  # every Begleiter of this recipe is in the scene's game, so children can take
  # them into their own games (scene opened from the recipe; the Sprite-Katalog has them, too)
  zusaetzlich: [roboter, vogel, eule, entchen, kaetzchen, kroete]
  karte: |
    ..........................................
    ..........................................
    ..........................................
    ............##############################
    .h.P..#.....==============================
    ############==============================
    ==========================================
ablauf:
  - { t: 0.5, halten: rechts, dauer: 1.45 }
  - { t: 0.75, drücken: springen }
  - { t: 1.5, drücken: springen }
  - { t: 3.4, halten: rechts, dauer: 2.5 }
dauer: 11.6
erwartet:
  figur_rechts_von: 30
  begleiter_einzeln:
    # over the small step, but not up the high ledge; lost, and found again
    Hund: { bleibt_zurueck: { links_von: 12, bis: 7 }, weg: 150, verloren: 1, folgt: 72 }
varianten:
  # 1: a robot that cannot jump stays in front of the small step
  - bild_hoch: 1
    szene: { legende: { h: roboter } }
    erwartet:
      begleiter_einzeln:
        Roboter: { bleibt_zurueck: { links_von: 6, bis: 7 }, verloren: 1, folgt: 72 }
  # 2: a bird and an owl fly over a gap and up a ledge
  - bild_hoch: 1
    szene:
      legende: { v: vogel, e: eule }
      karte: |
        ......................
        ......................
        e.....................
        .v............########
        ...P..........========
        ########..############
        ========..============
    ablauf:
      - { t: 0.5, halten: rechts, dauer: 2.0 }
      - { t: 1.0, drücken: springen }
      - { t: 1.8, drücken: springen }
    dauer: 5.2
    erwartet:
      figur_rechts_von: 16
      begleiter_einzeln:
        Vogel: { immer_hoeher_als: 2, hub: 30, rechts_von: 13, folgt: 90 }
        Eule: { immer_hoeher_als: 2, hub: 20, rechts_von: 12, folgt: 90 }
  # 3: the duckling swims after Pip, the dog waits at the shore
  - szene:
      himmel: ['#41a6f6', '#c3e6f6']
      legende: { h: hund, e: entchen, '_': sand, '~': wasser_oben, w: wasser }
      bewegungsbereiche:
        - { name: See, art: schwimmen, rechtecke: [[7, 3.25, 9, 2.75]] }
      ebenen:
        - name: Welt
          karte: |
            ......................
            ......................
            .h.e.P................
            #######.........######
            =======.........======
            =======.........======
            =======_________======
            ======================
        - name: Wasser
          kollision: false
          vorne: true
          karte: |
            ......................
            ......................
            ......................
            .......~~~~~~~~~......
            .......wwwwwwwww......
            .......wwwwwwwww......
            ......................
            ......................
    bild_hoch: 0
    ablauf:
      - { t: 0.4, halten: rechts, dauer: 3.6 }
      - { t: 2.3, halten: hoch, dauer: 1.6 }
      - { t: 2.9, drücken: springen }
      - { t: 3.3, drücken: springen }
    dauer: 7.0
    erwartet:
      figur_rechts_von: 17
      begleiter_einzeln:
        Entchen: { schwimmt: true, rechts_von: 16, folgt: 80 }
        Hund: { schwimmt: false, bleibt_zurueck: { links_von: 7, bis: 7 } }
  # 4: a whole group – the kitten, the toad and the owl line up behind Pip
  - bild_hoch: 1
    szene:
      legende: { k: kaetzchen, t: kroete, e: eule }
      karte: |
        ....................
        ....................
        ....................
        e...................
        .t.k.P......#.......
        ####################
        ====================
    ablauf:
      - { t: 0.5, halten: rechts, dauer: 1.65 }
      - { t: 1.22, drücken: springen }
    dauer: 5.4
    erwartet:
      figur_rechts_von: 16
      begleiter_einzeln:
        Kätzchen: { folgt: 64, rechts_von: 13, nie_verloren: true }
        Kröte: { folgt: 96, rechts_von: 12, nie_verloren: true }
        Eule: { folgt: 90, rechts_von: 11, immer_hoeher_als: 2 }
  # 5: a kitten waits until Pip comes to it (kommt erst bei Signal mit, a Signalbereich);
  # alone, it keeps busy where it is (the camera lifted: no strip below the ground)
  - bild_hoch: 1.5
    szene:
      signale: { 3: Treffpunkt }
      legende:
        k: { sprite: kaetzchen, platziert: { companion: { waits_for_signal: true, signal_code: 3 } } }
      bereiche:
        - { name: Treffpunkt, code: 3, rechtecke: [[6, 2, 5, 3]] }
      karte: |
        ........................
        ........................
        ........................
        ........................
        .P......k...............
        ########################
        ========================
    ablauf:
      - { t: 0.3, halten: rechts, dauer: 0.5 }
      - { t: 1.8, halten: rechts, dauer: 2.0 }
    dauer: 5.4
    erwartet:
      signale: ['3 an', '3 aus']
      begleiter_einzeln:
        Kätzchen: { bleibt_zurueck: { links_von: 9, bis: 1.8 }, folgt: 72, rechts_von: 13, nie_verloren: true }
  # 6: Pip stands still – the dog and the bird keep busy
  - bild_hoch: 1
    szene:
      legende: { h: hund, v: vogel }
      karte: |
        ....................
        ....................
        ....................
        .v..................
        .h..P...............
        ####################
        ====================
    ablauf:
      - { t: 0.3, halten: rechts, dauer: 0.9 }
    dauer: 12.0
    erwartet:
      begleiter_einzeln:
        Hund: { zeigt: [sit, busy], nie_verloren: true }
        Vogel: { landet: true, zeigt: [busy], nie_verloren: true }

---
## Kurz gesagt

1. Zeichne ein Tier oder einen Roboter – deinen **Begleiter** – und gib dem Sprite die Eigenschaft **Begleiter**.
2. Setz ihn ins Level: Er läuft deiner Spielfigur hinterher und bleibt in ihrer Nähe.
3. **Begleiter** sagt, *dass* er dir folgt. **Wie** er folgen kann, bestimmen seine eigenen Fähigkeiten: springen, schwimmen, fliegen.

## Das brauchst du

- **Das musst du zeichnen:** deinen Begleiter, nach rechts schauend – ein Bild zum Stehen reicht schon.
- **Das kannst du später dazumalen:** Laufen, Springen und Fallen – und Bilder, mit denen er sich die Zeit vertreibt: sitzen, schnüffeln, picken, sich putzen.

![Hund steht](katalog:hund/stehen 6)
![Hund läuft](katalog:hund/laufen 12)
![Hund springt](katalog:hund/springen)
![Hund fällt](katalog:hund/fallen)
![Hund sitzt](katalog:hund/sitzt 5)
![Hund schnüffelt](katalog:hund/schnueffelt 7)

## Schritt für Schritt

1. Zeichne deinen Begleiter in ein neues Sprite. Er schaut nach **rechts** – nach links dreht ihn das Spiel von selbst um.
2. Wähle **Eigenschaft hinzufügen → Begleiter → Begleiter**.
3. Sag dem Spiel, welches Bild wofür ist: **Begleiter schaut nach rechts** fürs Stehen, **Begleiter läuft nach rechts**, **Begleiter springt nach rechts**, **Begleiter fällt nach rechts**. Fehlt ein Bild, nimmt das Spiel das erste.
4. Stell seine **Sprungkraft** ein. Pip hat **7**, der Hund nur **5**: Über einen Block kommt er, über zwei nicht.
5. Setz den Begleiter neben deine Spielfigur und spiel das Level.

## Was der Begleiter macht

- Er läuft dir nach, bis er nah genug ist. Dann bleibt er stehen und schaut dich an. Läufst du nur ein kleines Stück, bleibt er, wo er ist.
- Bleibst du eine Weile stehen, **beschäftigt er sich**: Er läuft ein paar Schritte auf seiner Seite hin und her, setzt sich oder schnüffelt am Boden – wenn er Bilder für **Begleiter sitzt** und **Begleiter beschäftigt sich** hat. Sobald du weiterläufst, kommt er mit.
- Er springt über Hindernisse – aber nur so hoch, wie **seine eigene Sprungkraft** reicht. Der Hund hüpft über die kleine Stufe, an der hohen Kante bleibt er zurück.
- Schafft er einen Weg nicht, darf er zurückbleiben. Solange du ihn sehen kannst, wartet er. Ist er nicht mehr zu sehen und kommt ein paar Sekunden nicht näher, hat er **den Anschluss verloren** – kurz darauf **findet er dich wieder**: Er taucht knapp außerhalb des Bildschirms hinter dir auf und läuft zu dir.
- Er ist kein Gegner und kein Werkzeug: Er macht keinen Schaden, sammelt nichts ein, öffnet nichts, drückt keine Schalter oder Druckplatten. Du steuerst ihn ja nicht – deshalb verändert er nichts im Level.

> **Achtung:** Dass der Hund zurückbleibt, ist kein Fehler! Ein Begleiter übernimmt nicht automatisch die Fähigkeiten der Spielfigur. Was er nicht kann, schafft er nicht – und genau das macht ihn zu einem eigenen Charakter.

## Andere Begleiter, andere Fähigkeiten

Begleiter ist immer dieselbe Eigenschaft. Die Bewegungseinstellungen machen den Unterschied – das sind nur Ideen, mische sie, wie du willst.

### Der Roboter springt gar nicht

**kann springen** ist aus. Schon die kleine Stufe hält ihn auf – später findet er Pip wieder. Beim Rollen wippt er auf seiner Feder auf und ab.

![Roboter: kann nicht springen](variante:1)

![Roboter steht](katalog:roboter/stehen 3)
![Roboter rollt](katalog:roboter/rollen 10)
![Roboter ruht](katalog:roboter/ruht 2)
![Roboter scannt](katalog:roboter/scannt 4)

### Vogel und Eule fliegen

Mit **kann fliegen** folgen sie dir durch die Luft – über Lücken hinweg, ohne zu springen, ein Stück hinter und über dir. Ihr Flügelschlag bekommt **Begleiter fliegt nach rechts**. Das Bild macht nicht, dass er fliegt – das macht das Häkchen. So werden auch eine Drohne, ein Geist oder ein Ballon zu Fliegern.

![Vogel und Eule: kann fliegen](variante:2)

![Vogel fliegt](katalog:vogel/fliegen 14)
![Eule fliegt](katalog:eule/fliegen 10)

### Das Entchen schwimmt, der Hund wartet

Wasser ist ein **Bewegungsbereich** mit **Schwimmen** (siehe *Pip taucht*). Mit **kann schwimmen** folgt das Entchen dir hinein und springt am anderen Ufer mit einem Schwimmzug heraus – so hoch, wie seine Sprungkraft reicht. Der Hund kann nicht schwimmen: Er wartet am Ufer. Ein Vogel würde einfach darüber fliegen.

![Entchen und Hund am See](variante:3)

![Entchen schwimmt](katalog:entchen/schwimmen 6)
![Entchen watschelt](katalog:entchen/watscheln 12)

### Eine ganze Gruppe

Das **Kätzchen** ist flink (**Geschwindigkeit 3,2**) und springt hoch (**Sprungkraft 7,5**). Die **Kröte** ist langsam (**Geschwindigkeit 2,2**), springt aber höher als Pip (**Sprungkraft 8**). Die **Eule** fliegt gemütlich (**Geschwindigkeit 2,5**). Mehrere Begleiter stellen sich hintereinander auf – wer zuerst im Level steht, läuft vorn.

![Kätzchen, Kröte und Eule](variante:4)

![Kätzchen läuft](katalog:kaetzchen/laufen 12)
![Kröte hüpft](katalog:kroete/huepfen 10)
![Eule watschelt](katalog:eule/watscheln 8)

### Keine Langeweile

Bleibt Pip stehen, wird es den Begleitern nicht langweilig. Der Hund setzt sich und schnüffelt herum. Der Vogel flattert von Platz zu Platz, landet, hüpft und pickt am Boden – und fliegt wieder auf. Dafür bekommen ihre Bilder **Begleiter sitzt** und **Begleiter beschäftigt sich** (bei **Eigenschaft hinzufügen → Begleiter**). Fehlen die Bilder, laufen sie nur ein paar Schritte hin und her. Ein Flieger, der landet, zeigt am Boden **Begleiter schaut nach rechts** und **Begleiter läuft nach rechts** – zeichne ihn dafür sitzend und hüpfend.

![Hund und Vogel beschäftigen sich](variante:6)

![Vogel pickt](katalog:vogel/pickt 8)
![Kätzchen putzt sich](katalog:kaetzchen/putzt_sich 5)
![Kröte fängt eine Fliege](katalog:kroete/fliegenfang 8)
![Entchen putzt sich](katalog:entchen/putzt_sich 4)

## Tipps

> **Tipp:** Alle Begleiter aus diesem Rezept stecken in seiner Szene. Hol sie dir mit **Sprites holen** (der Korb neben dem + in der Sprite-Liste) aus dem **Sprite-Katalog** in dein eigenes Spiel – fertig animiert.

- Gib deinem Begleiter seinen Namen als **Titel**. Dann findest du ihn in der Sprite-Liste sofort.
- Ein Begleiter, der zurückbleiben kann, macht dein Level spannender: Baust du für den Hund eine Treppe neben die hohe Kante?
- Ist er weit weg, rennt er ein bisschen schneller, um dich einzuholen. Verlierst du ein Leben, ist er gleich wieder bei dir.
- **Ein Freund, den man erst finden muss:** Klicke den Begleiter im Level an und schalte **kommt erst bei Signal mit** an. Dann wartet er, wo er steht – und beschäftigt sich dort, bis Pip in die Nähe kommt. Leg einen **Signalbereich** um ihn herum und verbinde ihn mit dem Begleiter – sobald Pip zu ihm kommt, läuft er mit und bleibt bei dir:

![Das Kätzchen wartet am Treffpunkt](variante:5)

## Wenn's nicht klappt

- **Er bewegt sich gar nicht:** Ist bei ihm im Level **kommt erst bei Signal mit** an? Dann wartet er auf sein Signal. Hat das Sprite die Eigenschaft **Begleiter**? Ist es gleichzeitig **Spielfigur** oder **Gegner**, zählt es als das – ein Begleiter braucht ein eigenes Sprite.
- **Er schafft eine Stufe, die er nicht schaffen soll (oder umgekehrt):** Ändere seine **Sprungkraft**.
- **Er kommt nicht wieder:** Er kommt erst, wenn er weit weg und nicht mehr zu sehen ist – lauf weiter. Und er braucht neben dir Platz, auf dem er stehen kann.
- **Er geht nicht ins Wasser:** Ist **kann schwimmen** an, und liegt über dem Wasser ein **Bewegungsbereich** mit **Schwimmen**?
- **Er fällt herunter, obwohl er fliegen soll:** Ist **kann fliegen** an?

## Mach mehr draus

- Zeichne einen Schleim, eine Schildkröte, eine Drohne oder deinen besten Freund als Begleiter.
- Mach eine ganze Gruppe: Wer schafft welchen Weg, wer bleibt zurück?
