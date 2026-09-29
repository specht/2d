---
id: staubwirbel
titel: Staubwirbel
kategorie: Level gestalten
stufe: 2
kurz: Ein Wirbel aus Staub und Asche reißt alles mit – und taucht erst auf, wenn die Figur in die unheimliche Gegend kommt.
format: gif             # full of shader noise: a GIF is much smaller than lossless WebP
farben: 256
toleranz: 16
skala: 2
schritte: 2             # every second step: the file stays small
szene:
  himmel: ['#333c57', '#566c86']
  effekte:
    # the whirl seen from the side at an angle (neigung 65°): behind the figure,
    # eye at the right, edge 6 blocks away
    - { effekt: dust, id: wirbel, farbe: '#c2c3c7ee', tempo: 1.0, neigung: 65, pixel: true, hinter: Figuren, punkte: [[0.66, 0.62], [0.93, 0.62]] }
    # a dark red sky behind the trees appears together with it
    - { effekt: clouds, id: rotlicht, farbe: '#b13e53cc', vorne: false, tempo: 2.0 }
  ebenen:
    - name: Tannen
      kollision: false
      karte: |
        ..............
        ..............
        ..............
        ..............
        .Q....Q....Q..
        ..............
    - name: Welt
      karte: |
        ..............
        ..............
        ..............
        ..............
        .P............
        ##############
  bereiche:
    - { ziel: wirbel, rechtecke: [[6, 0, 12, 6]], im_bereich: sichtbar, ueberblendung: 1.2 }
    - { ziel: rotlicht, rechtecke: [[6, 0, 12, 6]], im_bereich: sichtbar, ueberblendung: 1.2 }
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.3 }
dauer: 3.2
erwartet:
  figur_rechts_von: 8
---
## Kurz gesagt

1. Der Effekt **Staubwirbel** lässt Staub und Asche in einen Wirbel stürzen – außen langsam, in der Mitte immer wilder.
2. Zwei weiße Punkte bestimmen den Wirbel: das **Auge** in der Mitte und den **Rand**. Mit **Neigung** schaust du schräg von der Seite auf den Wirbel.
3. Mit einem **Sichtbarkeitsbereich** taucht der Wirbel erst auf, wenn die Figur in die unheimliche Gegend kommt.

## Das brauchst du

- **Das musst du zeichnen:** nichts für den Wirbel selbst.
- **Das kannst du später dazumalen:** kahle Bäume, Ranken und Risse im Boden für die unheimliche Seite der Welt.

## Schritt für Schritt

1. Neue Ebene über **+ → Hintergrund**, dann **Art: Effekt** und **Effekt: Staubwirbel**.
2. Zieh das Rechteck über den Teil des Levels, in dem es wirbeln soll.
3. Schieb den ersten weißen Punkt dorthin, wo das **Auge** des Wirbels sein soll. Der zweite Punkt liegt auf dem **Rand**: So groß wird der Wirbel.
4. **Neigung:** Bei 0° schaust du genau von vorn auf den Wirbel – eine runde Scheibe. Bei 60° bis 70° siehst du ihn schräg von der Seite, wie einen flachen Strudel am Himmel. Die hintere Hälfte ist dann etwas blasser.
5. **Farbe:** helles Grau für Staub, fast Weiß für Asche. **Menge** macht den Wirbel dichter, **Geschwindigkeit** schneller, **Skalierung** die Staubkörner größer.
6. Setz das Häkchen bei **pixelig (wie Sprites)**, dann besteht auch der Staub aus echten Spielpixeln.
7. Leg eine zweite Ebene mit dem Effekt **Wolken** in dunklem Rot ganz nach unten, hinter die Bäume. Das ist der unheimliche Himmel.
8. Neue Ebene über **+ → Sichtbarkeitsbereich**, **Zielebene:** der Staubwirbel, **Im Bereich:** *sichtbar*, **Überblendung:** 1,2 s. Zieh das Rechteck über die unheimliche Gegend.
9. Mach dasselbe noch einmal für die roten Wolken.
10. Spiel es aus: Sobald Pip hineinläuft, färbt sich der Himmel rot und der Wirbel reißt los.

## Tipps

> **Tipp:** Direkt unter der Ebene mit der Figur wirbelt der Staub hinter ihr – man sieht sie gut. Ganz oben in der Layer-Liste wirbelt er **vor** der Figur: noch wilder, aber sie verschwindet fast darin.

- Ein kleiner Wirbel mit viel **Menge** wirkt wie ein Staubteufel in der Wüste, ein großer über dem ganzen Bild wie ein Tor in eine andere Welt.
- Mit dem **Mischmodus: Leuchten** bei der Ebene und warmem Orange wird aus dem Staub ein Funkenwirbel über einem Feuer.
- Wirbel haben keine Kollisionen – die Figur läuft einfach hindurch. Soll der Wirbel gefährlich sein, leg unsichtbare **Stacheln** dazu.

## Wenn's nicht klappt

- **Man sieht keinen Wirbel:** Die beiden Punkte liegen fast aufeinander, oder das Auge liegt außerhalb des Rechtecks.
- **Der Wirbel ist nur ein dünner Strich:** Die **Neigung** ist zu groß. Mit 60° bis 70° sieht er schräg von der Seite aus, mit 85° fast nur noch wie eine Linie.
- **Im Level-Editor bewegt sich nichts:** Setz bei den Level-Einstellungen das Häkchen bei **Effekte bewegen**.
- **Der Wirbel ist immer da:** Beim Sichtbarkeitsbereich steht **Im Bereich** auf *versteckt*, oder die **Zielebene** ist eine andere.
- **Der Wirbel verschwindet zu plötzlich:** Stell die **Überblendung** länger.
- **Es sieht aus wie Schneegestöber:** Die Farbe ist zu weiß und die **Geschwindigkeit** zu klein. Nimm Grau und dreh auf.

## Mach mehr draus

Bau ein Level mit zwei Seiten: Eine Tür führt in dieselbe Welt – nur dunkel, rot und voller Asche. Oder lass den Wirbel als Tor am Ende eines Levels stehen.
