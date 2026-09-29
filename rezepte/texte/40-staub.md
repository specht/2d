---
id: schwebestaub
titel: Staub in der Luft
kategorie: Level gestalten
stufe: 2
kurz: Feiner Staub schwebt durch eine tote, düstere Welt – er fällt nicht, er treibt mit der Luft.
format: gif             # full of shader noise: a GIF is much smaller than lossless WebP
farben: 256
toleranz: 12
skala: 2
szene:
  # night-dark, with a sick red glow low above the dead forest
  himmel: ['#10131f', '#3b2238']
  effekte:
    # the dust floats in front of everything and stays bright
    - { effekt: dust, farbe: '#d8d6e0ee', menge: 1.8, tempo: 0.8, pixel: true }
    # a cold tint over everything: gloomy, but Pip and the ground stay readable
    - { effekt: farbe, name: Düster, farben: ['#7a86ac', '#9a7f98'], mischmodus: abdunkeln }
    # fog between the dead trees and the forest far away
    # (punkte: thick at the bottom, fading out towards the top – no hard edge)
    - { effekt: clouds, name: Nebel, farbe: '#56668aa0', tempo: 0.4, hinter: Tote Bäume, bereich: [-4, 1, 22, 4], punkte: [[0.5, 0.1], [0.5, 1.0]] }
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
3. Zusammen mit kahlen Bäumen und rotem Licht am Himmel wird daraus eine unheimliche Schattenwelt.

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

1. **Tote Welt:** Mal Bäume ohne Blätter in dunklem Graublau, dazu einen fernen toten Wald als flache, noch dunklere Silhouette. Beim Boden wird das Gras grau und violett statt grün. Je weiter weg etwas ist, desto dunkler und blauer.
2. Neue Ebene über **+ → Hintergrund**, dann **Art: Effekt** und **Effekt: Schwebestaub**. Zieh das Rechteck über das ganze Level.
3. **Farbe:** helles Grau für Staub, fast Weiß für Asche. Setz das Häkchen bei **pixelig (wie Sprites)**, dann besteht jedes Staubkorn aus echten Spielpixeln.
4. **Menge** macht den Staub dichter, **Geschwindigkeit** lässt ihn schneller treiben, **Skalierung** macht die Körner größer. Für eine ruhige, unheimliche Stimmung: wenig Tempo und nicht zu viel Menge.
5. Schieb die Staub-Ebene in der Layer-Liste ganz nach oben. Dann schwebt der Staub auch vor der Figur.
6. **Düster färben:** Neue Ebene über **+ → Hintergrund**, **Art: Farbe**, mit einem kühlen Farbverlauf (oben graublau, unten altrosa). Stell bei der Ebene den **Mischmodus: Abdunkeln** ein und schieb sie direkt unter die Staub-Ebene. Alles darunter – Bäume, Boden, Figur – wird dunkler und kälter.
7. **Nebel:** Eine Ebene mit dem Effekt **Wolken** in halb durchsichtigem Graublau, nur als Streifen über dem Boden, zwischen den toten Bäumen und dem fernen Wald. Schieb den ersten weißen Punkt nach unten und den zweiten nach oben: Dann ist der Nebel unten dicht und läuft nach oben ohne Kante aus.
8. **Rotes Leuchten:** Ganz unten, hinter allem: noch einmal **Wolken**, diesmal in dunklem Rot.
9. Spiel es aus: Pip läuft durch die stille, tote Welt, und um ihn herum treibt der Staub.

## Tipps

> **Tipp:** Düster heißt nicht, dass man nichts mehr erkennt. Die Figur und der Boden, auf dem sie läuft, müssen gut zu sehen sein – dunkel werden darf vor allem, was weit weg ist. Nimm für die Abdunkeln-Ebene helle Farben: Weiß ändert gar nichts, Schwarz macht alles schwarz.

- Soll die düstere Welt erst auftauchen, wenn die Figur an eine bestimmte Stelle kommt? Gib Staub, Tönung und Wolken je einen **Sichtbarkeitsbereich** mit **Im Bereich:** *sichtbar* und etwas **Überblendung** – dann kippt die Welt ganz langsam um.
- Der Staub liegt über der Tönung, damit er hell bleibt. Liegt er darunter, wird er mit abgedunkelt und ist kaum noch zu sehen.
- Mit warmem Orange und dem **Mischmodus: Leuchten** bei der Staub-Ebene werden aus dem Staub Funken über einem Feuer.
- Staub hat keine Kollisionen – die Figur läuft einfach hindurch.

## Wenn's nicht klappt

- **Man sieht keinen Staub:** Die Staub-Ebene liegt unter der Abdunkeln-Ebene oder hinter dem Himmel. Schieb sie ganz nach oben.
- **Alles ist fast schwarz:** Die Farbe der Abdunkeln-Ebene ist zu dunkel. Nimm ein helleres Graublau.
- **Es wirkt nicht unheimlich:** Irgendwo ist noch etwas Frisches, Grünes oder Buntes. In einer toten Welt ist alles grau, blau und violett – nur das rote Leuchten fällt heraus.
- **Der Staub rast durchs Bild:** Stell die **Geschwindigkeit** kleiner.
- **Im Level-Editor bewegt sich nichts:** Setz bei den Level-Einstellungen das Häkchen bei **Effekte bewegen**.

## Mach mehr draus

Bau ein Level mit zwei Seiten: Eine Tür führt in dieselbe Welt – nur düster, still und voller Staub. Oder lass es in einem alten Keller oder einer verlassenen Mine stauben.
