---
titel: Ein Laden
kategorie: Level gestalten
stufe: 2
kurz: Über dem Schwert steht ein Preis. Mit F kauft Pip es für ihre Münzen – und der Wichtel hinter der Theke sagt, wenn das Geld nicht reicht.
tasten_zeigen: true
# the whole screen: the coins counting down and the sword in the HUD
hud: true
bild_hoch: 2
standbild: 2.0
szene:
  kamera: { bildhoehe: 180 }
  legende:
    S: { sprite: schwert, platziert: { pickup: { price: 40 } } }
    T: { sprite: trank, platziert: { pickup: { price: 20, buy_again: true } } }
    # the Verkäufer: a sign that speaks itself, with "spricht im Laden"
    W: { sprite: wichtel, platziert: { text: { text: 'Willkommen im Laden!', speaker: self, shop_keeper: true, shop_thanks: 'Danke schön!' } } }
  karte: |
    .............
    .............
    .............
    .............
    .............
    Pooooo..S..TW
    #############
    =============
    =============
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.9667 }
  - { t: 1.7, drücken: aktion }
  - { t: 2.5, halten: rechts, dauer: 0.4 }
  - { t: 3.6, drücken: aktion }
dauer: 5.6
erwartet:
  punkte_gleich: 10
  inventar: { Schwert: 1 }
  waffe: Schwert
  gesagt: ['Danke schön!', 'Dafür fehlen dir noch 10 Münzen.']
---
## Kurz gesagt

1. Leg etwas zum Einsammeln ins Level – ein Schwert, einen Trank, ein Extraleben.
2. Klick es im Level an und gib ihm einen **Preis**.
3. Im Spiel steht der Preis darüber. Die Spielfigur stellt sich davor und kauft es mit **F**.

## Das brauchst du

- **Das musst du zeichnen:** Münzen (oder etwas anderes, das **gibt Punkte**) und etwas, das man kaufen kann.
- **Das kannst du später dazumalen:** einen Verkäufer, der mit dir spricht (hier der Wichtel), eine Ladentheke, ein Schild „Laden“.

![Schwert](katalog:extra/schwert 5)
![Zaubertrank](katalog:extra/trank 6)

## Schritt für Schritt

1. Zum Bezahlen braucht die Spielfigur Punkte. Verteil Münzen mit **gibt Punkte 10** im Level davor – hier sind es fünf, also 50.
2. Leg das Schwert in den Laden. Es hat **man kann es einsammeln** mit **bleibt fürs ganze Spiel** und einen **Nahkampfangriff** – eine Waffe (Rezept *Waffen einsammeln und wechseln*).
3. Klick das Schwert im Level mit dem Auswahl-Werkzeug an und stell **Preis** auf **40**.
4. Leg einen **Zaubertrank** daneben: **Preis 20** und **kann man öfter kaufen** – dann bleibt er nach dem Kaufen liegen.
5. Stell einen Verkäufer dazu – hier den Wichtel. Er hat **Hinweistext** mit dem Text „Willkommen im Laden!“ und **Wer spricht: das Sprite spricht selbst**. Klick ihn im Level an und stell **spricht im Laden** an. Bei **sagt beim Kaufen** steht, wofür er sich bedankt.
6. Probier es aus: Pip sammelt die Münzen ein und drückt vor dem Schwert **F**. Die Münzen oben rechts zählen von 50 auf 10 herunter, oben links ist jetzt das Schwert, und der Wichtel bedankt sich. Vor dem Trank reicht das Geld nicht mehr – der Wichtel sagt, wie viel fehlt.

## Was passiert beim Kaufen?

- Hat die Spielfigur genug Punkte, werden sie abgezogen, und sie bekommt alles, was das Sprite gibt – genau wie beim Einsammeln: Energie, Leben, eine Waffe, sein Signal („sendet, wenn eingesammelt“).
- Reicht das Geld nicht, sagt der Verkäufer, wie viele Münzen noch fehlen. Es wird nichts abgezogen. Ohne Verkäufer sagt es die Spielfigur selbst – der Verkäufer ist nur ein Extra.
- Hat sie schon alle Leben, kauft sie kein Extraleben. Eine Waffe, die sie schon hat, kauft sie nicht noch einmal.
- **Preis 0** heißt: umsonst. Dann wird das Sprite wie immer beim Berühren eingesammelt.

## Tipps

- Mach aus dem Laden ein **Nebenlevel**: Eine Tür im Level führt hinein („führt zu“), der Ausgang im Laden führt zurück. Was die Spielfigur gekauft hat, bleibt gekauft.
- Den Preis stellst du für jedes Sprite im Level einzeln ein. Derselbe Trank kann in einem Laden 20 kosten und in einem anderen 50.
- Wenn du einem Sprite einen Preis gibst, zeigt der Startbildschirm des Spiels, dass man mit **F** kaufen kann.

## Wenn's nicht klappt

- **Über dem Sprite steht kein Preis:** Hast du den Preis beim Sprite *im Level* eingestellt (Auswahl-Werkzeug), nicht beim Zeichnen?
- **Die Spielfigur kann nie etwas kaufen:** Gibt in deinem Spiel etwas Punkte? Sonst zeigt der Level-Editor beim Preis einen Hinweis.

## Mach mehr draus

Lass den Verkäufer schon grüßen, wenn man den Laden betritt: Gib ihm **spricht bei Signal** und leg einen Signalbereich vor die Tür.
