---
titel: Ein Gegner, der Wache läuft
kategorie: Gegner
stufe: 1
skala: 4
kurz: Der Glibber ist ein Wächter. Er läuft hin und her – auf dem Boden in seinem Bereich, oben auf der Plattform bis zur Kante.
szene:
  anpassen:
    glibber: { baddie: { damage: 30, behavior: { type: guard, range: 2 } } }
  karte: |
    ..............
    ..........g...
    .........###..
    ..............
    M.P....g.....M
    ##############
ablauf:
  - { t: 0.5, halten: rechts, dauer: 1.6 }
  - { t: 0.85, drücken: springen }
dauer: 4.0
erwartet:
  figur_rechts_von: 10
  energie_gleich: 100
  gegner_weg: 40
  gegner_leben: 2
---
## Kurz gesagt

1. Beim Gegner gibt es **Verhalten**. Der **Wächter** läuft einfach hin und her.
2. An einer Wand oder einer Kante dreht er um. Mit **Bereich** entfernt er sich höchstens so viele Blöcke von seinem Startplatz.
3. Er jagt nicht und flieht nicht: Wer sein Muster kennt, kommt vorbei.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer Lauf-Animation.
- **Das kannst du später dazumalen:** Treffer und Tot für den Kampf.

![Glibber läuft](katalog:glibber/laufen 6)

## Schritt für Schritt

1. Mach aus dem Sprite einen **Gegner** und wähl bei **Verhalten** den **Wächter**.
2. **Geschwindigkeit** bestimmt, wie schnell er läuft. Ein langsamer Wächter ist leicht zu überspringen.
3. **Bereich: 2 Blöcke.** Der Glibber unten läuft nur zwei Blöcke nach links und zwei nach rechts – er bewacht eine Stelle.
4. Kommt vorher eine Wand oder Kante, dreht er schon dort um. Der Glibber auf der kurzen Plattform läuft deshalb nur von Kante zu Kante und fällt nie herunter. **Bereich: 0** heißt: immer bis zur nächsten Wand oder Kante.
5. **Schaden: 30.** Berührt die Figur den Wächter, verliert sie Energie.
6. Probier es aus: Pip springt im richtigen Moment über den Glibber – oben auf der Plattform läuft der andere von Kante zu Kante.

## Mit Intelligenz

Gib dem Wächter die Eigenschaft **Intelligenz** (unter **Fallen und Gegner**), dann bewacht er mehr als eine gerade Plattform (siehe *Intelligente Gegner*):

- **Schrägen und Treppen laufen:** Er läuft Hänge und Treppen hinauf und hinunter, statt dort umzudrehen – so bewacht er ein ganzes Treppenhaus.
- **über Hindernisse springen:** Über niedrige Blöcke springt er, statt umzudrehen. Wie hoch, bestimmt seine **Sprungkraft**.
- **über Lücken springen:** Über eine Lücke springt er, wenn er drüben landen kann.
- **von Kanten hinunterspringen:** Er lässt sich hinunterfallen, wenn höchstens fünf Blöcke tiefer Boden ist – und kommt vielleicht nie zurück.

Er macht das jedes Mal, wenn es geht. Leitern klettert ein Wächter nie: Er hat keinen Grund, das Stockwerk zu wechseln. Sein **Bereich** gilt weiterhin. Ein Gegner, der **Steht still**, braucht keine Intelligenz – bei ihm gibt es dort nichts einzustellen.

## Tipps

> **Tipp:** Ein Wächter ist der einfachste Gegner – und gerade deshalb gut für den Anfang eines Spiels. Wer ihn beobachtet, erkennt das Muster und fühlt sich schlau, wenn er vorbeikommt.

- **Pausen alle** und **Pausendauer** lassen ihn zwischendurch stehen bleiben. Dann wird er schwerer vorherzusagen.
- **springt von Plattformen** lässt ihn manchmal über die Kante hüpfen, statt umzudrehen.
- Mehrere Wächter mit verschiedenen **Bereichen** und Geschwindigkeiten ergeben schnell ein kniffliges Stück Level.

## Wenn's nicht klappt

- **Er läuft einfach weiter und fällt herunter:** Beim Gegner ist **springt von Plattformen** zu hoch eingestellt.
- **Er bleibt stehen:** Beim **Verhalten** ist **Steht still** eingestellt, oder die **Geschwindigkeit** ist 0.
- **Die Figur verliert keine Energie:** Der **Schaden** ist 0.

## Mach mehr draus

Stell zwei Wächter auf eine lange Plattform, die gegeneinander laufen – oder lass einen Wächter vor einer Tür Wache halten, die man erst mit einem Schlüssel öffnen kann.
