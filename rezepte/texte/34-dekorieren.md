---
titel: Level dekorieren
kategorie: Level gestalten
stufe: 2
kurz: Moos, Ranken und Fackeln liegen als durchsichtige Sprites auf derselben Mauer.
farben: 256            # many colours: avoid banding in the sky
szene:
  ebenen: &deko_nachher
    - name: Hintergrund
      kollision: false
      karte: |
        ............
        ..MMMMMMMM..
        ..MMMMMMMM..
        ..MMMMMMMM..
        ............
    - name: Boden
      karte: |
        ............
        ............
        ............
        .P..........
        ############
    - name: Deko
      kollision: false
      karte: |
        ............
        ..zzzzzzzz..
        ..r.nt.xr...
        .vr..v..rv..
        ............
vorher:
  szene:
    ebenen:
      - name: Hintergrund
        kollision: false
        karte: |
          ............
          ..MMMMMMMM..
          ..MMMMMMMM..
          ..MMMMMMMM..
          ............
      - name: Boden
        karte: |
          ............
          ............
          ............
          .P..........
          ############
ablauf:
  - { t: 0.3, halten: rechts, dauer: 1.1 }
dauer: 2.2
---
## Kurz gesagt

1. Deko-Sprites haben **durchsichtige** Pixel und **keine** Eigenschaften.
2. Sie kommen in eine **eigene Ebene** über der Mauer.
3. So bekommt dieselbe Mauer Moos, Ranken, Risse, Fenster und Fackeln.

## Das brauchst du

- **Das musst du zeichnen:** eine Mauer und ein paar kleine Deko-Sprites. Alles, was nicht dazugehört, bleibt durchsichtig.
- **Das kannst du später dazumalen:** eine flackernde Fackel (drei Frames).

![Moos](katalog:welt/moos)
![Ranke](katalog:welt/ranke)
![Fackel](katalog:welt/fackel 8)
![Riss](katalog:welt/riss)
![Burgfenster](katalog:welt/burgfenster)
![Grasbüschel](katalog:welt/grasbuesche)

## Schritt für Schritt

1. Zeichne die Mauer einmal, ohne Deko.
2. Zeichne das Moos nur in die obersten Reihen eines neuen Sprites. Der Rest bleibt durchsichtig – mit dem Radiergummi oder der durchsichtigen Farbe.
3. Genauso: Ranke, Riss, Fenster, Fackel. Diese Sprites bekommen **keine** Eigenschaften.
4. Neue Ebene „Deko“, **Kollisionen erkennen** aus. In der Layer-Liste steht sie **über** der Mauer.
5. Setz die Deko-Sprites genau auf die Mauersteine. Grasbüschel kommen in das Feld **über** dem Boden.

## Tipps

> **Tipp:** Pro Ebene kann an jeder Stelle nur **ein** Sprite liegen. Genau deshalb braucht die Deko ihre eigene Ebene – sonst würdest du die Mauer ersetzen.

- Die Mauer im Hintergrund hat hier auch **Kollisionen erkennen** aus: Pip läuft **davor** entlang, nicht dagegen.
- Weniger ist mehr: Wenn jeder Stein verziert ist, fällt nichts mehr auf. Verteil die Deko ungleichmäßig.
- Damit nicht alle Fackeln gleichzeitig flackern, sorgt die **Phase** im Zustand für kleine Unterschiede.
- Male Deko ruhiger und dunkler als Dinge, die man berühren kann. So verwechselt niemand Moos mit einer Plattform.

## Wenn's nicht klappt

- **Die Mauer ist weg, wo die Deko liegt:** Die Deko liegt in derselben Ebene wie die Mauer. Leg sie in eine eigene Ebene.
- **Die Deko ist hinter der Mauer:** Schieb die Deko-Ebene in der Layer-Liste nach oben.
- **Rund um die Deko ist ein Kasten zu sehen:** Die Pixel um das Moos herum sind nicht durchsichtig, sondern weiß oder schwarz.
- **Die Figur bleibt an der Deko hängen:** Die Deko hat eine Block-Eigenschaft. Deko braucht keine.

## Mach mehr draus

Mach aus derselben Mauer eine Ruine, ein Schloss und einen Kerker – nur mit anderer Deko.
