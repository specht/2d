---
titel: So wird ein Level geschafft
kategorie: Signale
stufe: 2
skala: 4
kurz: Ein Level ist geschafft, wenn die Spielfigur das Ziel erreicht – oder wenn ein Signal es sagt. Und ein Ziel kann zu sein, bis ein Schalter es öffnet.
szene:
  karte: |
    ..........
    ..........
    ..........
    .P....!...
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.9 }
dauer: 2.4
beschriftung:
  - { text: 1. Ziel, spalte: 6, zeile: 1 }
erwartet:
  geschafft: true
  lebt: true
varianten:
  - szene:
      signale: { 7: Edelstein gefunden }
      legende:
        $: { sprite: edelstein, platziert: { pickup: { signal_on_collect: true, signal_code: 7 } } }
      geschafft_bei: 7
      karte: |
        ..........
        ..........
        ..........
        .P....$...
        ##########
    beschriftung:
      - { text: 2. Signal, spalte: 6, zeile: 1 }
    erwartet:
      signale: ['7 an']
      geschafft: true
      lebt: true
  # 3. an exit that opens only on a Signal: closed at first (the figure walks
  # over it), the switch opens it; it sends "Am Ziel" while the figure stands at it
  - szene:
      signale: { 3: Ziel offen, 8: Am Ziel }
      legende:
        S: { sprite: schalter, platziert: { switch: { signal_code: 3 } } }
        '!': { sprite: ziel, platziert: { level_complete: { opens_on_signal: true, signal_code: 3, signal_on_reach: true, send_code: 8 } } }
      karte: |
        ..........
        ..........
        ..........
        .P..!..S..
        ##########
    ablauf:
      - { t: 0.3, halten: rechts, dauer: 0.75 }
      - { t: 1.3, drücken: aktion }
      - { t: 1.8, halten: links, dauer: 0.4 }
    dauer: 3.6
    beschriftung:
      - { text: 3. erst nach dem Schalter, spalte: 4, zeile: 1 }
    erwartet:
      signale: ['8 an', '8 aus', '3 an', '8 an']
      geschafft: true
      lebt: true
---
## Kurz gesagt

1. **Das Ziel:** Ein Sprite mit der Eigenschaft **Levelwechsel** beendet das Level, sobald die Spielfigur es berührt.
2. **Ein Signal:** Mit **geschafft bei Signal** ist das Level geschafft, sobald ein Signal ankommt – von einem Edelstein, einem Schalter, einem besiegten Gegner, wenn **alle Gegner besiegt** sind oder wenn die Zeit um ist.
3. **Ein Ziel, das erst aufgeht:** Verbinde einen Schalter mit dem Ziel – dann ist es zu, bis der Schalter umgelegt ist.
4. Danach geht es mit dem **nächsten Level** weiter. Nach dem letzten Level steht **Ende** da – und dass man dein Spiel geschafft hat.

## Das brauchst du

- **Das musst du zeichnen:** ein Ziel – eine Fahne, ein Tor, eine Rakete, was zu deinem Spiel passt.
- **Das kannst du später dazumalen:** eine Animation, zum Beispiel eine wehende Fahne.

![Ziel](katalog:welt/ziel 4)

## Schritt für Schritt

**Mit einem Ziel:**

1. Zeichne das Ziel und gib ihm **Eigenschaft hinzufügen → Level → Levelwechsel**.
2. Setz es ins **Level**, dorthin, wo das Level zu Ende sein soll. Es muss in einer Ebene mit **Kollisionen erkennen** liegen.
3. Probier es mit **Level testen** (Taste T) aus: Berührt die Figur das Ziel, zoomt die Kamera auf sie, und das Level ist geschafft.

**Mit einem Signal:**

1. Klicke auf eine leere Stelle im Level. Bei den **Level-Eigenschaften** schaltest du **geschafft bei Signal** an.
2. Wähle neben **Code** das Signal aus der Liste, das das Level beenden soll – oder lass es so und gib es dem Sender: Hier sendet ein Edelstein mit **sendet, wenn eingesammelt** das Signal **Edelstein gefunden** (siehe *Der Edelstein baut die Brücke*).
3. Probier es aus: Sobald das Signal ankommt, ist das Level geschafft – egal, wo die Figur gerade ist.

In der **Signale-Übersicht (Taste S)** steht die Regel als Satz: *Wenn »Edelstein« eingesammelt wird, dann ist das Level geschafft*.

**Ein Ziel, das erst aufgeht:**

1. Wähle das Werkzeug **Verbinden** (Taste R), klick erst auf den Schalter, dann auf das Ziel. Das Ziel bekommt **öffnet erst bei Signal**.
2. Im Spiel läuft die Figur jetzt über das Ziel hinweg, bis der Schalter umgelegt ist. Danach bleibt es offen.
3. Zeichne dem Ziel zwei Zustände: **Ausgang zu** und **Ausgang offen** – dann sieht man, ob es schon offen ist.
4. Mit **sendet, wenn die Figur davorsteht** kann das Ziel selbst ein Signal senden – zum Beispiel lässt es ein Schild sagen: „Leg erst den Hebel um!“

## In der Signale-Übersicht

Ganz oben in der **Signale-Übersicht (Taste S)** steht immer die Karte **Level geschafft**: alles, was dieses Level beendet – jedes Ziel und **geschafft bei Signal**, mit **→ weiter:** daneben. Dort stellst du auch gleich ein, wohin es weitergeht und ob man dafür **F** drücken muss. Ein Ziel, das erst aufgeht, steht dort mit einem Schloss: *zu, bis »Ziel offen« kommt*.

## Welcher Weg passt?

- **Ein Ziel** passt, wenn man irgendwo **hinkommen** muss: zum Ausgang, zur Fahne, zur Rakete.
- **Alle Gegner besiegt:** Schalte bei den Level-Eigenschaften **sendet, wenn alle Gegner besiegt** an und wähle bei **geschafft bei Signal** dasselbe Signal. Dann ist das Level vorbei, sobald kein Gegner mehr übrig ist (wie man das Signal baut, steht in *Die Falle schnappt zu*).
- **Durchhalten:** **sendet beim Start** mit einer **Verzögerung** und dasselbe Signal bei **geschafft bei Signal** – wer so lange überlebt, hat es geschafft (siehe *Wettlauf gegen die Zeit*).
- **Einen Schatz finden:** ein Edelstein, ein Schlüssel oder ein Schalter, der das Signal sendet – wie hier.

Beide Wege gehen auch zusammen: Das Ziel funktioniert weiter, auch wenn das Level **geschafft bei Signal** hat.

## Tipps

- **Welches Level kommt danach?** Das nächste in der Liste der Level, bei dem **Level verwenden** angehakt ist. Ein Level ohne Haken wird übersprungen.
- Beim Ziel kannst du im Level einstellen, wohin es **führt**: normalerweise **zum nächsten Level**. Du kannst auch ein bestimmtes Level wählen – so führen zwei Türen in zwei verschiedene Level – oder **zurück, woher man kam** und **zum Spielende**. Kommt die Figur durch so eine Tür in ein Level, steht sie dort an der Tür, die zurückführt.
- Mit **nur mit Aktionstaste** geht die Figur erst durch das Ziel, wenn man davor **F** drückt – wie bei einer Tür. Dann kann man auch daran vorbeilaufen.
- Ein **Nebenlevel** (bei den Level-Eigenschaften) ist ein Laden, ein Bonuslevel oder ein Geheimraum: Nach dem Level davor geht es nicht dort weiter, man kommt nur durch ein Ziel hinein, das genau dorthin führt. Ein Ziel im Nebenlevel führt von selbst zurück.
- Auf dem Bildschirm steht danach **Geschafft!** – und „Weiter mit:“ und der Name des nächsten Levels, wenn es einen hat. In ein Nebenlevel hinein und wieder heraus geht es wie durch eine Tür: Da steht kurz nur der Name des Levels, und es geht von selbst weiter. Gib deinen Levels gute Namen: Der Name steht auch am Anfang des Levels groß da.

## Wenn's nicht klappt

- **Die Figur läuft durch das Ziel hindurch:** Es liegt in einer Ebene ohne **Kollisionen erkennen**, oder ihm fehlt **Levelwechsel** – oder es **öffnet erst bei Signal** und das Signal ist noch nicht gekommen (schau auf die Karte *Level geschafft*).
- **Das Signal kommt an, aber das Level geht weiter:** Bei den Level-Eigenschaften ist **geschafft bei Signal** aus, oder es hat ein anderes Signal als der Sender (schau in die Signale-Übersicht).
- **Nach dem Ziel kommt sofort das Ende:** Es gibt kein weiteres Level mit **Level verwenden**.

## Mach mehr draus

Bau ein Level mit zwei Ausgängen: Ein Ziel führt zum nächsten Level, ein verstecktes Ziel führt zu einem Level weiter hinten – eine Abkürzung. Oder ein Level, das man nur verlassen kann, wenn alle Gegner besiegt sind – und eine Uhr, die das Level nach einer Minute trotzdem beendet.
