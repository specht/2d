---
titel: Ein Laden
kategorie: Level gestalten
stufe: 2
skala: 2
kurz: Über dem Trank und dem Schwert steht ein Preis. Pip schaut sich alles an, der Händler preist es mit Händen und Füßen an – und mit F kauft Pip für ihre Münzen.
tasten_zeigen: true
# the whole screen: the coins counting down and the new heart in the HUD
hud: true
schritte: 2
standbild: 37.0
# close up: the stall fills the screen, the floor at the bottom, the sign at the top
bild_hoch: 2.75
szene:
  # as wide as the level: the camera stays put
  kamera: { bildhoehe: 189 }
  # big speech bubbles: the Händler's monologue is the show
  eigenschaften: { max_lives: 5, text_size: large }
  # Pip brings her money along from the level before (the coin: in the game, for the HUD's counter)
  punkte: 70
  zusaetzlich: [muenze]
  legende:
    w: laden_wand
    l: wandlampe
    s: laden_schild
    m: markise
    i: stange
    a: regal_traenke
    b: regal_buecher
    c: regal_glaeser
    '[': theke_links
    '-': theke
    ']': theke_rechts
    _: dielen
    # the Händler: a Hinweistext that speaks itself and "spricht im Laden"
    V:
      sprite: haendler
      platziert:
        text:
          text: 'Ich bin Sigi. Sigi, der Sagenhafte! Mein Name ist Programm. Und das Programm heißt: Verkaufen!'
          speaker: self
          shop_keeper: true
          shop_thanks: 'Danke, danke! Beehre mich bald wieder!'
          shop_greeting: 'Hereinspaziert! Willkommen bei Sigis Sagenhaftem Sonderposten!'
          shop_chatter: 'Nur heute: Preise so niedrig, dass ich nachts weine! | Fass ruhig alles an. Kaputt gemacht heißt gekauft! | Psst! Der Trank ist heute im Angebot. Wie gestern. Und morgen.'
    T:
      sprite: heiltrank
      platziert:
        pickup:
          price: 30
          buy_again: true
          shop_text: 'Ein Heiltrank! Ein Schluck – und schwupp, ein Leben mehr!'
          shop_buy_line: 'Eine ausgezeichnete Wahl! Den hätte ich fast selbst getrunken.'
    S:
      sprite: schwert
      platziert:
        pickup:
          price: 120
          shop_text: 'Dieses Schwert gehörte einem echten Helden. Oder seinem Nachbarn.'
  ebenen:
    - name: Wand
      kollision: false
      karte: |
        wwwwwwwwwwwwww
        wwwwwwwwwwwwww
        wwwwwwwwwwwwww
        wwwwwwwwwwwwww
        wwwwwwwwwwwwww
        wwwwwwwwwwwwww
        wwwwwwwwwwwwww
        wwwwwwwwwwwwww
    - name: Deko
      kollision: false
      karte: |
        ..............
        ..............
        ......s.......
        l.mmmmmmmmmm.l
        ..iab....cai..
        ..i........i..
        ..i........i..
    - name: Händler
      karte: |
        ..............
        ..............
        ..............
        ..............
        ..............
        ..............
        ..............
        ......V.......
    - name: Theke
      kollision: false
      karte: |
        ..............
        ..............
        ..............
        ..............
        ..............
        ..............
        ..............
        ..[--------]..
    - name: Welt
      karte: |
        ..............
        ..............
        ..............
        ..............
        ..............
        ..............
        ....T....S....
        .P............
        ______________
ablauf:
  # the Händler greets at once; then to the potion: its Beschreibung
  - { t: 6.2, halten: rechts, dauer: 0.42 }
  # to the sword: its Beschreibung – and F: too expensive
  - { t: 12.4, halten: rechts, dauer: 0.65 }
  - { t: 19.8, drücken: aktion }
  # after a quiet while the Händler chats; back to the potion and F: bought
  - { t: 31.4, halten: links, dauer: 0.65 }
  - { t: 33.0, drücken: aktion }
dauer: 40.0
erwartet:
  punkte_gleich: 40
  leben: 4
  gesagt:
    - 'Hereinspaziert!'
    - 'Willkommen bei Sigis Sagenhaftem Sonderposten!'
    - 'Ein Heiltrank!'
    - 'Ein Schluck – und schwupp, ein Leben mehr!'
    - 'Dieses Schwert gehörte einem echten Helden.'
    - 'Oder seinem Nachbarn.'
    - 'Dafür fehlen dir noch 50 Münzen.'
    - 'Nur heute: Preise so niedrig, dass ich nachts weine!'
    - 'Ein Heiltrank!'
    - 'Eine ausgezeichnete Wahl!'
    - 'Den hätte ich fast selbst getrunken.'
---
## Kurz gesagt

1. Leg etwas zum Einsammeln ins Level – einen Trank, ein Schwert, ein Extraleben.
2. Klick es im Level an und gib ihm einen **Preis**. Bei **Beschreibung** schreibst du, was es ist.
3. Im Spiel steht der Preis darüber. Die Spielfigur stellt sich davor, hört die Beschreibung und kauft es mit **F**.

## Das brauchst du

- **Das musst du zeichnen:** Münzen (oder etwas anderes, das **gibt Punkte**) und etwas, das man kaufen kann.
- **Das kannst du später dazumalen:** einen Verkäufer, der redet wie ein Wasserfall, eine Ladentheke, ein Regal, ein Schild „Laden“.

![Heiltrank](katalog:extra/heiltrank 6)
![Schwert](katalog:extra/schwert 5)
![Händler](katalog:laden/haendler_spricht 6)

## Schritt für Schritt

1. Zum Bezahlen braucht die Spielfigur Punkte. Verteil Münzen (**gibt Punkte 10**) in den Leveln davor – hier bringt Pip schon 70 mit. Die Punkte bleiben von Level zu Level.
2. Bau die Theke: eine Ebene **Theke** ohne **Kollision**, also läuft die Spielfigur davor vorbei. Dahinter liegt eine Ebene mit dem Händler, ganz hinten die Wand, die Regale und die Markise.
3. Leg einen **Heiltrank** auf die Theke. Er hat **man kann es einsammeln** mit **gibt Leben 1**. Klick ihn im Level mit dem Auswahl-Werkzeug an: **Preis 30** und **kann man öfter kaufen**.
4. Schreib bei **Beschreibung**, was der Trank kann: „Ein Heiltrank! Ein Schluck – und schwupp, ein Leben mehr!“ Und bei **Verkäufer sagt beim Kaufen**: „Eine ausgezeichnete Wahl! Den hätte ich fast selbst getrunken.“
5. Leg ein Schwert daneben, **Preis 120**, mit der Beschreibung „Dieses Schwert gehörte einem echten Helden. Oder seinem Nachbarn.“ So viel Geld hat die Spielfigur nicht – mal sehen, was der Händler dazu sagt.
6. Stell den Händler hinter die Theke. Er hat **Hinweistext** und **Wer spricht: das Sprite spricht selbst**. Zeichne ihm einen Zustand **spricht gerade**: Darin fuchtelt er mit beiden Armen – beim Reden wird er gleich viel überzeugender. Klick ihn im Level an und stell **spricht im Laden** an. Jetzt kannst du ihm noch mehr Text geben:
   - **begrüßt:** „Hereinspaziert! Willkommen bei Sigis Sagenhaftem Sonderposten!“ – das sagt er einmal, sobald die Spielfigur in seine Nähe kommt.
   - **plaudert:** Sprüche, getrennt mit **|**. Sagt ein paar Sekunden lang niemand etwas, sagt er den nächsten – Satz für Satz: „Nur heute: Preise so niedrig, dass ich nachts weine! | Fass ruhig alles an. Kaputt gemacht heißt gekauft! | …“
   - **sagt beim Kaufen:** „Danke, danke! Beehre mich bald wieder!“ – das sagt er bei allem, was keinen eigenen Satz hat.
7. Probier es aus: Pip kommt mit 70 Münzen in den Laden, und der Händler grüßt. Vor dem Trank preist er den Trank an, vor dem Schwert das Schwert. Für das Schwert reicht das Geld nicht – er sagt, wie viel fehlt. Pip geht zurück zum Trank und drückt **F**: Die Münzen oben rechts zählen von 70 auf 40 herunter, oben links kommt ein Herz dazu, und der Händler freut sich.

## Was passiert beim Kaufen?

- Hat die Spielfigur genug Punkte, werden sie abgezogen, und sie bekommt alles, was das Sprite gibt – genau wie beim Einsammeln: Energie, Leben, eine Waffe, sein Signal („sendet, wenn eingesammelt“).
- Reicht das Geld nicht, sagt der Verkäufer, wie viele Münzen noch fehlen. Es wird nichts abgezogen.
- Hat sie schon alle Leben, kauft sie kein Extraleben. Eine Waffe, die sie schon hat, kauft sie nicht noch einmal.
- **Preis 0** heißt: umsonst. Dann wird das Sprite wie immer beim Berühren eingesammelt.

## Ohne Verkäufer

Der Verkäufer ist nur ein Extra. Ohne ihn liest die Spielfigur die **Beschreibung** selbst vor, und sie sagt auch, wenn das Geld nicht reicht. Nur der Satz beim Kaufen fällt dann weg.

## Tipps

- Mach aus dem Laden ein **Nebenlevel**: Eine Tür im Level führt hinein („führt zu“), der Ausgang im Laden führt zurück. Was die Spielfigur gekauft hat, bleibt gekauft.
- Den Preis und die Beschreibung stellst du für jedes Sprite im Level einzeln ein. Derselbe Trank kann in einem Laden 30 kosten und in einem anderen 50 – und jeder Händler preist ihn anders an.
- Der Händler darf ruhig übertreiben. Je länger und alberner, desto besser!
- Gibt dein Spiel kein Herz-Sprite her, das Leben gibt, zeigt die Anzeige oben links eingebaute Herzen. Ein Trank, den man nur kaufen kann, wird dort nicht zum Herz-Bild.
- Wenn du einem Sprite einen Preis gibst, zeigt der Startbildschirm des Spiels, dass man mit **F** kaufen kann.

## Wenn's nicht klappt

- **Über dem Sprite steht kein Preis:** Hast du den Preis beim Sprite *im Level* eingestellt (Auswahl-Werkzeug), nicht beim Zeichnen?
- **Die Spielfigur kommt nicht an die Sachen auf der Theke:** Liegen sie höchstens einen Block über dem Boden, auf dem die Spielfigur steht?
- **Der Händler grüßt nicht:** Hat er **spricht im Laden** an? Erst dann gibt es **begrüßt** und **plaudert**.
- **Die Spielfigur kann nie etwas kaufen:** Gibt in deinem Spiel etwas Punkte? Sonst zeigt der Level-Editor beim Preis einen Hinweis.

## Mach mehr draus

Gib dem Händler beim Anklicken etwas zu sagen: Sein **Hinweistext** kommt, wenn die Spielfigur vor ihm steht und **F** drückt. Hier stellt er sich vor: „Ich bin Sigi. Sigi, der Sagenhafte! …“
