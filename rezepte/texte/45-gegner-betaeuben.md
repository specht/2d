---
titel: Gegner nach einem Treffer anhalten
kategorie: Kampf
stufe: 2
skala: 4
kurz: Mit „Pause nach Treffer“ bleibt der Glibber kurz stehen – Zeit zum Durchatmen.
szene:
  legende: { P: pip_schwert }
  anpassen: { glibber: { baddie: { energy: 60, hit_pause: 1.0, vrun: 0.6 } } }
  karte: |
    ..........
    ..........
    .P......g.
    ##########
ablauf:
  - { t: 0.3, halten: rechts, dauer: 0.6 }
  - { t: 1.0, drücken: nahkampf }
  - { t: 2.25, drücken: nahkampf }
  - { t: 3.5, drücken: nahkampf }
dauer: 4.4
erwartet:
  gegner_besiegt: 1
---
## Kurz gesagt

1. Beim Gegner gibt es die Eigenschaft **Pause nach Treffer**.
2. Nach jedem Treffer bleibt er so viele Sekunden stehen und greift nicht an.
3. So kann die Figur einen starken Gegner mit mehreren Schlägen besiegen, ohne selbst getroffen zu werden.

## Das brauchst du

- **Das musst du zeichnen:** einen Gegner mit einer **Treffer**-Animation, damit man die Pause auch sieht.
- **Das kannst du später dazumalen:** kleine Sterne über dem Kopf, solange er benommen ist.

![Glibber läuft](katalog:glibber/laufen 8)
![Glibber getroffen](katalog:glibber/treffer)

## Schritt für Schritt

1. Gib der Spielfigur einen Nahkampf (siehe *Schwertkampf*).
2. Wähl den Gegner aus und schau bei **Gegner** in die Eigenschaften.
3. Stell **Energie** höher, zum Beispiel **60**. Dann reicht ein Schlag nicht.
4. Stell **Pause nach Treffer** auf **1,0 s**.
5. Probier es aus: Schlag zu, warte kurz, schlag noch einmal. Der Glibber bleibt nach jedem Treffer stehen.

## Tipps

> **Tipp:** Bei **0** ist die Pause ausgeschaltet: Der Gegner macht nach einem Treffer einfach weiter.

- Eine kurze Pause (0,3 bis 0,5 s) fühlt sich wie ein Rückstoß an. Eine lange (über 1 s) macht den Gegner benommen – dann wird es leicht.
- Große Bossgegner werden fairer, wenn man nach einem Treffer kurz durchatmen kann.
- Die Pause gilt für jeden Treffer: Schwert, Pfeil, Stein und Bombe.

## Wenn's nicht klappt

- **Der Gegner läuft sofort weiter:** **Pause nach Treffer** steht noch auf 0 – oder du hast sie bei einem anderen Sprite eingestellt.
- **Der Gegner ist nach einem Schlag weg:** Seine **Energie** ist kleiner als der Schaden des Schwerts.
- **Die Figur wird trotzdem getroffen:** Die Figur läuft in den Gegner hinein. Die Pause stoppt Angriffe, aber Berührungen machen weiter Schaden, wenn der Gegner so eingestellt ist.

## Mach mehr draus

Bau einen Boss mit viel Energie und kurzer Pause – und gib der Figur Pfeile, damit sie aus der Entfernung kämpfen kann.
