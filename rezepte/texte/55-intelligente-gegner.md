---
titel: Intelligente Gegner
kategorie: Gegner
stufe: 3
kurz: Der Käfer bleibt nicht unten stehen – er ist schlau genug, die Leiter hochzuklettern, um Pip zu erwischen.
szene:
  anpassen:
    kaefer:
      baddie: { behavior: { type: hunter, alert: true, chase: 2.5 } }
      smart: { climbs_ladders: true }
  karte: |
    ..............
    ..........P...
    .....H########
    .....H........
    .K...H........
    ##############
ablauf: []
dauer: 6.0
erwartet:
  gegner_modi: [chase]
  gegner_hub: 48
---
## Kurz gesagt

1. Normale Gegner bleiben auf ihrem Stockwerk: An einer Schräge, einer Mauer oder einer Kante drehen sie um.
2. Mit der Eigenschaft **Intelligenz** bringst du einem Gegner mehr bei: Schrägen und Treppen laufen, über Hindernisse und Lücken springen, von Kanten hinunterspringen – und Leitern klettern.
3. Jedes Häkchen einzeln: So bestimmst du genau, wie schlau dein Gegner ist.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer Lauf-Animation und eine Leiter.
- **Das kannst du später dazumalen:** ein Bild, auf dem der Gegner klettert (**Gegner schaut nach hinten**).

![Käfer läuft](katalog:kaefer/laufen 10)
![Käfer jagt](katalog:kaefer/jagen 16)

## Schritt für Schritt

1. Mach den Käfer zum **Gegner** mit dem **Verhalten: Jäger** (siehe *Ein Gegner, der dich verfolgt*).
2. Klick beim Käfer auf **Eigenschaft hinzufügen** und wähl unter **Fallen und Gegner** die **Intelligenz**.
3. Setz dort das Häkchen bei **Leitern klettern**.
4. Bau zwei Stockwerke mit einer Leiter dazwischen. Pip steht oben, der Käfer läuft unten.
5. Spiel es aus: Der Käfer entdeckt Pip, läuft zur Leiter, klettert hinauf und jagt oben weiter.

## Was ein Gegner noch lernen kann

- **Schrägen und Treppen laufen:** Er läuft Hänge und Treppen hinauf und hinunter, statt dort umzudrehen.
- **über Hindernisse springen:** Ein niedriger Block im Weg? Er springt darüber – aber nur, wenn sein Sprung hoch genug ist. Das hängt von seiner **Sprungkraft** ab.
- **über Lücken springen:** An einer Kante springt er hinüber, wenn er auf der anderen Seite landen kann.
- **von Kanten hinunterspringen:** Er lässt sich hinunterfallen – aber nur, wenn höchstens fünf Blöcke tiefer Boden ist. In einen Abgrund springt er nie.
- **Leitern klettern:** Nur Jäger und Angsthasen: Sie klettern, um der Spielfigur zu folgen oder vor ihr zu fliehen. Ein Wächter hat keinen Grund, das Stockwerk zu wechseln.

Die Intelligenz zeigt nur, was zum **Verhalten** des Gegners passt. Ein Stampfer oder ein Flatterer läuft nicht – bei ihm gibt es dort nichts einzustellen.

## Tipps

> **Tipp:** Ein Gegner, der alles kann, ist schwer zu besiegen – und manchmal auch langweilig. Gib jedem Gegner nur ein, zwei Fähigkeiten. Dann weiß man: „Vor dem Käfer bin ich oben sicher, vor der Ratte nicht.“

- Ein Angsthase, der über Lücken springt, ist viel schwerer zu fangen.
- Ein Wächter, der Treppen läuft, bewacht ein ganzes Treppenhaus.
- Ohne die Eigenschaft **Intelligenz** verhalten sich Gegner genau wie bisher. Ältere Spiele ändern sich also nicht.

## Wenn's nicht klappt

- **Er klettert nicht:** Das Häkchen **Leitern klettern** fehlt, oder er sieht die Spielfigur gar nicht. Er klettert nur, wenn er sie verfolgt und sie über oder unter ihm ist.
- **Ich finde Leitern klettern nicht:** Das gibt es nur beim Jäger und beim Angsthasen. Stell beim Gegner zuerst das **Verhalten** ein.
- **Er springt nicht über den Block:** Der Block ist höher als sein Sprung. Stell die **Sprungkraft** größer.
- **Er fällt in eine Grube und kommt nicht mehr heraus:** Das passiert mit **von Kanten hinunterspringen**. Gib ihm dazu **über Hindernisse springen** oder eine Leiter nach oben.

## Mach mehr draus

Bau ein Haus mit drei Stockwerken und einem Käfer, der dich durchs Treppenhaus verfolgt – und einem Versteck, in das er nicht kommt.
