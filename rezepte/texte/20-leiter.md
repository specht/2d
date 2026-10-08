---
titel: Leitern hochklettern
kategorie: Welt bauen
stufe: 1
skala: 2
kurz: Pip klettert eine Leiter hoch und läuft oben weiter.
schleife: true
szene:
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
  - { t: 2.6, halten: links, dauer: 0.3 }
  - { t: 3.1, halten: runter, dauer: 0.75 }
  - { t: 4.1, halten: links, dauer: 0.4 }
  - { t: 4.7, halten: rechts, dauer: 0.016667 }
dauer: 5.0
---
## Kurz gesagt

1. Zeichne eine Leiter und gib ihr die Eigenschaft *man kann dran hoch- und runterklettern*.
2. Stapel die Leiter im Level bis zur Plattform.
3. Zeichne ein Kletterbild, das deine Figur **von hinten** zeigt, und gib ihm die Eigenschaft *Spielfigur klettert*.

## Das brauchst du

- **Das musst du zeichnen:** eine Leiter.
- **Das kannst du später dazumalen:** eine Kletteranimation (Pip hat zwei Bilder: mal ist die linke Hand oben, mal die rechte).

![Klettern](katalog:pip/klettern 6)

## Schritt für Schritt

1. Zeichne die Leiter so, dass sie nach oben und unten nahtlos weitergeht.
2. **Eigenschaft hinzufügen → Leitern → man kann dran hoch- und runterklettern**. Lass **Figur zentrieren** an.
3. Bau im **Level** die Leiter von unten bis auf die Höhe der Plattform. Das oberste Leiterstück liegt direkt neben der Plattform.
4. Bei deiner Figur: neuer Zustand „Klettern“, dann **Eigenschaft hinzufügen → Spielfigur → Spielfigur klettert**.
5. Probier es aus: Pfeil nach oben (oder W) zum Hochklettern, Pfeil nach unten (oder S) zum Runterklettern.

> **Achtung:** Die Kletteranimation gehört zu **Spielfigur klettert** – nicht zu *läuft* und nicht zu *schaut nach hinten*. So kann deine Figur ein eigenes Bild haben, auf dem sie nur von hinten dasteht, zum Beispiel vor einer Tür.

## Tipps

- Oben auf der Leiter kann deine Figur stehen wie auf einem Block. Mit Pfeil nach unten klettert sie wieder runter.
- Hält die Figur mitten auf der Leiter still, bleibt die Kletteranimation stehen. Sobald sie weiterklettert, geht die Animation weiter.
- Gegner können auch klettern (siehe *Intelligente Gegner*). Ihr Zustand heißt **Gegner klettert**.

## Wenn's nicht klappt

- **Die Figur klettert nicht:** Sie muss die Leiter berühren. Stell sie direkt davor, nicht daneben.
- **Oben geht es nicht weiter:** Die Leiter muss genau so hoch sein wie die Plattform – nicht niedriger.
- **Beim Klettern sieht man das Stehbild:** Dem Kletter-Zustand fehlt *Spielfigur klettert*. Ohne ihn zeigt das Spiel das Bild für *schaut nach hinten* – oder, wenn es das auch nicht gibt, das Stehbild.
- **Die Figur springt seitlich weg:** Schalte **Figur zentrieren** ein.

## Mach mehr draus

Bau eine Kletterwand aus mehreren Leitern nebeneinander – mit einer Münze ganz oben.
