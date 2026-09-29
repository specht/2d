---
titel: Laufen, Springen und Fallen animieren
kategorie: Figuren animieren
stufe: 2
kurz: Mit ein paar Zusatzbildern wackelt, hüpft und plumpst deine Figur.
szene:
  karte: |
    .............
    .............
    .............
    ..P..........
    ####.###.....
    ####.########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.05 }
  - { t: 0.42, drücken: springen }
dauer: 2.4
erwartet:
  figur_rechts_von: 7
---
## Kurz gesagt

1. Leg für jede Bewegung einen neuen **Zustand** an.
2. Zeichne darin ein paar **Frames** (Einzelbilder).
3. Sag dem Zustand, wofür er da ist, z. B. *Spielfigur läuft nach rechts*.

## Das brauchst du

- **Das musst du zeichnen:** eine Figur mit einem Stehbild.
- **Das kannst du später dazumalen:** Laufen (2–6 Bilder), Springen (1 Bild), Fallen (1 Bild).

So sieht Pips Animationskatalog aus:

![Stehen](katalog:pip/stehen 3)
![Laufen](katalog:pip/laufen 10)
![Springen](katalog:pip/springen)
![Fallen](katalog:pip/fallen)

## Schritt für Schritt

1. Wähle unter **Sprites** deine Figur. Unter **Zustände** siehst du ihren ersten Zustand. Das ist das Stehbild.
2. Klicke bei **Zustände** auf **+**. Gib dem neuen Zustand den **Titel** „Laufen“.
3. Zeichne das erste Laufbild. Mit **+** in der Frame-Leiste unten fügst du weitere Frames hinzu.
4. Klicke beim Zustand auf **Eigenschaft hinzufügen → Spielfigur → Laufen → Spielfigur läuft nach rechts**.
5. Stell die **Framerate** ein. Pip läuft mit 10 fps, steht mit 3 fps.
6. Mach dasselbe für **Springen** (*Spielfigur springt nach rechts*) und **Fallen** (*Spielfigur fällt nach rechts*).

## Tipps

> **Tipp:** Beim Laufen hilft ein kleiner Trick: Hebe die Figur in jedem zweiten Frame einen Pixel an. So wippt sie beim Gehen.

- Beim **Springen** wird Pip länger und schmaler, beim **Fallen** breiter – das nennt man *Squash & Stretch* (siehe unten bei den 12 Prinzipien der Animation).
- Pips Blatt hängt beim Laufen hinterher. Solche Nachzieh-Bewegungen machen Figuren lebendig.
- Fehlt ein Zustand, nimmt das Spiel automatisch einen ähnlichen – ohne Fallbild wird z. B. das Sprungbild benutzt.

## Wenn's nicht klappt

- **Die Figur läuft, aber die Animation spielt nicht:** Dem Zustand fehlt die Zustands-Eigenschaft *Spielfigur läuft nach rechts*.
- **Die Animation ist viel zu schnell oder zu langsam:** Ändere die **Framerate** des Zustands.
- **Die Figur zittert beim Animieren hin und her:** Die Frames sind unterschiedlich weit verschoben. Achte darauf, dass die Füße in allen Frames auf derselben Zeile stehen.

## Mach mehr draus

Zeichne einen Zustand *Spielfigur schaut nach vorn* – zum Beispiel mit Blinzeln. Den sieht man, bevor sich die Figur zum ersten Mal bewegt.
