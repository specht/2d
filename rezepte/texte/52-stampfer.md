---
titel: Der Stampfer kracht herunter
kategorie: Gegner
stufe: 2
skala: 2
kurz: Steinklötze hängen an der Decke. Läuft Pip darunter durch, krachen sie herunter – einer hebt sich wieder, der andere bleibt liegen.
szene:
  anpassen:
    klotz: { baddie: { damage: 50 } }
    klotz_einmal: { baddie: { damage: 50 } }
  # one extra tile all around the recorded area: the camera shake never shows empty edges
  ausschnitt: [1, 1, 14, 6]
  karte: |
    MMMMMMMMMMMMMMMM
    MMMMMMMMMMMMMMMM
    MM....U....8..MM
    MM............MM
    MM............MM
    MMP...........MM
    ################
    ================
ablauf:
  - { t: 0.5, halten: rechts, dauer: 1.45 }
dauer: 5.2
erwartet:
  gegner_modi: [drop, bottom, rise, done]
  gegner_hub: 60
  energie_gleich: 100
---
## Kurz gesagt

1. Der **Stampfer** hängt oben und wartet.
2. Läuft die Spielfigur darunter durch, wackelt er kurz – und kracht herunter.
3. Danach hebt er sich langsam wieder. Oder er **fällt nur einmal** und bleibt liegen.

## Das brauchst du

- **Das musst du zeichnen:** einen schweren Block mit einem schlafenden Gesicht.
- **Das kannst du später dazumalen:** ein wütendes Gesicht für den Fall und ein paar Bilder für den Aufprall – mit Staubwolken an den Seiten.

![Steinklotz wartet](katalog:klotz/stehen)
![Steinklotz fällt](katalog:klotz/fallen)
![Steinklotz schlägt auf](katalog:klotz/landen 10)

## Schritt für Schritt

1. Bau eine Decke, zum Beispiel einen Gang in einer Höhle.
2. Setz den Steinklotz direkt unter die Decke.
3. Gib ihm die Eigenschaft **Gegner** und stell **Verhalten: Stampfer** ein. Die Schwerkraft wirkt jetzt nicht mehr auf ihn – er hängt, bis er fällt.
4. **fällt ab Abstand: 12 px.** So nah muss die Spielfigur kommen.
5. **wackelt vorher: 0,2 s** – die Warnung. **Tempo beim Fallen: 600 px/s.**
6. **wartet unten: 1 s**, **Tempo nach oben: 40 px/s** und **Pause oben: 0,5 s**.
7. Beim zweiten Klotz: **fällt nur einmal**. Er bleibt nach dem Aufprall liegen.
8. Die Bilder: **Gegner fällt nach vorn** zeigt das wütende Gesicht, **Gegner ist aufgeschlagen (vorn)** den Aufprall. Diese Animation läuft einmal ab, dann bleibt das letzte Bild stehen.
9. Mit **Camera Shake bei Landung** (unter **Erweitert**) wackelt der Bildschirm, wenn er aufschlägt. Pip benutzt **4 px**.

## Tipps

> **Tipp:** Wer schnell genug läuft, kommt durch. Wer stehen bleibt, wird getroffen. **wackelt vorher** ist die Chance – je länger, desto leichter.

- Beim **Schaden** des Stampfers entscheidest du, wie gefährlich er ist. Hier: **50**.
- Gib dem Stampfer viel **Energie** (Pip: **1000**), wenn man ihn nicht besiegen können soll.
- Ein Klotz, der **nur einmal** fällt, versperrt danach den Weg – oder wird zur Stufe, auf die man springen muss.
- Mehrere Stampfer hintereinander ergeben einen Rhythmus: warten, rennen, warten.

## Wenn's nicht klappt

- **Er fällt sofort herunter:** Das Verhalten steht noch auf **Wächter**. Stell **Stampfer** ein.
- **Er fällt nie:** Die Spielfigur läuft nicht nah genug darunter durch. Stell **fällt ab Abstand** größer.
- **Er fällt durch den Boden:** Der Boden braucht *man kann nicht von oben reinfallen*.
- **Man sieht den Aufprall nicht:** Es fehlt der Zustand **Gegner ist aufgeschlagen**. Ohne ihn zeigt er einfach sein normales Bild.

## Mach mehr draus

Leg unter einen Stampfer eine Münze. Man muss warten, bis er unten ist, und die Münze holen, während er sich langsam hebt.
