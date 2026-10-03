---
titel: Ein Vogel fliegt mit
kategorie: Begleiter
stufe: 2
skala: 3
kurz: Mit „kann fliegen“ folgt dir dein Begleiter durch die Luft – über Lücken und Kanten hinweg, ganz ohne zu springen.
szene:
  legende: { v: vogel, f: fee }
  karte: |
    ......................
    ......................
    ......................
    f.....................
    .v............########
    ...P..........========
    ########..############
    ========..============
ablauf:
  - { t: 0.5, halten: rechts, dauer: 2.0 }
  - { t: 1.0, drücken: springen }
  - { t: 1.8, drücken: springen }
dauer: 5.2
erwartet:
  figur_rechts_von: 16
  begleiter_einzeln:
    # both fly over the gap (never lower than the ground) and up after Pip
    Vogel: { immer_hoeher_als: 2, hub: 30, rechts_von: 13, folgt: 90 }
    Fee: { immer_hoeher_als: 2, hub: 20, rechts_von: 13, folgt: 90 }
---
## Kurz gesagt

1. **Begleiter** sagt, dass die Figur dir folgt.
2. **kann fliegen** sagt, *wie* sie folgt: durch die Luft.
3. Ein fliegender Begleiter braucht keine Sprünge – Lücken, Stufen und Wasser hält er nicht auf.

## Das brauchst du

- **Das musst du zeichnen:** einen Begleiter, der fliegt – mit ein paar Bildern Flügelschlag.
- **Das kannst du später dazumalen:** nichts weiter. Ein Flieger braucht keine Lauf- oder Sprungbilder.

![Vogel fliegt](katalog:vogel/fliegen 12)
![Fee fliegt](katalog:fee/fliegen 10)
![Zauberin schwebt](katalog:zauberin/schweben 4)

## Schritt für Schritt

1. Gib dem Sprite die Eigenschaft **Begleiter**.
2. Schalte **kann fliegen** ein. Die Einstellungen fürs Springen und Schwimmen verschwinden – ein Flieger braucht sie nicht.
3. Gib dem Zustand mit dem Flügelschlag **Eigenschaft hinzufügen → Begleiter → Fliegen → Begleiter fliegt nach rechts**. Ohne dieses Bild nimmt er beim Fliegen das Laufbild, beim Schweben das Stehbild.
4. Setz ihn ins Level – gern schon in die Luft.
5. Spiel: Er fliegt ein Stück hinter dir und etwas über dir, damit er deine Spielfigur nicht verdeckt. Springst du auf eine Kante, fliegt er mit nach oben. Über eine Lücke fliegt er einfach hinüber.

> **Tipp:** Das Bild macht nicht, dass er fliegt – das macht das Häkchen **kann fliegen**. Ein Vogel ohne das Häkchen läuft am Boden, auch wenn er Flügel hat.

## Ideen

Fliegen ist eine Fähigkeit, keine Tierart. Mit **kann fliegen** werden das alles Begleiter, die durch die Luft folgen:

- ein **Vogel**, eine **Fledermaus** oder ein **Schmetterling**
- eine **Fee** mit Glitzer
- eine **Drohne** oder ein fliegender Roboter
- ein **Geist**, ein **Ballon** – oder eine **Zauberin**, die neben dir herschwebt

## Tipps

- Mehrere Begleiter reihen sich hinter dir auf: Der erste fliegt am nächsten, der zweite etwas weiter hinten. Hier fliegen ein Vogel und eine Fee mit.
- Ein Flieger stößt sich an Wänden und Decken wie alle anderen. Durch Mauern fliegt er nicht – kommt er wirklich nicht weiter, findet er dich nach einer Weile wieder.
- Bewegungsbereiche (Wasser, Weltall) gelten für Flieger nicht: Über Wasser fliegt er einfach hinweg.

## Wenn's nicht klappt

- **Er fällt herunter:** Ist **kann fliegen** an?
- **Er flattert nicht:** Gib dem Flügelschlag-Zustand **Begleiter fliegt nach rechts** und mehrere Bilder.
- **Er hängt hinter einer Mauer fest:** Bau Lücken in Decken und Wände, durch die er fliegen kann – oder warte: Er findet dich wieder.

## Mach mehr draus

- Lass die Fee mit **Mischmodus Leuchten** glühen.
- Gib deinem Flieger eine kleinere **Geschwindigkeit** – dann flattert er gemütlich hinterher.
