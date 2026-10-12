---
titel: Trampolin und Sprungfeder
kategorie: Welt bauen
stufe: 2
skala: 3
kurz: Ein Trampolin wirft Pip hoch hinauf – eine Sprungfeder noch höher, und manche spannt sich erst.
einzelbilder: true
szene:
  legende: { T: trampolin }
  zusaetzlich: [sprungfeder, sprungfeder_spannt]
  karte: |
    ...........M
    ...........M
    ...........M
    ........$..M
    .......####M
    .......####M
    .......####M
    .P.....####M
    ####T.#####M
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.95 }
dauer: 2.4
erwartet:
  figur_hoeher_als: 4
  figur_rechts_von: 8
  punkte: 50
varianten:
  - szene:
      legende: { F: sprungfeder }
      karte: |
        ...........M
        ........$..M
        .......####M
        .......####M
        .......####M
        .......####M
        .......####M
        .P.....####M
        #####F#####M
    ablauf:
      - { t: 0.3, halten: rechts, dauer: 0.95 }
      - { t: 1.8, halten: rechts, dauer: 0.4 }
    dauer: 2.8
    erwartet:
      figur_hoeher_als: 6
      punkte: 50
  - szene:
      legende: { F: sprungfeder_spannt }
      karte: |
        ...........M
        ........$..M
        .......####M
        .......####M
        .......####M
        .......####M
        .......####M
        .P.....####M
        #####F#####M
    ablauf:
      - { t: 0.3, halten: rechts, dauer: 0.55 }
      - { t: 1.7, halten: rechts, dauer: 0.45 }
    dauer: 3.2
    erwartet:
      figur_hoeher_als: 6
      punkte: 50
---
## Kurz gesagt

1. Ein Sprite mit der Eigenschaft **Trampolin** wirft jeden hoch, der darauf landet – so hoch, wie seine **Sprungkraft** sagt.
2. Mit **man kann nicht von oben reinfallen** kann man darauf stehen.
3. **wirft nach** und **Federweg**: Erst sinkt die Figur ins Tuch ein, dann fliegt sie – der Zustand **lädt auf** zeigt es.

## Das brauchst du

- **Das musst du zeichnen:** ein Trampolin, **48 × 24** Pixel groß (zwei Blöcke breit): oben das Sprungtuch, darunter die Beine. Oder eine Sprungfeder, einen Block groß: eine Platte auf einer Spiralfeder.
- **Das kannst du später dazumalen:** einen Zustand **lädt auf**, in dem das Tuch Frame für Frame tiefer einsinkt, und einen Zustand **federt**, in dem es hochschnellt, ein Stück über den Rand hinaus, und nachwippt. Bei der Sprungfeder drückt sich die Platte nach unten, die Ringe rücken zusammen – und bei der, die sich erst spannt, geht ein Lämpchen nach dem anderen an.

![Trampolin](katalog:welt/trampolin)
![lädt auf](katalog:welt/trampolin_laedt 8)
![federt](katalog:welt/trampolin_federt 24)
![Sprungfeder](katalog:welt/sprungfeder)
![lädt auf](katalog:welt/sprungfeder_laedt 6)
![federt](katalog:welt/sprungfeder_federt 20)

## Schritt für Schritt

1. Leg ein neues Sprite an und mach es mit **Funktionen → Sprite → Größe ändern** **2 × 1** Felder groß (48 × 24). Zeichne das Sprungtuch in die **oberste** Pixelreihe – dort landet man.
2. **Eigenschaft hinzufügen → Blöcke → man kann nicht von oben reinfallen**. Ohne diese Eigenschaft fällt man einfach durch.
3. **Eigenschaft hinzufügen → Plattformen → Trampolin**. Die **Sprungkraft** sagt, wie hoch es wirft – so wie die Sprungkraft einer Spielfigur: Pip springt mit 7 etwa 3 Blöcke hoch, mit **10** (so ist das Trampolin eingestellt) etwa 6, mit 12 etwa 9.
4. **höher mit Sprungtaste** ist an: Drückt man auf dem Trampolin die Sprungtaste, fliegt man noch ein Stück höher. (Normal springen kann man darauf nicht – die Sprungtaste macht den Wurf höher.)
5. **wirft nach: 0,15 s** und **Federweg: 6** Pixel: Pip landet, sinkt in dieser Zeit 6 Pixel tief ins Tuch ein – und fliegt los.
6. Neuer Zustand, in dem das Tuch nach und nach einsinkt – hier vier Frames, jeder 2 Pixel tiefer, bis 6. Beim Zustand: **Eigenschaft hinzufügen → Trampolin → lädt auf**. Seine Frames laufen während **wirft nach** genau einmal ab, und Pip sinkt Frame für Frame mit.
7. Noch ein Zustand, in dem das Tuch hochschnellt und nachwippt: **Eigenschaft hinzufügen → Trampolin → federt**. Er wird bei jedem Wurf einmal abgespielt. Dem ersten Zustand gibst du **ruhig**.
8. Setz das Trampolin ins **Level**, und zwar **in den Boden** – an die Stelle von zwei Bodenblöcken, sodass das Tuch genau auf Bodenhöhe liegt. Dann läuft Pip einfach drauf. Steht es *auf* dem Boden, muss man erst hinaufspringen: Von der Seite läuft man hindurch.
9. Probier es aus: Lauf auf das Trampolin, flieg hoch und lande auf dem Felsen beim Edelstein.

## Die Sprungfeder

Die Sprungfeder ist nur einen Block groß und hat **Sprungkraft 12** – sie wirft Pip bis ganz nach oben. Mit **wirft nach 0,12 s** und **Federweg 8** drückt Pip die Platte kurz hinunter, bevor er fliegt:

![Sprungfeder](variante:1)

## Die Feder, die sich erst spannt

Stell **wirft nach** länger ein, zum Beispiel **0,8 s**. Dann muss Pip so lange auf der Feder stehen bleiben, bevor sie ihn hochwirft. Geht er vorher herunter, passiert nichts.

Der Zustand **lädt auf** läuft jetzt langsam ab – so sieht man, wie lange es noch dauert. Hier sinkt die Platte mit Pip in sechs Frames 8 Pixel tief, die Ringe rücken zusammen, die Lämpchen gehen eines nach dem anderen an, und zum Schluss leuchtet und zittert alles:

![Erst spannen, dann fliegen](variante:2)

## Tipps

> **Tipp:** Wer auf einem Trampolin landet, bekommt **keinen Fallschaden** – egal, wie tief er fällt. Das Trampolin fängt ihn auf.

> **Profi-Tipp:** Mal die Platte in **lädt auf** gleichmäßig tiefer – im letzten Frame genau so viele Pixel wie der **Federweg**. Dann stehen die Füße immer genau auf der Platte. Und lass sie in **federt** erst ein Stück zu weit hochschnellen und dann nachwippen: Das wirkt viel lebendiger.

- Mit **wirft auch Gegner** springen auch Gegner in die Höhe, die über das Trampolin laufen.
- Ein Trampolin unter einer niedrigen Decke ist gemein: Pip stößt sich den Kopf und kommt nicht weit.
- Mehrere Trampoline hintereinander werden zur Hüpfstrecke – mit Münzen in der Luft.

## Wenn's nicht klappt

- **Pip fällt durch das Trampolin:** Es fehlt *man kann nicht von oben reinfallen*.
- **Pip läuft durch das Trampolin hindurch:** Es steht auf dem Boden. Setz es in den Boden hinein oder spring von oben darauf.
- **Pip schwebt über dem Trampolin:** Das Tuch ist nicht ganz oben im Sprite gemalt. Man steht immer auf der Oberkante.
- **Die Sprungfeder wirft nicht:** Pip geht herunter, bevor die Zeit bei **wirft nach** um ist – bleib stehen.
- **Man sieht nicht, wie sie sich spannt:** Es fehlt ein Zustand mit **lädt auf**.
- **Pip sinkt nicht ein:** **Federweg** ist 0 – oder **wirft nach** ist 0, dann gibt es keine Zeit zum Einsinken.
- **Pip schwebt über der Platte oder steckt darin:** Die Platte sinkt in **lädt auf** nicht genauso tief wie der **Federweg**.

## Mach mehr draus

Bau einen Schacht, den man nur mit Trampolinen hinaufkommt – und ganz oben wartet der Edelstein. Oder versteck eine Sprungfeder, die sich erst spannt, neben einem Gegner, der heranläuft. Schaffst du es rechtzeitig?
