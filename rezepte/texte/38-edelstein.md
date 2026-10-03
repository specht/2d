---
titel: Der Edelstein baut die Brücke
kategorie: Signale
stufe: 2
skala: 2
kurz: Pip sammelt einen Edelstein ein – und über dem Stachelgraben erscheint eine Brücke.
szene:
  signale: { 4: Edelstein gefunden }
  legende:
    $: { sprite: edelstein, platziert: { pickup: { signal_on_collect: true, signal_code: 4 } } }
  ebenen:
    - name: Welt
      karte: |
        .............M
        .............M
        .............M
        .P..$........M
        ######....####
        ======^^^^====
    - name: Brücke
      signal: { code: 4, reaktion: erscheint }
      karte: |
        ..............
        ..............
        ..............
        ..............
        ......----....
        ..............
ablauf:
  - { t: 0.3, halten: rechts, dauer: 2.2 }
dauer: 2.9
erwartet:
  signale: ['4 an']
  punkte: 50
  figur_rechts_von: 10
  lebt: true
---
## Kurz gesagt

1. Alles, was man **einsammeln** kann, kann dabei auch ein **Signal** senden – zum Beispiel ein Edelstein.
2. Eine **Ebene** mit demselben Signal **erscheint**, sobald er eingesammelt ist: hier die Brücke über den Graben.
3. Im Spiel: erst den Edelstein holen, dann kommt man weiter.

## Das brauchst du

- **Das musst du zeichnen:** etwas zum Einsammeln, zum Beispiel einen Edelstein, und eine Brücke.
- **Das kannst du später dazumalen:** ein Funkeln – leg dafür ein paar Bilder in den Zustand.

![Edelstein](katalog:welt/edelstein 6)

## Schritt für Schritt

1. Zeichne den Edelstein und gib ihm **Eigenschaft hinzufügen → Einsammeln → man kann es einsammeln**. Bei **gibt Punkte** kannst du ihm zum Beispiel **50** geben.
2. Setz ihn ins **Level** und klicke ihn an. Schalte **sendet, wenn eingesammelt** an. Er bekommt einen eigenen **Code**. Gib dem Signal einen Namen: neben dem Code **ohne Namen** → **Namen geben …**, zum Beispiel **Edelstein gefunden**.
3. Leg eine **neue Ebene** an, nenne sie **Brücke** und lass **Kollisionen erkennen** an. Setz die Bretter der Brücke hinein.
4. Stell bei dieser Ebene **Bei Signal** auf **erscheint** und wähle neben **Code** aus der Liste **Edelstein gefunden**.
5. Probier es mit **Level testen** (Taste T) aus: Am Anfang fehlt die Brücke. Sobald die Figur den Edelstein einsammelt, ist sie da.

In der **Signale-Übersicht (Taste S)** steht deine Regel als Satz: *Wenn »Edelstein« eingesammelt wird, dann erscheint die Ebene »Brücke«*.

## Tipps

- Schneller geht's mit dem Werkzeug **Verbinden** (Taste R): erst den Edelstein anklicken, dann eine Brücke in ihrer Ebene. Das schaltet **sendet, wenn eingesammelt** gleich mit an.
- Nur dieser eine Edelstein sendet. Andere Edelsteine aus derselben Zeichnung sammeln nur Punkte – außer du schaltest es bei ihnen auch an.
- Statt einer Brücke kann der Edelstein auch ein **Tor öffnen** oder eine Mauer **verschwinden** lassen – alles, was auf sein Signal hört.
- Mit **Verzögerung** baut sich die Brücke erst kurz nach dem Einsammeln auf.
- Soll der Edelstein das Level beenden? Gib dem Level **geschafft bei Signal** mit demselben Signal – siehe *So wird ein Level geschafft*.

## Wenn's nicht klappt

- **Die Brücke erscheint nicht:** Beim Edelstein ist **sendet, wenn eingesammelt** aus, oder Edelstein und Ebene haben nicht dasselbe Signal (schau in die Signale-Übersicht).
- **Die Brücke ist von Anfang an da:** Bei der Ebene steht **Bei Signal** nicht auf **erscheint**.
- **Man fällt durch die Brücke:** Bei der Ebene ist **Kollisionen erkennen** aus.
- **Man kann den Edelstein nicht einsammeln:** Er liegt in einer Ebene ohne **Kollisionen erkennen**, oder ihm fehlt **man kann es einsammeln**.

## Mach mehr draus

Versteck den Edelstein an einer schwierigen Stelle – auf einer hohen Plattform oder hinter Stacheln. Oder lass jeden von drei Edelsteinen ein anderes Stück der Brücke bauen.
