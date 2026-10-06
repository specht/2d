---
titel: Ein Schlüssel für das ganze Spiel
kategorie: Türen & Schlüssel
stufe: 3
kurz: Den Zauberschlüssel behält Pip für immer. In jedem Level, das danach fragt, öffnet er das Tor – auch wenn Pip ihn ganz woanders gefunden hat.
# the whole screen: the key top left once Pip has it
hud: true
# the ground at the bottom edge, a little sky for the HUD
bild_hoch: 0.375
szene:
  kamera: { bildhoehe: 162 }
  levelname: Level 1
  signale: { 4: Burgtor }
  # the level's setting "sendet, wenn die Spielfigur … hat": Code 4 while Pip has the key
  wenn_hat: [{ sprite: zauberschluessel, code: 4 }]
  legende:
    G: { sprite: gittertor, platziert: { door: { signal_code: 4, door_reaction: open } } }
    z: zauberschluessel
    S: boden_schnee
  karte: |
    .........M..
    .........M..
    .........M..
    .........M..
    .P..z....G..
    ############
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.3 }
dauer: 3.2
erwartet:
  signale: ['4 an']
  tuer_offen: true
  figur_rechts_von: 9
  inventar: { Zauberschlüssel: 1 }
# a picture of its own in the text: the next level – Pip has brought the key
# along (top left from the start), and the gate opens as the level starts
einzelbilder: true
varianten:
  - szene:
      inventar: [zauberschluessel]
      levelname: Level 2
      himmel: ['#3b5dc9', '#f4f4f4']
      karte: |
        .........M..
        .........M..
        .........M..
        .........M..
        .P.......G..
        SSSSSSSSSSSS
    erwartet:
      signale: ['4 an']
      tuer_offen: true
      figur_rechts_von: 9
      inventar: { Zauberschlüssel: 1 }
---
## Kurz gesagt

1. Zeichne einen besonderen Schlüssel. Gib ihm **man kann es einsammeln** mit **bleibt fürs ganze Spiel** – keinen gewöhnlichen „ist ein Schlüssel“.
2. In jedem Level mit einem passenden Tor: **Level-Einstellungen → sendet, wenn die Spielfigur … hat**, den Schlüssel auswählen und einen Code geben.
3. Das Tor bekommt denselben Code mit **Bei Signal: öffnen**.

## Das brauchst du

- **Das musst du zeichnen:** den Schlüssel und ein Tor (oder nimm das Gittertor aus dem Sprite-Katalog).
- **Das kannst du später dazumalen:** ein Schild am Tor, das sagt, welcher Schlüssel fehlt.

![Zauberschlüssel](katalog:extra/zauberschluessel 4)

## Schritt für Schritt

1. Zeichne den Zauberschlüssel. **Eigenschaft hinzufügen → Einsammeln → man kann es einsammeln** und darunter **bleibt fürs ganze Spiel**.
2. Setz das Tor in eine Mauer, die höher ist als ein Sprung. Es hat **ist verschließbar** und **automatische Tür**.
3. Klick im Level auf das Tor: **Code 4** (hier heißt er „Burgtor“) und **Bei Signal: öffnen**.
4. Klick in der Level-Liste auf das Level. Bei den Level-Einstellungen gibt es jetzt **+ sendet, wenn die Spielfigur … hat**. Klick darauf, wähle den Zauberschlüssel und **Code 4**.
5. Probier es aus: Sobald Pip den Schlüssel einsammelt, sendet das Level Code 4, und das Tor geht auf. Oben links im Spiel siehst du jetzt den Schlüssel – Pip hat ihn dabei.

## Mitgebracht aus einem anderen Level

Ein gewöhnlicher Schlüssel öffnet nur Türen in seinem eigenen Level. Der Zauberschlüssel bleibt bei Pip – auch im nächsten Level und wenn sie ein Leben verliert. Kommt sie mit ihm in ein Level, das nach ihm fragt, sendet das Level den Code gleich am Anfang: Das Tor geht auf, sobald das Level beginnt. Oben links ist der Schlüssel von Anfang an zu sehen.

![Pip bringt den Zauberschlüssel mit](variante:1)

So kann der Schlüssel in Level 1 liegen und das Tor in Level 5 öffnen. Gib dazu jedem Level mit so einem Tor die Einstellung **sendet, wenn die Spielfigur … hat**.

## Tipps

- Mit einem **Zähler** braucht das Tor mehrere Dinge: drei Kristalle, jeder mit **sendet, wenn die Spielfigur … hat** und demselben Code, und ein Zähler mit **Anzahl 3**.
- Ein Hinweistext mit **spricht bei Signal** kann sagen: „Der Zauberschlüssel passt!“

## Wenn's nicht klappt

- **„sendet, wenn die Spielfigur … hat“ fehlt in den Level-Einstellungen:** Es erscheint erst, wenn ein Sprite in deinem Spiel **bleibt fürs ganze Spiel** hat.
- **Das Tor bleibt zu:** Haben Tor und Level-Einstellung denselben Code? Und steht beim Tor **Bei Signal: öffnen**?

## Mach mehr draus

Verkauf den Zauberschlüssel in einem Laden (Rezept *Ein Laden*) – teuer, aber er öffnet den Weg zum Schatz.
