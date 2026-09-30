---
titel: Pip taucht
kategorie: Wasser & Weltall
stufe: 2
kurz: Ein Bewegungsbereich macht aus Wasser echtes Wasser – Pip springt vom Steg, taucht nach Perlen und springt drüben wieder heraus.
skala: 2
# the gallery card: Pip under water, on the way to the pearls
standbild: 1.6
szene:
  himmel: ['#41a6f6', '#c3e6f6']
  legende: { P: pip_taucher, s: steg, '|': stegpfosten, R: fels, _: sand, o: perle, w: seegras, k: koralle, K: koralle_gruen, '~': wasser_oben, '=': wasser }
  effekte:
    # the deeper, the darker (over the water only)
    - { effekt: farbe, name: Tiefe, farben: ['#e8f0ff', '#6078c0'], mischmodus: abdunkeln, bereich: [0, 2.3, 13, 3.7] }
    - { effekt: bubbles, name: Blasen, farbe: '#c3e6f6aa', bereich: [0, 2.3, 13, 3.7], hinter: Figuren }
  bewegungsbereiche:
    # the water: from just below the surface down to the sea floor
    - { name: Meer, art: schwimmen, rechtecke: [[0, 2.25, 13, 3.75]] }
  ebenen:
    - name: Deko
      kollision: false
      karte: |
        ................
        ................
        ................
        ...|............
        ...|.........w..
        ...|.w..k..K....
        ................
    - name: Welt
      karte: |
        ................
        .P..............
        ssss.........RRR
        .............RRR
        .........o...RRR
        ...........o.RRR
        ________________
    - name: Wasser
      kollision: false
      vorne: true
      karte: |
        ................
        ................
        ~~~~~~~~~~~~~...
        =============...
        =============...
        =============...
        ................
ablauf:
  - { t: 0.3, halten: rechts, dauer: 3.4 }
  - { t: 0.55, drücken: springen }
  - { t: 2.3, halten: hoch, dauer: 1.2 }
  - { t: 3.5, drücken: springen }
dauer: 4.5
erwartet:
  punkte: 20
  figur_rechts_von: 13
  figur_hoeher_als: 4
---
## Kurz gesagt

1. Wasser malst du wie immer. Damit Pip darin **schwimmt**, legst du einen **Bewegungsbereich** darüber.
2. Im Wasser trägt es sie: Sie sinkt langsam, die **Pfeiltasten** steuern in alle Richtungen, und die **Sprungtaste** ist ein **Schwimmzug** nach oben.
3. Direkt unter der Oberfläche springt sie mit einem Schwimmzug aus dem Wasser – zum Beispiel auf einen Felsen.

## Das brauchst du

- **Das musst du zeichnen:** halbdurchsichtiges Wasser, eine Wasseroberfläche, einen Meeresboden und einen Steg.
- **Das kannst du später dazumalen:** Bilder, auf denen die Figur schwimmt, abtaucht, auftaucht und im Wasser treibt, Perlen zum Einsammeln, Seegras und Korallen.

![Pip schwimmt](katalog:pip/schwimmen 8)
![Pip taucht ab](katalog:pip/abtauchen 8)
![Pip taucht auf](katalog:pip/auftauchen 8)
![Pip treibt](katalog:pip/treiben 4)
![Perle](katalog:meer/perle 4)
![Seegras](katalog:meer/seegras 4)
![Koralle](katalog:meer/koralle)
![Meeresboden](katalog:meer/sand)

## Schritt für Schritt

1. **Die Welt:** links ein Steg (*nur von oben begehbar*), unten Meeresboden, rechts ein Felsen, auf den Pip am Ende springt.
2. **Das Wasser:** eine eigene Ebene ohne **Kollisionen erkennen**, in der Layer-Liste **vor** der Figur. Die Wasser-Sprites sind halbdurchsichtig – so sieht man Pip darin. Ganz oben liegt die Wasseroberfläche mit den Wellen.
3. **Der Bewegungsbereich:** Neue Ebene über **+ → Bewegungsbereich** mit **Bewegung: Schwimmen**. Zieh das Rechteck über das ganze Wasser. Oben endet es **knapp unter der Wasseroberfläche**. Es zählt die **Mitte** der Figur: Liegt sie im Rechteck, schwimmt die Figur.
4. Die Einstellungen sind am Anfang schon gut: **Schwerkraft 20 %** (Pip sinkt langsam), **Gleiten 90 %** (sie treibt noch ein Stück weiter, wenn du loslässt), **Tempo 0,8 ×** (im Wasser ist sie etwas langsamer) und **Schwimmzug 0,6 ×** (so kräftig ist ein Zug mit der Sprungtaste).
5. **Pip schwimmt:** Gib Pip einen Zustand **Spielfigur schwimmt nach rechts** – sie liegt im Wasser und strampelt. Wer mag, zeichnet noch mehr: **Spielfigur taucht ab** (Kopf voran nach unten, mit ↓), **Spielfigur taucht auf** (mit ↑ und nach einem Schwimmzug) und **Spielfigur treibt** (aufrecht, wenn du nichts drückst). Was fehlt, ersetzt das Spiel durch **schwimmt** – und ganz ohne Schwimm-Bilder nimmt es die Bilder fürs Laufen, Springen und Fallen. Auf dem Meeresgrund läuft und steht Pip wie an Land.
6. **Tiefe:** Neue Ebene über **+ → Hintergrund**, **Art: Farbe**, von Hellblau oben nach Dunkelblau unten, **Mischmodus: Abdunkeln**, nur über dem Wasser. Je tiefer, desto dunkler – auch Pip. Ein paar **Blasen** (Art: Effekt) machen das Wasser lebendig.
7. Probier es aus: Pip springt vom Steg, sinkt ins Wasser und schwimmt zu den Perlen. Mit **↑** schwimmt sie nach oben, und an der Oberfläche springt sie mit der **Sprungtaste** hinaus auf den Felsen.

## Tipps

> **Tipp:** Ein Bewegungsbereich ist unsichtbar. Er bestimmt nur, **wie** sich die Figur bewegt – wie das Wasser aussieht, malst du selbst.

- Springt Pip von hoch oben ins Wasser, bremst das Wasser sie kräftig ab. Sie landet nicht gleich auf dem Boden, sondern taucht ein.
- Mehr **Schwerkraft** lässt die Figur schneller sinken (ein Taucher mit Bleigürtel), bei **0 %** schwebt sie im Wasser und sinkt gar nicht.
- **Luftblase:** Ein zweiter Bewegungsbereich mit **Laufen – andere Schwerkraft** (100 %) mitten im Wasser wird zu einer Höhle voller Luft. Liegen Bereiche übereinander, gilt der vorderste.
- Auch Gegner schwimmen im Bewegungsbereich – ein **Jäger** sogar hinter dir her (Rezept *Ein Hai, der dich jagt*). Quallen, die nur auf und ab treiben, bekommen das Verhalten **Flatterer**.

## Wenn's nicht klappt

- **Pip fällt durch das Wasser wie durch Luft:** Das Rechteck des Bewegungsbereichs liegt nicht dort, wo das Wasser ist. Es zählt die Mitte der Figur.
- **Pip kommt nicht aus dem Wasser heraus:** Das Rechteck reicht bis über die Wasseroberfläche – dann ist sie oben immer noch „im Wasser“. Lass es knapp unter der Oberfläche enden. Oder der **Schwimmzug** steht auf 0.
- **Pip geht im Wasser nicht die Leiter hoch:** Im Wasser schwimmen die Pfeiltasten, statt zu klettern.

## Mach mehr draus

Bau eine Unterwasserhöhle mit einer Luftblase darin, in der ein Schatz liegt – und einen Fisch, der davor hin und her schwimmt.
