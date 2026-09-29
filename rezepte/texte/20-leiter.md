---
titel: Leitern hochklettern
kategorie: Welt bauen
stufe: 1
kurz: Pip klettert eine Leiter hoch und läuft oben weiter.
szene:
  ausschnitt: [0, 1, 10, 4]
  karte: |
    ..........
    ....H###..
    ....H.....
    .P..H.....
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.4 }
  - { t: 0.9, halten: hoch, dauer: 0.75 }
  - { t: 1.9, halten: rechts, dauer: 0.3 }
dauer: 3.0
erwartet:
  figur_hoeher_als: 3
  figur_rechts_von: 5
---
## Kurz gesagt

1. Zeichne eine Leiter und gib ihr die Eigenschaft *man kann dran hoch- und runterklettern*.
2. Stapel die Leiter im Level bis zur Plattform.
3. Zeichne ein Kletterbild, das deine Figur **von hinten** zeigt.

## Das brauchst du

- **Das musst du zeichnen:** eine Leiter.
- **Das kannst du später dazumalen:** eine Kletteranimation (Pip hat zwei Bilder: mal ist die linke Hand oben, mal die rechte).

![Klettern](katalog:pip/klettern 6)

## Schritt für Schritt

1. Zeichne die Leiter so, dass sie nach oben und unten nahtlos weitergeht.
2. **Eigenschaft hinzufügen → Leitern → man kann dran hoch- und runterklettern**. Lass **Figur zentrieren** an.
3. Bau im **Level** die Leiter von unten bis auf die Höhe der Plattform. Das oberste Leiterstück liegt direkt neben der Plattform.
4. Bei deiner Figur: neuer Zustand „Klettern“, dann **Eigenschaft hinzufügen → Spielfigur → Stehen → Spielfigur schaut nach hinten**.
5. Spiel es aus: Pfeil nach oben (oder W) zum Hochklettern, Pfeil nach unten (oder S) zum Runterklettern.

> **Achtung:** Beim Klettern schaut die Figur für das Spiel *nach hinten*. Deshalb gehört die Kletteranimation zu **Spielfigur schaut nach hinten** – nicht zu *läuft*.

## Tipps

- Oben auf der Leiter kann deine Figur stehen wie auf einem Block. Mit Pfeil nach unten klettert sie wieder runter.
- Die Kletteranimation läuft auch weiter, wenn die Figur auf der Leiter stillhält. Zwei ruhige Frames sehen darum besser aus als sechs wilde.

## Wenn's nicht klappt

- **Die Figur klettert nicht:** Sie muss die Leiter berühren. Stell sie direkt davor, nicht daneben.
- **Oben geht es nicht weiter:** Die Leiter muss genau so hoch sein wie die Plattform – nicht niedriger.
- **Beim Klettern sieht man das Stehbild:** Dem Kletter-Zustand fehlt *Spielfigur schaut nach hinten*.
- **Die Figur springt seitlich weg:** Schalte **Figur zentrieren** ein.

## Mach mehr draus

Bau eine Kletterwand aus mehreren Leitern nebeneinander – mit einer Münze ganz oben.
