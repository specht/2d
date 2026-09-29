---
titel: Eigene Tasten festlegen
kategorie: Loslegen
stufe: 1
kurz: Springen mit Pfeil hoch, Schwert mit Strg? In den Einstellungen legst du fest, welche Taste was macht.
tasten_zeigen: true
szene:
  legende: { P: pip_schwert }
  anpassen: { glibber: { baddie: { hit_pause: 0.8 } } }
  eigenschaften:
    controls: { jump: ['ArrowUp'], melee: ['ControlLeft'] }
  karte: |
    ..........
    ..........
    ..........
    .P......g.
    ##########
ablauf:
  - { t: 0.4, halten: rechts, dauer: 0.7 }
  - { t: 0.62, halten: ArrowUp, dauer: 0.15 }
  - { t: 1.5, halten: ControlLeft, dauer: 0.15 }
  - { t: 2.3, halten: ControlLeft, dauer: 0.15 }
dauer: 3.3
erwartet:
  gegner_besiegt: 1
---
## Kurz gesagt

1. In **Einstellungen → Steuerung** steht jede Aktion mit ihren Tasten.
2. Klick auf eine Taste und drück die neue – fertig.
3. Hier springt Pip mit **↑** und schlägt mit **Strg links** zu.

## Das brauchst du

- **Das musst du zeichnen:** nichts Neues. Die Steuerung gilt für dein ganzes Spiel.
- **Das kannst du später dazumalen:** ein Schild am Anfang des Levels, auf dem steht, welche Tasten es gibt.

## Schritt für Schritt

1. Öffne **Einstellungen** und scroll zu **Steuerung**. Dort stehen alle Aktionen: *Nach links*, *Nach rechts*, *Hoch (Leiter)*, *Runter (Leiter)*, *Springen*, *Aktion (Tür, Text)*, *Nahkampf* und *Fernkampf*.
2. Bei **Springen** klickst du auf **Leertaste**. Auf dem Knopf steht jetzt *Taste drücken …* – drück **↑**.
3. Bei **Nahkampf** klickst du auf **J** und drückst **Strg links**.
4. Jede Aktion kann **zwei** Tasten haben. Klick auf **+**, um eine zweite dazuzunehmen.
5. Eine Taste wieder loswerden: draufklicken und **Entf** drücken. **Esc** bricht ab, ohne etwas zu ändern.
6. Spiel es aus. Klappt etwas nicht, bringt **Standard-Tasten** alles zurück.

## Tipps

> **Tipp:** Die Tasten gelten für **dein Spiel** – also für alle, die es spielen. Verrate ihnen die Tasten, zum Beispiel auf einem Schild gleich am Anfang.

- Unter einer Aktion erscheint ein Hinweis, wenn dieselbe Taste noch etwas anderes macht. Hier ist **↑** auch *Hoch (Leiter)*: An einer Leiter klettert Pip dann, sonst springt er. Das passt gut zusammen.
- Beliebt für zwei Hände: links **A**/**D** zum Laufen, rechts **Leertaste** zum Springen und **Strg**, **J** oder **K** zum Kämpfen.
- Spiele ohne eigene Steuerung benutzen weiter die gewohnten Tasten: Pfeiltasten oder WASD, Leertaste, F, J und K.

> **Achtung:** Drückt man **Umschalt** fünfmal schnell hintereinander, fragt Windows nach den *Einrastfunktionen*. Umschalt funktioniert im Spiel trotzdem – einfach „Nein“ wählen. Die Einstellungen zeigen dazu einen Hinweis.

## Wenn's nicht klappt

- **Die Taste lässt sich nicht belegen:** **Esc**, **F5**, **F11** und **F12** braucht der Browser selbst. Nimm eine andere.
- **Strg+W schließt den Tab:** Strg zusammen mit W drückt man leicht aus Versehen, wenn man mit WASD läuft. Lauf dann mit den Pfeiltasten, oder nimm für den Angriff eine andere Taste.
- **Die Windows-Taste öffnet das Startmenü:** Das kann das Spiel nicht verhindern. Nimm eine andere Taste.
- **Nach dem Umbelegen springt die Figur gar nicht mehr:** Du hast die neue Taste vielleicht bei *Hoch (Leiter)* eingetragen statt bei *Springen*. Schau in die Zeile, in der sie steht.

## Mach mehr draus

Bau ein Spiel für zwei Hände: eine Hand läuft, die andere kämpft. Probier aus, welche Tasten sich am besten anfühlen – und frag jemanden, der dein Spiel testet.
