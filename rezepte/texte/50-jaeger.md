---
titel: Ein Gegner, der dich verfolgt
kategorie: Gegner
stufe: 2
kurz: Der Käfer ist ein Jäger. Sieht er Pip, rennt er hinterher – bis er aufgibt.
szene:
  anpassen:
    kaefer: { baddie: { vjump: 5.0, behavior: { type: hunter, alert: true, chase: 3.0 } } }
  karte: |
    ..............
    ###H.........M
    ===H.........M
    ===H.........M
    ===H.P....K..M
    ##############
ablauf:
  - { t: 1.4, halten: rechts, dauer: 0.25 }
  - { t: 2.4, halten: links, dauer: 0.5 }
  - { t: 2.95, halten: hoch, dauer: 0.7 }
  - { t: 3.7, halten: links, dauer: 0.3 }
dauer: 6.4
erwartet:
  gegner_modi: [chase, idle]
  gegner_ausrufezeichen: true
  figur_hoeher_als: 4
---
## Kurz gesagt

1. Beim Gegner gibt es **Verhalten**. Der **Jäger** läuft erst hin und her wie ein Wächter.
2. Sieht er die Spielfigur, rennt er hinterher – schneller als sonst.
3. Verliert er sie aus den Augen, gibt er nach einer Weile auf.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer Lauf-Animation.
- **Das kannst du später dazumalen:** ein Bild für die Jagd – wütender Blick, Staub hinter ihm – und Treffer und Tot für den Kampf.

![Käfer läuft](katalog:kaefer/laufen 10)
![Käfer jagt](katalog:kaefer/jagen 16)

## Schritt für Schritt

1. Gib dem Käfer die Eigenschaft **Gegner**.
2. Stell ganz oben bei **Verhalten** den **Jäger** ein. Darunter erscheinen nur die Einstellungen, die der Jäger braucht.
3. **Sichtweite:** Pips Käfer sieht **144 px** weit – sechs Blöcke. Er sieht nur nach vorn, und Wände verdecken die Sicht.
4. **Tempo beim Verfolgen:** hier **3×** so schnell wie beim normalen Laufen.
5. **gibt auf nach:** **2 s**. So lange sucht er noch, wenn er die Spielfigur nicht mehr sieht.
6. Schalte **zeigt „!“** ein. Dann weiß man sofort, dass es gleich losgeht.
7. Ein neuer Zustand mit **Gegner jagt nach rechts** zeigt, dass es ernst wird: Solange er verfolgt, sieht man dieses Bild. Ohne den Zustand rennt er einfach mit seinem Laufbild.
8. Bau einen sicheren Ort: Hier klettert Pip eine Leiter hoch. Ohne **Intelligenz** klettern Gegner nicht.

## Mit Intelligenz

Mit der Eigenschaft **Intelligenz** (unter **Fallen und Gegner**) wird der Jäger viel hartnäckiger (siehe *Intelligente Gegner*):

- **Solange er dich nicht gesehen hat,** läuft er wie ein Wächter hin und her – mit Schrägen, Hindernissen, Lücken und Kanten, je nach Häkchen.
- **Beim Verfolgen** schafft er Schrägen und kleine Hindernisse sowieso. Mit **über Lücken springen** springt er dir über Lücken nach.
- **Leitern klettern:** Bist du über oder unter ihm, sucht er eine Leiter, die höchstens fünf Blöcke entfernt ist, und klettert hinterher. Findet er keine, wartet er.
- **Hinunterspringen:** Bist du unter ihm, springt er dir nach – mit Intelligenz aber nur, wenn unten Boden ist. In einen Abgrund folgt er dir nicht.

Damit ist die Leiter kein sicherer Ort mehr. Bau dann ein anderes Versteck – oder lass das Häkchen **Leitern klettern** weg.

## Tipps

> **Tipp:** Ein Jäger ist nur fair, wenn man ihm entkommen kann. Gib ihm eine kleinere **Geschwindigkeit** als der Spielfigur – oder baue Verstecke und Leitern ein.

- Der Jäger springt über kleine Hindernisse. Wie hoch, bestimmt seine **Sprungkraft**. Pips Käfer hat nur **5** und kommt über hohe Mauern nicht drüber.
- An einer Kante bleibt er stehen und wartet – außer die Spielfigur ist unter ihm. Dann lässt er sich hinunterfallen. Mit **Intelligenz** macht er das nur, wenn unten Boden ist.
- Ein Gegner, bei dem du kein anderes **Verhalten** einstellst, ist ein **Wächter**: Er läuft hin und her. Mit **Bereich** bewacht er nur ein paar Blöcke um seinen Startplatz.
- Das Gegenteil vom Jäger ist der **Angsthase**: Er rennt davon, sobald die Spielfigur zu nah kommt. Toll für einen Dieb, den man fangen muss.

## Wenn's nicht klappt

- **Der Jäger bemerkt die Figur nie:** Er schaut in die falsche Richtung, eine Wand ist dazwischen, oder die **Sichtweite** ist zu klein.
- **Die Figur ist auf einer anderen Etage, und er sieht sie trotzdem:** Er sieht etwa drei Blöcke nach oben und unten. Bau die Etagen höher.
- **Er gibt nie auf:** Er sieht die Figur noch. Oder **gibt auf nach** ist sehr lang.
- **Es erscheint kein „!“:** Das Ausrufezeichen ist ausgeschaltet, bis du **zeigt „!“** einschaltest.

## Mach mehr draus

Bau eine Wachstation: zwei Wächter mit kleinem **Bereich** und ein Jäger, der erst loslegt, wenn man zu nah kommt.
