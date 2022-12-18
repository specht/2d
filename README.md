```
sprites:
  - name: 'Sprite 1'
    classes: []
    properties:
      deal_damage: 1
    hitboxes:
      collision: []
      take_damage: []
      deal_damage: []
    states:
    - name: 'Zustand 1'
      hitboxes: nil
      fps: 8
      frames:
      - width: 24
        height: 24
        hitboxes: nil
        src: (image/png base64 url)
palette:
  - html color entries
levels:
  - name: 'Level 1'
    layers:
    - name: 'Layer 1'
      properties:
        visible: true
      sprites:
       - [sprite_index, x, y]
       - ...
```

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

Level Editor:

Pan & zoom
Set sprite
Select sprites and delete