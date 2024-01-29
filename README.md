```
- mesh_for_sprite
- LayerStruct:
  - sprite_for_pos (only one sprite per position)
  - interval_tree_x, interval_tree_y: x => [sprite_index, x, y]
- scene:
  - layer groups:
    - list of: mesh with geometry and material -> uniforms / texture1 / value: this.spritesheet
    - geometry_for_sprite
    - material_for_sprite
  - cursor_group
  - grid_group
- selection for current level and layer:
  - set of layer_sprite indices
  - delete => re-create LayerStruct
```

Level Editor

- Pan & zoom
- Place sprite
- Fill rect with sprite
- Select placed sprites and delete
- Enable / disable grid
- Resize grid / move grid

Feedback Expertentage

- Schlüssel und Türen
- Nahkampf und Fernkampf, Knockback und Damage, mit Upgrades (Fäuste, Schwert, etc.)
- Schlittern (Eisiger Untergrund)
- Multiplayer
- Teammates, Begleiter, NPC
- Leiter / Wednesday Bug mit mehreren Spritesheet
- Blöcke die runterfallen
- Block erscheint beim betreten
- Fahrstuhl / Plattformen
- Schutzschilder
- Sprechblasen triggern mit Sprites
- Missionen: Dinge einsammeln, NPC bringen
- Gleiten / flattern wenn man in der Luft ist
- physikverstellende Blöcke
- Parallaxe zu kompliziert: Layer komplett verschieben
- Shop-System: Münzen einsetzen und Upgrades kaufen

Feedback Forschertage

- Kampfsystem: draufspringen, Nahkampf, Fernkampf (auch für Gegner!)
- Zeit die abläuft (insgesamt)
- von unten gegen Blöcke springen: Sprite kommt raus (Münze)
- NPCs mit Dialog
- Skills: fliegen / schweben können
- Mauspads in 223
- Steuerung: WASD / Leertaste, konfigurierbar machen
- bewegliche Blöcke, Plattformen etc.

Türen:
- `lockable` ist verschließbar: braucht Schlüssel oder Schalter bzw. lässt sich so öffnen
- im Level: Code für Türen, Schlüssel und Schalter (falls verschlossen)
- `automatic` automatische Tür ja / nein
- `closable` lässt sich wieder schließen ja / nein
- `close_after` schließt automatisch nach n Sekunden (0 = nein)
- Was passiert, wenn man die Tür schließt und drin steht?

```
def open_door_intent():
  ok = false
  if lockable:
    if have matching key:
      ok = true
  if ok:
    do_open()

def close_door_intent():
  if ok:
    do_close()

def toggle_door_intent():
  if closed:
    open()
  else:
    close()

if standing close:
  if automatic:
    open_door_intent()
  else:
    display F hint

if F pressed and not automatic:
  toggle_door_intent()

if timeout triggered:
  close_door_intent()

if lockable:
  if have matching key:
if not lockable:
```