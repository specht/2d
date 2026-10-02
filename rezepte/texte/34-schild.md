---
titel: Ein Schild, das Pip vorliest
kategorie: Level gestalten
stufe: 1
skala: 4
kurz: Pip drückt F am Schild und liest vor – Satz für Satz, jeder in einer eigenen Sprechblase. Mit der Punkt-Taste geht's weiter.
szene:
  legende:
    S: { sprite: schild, platziert: { text: { text: "Willkommen im Pilzwald! Vorsicht vor dem Glibber – er klebt!" } } }
  karte: |
    ..........
    ..........
    ..........
    .P..S.....
    ##########
ablauf:
  - { t: 0.2, halten: rechts, dauer: 0.4 }
  - { t: 0.75, drücken: aktion }
  - { t: 1.9, drücken: weiter }
dauer: 5.6
standbild: 1.5
tasten_zeigen: true
erwartet:
  gesagt: ['Willkommen im Pilzwald!', 'Vorsicht vor dem Glibber – er klebt!']
  lebt: true
---
## Kurz gesagt

1. Gib einem Sprite die Eigenschaft **Hinweistext** – zum Beispiel einem Schild.
2. Schreib den Text beim **platzierten** Schild im Level hinein. **Jeder Satz kommt in eine eigene Sprechblase.**
3. Im Spiel: vor das Schild stellen und **F** drücken. Die Spielfigur liest Satz für Satz vor. Mit **.** (Punkt) geht es sofort zur nächsten Sprechblase.

## Das brauchst du

- **Das musst du zeichnen:** ein Schild (oder irgendein anderes Sprite, das etwas zu sagen hat).
- **Das kannst du später dazumalen:** nichts – die Schrift kommt vom Spiel.

![Schild](katalog:welt/schild)

## Schritt für Schritt

1. Zeichne das Schild und gib ihm **Eigenschaft hinzufügen → Text → Hinweistext**.
2. Setz es ins **Level** und klicke es an.
3. Schreib bei **Text** hinein, was auf dem Schild steht. Jeder Satz – alles bis zu einem **.**, **!** oder **?** – kommt in eine eigene Sprechblase, die Sprechblasen erscheinen nacheinander.
4. Bei **Wer spricht** steht **die Spielfigur liest vor**: Der Text erscheint über der Figur, in ihrer Farbe.
5. Probier es mit **Level testen** (Taste T) aus.

Jeder Satz bleibt so lange stehen, dass man ihn lesen kann. Wer schneller ist, drückt **.** oder **F** – dann kommt gleich der nächste.

## Tipps

- **Selbst bestimmen, was zusammen in eine Sprechblase kommt:** Setz ein **|** dorthin, wo eine neue Sprechblase beginnen soll – mit dem Knopf **Neue Sprechblase** unter dem Text (oder AltGr + <). Sobald ein **|** im Text steht, bestimmst du alle Sprechblasen selbst.
- Unter **Einstellungen → Texte** suchst du die **Schrift** für dein ganzes Spiel aus, dazu **Textgröße**, **Lesetempo** und die **Textfarbe der Spielfigur**. Eine Vorschau zeigt, wie es aussieht.
- Die Schrift ist immer gleich gut lesbar – egal, wie groß deine Pixel im Spiel sind.
- Soll das Schild (oder eine Figur, die du gezeichnet hast) **selbst** sprechen, stell **Wer spricht** auf **das Sprite spricht selbst** und gib ihm eine eigene **Textfarbe**. Gib jeder Figur ihre eigene Farbe – dann sieht man sofort, wer redet.
- Auf dem Tablet tippst du einfach auf den Bildschirm, um zum nächsten Satz zu kommen.

## Wenn's nicht klappt

- **Über dem Schild erscheint kein F:** Es liegt in einer Ebene ohne **Kollisionen erkennen**, oder ihm fehlt **Hinweistext**.
- **Es passiert nichts, wenn ich F drücke:** Beim platzierten Schild ist **Text** noch leer.
- **Alles kommt in einer Sprechblase:** Hinter dem Satz fehlt ein **.**, **!** oder **?** – oder es steht irgendwo ein **|** im Text: Dann gelten nur die **|**.
- **Ein Satz wird mittendrin geteilt:** Setz **|** an die Stellen, an denen eine neue Sprechblase beginnen soll.

## Mach mehr draus

Stell an den Anfang deines Levels ein Schild, das erklärt, was zu tun ist. Oder bau eine Figur, die selbst spricht – mit einer eigenen Farbe, wie in alten Abenteuerspielen.
