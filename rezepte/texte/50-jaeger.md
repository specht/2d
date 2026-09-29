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

1. Beim Gegner gibt es **Verhalten**. Der **Jäger** läuft erst hin und her wie immer.
2. Sieht er die Spielfigur, rennt er hinterher – schneller als sonst.
3. Verliert er sie aus den Augen, gibt er nach einer Weile auf.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer Lauf-Animation.
- **Das kannst du später dazumalen:** eine Treffer- und eine Tot-Animation für den Kampf.

![Käfer läuft](katalog:kaefer/laufen 10)

## Schritt für Schritt

1. Gib dem Käfer die Eigenschaft **Gegner**.
2. Stell ganz oben bei **Verhalten** den **Jäger** ein. Darunter erscheinen nur die Einstellungen, die der Jäger braucht.
3. **Sichtweite:** Pips Käfer sieht **144 px** weit – sechs Blöcke. Er sieht nur nach vorn, und Wände verdecken die Sicht.
4. **Tempo beim Verfolgen:** hier **3×** so schnell wie beim normalen Laufen.
5. **gibt auf nach:** **2 s**. So lange sucht er noch, wenn er die Spielfigur nicht mehr sieht.
6. Schalte **zeigt „!“** ein. Dann weiß man sofort, dass es gleich losgeht.
7. Bau einen sicheren Ort: Hier klettert Pip eine Leiter hoch. Gegner klettern nicht.

## Tipps

> **Tipp:** Ein Jäger ist nur fair, wenn man ihm entkommen kann. Gib ihm eine kleinere **Geschwindigkeit** als der Spielfigur – oder baue Verstecke und Leitern ein.

- Der Jäger springt über kleine Hindernisse. Wie hoch, bestimmt seine **Sprungkraft**. Pips Käfer hat nur **5** und kommt über hohe Mauern nicht drüber.
- An einer Kante bleibt er stehen und wartet – außer die Spielfigur ist unter ihm. Dann lässt er sich hinunterfallen.
- Alte Gegner und neue Gegner ohne Einstellung sind **Wächter**: Sie laufen hin und her wie schon immer. Beim Wächter kannst du jetzt auch einen **Bereich** in Blöcken einstellen.
- Das Gegenteil vom Jäger ist der **Angsthase**: Er rennt davon, sobald die Spielfigur zu nah kommt. Toll für einen Dieb, den man fangen muss.

## Wenn's nicht klappt

- **Der Jäger bemerkt die Figur nie:** Er schaut in die falsche Richtung, eine Wand ist dazwischen, oder die **Sichtweite** ist zu klein.
- **Die Figur ist auf einer anderen Etage, und er sieht sie trotzdem:** Er sieht etwa drei Blöcke nach oben und unten. Bau die Etagen höher.
- **Er gibt nie auf:** Er sieht die Figur noch. Oder **gibt auf nach** ist sehr lang.
- **Es erscheint kein „!“:** Das Ausrufezeichen ist ausgeschaltet, bis du **zeigt „!“** einschaltest.

## Mach mehr draus

Bau eine Wachstation: zwei Wächter mit kleinem **Bereich** und ein Jäger, der erst loslegt, wenn man zu nah kommt.
