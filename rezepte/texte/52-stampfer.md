---
titel: Der Stampfer kracht herunter
kategorie: Gegner
stufe: 2
farben: 256
skala: 2
schritte: 2             # the screen shakes: fewer frames keep the file small
kurz: Steinklötze hängen an der Decke. Läuft Pip darunter durch, krachen sie herunter – wer zu langsam ist, wird platt.
szene:
  anpassen: { klotz: { baddie: { damage: 50 } } }
  karte: |
    MMMMMMMMMMMMMM
    M....U....U..M
    M............M
    M............M
    MP...........M
    ##############
ablauf:
  - { t: 0.5, halten: rechts, dauer: 1.3 }
dauer: 5.2
erwartet:
  gegner_modi: [drop, bottom, rise]
  gegner_hub: 60
  energie_gleich: 100
---
## Kurz gesagt

1. Der **Stampfer** hängt oben und wartet.
2. Läuft die Spielfigur darunter durch, kracht er herunter.
3. Danach bleibt er kurz unten und hebt sich langsam wieder.

## Das brauchst du

- **Das musst du zeichnen:** einen schweren Block mit einem schlafenden Gesicht.
- **Das kannst du später dazumalen:** ein wütendes Gesicht für den Fall.

![Steinklotz wartet](katalog:klotz/stehen)
![Steinklotz fällt](katalog:klotz/fallen)

## Schritt für Schritt

1. Bau eine Decke, zum Beispiel einen Gang in einer Höhle.
2. Setz den Steinklotz direkt unter die Decke.
3. Gib ihm die Eigenschaft **Gegner** und stell **Verhalten: Stampfer** ein. Die Schwerkraft wirkt jetzt nicht mehr auf ihn – er hängt, bis er fällt.
4. **fällt ab Abstand: 12 px.** So nah muss die Spielfigur kommen.
5. **wartet unten: 1 s** und **Tempo nach oben: 40 px/s**.
6. Der Zustand mit **Gegner fällt nach vorn** zeigt das wütende Gesicht beim Fallen.
7. Mit **Camera Shake bei Landung** wackelt der Bildschirm, wenn er aufschlägt. Pip benutzt **4 px**.

## Tipps

> **Tipp:** Wer schnell genug läuft, kommt durch. Wer stehen bleibt, wird getroffen. Der Klotz braucht einen Moment, bevor er fällt – genau das ist die Chance.

- Beim **Schaden** des Stampfers entscheidest du, wie gefährlich er ist. Hier: **50**.
- Gib dem Stampfer viel **Energie** (Pip: **1000**), wenn man ihn nicht besiegen können soll.
- Mehrere Stampfer hintereinander ergeben einen Rhythmus: warten, rennen, warten.

## Wenn's nicht klappt

- **Er fällt sofort herunter:** Das Verhalten steht noch auf **Wächter**. Stell **Stampfer** ein.
- **Er fällt nie:** Die Spielfigur läuft nicht nah genug darunter durch. Stell **fällt ab Abstand** größer.
- **Er fällt durch den Boden:** Der Boden braucht *man kann nicht von oben reinfallen*.

## Mach mehr draus

Leg unter einen Stampfer eine Münze. Man muss warten, bis er unten ist, und die Münze holen, während er sich langsam hebt.
