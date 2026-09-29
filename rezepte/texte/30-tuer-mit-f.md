---
titel: Eine Tür mit F öffnen
kategorie: Türen & Schlüssel
stufe: 1
kurz: Vor der Tür erscheint ein F – drück es, und die Tür geht auf.
szene:
  karte: |
    .........
    .........
    .P...D...
    #########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.8 }
  - { t: 1.3, drücken: aktion }
  - { t: 1.9, halten: rechts, dauer: 0.4 }
dauer: 3.0
erwartet:
  tuer_offen: true
  figur_rechts_von: 6
---
## Kurz gesagt

1. Zeichne eine Tür in zwei Zuständen: **geschlossen** und **geöffnet**.
2. Gib ihr **ist eine Tür** und schalte *ist verschließbar* und *automatische Tür* **aus**.
3. Im Spiel: vor die Tür stellen, **F** drücken.

## Das brauchst du

- **Das musst du zeichnen:** eine geschlossene und eine offene Tür.
- **Das kannst du später dazumalen:** einen Zustand **Übergang**, der zeigt, wie die Tür aufgeht (Pips Tür hat drei Bilder).

![Tür geht auf](katalog:welt/tuer_uebergang 10)

## Schritt für Schritt

1. Zeichne die geschlossene Tür. Leg einen zweiten Zustand an und zeichne die offene Tür.
2. **Eigenschaft hinzufügen → Türen → ist eine Tür**.
3. Schalte **ist verschließbar** und **automatische Tür** aus.
4. Beim ersten Zustand: **Eigenschaft hinzufügen → ist eine Tür → geschlossen**, beim zweiten **geöffnet**.
5. Optional: dritter Zustand mit **Übergang**. Die Frames zeigen die Tür von zu nach auf.
6. Setz die Tür im **Level** auf den Boden und probiere es aus.

## Tipps

> **Tipp:** Der **Tür-Check** in den Tür-Einstellungen zeigt dir, ob beide Zustände da sind.

- Schaltest du **lässt sich schließen** ein, macht F die Tür auch wieder zu.
- Mit **Rand links/rechts** stellst du ein, wie nah man an die Tür heran muss, damit das F erscheint.
- Beim Level-Sprite kannst du **Tür geschlossen** ausschalten – dann ist die Tür am Anfang schon offen.

## Wenn's nicht klappt

- **Es erscheint kein F:** Wahrscheinlich ist **automatische Tür** noch an – dann gibt es kein F.
- **F geht nicht, die Tür bleibt zu:** **ist verschließbar** ist an. Dann braucht man einen Schlüssel (siehe nächstes Rezept).
- **Die Tür geht auf, sieht aber immer gleich aus:** Den Zuständen fehlen *geschlossen* und *geöffnet*.

## Mach mehr draus

Stell hinter die Tür einen **Hinweistext**. Er erscheint, wenn man davor steht und F drückt.
