---
titel: Frosch und Fledermaus
kategorie: Gegner
stufe: 2
farben: 256
kurz: Der Frosch kommt nur hüpfend voran, die Fledermaus flattert in Wellen – zwei Verhalten, kein Programmieren.
szene:
  anpassen:
    frosch: { baddie: { vjump: 5.5, jump_vfactor: 3.0, behavior: { type: hopper, interval: 1.2 } } }
  karte: |
    ..............
    M............M
    M.....j......M
    M............M
    M.P.......q..M
    ##############
ablauf:
  - { t: 0.4, halten: rechts, dauer: 0.35 }
  - { t: 2.5, drücken: springen }
  - { t: 2.5, halten: rechts, dauer: 0.42 }
  - { t: 3.3, halten: rechts, dauer: 0.35 }
dauer: 4.6
erwartet:
  gegner_hub: 24
  gegner_weg: 96
---
## Kurz gesagt

1. Der **Hüpfer** bewegt sich nur mit Sprüngen – hier ein Frosch.
2. Der **Flatterer** fliegt hin und her und dabei in Wellen auf und ab – hier eine Fledermaus.
3. Beides stellst du beim Gegner unter **Verhalten** ein.

## Das brauchst du

- **Das musst du zeichnen:** einen sitzenden Frosch, einen springenden Frosch und eine Fledermaus mit Flügelschlag.
- **Das kannst du später dazumalen:** Treffer und Tot für beide.

![Frosch sitzt](katalog:frosch/stehen 2)
![Frosch springt](katalog:frosch/springen)
![Fledermaus](katalog:fledermaus/fliegen 10)

## Schritt für Schritt

1. Frosch: **Gegner** mit **Verhalten: Hüpfer**.
2. **Sprung alle: 1,2 s.** Dazwischen sitzt er still.
3. **Sichtweite: 120 px.** Ist die Spielfigur näher, hüpft er auf sie zu. Sonst hüpft er hin und her.
4. Wie weit ein Sprung geht, bestimmen **Sprungkraft** (hier **5,5**) und **Sprungfaktor** (hier **3**).
5. Der Zustand mit **Gegner springt nach rechts** und **Gegner fällt nach rechts** zeigt den springenden Frosch.
6. Fledermaus: **Gegner** mit **Verhalten: Flatterer**. Die Schwerkraft wirkt auf sie nicht.
7. **Wellenhöhe: 16 px** und **Dauer einer Welle: 1,6 s**. Die Flügel schlagen mit dem Zustand **Gegner läuft nach rechts**.

## Tipps

> **Tipp:** Der Hüpfer prüft vor jedem Sprung, ob dort, wo er landen würde, Boden ist. So springt er nicht in eine Grube.

- Zwischen zwei Sprüngen ist der Frosch am Boden – die beste Zeit, um über ihn zu springen.
- Eine flache Welle wirkt ruhig, eine hohe Welle schwer vorhersehbar. Wird sie zu hoch, ist die Fledermaus kaum zu überspringen.
- Flatterer drehen an Wänden um wie Wächter.
- **Intelligenz** brauchen Hüpfer und Flatterer nicht: Der Hüpfer springt sowieso, der Flatterer fliegt. Bei ihnen gibt es dort nichts einzustellen.

## Wenn's nicht klappt

- **Der Frosch springt gar nicht:** Das Verhalten ist noch **Wächter**, oder die **Sprungkraft** ist 0.
- **Der Frosch dreht dauernd um:** Vor ihm ist eine Grube oder Wand. Mach seinen Weg länger oder die Sprünge kürzer.
- **Die Fledermaus fällt herunter:** Stell **Verhalten: Flatterer** ein – dann wirkt keine Schwerkraft mehr.

## Mach mehr draus

Lass einen Frosch über kleine Hügel hüpfen und eine Fledermaus durch eine Höhle mit niedriger Decke fliegen.
