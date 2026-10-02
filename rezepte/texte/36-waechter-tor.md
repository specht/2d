---
titel: Erst den Wächter besiegen
kategorie: Signale
stufe: 2
skala: 2
kurz: Ein Glibber bewacht das Tor. Erst wenn Pip ihn besiegt hat, fährt das Gitter hoch.
szene:
  anpassen: { glibber: { baddie: { hit_pause: 0.5 } } }
  legende:
    P: pip_schwert
    g: { sprite: glibber, platziert: { baddie: { signal_on_defeat: true, signal_code: 5 } } }
    G: { sprite: gittertor, platziert: { door: { signal_code: 5, door_reaction: open } } }
  karte: |
    ..........M.M
    ..........M.M
    ..........M.M
    .P.....g..G.M
    #############
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.5 }
  - { t: 1.0, drücken: nahkampf }
  - { t: 1.6, drücken: nahkampf }
  - { t: 2.4, halten: rechts, dauer: 1.1 }
dauer: 3.8
erwartet:
  gegner_besiegt: 1
  signale: ['5 an']
  tuer_offen: true
  figur_rechts_von: 10
  lebt: true
---
## Kurz gesagt

1. Ein Gegner kann ein **Signal** senden, wenn er besiegt ist.
2. Ein Tor mit **demselben Code** geht dann auf.
3. Im Spiel: Gegner besiegen – und durch das Tor.

## Das brauchst du

- **Das musst du zeichnen:** eine Spielfigur mit einem Angriff, einen Gegner und ein Tor (geschlossen und geöffnet).
- **Das kannst du später dazumalen:** einen **Übergang**, in dem das Tor hochfährt, und einen **Tot**-Zustand für den Gegner.

![Das Gitter fährt hoch](katalog:welt/gitter_uebergang 10)

## Schritt für Schritt

1. Gib deiner Figur einen Angriff wie im Rezept *Schwertkampf*.
2. Zeichne das Tor wie im Rezept *Ein Schalter öffnet das Tor*: **ist eine Tür**, **ist verschließbar** und **automatische Tür** an.
3. Setz das Tor ins **Level** in eine hohe Mauer und den Gegner davor.
4. Klicke im Level auf den Gegner und schalte **sendet, wenn besiegt** an. Er bekommt einen eigenen **Code**; du kannst ihn ändern, z. B. in **5**.
5. Klicke auf das Tor: **Code** auch **5**, und unter **Bei Signal** wählst du **öffnen**.

Unter dem Code steht, was zusammengehört: *Code 5 in diesem Level – sendet: 1 Gegner · reagiert: 1 Tür*.

## Tipps

- Mehrere Wächter? Sollen sie **alle** besiegt sein? Bei den **Level-Eigenschaften** gibt es **sendet, wenn alle Gegner besiegt**. Dann reicht ein Code für alle.
- Gegner in einer **Ebene**, die erst erscheint, warten, bis sie da ist. So baust du eine zweite Welle: Die Ebene mit den neuen Gegnern stellst du auf **Bei Signal: erscheint** – mit dem Code von *alle Gegner besiegt*.
- Ein besiegter Gegner kann auch eine Brücke erscheinen oder eine Wand verschwinden lassen – alles, was auf seinen Code hört.

## Wenn's nicht klappt

- **Das Tor bleibt zu:** Beim Gegner ist **sendet, wenn besiegt** aus, oder die Codes sind verschieden.
- **Das Tor geht auf, bevor der Gegner besiegt ist:** Etwas anderes sendet denselben Code – ein Schlüssel oder Schalter. Unter dem Code siehst du, wer sendet.
- **Man kommt auch ohne Kampf durch:** Die Mauer hat eine Lücke, oder das Tor ist nicht **verschließbar**.

## Mach mehr draus

Lass nach dem Sieg nicht nur das Tor aufgehen, sondern auch eine Brücke über einen Graben erscheinen – beide mit demselben Code.
