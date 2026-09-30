---
titel: Intelligente Gegner
kategorie: Gegner
stufe: 3
kurz: Der Waschbär lässt sich nicht abhängen. Pip springt über eine Lücke, über einen Stein und klettert eine Leiter hoch – und der Waschbär macht alles nach.
skala: 2
schritte: 2
# the gallery card: the raccoon has caught up with Pip
standbild: 6.4
szene:
  # a level wider than the screen: the camera follows Pip
  kamera: { bildhoehe: 144 }
  legende: { W: waschbaer, P: pip_erschrickt }
  ebenen:
    # Pip in a layer of her own before the world: she is placed first, so the
    # raccoon is drawn in front of her when he catches her
    - name: Pip
      kollision: false
      karte: |
        ................................
        ................................
        ................................
        ................................
        ......P.........................
        ................................
    - name: Welt
      # the wall at the end reaches the top row: the level fills the screen
      karte: |
        ...............................M
        ...............................M
        .....................H##########
        .....................H==========
        W..............M.....H==========
        ##########..####################
# Pip (180 px/s, jump 7) runs off, jumps the gap and the stone, climbs the
# ladder and runs on along the top, where she stops and turns round. The
# raccoon (1.8 px/frame when chasing, 60 % of Pip) follows: gap jump, hop over
# the stone, ladder, along the top – and stops right in front of her.
ablauf:
  - { t: 0.4, halten: rechts, dauer: 2.0 }
  - { t: 0.8, drücken: springen }
  - { t: 1.4, drücken: springen }
  - { t: 2.45, halten: hoch, dauer: 0.6 }
  - { t: 3.15, halten: rechts, dauer: 0.97 }
  # she hears him coming and turns round (one step back to the left)
  - { t: 4.9, halten: links, dauer: 0.02 }
dauer: 7.6
erwartet:
  gegner_modi: [chase]
  gegner_ausrufezeichen: true
  gegner_hub: 60
  figur_hoeher_als: 3
  # caught: the raccoon has touched Pip
  energie_unter: 100
---
## Kurz gesagt

1. Normale Gegner bleiben auf ihrem Stockwerk: An einer Schräge, einer Mauer oder einer Kante drehen sie um.
2. Mit der Eigenschaft **Intelligenz** bringst du einem Gegner mehr bei: Schrägen und Treppen laufen, über Hindernisse und Lücken springen, von Kanten hinunterspringen – und Leitern klettern.
3. Jedes Häkchen einzeln: So bestimmst du genau, wie schlau dein Gegner ist.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer Lauf-Animation und eine Leiter.
- **Das kannst du später dazumalen:** ein Bild für die Jagd, eins für den Sprung und zwei Bilder von hinten, auf denen er klettert (**Gegner klettert**). Dann glaubt man ihm, dass er das kann.

![Waschbär steht](katalog:waschbaer/stehen 2)
![Waschbär läuft](katalog:waschbaer/laufen 10)
![Waschbär jagt](katalog:waschbaer/jagen 14)
![Waschbär springt](katalog:waschbaer/springen)
![Waschbär klettert](katalog:waschbaer/klettern 6)

## Schritt für Schritt

1. Mach den Waschbären zum **Gegner** mit dem **Verhalten: Jäger** (siehe *Ein Gegner, der dich verfolgt*). **Sichtweite: 168 px**, **Tempo beim Verfolgen: 2 ×** – er ist deutlich langsamer als Pip, gibt aber nicht auf. **Schaden: 10**: Wenn er sie erwischt, tut es ein bisschen weh.
2. **Sprungkraft: 5,5** – weniger als Pip. Für die Lücke und den Stein reicht das, aber er springt nicht höher als nötig.
3. Klick beim Waschbären auf **Eigenschaft hinzufügen** und wähl unter **Fallen und Gegner** die **Intelligenz**.
4. Setz dort die Häkchen bei **über Lücken springen**, **über Hindernisse springen** und **Leitern klettern**.
5. **gibt auf nach: 5 s.** Während Pip oben ist, sieht er sie nicht. So lange sucht er trotzdem weiter.
6. Leg die Zustände an: **Gegner jagt nach rechts**, **Gegner springt nach rechts** und **Gegner klettert**.
7. Bau eine Strecke, die breiter ist als der Bildschirm: eine Lücke, einen Stein, eine Leiter zu einer höheren Ebene. Die Kamera folgt Pip.
8. Gib Pip einen Zustand **Spielfigur: Treffer (rechts)**, in dem sie erschrickt. Berührt sie ein Gegner, der Schaden macht, zeigt sie dieses Bild und blinkt.
9. Probier es aus: Pip rennt los, springt über die Lücke und den Stein und klettert die Leiter hinauf. Oben läuft sie bis fast ans Ende und dreht sich um. Der Waschbär springt hinterher, hüpft über den Stein, klettert die Leiter hoch – und holt sie oben ein. Er bleibt direkt vor ihr stehen, und Pip erschrickt.

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

> **Tipp:** Ein Gegner wirkt nur schlau, wenn man ihm glaubt, was er tut. Ein Waschbär mit Pfoten klettert glaubwürdig – ein Käfer ohne Arme eher nicht. Mal deinem Gegner Bilder für alles, was er kann.

> **Tipp:** Ein Gegner, der alles kann, ist schwer zu besiegen – und manchmal auch langweilig. Gib jedem Gegner nur ein, zwei Fähigkeiten. Dann weiß man: „Vor dem Käfer bin ich oben sicher, vor der Ratte nicht.“

- Ein Angsthase, der über Lücken springt, ist viel schwerer zu fangen.
- Ein Wächter, der Treppen läuft, bewacht ein ganzes Treppenhaus.
- Ohne die Eigenschaft **Intelligenz** laufen Gegner nur hin und her, verfolgen oder fliehen – Leitern, Lücken und Treppen sind für sie das Ende des Wegs.

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

Bau ein Haus mit drei Stockwerken und einem Waschbären, der dich durchs Treppenhaus verfolgt – und einem Versteck, in das er nicht kommt.
