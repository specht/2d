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
