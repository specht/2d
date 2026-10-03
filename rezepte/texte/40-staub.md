---
id: schwebestaub
titel: Staub in der Luft
kategorie: Level gestalten
stufe: 2
kurz: Feiner Staub schwebt durch eine tote, düstere Welt – er fällt nicht, er treibt mit der Luft.
skala: 2
# every second frame (30 per second): the dust drifts slowly, and the file stays half as big
schritte: 2
# the still for the gallery card: right in the second flash
standbild: 2.8
szene:
  # night-dark, with a sick red glow low above the dead forest
  himmel: ['#10131f', '#3b2238']
  effekte:
    # the dust floats in front of everything and stays bright
    - { effekt: dust, farbe: '#d8d6e0ee', menge: 1.8, tempo: 0.8, pixel: true }
    # a cold tint over everything: gloomy, but Pip and the ground stay readable
    - { effekt: farbe, name: Düster, farben: ['#8591b6', '#a68ba2'], mischmodus: abdunkeln }
    # fog between the dead trees and the forest far away
    # (punkte: thick at the bottom, fading out towards the top – no hard edge)
    - { effekt: clouds, name: Nebel, farbe: '#6b7ba0a8', tempo: 0.4, hinter: Tote Bäume, bereich: [-4, 1, 22, 4], punkte: [[0.5, 0.1], [0.5, 1.0]] }
    # a thunderstorm far away: in front of the sky, behind everything else –
    # when it flashes, the dead trees stand out black against the light
    - { effekt: lightning, name: Gewitter, farbe: '#eef3ffff', vorne: false, blitz_alle: 2.2, himmel_leuchtet: 1.0, blitz_aufbau: 0.18, pixel: true }
    # the red glow behind everything
    - { effekt: clouds, name: Rotes Leuchten, farbe: '#b13e5399', vorne: false, tempo: 0.5 }
  ebenen:
    - name: Toter Wald
      kollision: false
      karte: |
        ..............
        ..............
        ..............
        ..............
        4.......4.....
        ..............
    - name: Tote Bäume
      kollision: false
      karte: |
        ..............
        ..............
        ..............
        ..............
        ..1...3...2...
        ..............
    - name: Welt
      karte: |
        ..............
        ..............
        ..............
        ..............
        .P............
        55555555555555
ablauf:
  - { t: 0.6, halten: rechts, dauer: 0.9 }
  - { t: 2.4, halten: rechts, dauer: 0.35 }
dauer: 3.8
erwartet:
  figur_rechts_von: 7
---
## Kurz gesagt

1. Der Effekt **Schwebestaub** lässt feinen Staub oder Asche in der Luft hängen. Er fällt nicht wie Schnee, sondern treibt ganz langsam mit der Luft und dreht dabei kleine Kreise.
2. Eine Ebene mit einer **Farbe** und dem **Mischmodus: Abdunkeln** färbt die ganze Welt düster – ohne dass du etwas neu malen musst.
3. Zusammen mit kahlen Bäumen, rotem Licht und einem fernen **Gewitter** am Himmel wird daraus eine unheimliche Schattenwelt.

## Das brauchst du

- **Für den Staub selbst** musst du nichts zeichnen.
- **Das musst du auch zeichnen:** eine tote Welt – kahle, krumme Bäume, einen fernen toten Wald als Silhouette und Boden mit vertrocknetem Gras. Nichts ist grün, nichts blüht.
- **Das kannst du später dazumalen:** Ranken, Risse im Boden, verfallene Zäune.

![Toter Baum](katalog:welt/toter_baum)
![Krummer Baum](katalog:welt/toter_baum_2)
![Schmaler Baum](katalog:welt/toter_baum_3)
![Toter Wald](katalog:welt/tote_baeume_fern)
![Toter Boden](katalog:welt/boden_tot)

## Schritt für Schritt

1. **Tote Welt:** Mal Bäume ohne Blätter fast ganz in Schwarzblau – als Silhouette, nur mit einem ganz schmalen, etwas helleren Rand. Dazu einen fernen toten Wald als flache Silhouette in hellerem, blassem Graublau. Beim Boden wird das Gras grau und violett statt grün. Je weiter weg etwas ist, desto heller und blasser – wie im Nebel.
2. Neue Ebene über **+ → Hintergrund**, dann **Art: Effekt** und **Effekt: Schwebestaub**. Zieh das Rechteck über das ganze Level.
3. **Farbe:** helles Grau für Staub, fast Weiß für Asche. Setz das Häkchen bei **pixelig (wie Sprites)**, dann besteht jedes Staubkorn aus echten Spielpixeln.
4. **Menge** macht den Staub dichter, **Geschwindigkeit** lässt ihn schneller treiben, **Skalierung** macht die Körner größer. Für eine ruhige, unheimliche Stimmung: wenig Tempo und nicht zu viel Menge.
5. Schieb die Staub-Ebene in der Layer-Liste ganz nach oben. Dann schwebt der Staub auch vor der Figur.
6. **Düster färben:** Neue Ebene über **+ → Hintergrund**, **Art: Farbe**, mit einem kühlen Farbverlauf (oben graublau, unten altrosa). Stell bei der Ebene den **Mischmodus: Abdunkeln** ein und schieb sie direkt unter die Staub-Ebene. Alles darunter – Bäume, Boden, Figur – wird dunkler und kälter.
7. **Nebel:** Eine Ebene mit dem Effekt **Wolken** in halb durchsichtigem Graublau, nur als Streifen über dem Boden, zwischen den toten Bäumen und dem fernen Wald. Schieb den ersten weißen Punkt nach unten und den zweiten nach oben: Dann ist der Nebel unten dicht und läuft nach oben ohne Kante aus.
8. **Rotes Leuchten:** Ganz unten, hinter allem: noch einmal **Wolken**, diesmal in dunklem Rot.
9. **Gewitter:** Noch eine Ebene mit dem Effekt **Gewitter**, in hellem, kühlem Weißblau. Schieb sie ganz nach unten, direkt über den Himmel – **hinter** alle Bäume. Wenn es blitzt, leuchtet der Himmel auf, und die toten Bäume stehen für einen Augenblick schwarz vor dem Licht. **Blitz alle** bestimmt, wie oft es blitzt (hier alle **2,2 s**), **Himmel leuchtet**, wie hell der Himmel dabei wird (hier **1** – ganz hell, damit man es auch durch die düstere Tönung sieht), und **Aufblitzen**, wie schnell ein Blitz hell wird (hier **0,18 s**: schnell, aber so, dass man es sieht). In dieser Zeit zuckt der Blitz von oben nach unten, und der Himmel hellt sich hinter ihm auf. Mit **pixelig (wie Sprites)** wird der Blitz in Spielpixeln gezeichnet – so passt er zu den Bäumen und zu Pip. Der Blitz selbst bleibt immer ein bisschen heller als der Himmel – so sieht man ihn auch bei **Himmel leuchtet 1**.
10. Probier es aus: Pip läuft durch die stille, tote Welt, um ihn herum treibt der Staub – und in der Ferne blitzt es.

## Tipps

> **Tipp:** Eine Silhouette wirkt nur, wenn dahinter etwas Helleres ist. Die nahen Bäume sind fast schwarz, der Nebel und der ferne Wald dahinter heller – so stehen die Bäume klar vor dem Hintergrund, obwohl alles düster ist.

> **Tipp:** Düster heißt nicht, dass man nichts mehr erkennt. Die Figur und der Boden, auf dem sie läuft, müssen gut zu sehen sein – dunkel werden darf vor allem, was weit weg ist. Nimm für die Abdunkeln-Ebene helle Farben: Weiß ändert gar nichts, Schwarz macht alles schwarz.

- Soll die düstere Welt erst auftauchen, wenn die Figur an eine bestimmte Stelle kommt? Leg dort einen **Signalbereich** an (**+ → Signalbereich**) und stell bei Staub, Tönung und Wolken **Bei Signal: erscheint** mit dem Signal des Signalbereichs und etwas **Überblendung** ein – dann kippt die Welt ganz langsam um.
- Der Staub liegt über der Tönung, damit er hell bleibt. Liegt er darunter, wird er mit abgedunkelt und ist kaum noch zu sehen.
- Mit warmem Orange und dem **Mischmodus: Leuchten** bei der Staub-Ebene werden aus dem Staub Funken über einem Feuer.
- Staub hat keine Kollisionen – die Figur läuft einfach hindurch.
- Nimm beim Gewitter das Häkchen bei **Blitze zeigen** weg, dann flackert nur der Himmel – wie Wetterleuchten weit weg. Das ist noch unheimlicher, weil man den Blitz nie sieht.
- Das Gewitter wirkt am stärksten, wenn es selten blitzt. Alle zwei Sekunden ist für ein Rezept gut, in einem Spiel sind zehn oder zwanzig Sekunden oft schöner.

## Wenn's nicht klappt

- **Man sieht keinen Staub:** Die Staub-Ebene liegt unter der Abdunkeln-Ebene oder hinter dem Himmel. Schieb sie ganz nach oben.
- **Alles ist fast schwarz:** Die Farbe der Abdunkeln-Ebene ist zu dunkel. Nimm ein helleres Graublau.
- **Die Bäume verschwimmen mit dem Hintergrund:** Nahe und ferne Bäume sind gleich hell. Mal die nahen dunkler und die fernen heller.
- **Es wirkt nicht unheimlich:** Irgendwo ist noch etwas Frisches, Grünes oder Buntes. In einer toten Welt ist alles grau, blau und violett – nur das rote Leuchten fällt heraus.
- **Der Staub rast durchs Bild:** Stell die **Geschwindigkeit** kleiner.
- **Die Blitze sind vor den Bäumen:** Die Gewitter-Ebene liegt in der Layer-Liste zu weit oben. Schieb sie ganz nach unten, direkt über den Himmel.
- **Es blitzt, aber man sieht es kaum:** Die Abdunkeln-Ebene schluckt das Licht. Nimm für das Gewitter eine hellere Farbe oder stell **Himmel leuchtet** höher.
- **Im Level-Editor bewegt sich nichts:** Schalte unter Werkzeuge **Level animieren** ein (Taste A).

## Mach mehr draus

Bau ein Level mit zwei Seiten: Eine Tür führt in dieselbe Welt – nur düster, still und voller Staub. Oder lass es in einem alten Keller oder einer verlassenen Mine stauben.
