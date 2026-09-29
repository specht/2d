---
titel: Checkpoints
kategorie: Welt bauen
stufe: 1
kurz: Berührt Pip die Fahne, wird sie grün – hier geht es nach einem Missgeschick weiter.
szene:
  karte: |
    ..........
    ..........
    .P....f...
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.1 }
dauer: 2.4
erwartet:
  checkpoint_aktiv: true
---
## Kurz gesagt

1. Eine Fahne mit der Eigenschaft **Checkpoint** merkt sich, wo es weitergeht.
2. Zeichne zwei Zustände: aus und an.
3. Berührt die Figur die Fahne, schaltet sie auf **Checkpoint aktiviert**.

## Das brauchst du

- **Das musst du zeichnen:** eine Fahne, die noch nicht aktiv ist (grau, schlaff).
- **Das kannst du später dazumalen:** eine aktive Fahne, die im Wind flattert (Pips Fahne hat zwei Frames).

![Fahne aus](katalog:welt/fahne_aus)
![Fahne an](katalog:welt/fahne_an 4)

## Schritt für Schritt

1. Zeichne die graue Fahne.
2. **Eigenschaft hinzufügen → Level → Checkpoint**.
3. Leg einen zweiten Zustand an und zeichne die grüne, flatternde Fahne. Framerate 4.
4. Beim zweiten Zustand: **Eigenschaft hinzufügen → Checkpoint → Checkpoint aktiviert**.
5. Stell die Fahne im **Level** an eine Stelle nach einem schwierigen Stück.

## Tipps

> **Tipp:** Verliert die Spielfigur ein Leben, fängt sie an der zuletzt berührten Fahne wieder an – nicht ganz am Anfang.

- Der erste Zustand ist die Fahne, bevor man sie berührt. Die Reihenfolge der Zustände ist also wichtig.
- Große Farbunterschiede helfen: grau = noch nicht, grün = geschafft.

## Wenn's nicht klappt

- **Die Fahne ändert sich nicht:** Dem zweiten Zustand fehlt **Checkpoint aktiviert**.
- **Man fängt trotzdem vorne an:** Die Figur hat die Fahne nicht berührt. Stell sie auf den Weg, nicht daneben.
- **Die aktive Fahne flattert zu schnell:** Setz die **Framerate** herunter.

## Mach mehr draus

Stell vor jeden schwierigen Abschnitt eine Fahne – dann macht dein Level auch beim fünften Versuch noch Spaß.
