---
id: schwebestaub
titel: Staub in der Luft
kategorie: Level gestalten
stufe: 2
kurz: Feiner Staub schwebt langsam durch eine düstere Welt – er fällt nicht, er treibt mit der Luft.
format: gif             # full of shader noise: a GIF is much smaller than lossless WebP
farben: 256
toleranz: 12
skala: 2
szene:
  himmel: { farben: [['#f64151', 0.5, 1.0], ['#132f37', 0.5, 0.0]], dither: noise, stufen: 5 }
  effekte:
    # the dust floats in front of everything, the tint makes the world gloomy
    - { effekt: dust, farbe: '#a21327ff', menge: 2.0, tempo: 1.0, pixel: true }
    - { effekt: farbe, name: Düster, farben: ['#56668a', '#7d6784'], mischmodus: abdunkeln }
    # a dull red glow far behind the trees
    - { effekt: clouds, farbe: '#b13e53c0', vorne: false, tempo: 0.6 }
  ebenen:
    - name: Tote Bäume
      kollision: false
      karte: |
        ..............
        ..............
        ..............
        ..............
        ...1.......2..
        ..............
    - name: Welt
      karte: |
        ..............
        ..............
        ..............
        ..............
        .P............
        ##############
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

- **Das musst du zeichnen:** nichts für den Staub selbst.
- **Das kannst du später dazumalen:** kahle Bäume, Ranken und Risse im Boden für die unheimliche Seite der Welt.

![Toter Baum](katalog:welt/toter_baum)
![Krummer Baum](katalog:welt/toter_baum_2)

## Schritt für Schritt

1. Neue Ebene über **+ → Hintergrund**, dann **Art: Effekt** und **Effekt: Schwebestaub**. Zieh das Rechteck über das ganze Level.
2. **Farbe:** helles Grau für Staub, fast Weiß für Asche. Setz das Häkchen bei **pixelig (wie Sprites)**, dann besteht jedes Staubkorn aus echten Spielpixeln.
3. **Menge** macht den Staub dichter, **Geschwindigkeit** lässt ihn schneller treiben, **Skalierung** macht die Körner größer. Für eine ruhige, unheimliche Stimmung: wenig Tempo und nicht zu viel Menge.
4. Schieb die Staub-Ebene in der Layer-Liste ganz nach oben. Dann schwebt der Staub auch vor der Figur.
5. **Düster färben:** Neue Ebene über **+ → Hintergrund**, **Art: Farbe**, mit einem graublauen Farbverlauf. Stell bei der Ebene den **Mischmodus: Abdunkeln** ein und schieb sie direkt unter die Staub-Ebene. Alles darunter – Bäume, Boden, Figur – wird dunkler und kälter.
6. Ganz unten, hinter den Bäumen: eine Ebene mit dem Effekt **Wolken** in dunklem Rot. Das ist das ferne, unheimliche Licht.
7. Spiel es aus: Pip läuft durch die stille, graue Welt, und um ihn herum treibt der Staub.

## Tipps

> **Tipp:** Die Farbe der Abdunkeln-Ebene bestimmt die Stimmung: Graublau wirkt kalt und still, ein dunkles Violett unheimlich, ein warmes Braun nach altem Keller. Weiß ändert gar nichts, Schwarz macht alles schwarz.

- Soll die düstere Welt erst auftauchen, wenn die Figur an eine bestimmte Stelle kommt? Gib Staub, Tönung und Wolken je einen **Sichtbarkeitsbereich** mit **Im Bereich:** *sichtbar* und etwas **Überblendung** – dann kippt die Welt ganz langsam um.
- Der Staub liegt über der Tönung, damit er hell bleibt. Liegt er darunter, wird er mit abgedunkelt und ist kaum noch zu sehen.
- Mit warmem Orange und dem **Mischmodus: Leuchten** bei der Staub-Ebene werden aus dem Staub Funken über einem Feuer.
- Staub hat keine Kollisionen – die Figur läuft einfach hindurch.

## Wenn's nicht klappt

- **Man sieht keinen Staub:** Die Staub-Ebene liegt unter der Abdunkeln-Ebene oder hinter dem Himmel. Schieb sie ganz nach oben.
- **Alles ist fast schwarz:** Die Farbe der Abdunkeln-Ebene ist zu dunkel. Nimm ein helleres Graublau.
- **Der Staub rast durchs Bild:** Stell die **Geschwindigkeit** kleiner.
- **Im Level-Editor bewegt sich nichts:** Setz bei den Level-Einstellungen das Häkchen bei **Effekte bewegen**.

## Mach mehr draus

Bau ein Level mit zwei Seiten: Eine Tür führt in dieselbe Welt – nur düster, still und voller Staub. Oder lass es in einem alten Keller oder einer verlassenen Mine stauben.
