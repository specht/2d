---
titel: Rutschiger Eishang
kategorie: Welt bauen
stufe: 2
kurz: Ein verschneiter Wintertag. Ein Schritt nach vorn – und Pip rutscht den Eishang ganz von allein hinunter, direkt zum Schneemann.
format: gif             # falling snow: a GIF is much smaller than lossless WebP
farben: 256
toleranz: 12
szene:
  # a grey winter sky, bright near the horizon
  himmel: ['#566c86', '#94b0c2']
  legende: { T: tannen_schnee, s: boden_schnee, m: schneemann }
  effekte:
    # snowfall in the air, in front of everything (not into the ground)
    - { effekt: snow, farbe: '#f4f4f4ff', pixel: true, menge: 1.2, tempo: 0.8, bereich: [-4, 0, 20, 5] }
  ebenen:
    - name: Wald
      kollision: false
      karte: |
        ............
        ............
        ............
        ............
        ....T.......
        ............
    - name: Schneemann
      kollision: false
      karte: |
        ............
        ............
        ............
        ............
        .........m..
        ............
    - name: Welt
      karte: |
        ............
        .P..........
        II\.........
        III\........
        IIII\.......
        =====sssssss
ablauf:
  - { t: 0.4, halten: rechts, dauer: 0.25 }
dauer: 3.0
erwartet:
  figur_rechts_von: 5
---
## Kurz gesagt

1. Eine **Schräge / Treppe** mit **Richtung: nach rechts unten** geht bergab.
2. Stell **rutschig** hoch – dann rutscht die Figur von allein.
3. Oben ein Eisblock, darunter noch mehr Eis, damit nichts in der Luft hängt. Drumherum Schnee statt grünem Gras – und schon ist Winter.

## Das brauchst du

- **Das musst du zeichnen:** einen Eishang (Kante von **links oben nach rechts unten**) und einen Eisblock.
- **Das kannst du später dazumalen:** Boden mit Schnee, verschneite Tannen, einen Schneemann – und Glitzer auf dem Eis oder Eiszapfen.

![Eishang](katalog:welt/eishang)
![Eisblock](katalog:welt/eis)
![Boden mit Schnee](katalog:welt/boden_schnee)
![Verschneite Tannen](katalog:welt/tannen_schnee)
![Schneemann](katalog:welt/schneemann)

## Schritt für Schritt

1. Zeichne den Eishang so, dass die Kante genau von der linken oberen Ecke zur rechten unteren Ecke geht.
2. **Eigenschaft hinzufügen → Schrägen → Schräge / Treppe**, **Richtung: nach rechts unten**.
3. Stell **rutschig** auf **150 %**.
4. Der Eisblock bekommt alle drei Block-Eigenschaften.
5. Bau im **Level** eine Treppe aus Eisblöcken und leg an jede Stufe einen Eishang.
6. Stell die Figur oben hin, mach einen Schritt – und los geht die Rutschpartie.

## So wird es Winter

1. **Kein Grün:** Mal den Boden mit einer dicken Schneeschicht obendrauf. Der Schnee ist unten nicht gerade, sondern weich und wellig – und darunter liegt ein schmaler Schatten.
2. **Kalte Farben:** Graublau für den Himmel, dunkles Blau und Blaugrün für die Tannen. Nimm dafür deine Tannen und mal auf jeden Zweig ein bisschen Weiß – fertig ist der Winterwald.
3. **Schneefall:** Eine Ebene **Hintergrund** mit dem Effekt **Schnee**, ganz oben in der Layer-Liste, nur über der Luft (siehe *Schnee, Regen und Nordlicht*).
4. **Eine Kleinigkeit zum Entdecken:** Ein Schneemann unten am Hang erzählt, dass hier jemand gespielt hat. Solche Details machen ein Level lebendig.

## Tipps

> **Tipp:** Je größer **rutschig**, desto schneller rutscht die Figur. Mit sehr hohen Werten kommt sie den Hang gar nicht mehr hinauf – so baust du eine Rutsche, die nur in eine Richtung geht.

- Ein Hang nach oben ist das Rezept *Schrägen und Treppen* mit **Richtung: nach rechts oben**.
- Unter jede Schräge gehört ein fester Block. Sonst sieht der Hang aus, als würde er schweben.
- Unter dem Eis liegt Erde, kein Schnee: Schnee liegt nur dort, wo er auch hinfallen konnte.
- Lass es nicht zu dicht schneien. Pip und der Hang müssen gut zu sehen sein.

## Wenn's nicht klappt

- **Die Figur rutscht nicht:** **rutschig** steht auf 0 %.
- **Die Figur rutscht in die falsche Richtung oder hüpft:** Die **Richtung** passt nicht zur gemalten Kante.
- **Unten fällt die Figur in ein Loch:** Am Ende des Hangs fehlt der Boden.

## Mach mehr draus

Bau einen langen Eisberg mit mehreren Hängen hintereinander und einer Münze an jeder Stufe – oder einen zugefrorenen See, über den Pip schlittert, mit Eiszapfen an einer Felswand und einem Iglu am Ende.
