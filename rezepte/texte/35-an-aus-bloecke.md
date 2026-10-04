---
titel: Rote und grüne Blöcke
kategorie: Signale
stufe: 2
skala: 2
kurz: Ein Schalter, zwei Ebenen – bei jedem Umlegen verschwinden die roten Blöcke und die grünen erscheinen. Oder umgekehrt.
szene:
  signale: { 1: Blöcke tauschen }
  legende:
    S: { sprite: schalter, platziert: { switch: { signal_code: 1 } } }
    R: block_rot
    G: block_gruen
    r: umriss_rot
    g: umriss_gruen
  ebenen:
    # the dashed outlines always stay: they show where the other blocks are
    - name: Umrisse
      kollision: false
      karte: |
        ......r........
        ......r........
        ......r........
        ......r........
        ........ggg....
        ...............
    - name: Welt
      karte: |
        ..............M
        ..............M
        ..............M
        .P.S..........M
        ########...####
        ========^^^====
    # the Schalter is off at the start: the red blocks are there …
    - name: Rote Blöcke
      signal: { code: 1, reaktion: solange_aus, ueberblendung: 0.2 }
      karte: |
        ......R........
        ......R........
        ......R........
        ......R........
        ...............
        ...............
    # … and the green ones only while it is on
    - name: Grüne Blöcke
      signal: { code: 1, reaktion: solange_an, ueberblendung: 0.2 }
      karte: |
        ...............
        ...............
        ...............
        ...............
        ........GGG....
        ...............
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.25 }
  - { t: 0.8, drücken: aktion }
  - { t: 1.4, halten: rechts, dauer: 1.3 }
dauer: 3.2
standbild: 1.2
tasten_zeigen: true
erwartet:
  signale: ['1 an']
  figur_rechts_von: 11
  lebt: true
---
## Kurz gesagt

1. Ein **Schalter** sendet beim Umlegen seinen **Code** – mit **an** oder **aus**.
2. Zwei **Ebenen** hören auf dasselbe Signal: Die eine ist **da, solange an**, die andere **weg, solange an**.
3. Im Spiel: Jedes Umlegen tauscht die Blöcke. Mal ist der Weg versperrt, mal fehlt die Brücke.

## Das brauchst du

- **Das musst du zeichnen:** einen Schalter (aus und an) und zwei Blöcke, die man gut unterscheiden kann – am besten in den Farben des Schalterknopfs.
- **Das kannst du später dazumalen:** gestrichelte **Umrisse** der Blöcke. Sie zeigen, wo gerade die anderen Blöcke fehlen. Mit vier Frames, in denen die Striche jeweils ein Pixel weiterrücken, laufen sie im Kreis.

![Roter Block](katalog:welt/block_rot) ![Grüner Block](katalog:welt/block_gruen) ![Umriss rot](katalog:welt/umriss_rot 6) ![Umriss grün](katalog:welt/umriss_gruen 6)

## Schritt für Schritt

1. Zeichne den Schalter wie im Rezept *Ein Schalter öffnet das Tor*.
2. Zeichne einen roten und einen grünen Block. Beide bekommen **Eigenschaft hinzufügen → Blöcke** mit allen drei Eigenschaften – wie ein Boden.
3. Bau im **Level** die Welt mit dem Schalter. Klicke ihn an und gib seinem Signal einen Namen: neben dem **Code** **ohne Namen** → **Namen geben …**, zum Beispiel **Blöcke tauschen**.
4. Leg eine **neue Ebene** an, nenne sie **Rote Blöcke** und lass **Kollisionen erkennen** an. Stell **Bei Signal** auf **weg, solange an** und wähle neben **Code** das Signal **Blöcke tauschen**. Setz die roten Blöcke hinein – hier eine Mauer, die den Weg versperrt.
5. Leg noch eine Ebene an: **Grüne Blöcke**, **Bei Signal: da, solange an**, Signal **Blöcke tauschen**. Setz die grünen Blöcke hinein – hier eine Brücke über die Stacheln.
6. Probier es aus: Am Anfang ist der Schalter aus. Die rote Mauer steht, die grüne Brücke fehlt. Legst du den Schalter um, ist es genau andersherum.

Unter dem Code steht, was zusammengehört: *»Blöcke tauschen« (Code 1) in diesem Level – sendet: 1 Schalter · reagiert: Ebene »Rote Blöcke«, Ebene »Grüne Blöcke«*.

> **Achtung:** Spielfigur, Schalter und Gegner gehören nicht in die Ebenen, die verschwinden. Die Ebene reagiert sonst gar nicht.

## Tipps

- **Umrisse:** Eine Ebene ohne **Kollisionen erkennen** hinter den Blöcken, mit einem gestrichelten Umriss an jeder Stelle eines Blocks – eine Pixellinie, ein Pixel vom Rand entfernt, damit zwei Umrisse nebeneinander nicht zu einer dicken Linie werden. Ist der Block da, verdeckt er seinen Umriss. Ist er weg, sieht man, wo er gleich wieder auftaucht.
- **Überblendung** bei der Ebene macht das Erscheinen weich. Fest wird ein Block aber sofort – egal, wie lange er noch einblendet.
- **Ein Schalter pro Signal:** Jeder Schalter merkt sich selbst, ob er an oder aus ist. Ein zweiter Schalter mit demselben Signal weiß nicht, wie der erste steht – dann passen Hebel und Blöcke nicht mehr zusammen.
- Mit einer **Druckplatte** statt des Schalters sind die grünen Blöcke nur da, solange jemand auf ihr steht.
- Statt Blöcken kann auch ein Tor wechseln: **Bei Signal: wechseln** macht es bei jedem Umlegen auf oder zu.

## Wenn's nicht klappt

- **Beide Blockfarben sind gleichzeitig da (oder beide weg):** Bei beiden Ebenen steht dasselbe unter **Bei Signal**. Eine braucht **da, solange an**, die andere **weg, solange an**.
- **Nichts passiert beim Umlegen:** Schalter und Ebenen haben nicht dasselbe Signal (schau in die Signale-Übersicht (Taste S)) – oder die Spielfigur liegt in einer der Ebenen.
- **Man fällt durch die grünen Blöcke:** In der Ebene ist **Kollisionen erkennen** aus.
- **Die Spielfigur steckt plötzlich in einer Mauer:** Sie stand dort, wo die Blöcke erscheinen. Stell den Schalter so, dass man ihn nicht mitten zwischen den Blöcken umlegt.

## Mach mehr draus

Bau ein Rätsel: Die rote Mauer versperrt den Weg zum Schlüssel, die grüne Brücke führt zum Ausgang – und unterwegs muss man den Schalter mehrmals umlegen. Oder nimm zwei Schalter mit zwei Signalen und vier Farben.
