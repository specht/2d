---
titel: Intelligente Gegner
kategorie: Gegner
stufe: 3
kurz: Pip flüchtet die Leiter hoch – dort war sie vor dem Käfer bisher sicher. Aber dieser Käfer ist schlau und klettert hinterher.
szene:
  # the scene of "Ein Gegner, der dich verfolgt" – plus Intelligenz
  anpassen:
    kaefer:
      baddie: { vjump: 5.0, behavior: { type: hunter, alert: true, chase: 3.0, forget: 4.0 } }
      smart: { climbs_ladders: true }
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
dauer: 8.5
erwartet:
  gegner_modi: [chase]
  gegner_ausrufezeichen: true
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

1. Nimm den Käfer aus *Ein Gegner, der dich verfolgt*: einen **Gegner** mit dem **Verhalten: Jäger**. Dort ist Pip oben auf der Leiter sicher.
2. Klick beim Käfer auf **Eigenschaft hinzufügen** und wähl unter **Fallen und Gegner** die **Intelligenz**.
3. Setz dort das Häkchen bei **Leitern klettern**.
4. **gibt auf nach: 4 s.** Während Pip oben ist, sieht der Käfer sie nicht mehr. So lange sucht er trotzdem weiter – Zeit genug, um bis zur Leiter zu rennen.
5. Spiel es aus: Der Käfer entdeckt Pip, Pip flüchtet die Leiter hoch – und der Käfer klettert hinterher und erwischt sie oben. Die Leiter darf auch ein Stück neben seinem Weg stehen: Bis zu fünf Blöcke weit sucht er danach.

## Was ein Gegner noch lernen kann

- **Schrägen und Treppen laufen:** Er läuft Hänge und Treppen hinauf und hinunter, statt dort umzudrehen.
- **über Hindernisse springen:** Ein niedriger Block im Weg? Er springt darüber – aber nur, wenn sein Sprung hoch genug ist. Das hängt von seiner **Sprungkraft** ab.
- **über Lücken springen:** An einer Kante springt er hinüber, wenn er auf der anderen Seite landen kann.
- **von Kanten hinunterspringen:** Er lässt sich hinunterfallen – aber nur, wenn höchstens fünf Blöcke tiefer Boden ist. In einen Abgrund springt er nie.
- **Leitern klettern:** Er wechselt über eine Leiter das Stockwerk.

Was ein Gegner kann, macht er **immer**, wenn es geht – nicht mal so, mal so. Nur **springt von Plattformen** beim Gegner bleibt ein Zufall: Es gilt an Kanten, an denen keine Fähigkeit hilft.

## Was macht welcher Gegner damit?

Jeder Gegner nutzt seine Intelligenz auf seine Art. Die Häkchen, die zu seinem **Verhalten** nicht passen, zeigt das Studio gar nicht erst an.

- **Wächter:** Er läuft immer hin und her – und nutzt dabei Schrägen, Hindernisse, Lücken und Kanten. Leitern braucht er nicht. Achtung: Mit **von Kanten hinunterspringen** verlässt er seine Plattform und kommt vielleicht nie zurück.
- **Jäger, solange er dich nicht gesehen hat:** wie der Wächter.
- **Jäger beim Verfolgen:** Schrägen und kleine Hindernisse schafft er auch ohne Intelligenz, und er springt dir hinterher, wenn du unter ihm bist. Mit Intelligenz passiert das aber nur noch, wenn unten Boden ist – in einen Abgrund folgt er dir nicht. Mit **über Lücken springen** springt er dir über Lücken nach. Mit **Leitern klettern** sucht er eine Leiter, die höchstens fünf Blöcke entfernt ist, sobald du über oder unter ihm bist. Findet er keine, wartet er.
- **Angsthase, solange er keine Angst hat:** wie der Wächter.
- **Angsthase auf der Flucht:** Er rennt einfach weg, Schrägen schafft er dabei immer. Mit **Leitern klettern** flüchtet er jede Leiter hoch oder runter, an der er vorbeikommt – aber nie dir entgegen. Sitzt er in der Ecke, helfen ihm **über Hindernisse springen**, **über Lücken springen** und **von Kanten hinunterspringen** hinaus. Erst wenn nichts davon geht, zittert er.
- **Steht still, Lauerer, Hüpfer, Flatterer und Stampfer:** Sie brauchen keine Intelligenz. Der Lauerer stürmt geradeaus, der Hüpfer springt sowieso, Flatterer fliegen, Stampfer fallen nur herunter. Bei ihnen gibt es deshalb nichts einzustellen.

## Tipps

> **Tipp:** Ein Gegner, der alles kann, ist schwer zu besiegen – und manchmal auch langweilig. Gib jedem Gegner nur ein, zwei Fähigkeiten. Dann weiß man: „Vor dem Käfer bin ich oben sicher, vor der Ratte nicht.“

- Ein Angsthase, der über Lücken springt, ist viel schwerer zu fangen.
- Ein Wächter, der Treppen läuft, bewacht ein ganzes Treppenhaus.
- Ohne die Eigenschaft **Intelligenz** verhalten sich Gegner genau wie bisher. Ältere Spiele ändern sich also nicht.

## Wenn's nicht klappt

- **Er klettert nicht:** Das Häkchen **Leitern klettern** fehlt, oder er hat die Spielfigur nie gesehen. Er klettert nur, wenn er sie verfolgt und sie über oder unter ihm ist – und nur, wenn die Leiter höchstens fünf Blöcke entfernt ist.
- **Er bemerkt die Figur auf dem anderen Stockwerk nicht:** Das ist Absicht – durch den Boden sieht er nicht, nur etwa drei Blöcke nach oben und unten. Er muss sie zuerst auf seinem Stockwerk entdecken, dann folgt er ihr.
- **Er gibt auf, bevor er die Leiter erreicht:** Stell **gibt auf nach** größer.
- **Ich finde Leitern klettern nicht:** Das gibt es nur beim Jäger und beim Angsthasen. Stell beim Gegner zuerst das **Verhalten** ein.
- **Bei der Intelligenz gibt es gar keine Häkchen:** Dein Gegner ist ein Lauerer, Hüpfer, Flatterer, Stampfer oder steht still. Die brauchen keine Intelligenz.
- **Mein Jäger springt mir nicht mehr hinterher:** Mit Intelligenz springt er nur, wenn unten Boden ist (höchstens fünf Blöcke tiefer).
- **Er springt nicht über den Block:** Der Block ist höher als sein Sprung. Stell die **Sprungkraft** größer.
- **Er fällt in eine Grube und kommt nicht mehr heraus:** Das passiert mit **von Kanten hinunterspringen**. Gib ihm dazu **über Hindernisse springen** oder eine Leiter nach oben.

## Mach mehr draus

Bau ein Haus mit drei Stockwerken und einem Käfer, der dich durchs Treppenhaus verfolgt – und einem Versteck, in das er nicht kommt.
