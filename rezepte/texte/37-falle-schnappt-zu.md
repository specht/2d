---
titel: Die Falle schnappt zu
kategorie: Signale
stufe: 3
skala: 2
kurz: Kaum ist Pip in der Arena, fällt hinter ihm das Gitter zu. Erst wenn alle Glibber besiegt sind, geht vorne das Tor auf.
szene:
  # the Glibber wait where they are, so the fight in the recording always goes the same way
  anpassen: { glibber: { baddie: { hit_pause: 0.5, patrols: false } } }
  legende:
    P: pip_schwert
    # open at the start; the Bereich "Arena" (Code 1) closes it behind Pip
    E: { sprite: gittertor, platziert: { door: { door_closed: false, signal_code: 1, door_reaction: close } } }
    # the level sends Code 2 once no enemy is left (alle_besiegt)
    G: { sprite: gittertor, platziert: { door: { signal_code: 2, door_reaction: open } } }
  bereiche:
    - { name: Arena, code: 1, rechtecke: [[6, 0, 7, 4]] }
  alle_besiegt: 2
  karte: |
    ....M........M.M
    ....M........M.M
    ....M........M.M
    .P..E...g..g.G.M
    ################
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.75 }
  - { t: 1.2, drücken: nahkampf }
  - { t: 1.8, drücken: nahkampf }
  - { t: 2.4, halten: rechts, dauer: 0.4 }
  - { t: 2.9, drücken: nahkampf }
  - { t: 3.5, drücken: nahkampf }
  - { t: 4.3, halten: rechts, dauer: 1.2 }
dauer: 6.0
standbild: 1.4
erwartet:
  gegner_besiegt: 2
  # "1 aus": Pip leaves the arena – the entry gate only listens to "an" and stays shut
  signale: ['1 an', '2 an', '1 aus']
  tuer_offen: true
  figur_rechts_von: 13
  lebt: true
---
## Kurz gesagt

1. Ein **Bereich** sendet seinen **Code**, sobald die Spielfigur hineinläuft – das Tor hinter ihr **schließt** sich.
2. Das Level sendet einen zweiten Code, wenn **alle Gegner besiegt** sind – das Tor vorne **öffnet** sich.
3. Im Spiel: hinein, kämpfen, hinaus. Zurück geht's nicht.

## Das brauchst du

- **Das musst du zeichnen:** eine Spielfigur mit einem Angriff, Gegner und ein Tor (geschlossen und geöffnet) – das gleiche Tor für den Eingang und den Ausgang.
- **Das kannst du später dazumalen:** einen **Übergang**, in dem das Gitter herunterfällt und hochfährt.

![Das Gitter fährt hoch](katalog:welt/gitter_uebergang 10)

## Schritt für Schritt

1. Bau die Arena: links und rechts eine hohe Mauer mit je einem Tor. Zeichne das Tor wie im Rezept *Ein Schalter öffnet das Tor* (**ist verschließbar** und **automatische Tür** an). Setz die Gegner hinein.
2. **Der Eingang:** Klicke im Level auf das linke Tor. Schalte **Tür geschlossen** aus – am Anfang ist es offen. **Code 1**, **Bei Signal: schließen**.
3. **Die Falle:** Neue Ebene über **+ → Bereich**, **Code 1**. Zieh das Rechteck über die Arena. Lass es erst **ein Stück hinter dem Tor** beginnen – sonst fällt das Gitter, während die Figur noch darin steht.
4. **Der Ausgang:** Klicke auf das rechte Tor: **Code 2**, **Bei Signal: öffnen**.
5. Klicke auf eine leere Stelle im Level. Bei den **Level-Eigenschaften** stellst du **sendet, wenn alle Gegner besiegt** auf **2**.
6. Probier es aus: Pip läuft hinein, das Gitter hinter ihm fällt zu. Erst nach dem letzten Gegner fährt vorne das Tor hoch.

Unter jedem Code steht, was zusammengehört: *Code 1 – sendet: Bereich »Arena« · reagiert: 1 Tür* und *Code 2 – sendet: alle Gegner besiegt · reagiert: 1 Tür*.

## Tipps

- Für einen einzelnen Gegner reicht es, wenn **er** sendet – siehe *Erst den Wächter besiegen*. **Alle Gegner besiegt** ist praktisch, sobald es mehrere sind: Du musst dir nur einen Code merken.
- **Gegnerwellen:** Leg die zweite Welle in eine eigene Ebene mit **Bei Signal: erscheint** und dem Code von *alle Gegner besiegt*. Gegner in einer Ebene, die noch nicht da ist, warten – und zählen noch nicht mit. Erst wenn auch sie besiegt sind, sendet das Level noch einmal.
- Gib dem Bereich eine **Verzögerung**: Dann fällt das Gitter erst eine Sekunde, nachdem die Figur hineingelaufen ist – ein kleiner Schreckmoment.
- Ein Bereich kann noch mehr: Lässt du eine Wand-Ebene mit **weg, solange an** verschwinden, solange die Figur darin steht, hast du einen **geheimen Gang** – wie der Berg im Rezept *Eine Höhle erkunden*.

## Wenn's nicht klappt

- **Das Gitter fällt nicht zu:** Bereich und Eingang haben verschiedene Codes, beim Eingang steht nicht **schließen**, oder das Rechteck liegt nicht dort, wo die Figur läuft. Es zählt die Mitte der Figur.
- **Das Gitter fällt auf die Figur:** Der Bereich beginnt zu nah am Tor. Schieb ihn ein Stück in die Arena hinein.
- **Der Eingang ist schon am Anfang zu:** Beim platzierten Tor ist **Tür geschlossen** noch an.
- **Der Ausgang bleibt zu:** Ein Gegner lebt noch – vielleicht einer außerhalb der Arena. **Alle Gegner besiegt** heißt: alle im ganzen Level.

## Mach mehr draus

Stell in die Arena einen Gegner, der schießt, und einen, der dich verfolgt. Oder bau eine Bossarena: ein großer Gegner mit viel Energie, und hinter dem Ausgang wartet die Belohnung.
