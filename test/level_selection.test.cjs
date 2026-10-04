const test = require('node:test');
const assert = require('node:assert/strict');
const sel = require('../src/static/level_selection.js');

const layer = () => [['a', 0, 0], ['b', 24, 0], ['c', 48, 0, { key: { signal_code: 3 } }], ['d', 24, 24]];

test('moving: the moved sprites win where they land, the rest stays – in the same order', () => {
    const { sprites, selection } = sel.move_placed(layer(), [0, 1], 24, 0);
    // a moved onto b's old place, b onto c (c is replaced); the order stays, so
    // what was behind stays behind
    assert.deepEqual(sprites, [['a', 24, 0], ['b', 48, 0], ['d', 24, 24]]);
    assert.deepEqual(selection, [0, 1]);
    const back = sel.move_placed(layer(), [3], 0, -24);
    assert.deepEqual(back.sprites, [['a', 0, 0], ['c', 48, 0, { key: { signal_code: 3 } }], ['d', 24, 0]]);
    assert.deepEqual(back.selection, [2]);
    const same = layer();
    assert.equal(sel.move_placed(same, [0], 0, 0).sprites, same);
});

test('copy keeps placed properties, paste puts the lower left corner where wanted', () => {
    const clip = sel.copy_placed(layer(), [2, 3]);
    assert.deepEqual(clip, { items: [['c', 48, 0, { key: { signal_code: 3 } }], ['d', 24, 24]], x: 24, y: 0 });
    const { sprites, selection } = sel.paste_placed(layer(), clip, 100, 48);
    assert.deepEqual(sprites.slice(4), [['c', 124, 48, { key: { signal_code: 3 } }], ['d', 100, 72]]);
    assert.deepEqual(selection, [4, 5]);
    // a copy is a copy
    sprites[4][3].key.signal_code = 9;
    assert.equal(clip.items[0][3].key.signal_code, 3);
    assert.equal(sel.copy_placed(layer(), []), null);
    assert.deepEqual(sel.paste_placed(layer(), null, 0, 0).selection, []);
});

test('pasting over sprites replaces them', () => {
    const clip = sel.copy_placed(layer(), [0]);
    const { sprites } = sel.paste_placed(layer(), clip, 24, 0);
    assert.deepEqual(sprites, [['a', 0, 0], ['c', 48, 0, { key: { signal_code: 3 } }], ['d', 24, 24], ['a', 24, 0]]);
});

test('removing and moving to another layer', () => {
    assert.deepEqual(sel.remove_placed(layer(), [1, 3]).sprites, [['a', 0, 0], ['c', 48, 0, { key: { signal_code: 3 } }]]);
    const moved = sel.move_placed_to_layer(layer(), [0, 3], [['x', 0, 0], ['y', 96, 0]]);
    assert.deepEqual(moved.from, [['b', 24, 0], ['c', 48, 0, { key: { signal_code: 3 } }]]);
    assert.deepEqual(moved.to, [['y', 96, 0], ['a', 0, 0], ['d', 24, 24]]);
    assert.deepEqual(moved.selection, [1, 2]);
});

test('moving to a layer with another parallax keeps the sprites where they are on screen', () => {
    // camera at x 480: the background (parallax 0.5) is drawn 240 further right than the world (0)
    assert.deepEqual(sel.parallax_layer_offset(480, 0, 0, 0.5, 24, 24), [-240, 0]);
    assert.deepEqual(sel.parallax_layer_offset(480, 96, 0.5, 0, 24, 24), [240, 48]);
    // whole grid steps, so the sprites stay on the grid
    assert.deepEqual(sel.parallax_layer_offset(100, 0, 0, 0.5, 24, 24), [-48, 0]);
    // without a grid: whole pixels; the same parallax: no offset (and never -0)
    assert.deepEqual(sel.parallax_layer_offset(101, 0, 0, 0.5, 0, 0), [-50, 0]);
    assert.deepEqual(sel.parallax_layer_offset(480, 96, 0.5, 0.5, 24, 24), [0, 0]);
    assert.deepEqual(sel.parallax_layer_offset(480, 96, undefined, 0, 24, 24), [0, 0]);
    const moved = sel.move_placed_to_layer(layer(), [2], [['x', 0, 0]], -24, 24);
    assert.deepEqual(moved.to, [['x', 0, 0], ['c', 24, 24, { key: { signal_code: 3 } }]]);
    // a moved sprite lands on another one: it wins
    assert.deepEqual(sel.move_placed_to_layer(layer(), [1], [['x', 0, 0]], -24, 0).to, [['b', 0, 0]]);
});

test('filling a rectangle on the grid, corners included', () => {
    const grid = { width: 24, height: 24 };
    const { sprites, selection } = sel.fill_placed([['old', 24, 0]], 's1', 0, 0, 48, 24, grid);
    assert.equal(sprites.length, 6);
    assert.deepEqual(sprites.map(p => p.slice(1)), [[0, 0], [24, 0], [48, 0], [0, 24], [24, 24], [48, 24]]);
    assert.ok(sprites.every(p => p[0] === 's1'));
    assert.deepEqual(selection, [0, 1, 2, 3, 4, 5]);
    // dragged the other way round: the same
    assert.deepEqual(sel.fill_placed([], 's1', 48, 24, 0, 0, grid).sprites.length, 6);
    // far too big: nothing happens
    assert.equal(sel.fill_placed([], 's1', 0, 0, 24 * 1000, 24 * 1000, grid).sprites.length, 0);
});

test('the edge of a rectangle: only its outer cells', () => {
    const grid = { width: 24, height: 24 };
    const cells = sel.shape_cells('frame', 0, 0, 72, 48, grid);
    assert.equal(cells.length, 10);   // 4 × 3 cells, without the 2 inside
    assert.ok(!cells.some(([x, y]) => y === 24 && (x === 24 || x === 48)));
    // one row or column thick: every cell, each once
    assert.deepEqual(sel.shape_cells('frame', 48, 0, 0, 0, grid), [[0, 0], [24, 0], [48, 0]]);
    assert.deepEqual(sel.shape_cells('frame', 0, 0, 0, 0, grid), [[0, 0]]);
    // what was inside stays
    const { sprites, selection } = sel.place_shape([['old', 24, 24]], 's1', 'frame', 0, 0, 48, 48, grid);
    assert.equal(sprites.length, 9);
    assert.deepEqual(sprites[0], ['old', 24, 24]);
    assert.deepEqual(selection, [1, 2, 3, 4, 5, 6, 7, 8]);
    // a big edge is fine where the filled rectangle would be too big
    assert.equal(sel.shape_cells('frame', 0, 0, 24 * 1000, 24 * 1000, grid).length, 4000);
    assert.equal(sel.shape_cells('rect', 0, 0, 24 * 1000, 24 * 1000, grid), null);
});

test('a line of cells: straight, diagonal or in between', () => {
    const grid = { width: 24, height: 24 };
    assert.deepEqual(sel.shape_cells('line', 0, 0, 72, 0, grid), [[0, 0], [24, 0], [48, 0], [72, 0]]);
    assert.deepEqual(sel.shape_cells('line', 0, 48, 0, 0, grid), [[0, 48], [0, 24], [0, 0]]);
    assert.deepEqual(sel.shape_cells('line', 0, 0, 72, 72, grid), [[0, 0], [24, 24], [48, 48], [72, 72]]);
    assert.deepEqual(sel.shape_cells('line', 72, 0, 0, 72, grid), [[72, 0], [48, 24], [24, 48], [0, 72]]);
    // shallow: one cell per column, from the start to the end
    const shallow = sel.shape_cells('line', 0, 0, 96, 48, grid);
    assert.equal(shallow.length, 5);
    assert.deepEqual(shallow[0], [0, 0]);
    assert.deepEqual(shallow[4], [96, 48]);
    assert.deepEqual(shallow.map(([x]) => x), [0, 24, 48, 72, 96]);
    // on an offset grid and with a 16 × 32 grid
    assert.deepEqual(sel.shape_cells('line', 8, 4, 40, 68, { width: 16, height: 32 }), [[8, 4], [24, 36], [40, 68]]);
    assert.deepEqual(sel.shape_cells('line', 0, 0, 0, 0, grid), [[0, 0]]);
    assert.equal(sel.shape_cells('line', 0, 0, 24 * 5000, 0, grid), null);
    const { sprites } = sel.place_shape([['old', 24, 24]], 's1', 'line', 0, 0, 48, 48, grid);
    assert.deepEqual(sprites, [['s1', 0, 0], ['s1', 24, 24], ['s1', 48, 48]]);
});

test('"Gleiche auswählen": every copy of the selected sprites in the layer', () => {
    const sprites = [['gras', 0, 0], ['erde', 24, 0], ['gras', 48, 0], ['tuer', 72, 0], ['gras', 96, 0]];
    assert.deepEqual(sel.same_sprite_indices(sprites, [2]), [0, 2, 4]);
    assert.deepEqual(sel.same_sprite_indices(sprites, [1, 3]), [1, 3]);
    assert.deepEqual(sel.same_sprite_indices(sprites, []), []);
    assert.deepEqual(sel.same_sprite_indices(sprites, [99]), []);
});

test('"Ersetzen": same place and order, settings stay for traits the new sprite has', () => {
    const sprites = [
        ['gras', 0, 0],
        ['tuer_holz', 24, 0, { door: { signal_code: 4, door_reaction: 'follow' }, text: { text: 'alt' } }],
        ['schalter', 48, 0, { switch: { signal_code: 2 } }],
        ['erde', 72, 0],
    ];
    const before = JSON.stringify(sprites);
    const door_traits = new Set(['door']);
    const result = sel.replace_placed(sprites, [1, 2, 0], 'tuer_eisen', trait => door_traits.has(trait));
    assert.deepEqual(result.sprites, [
        ['tuer_eisen', 0, 0],
        ['tuer_eisen', 24, 0, { door: { signal_code: 4, door_reaction: 'follow' } }],
        ['tuer_eisen', 48, 0],                  // a Schalter's Code means nothing to a door
        ['erde', 72, 0],
    ]);
    assert.deepEqual(result.selection, [1, 2, 0]);
    assert.deepEqual(result.changed, [0, 1, 2]);
    assert.equal(JSON.stringify(sprites), before); // the old array is untouched
    // the kept settings are copies
    result.sprites[1][3].door.signal_code = 9;
    assert.equal(sprites[1][3].door.signal_code, 4);
});

test('"Ersetzen" with the sprite that is already there changes nothing', () => {
    const sprites = [['gras', 0, 0], ['gras', 24, 0, { key: { signal_code: 1 } }]];
    const result = sel.replace_placed(sprites, [0, 1], 'gras', () => false);
    assert.equal(result.sprites, sprites);
    assert.deepEqual(result.changed, []);
    assert.deepEqual(sel.replace_placed(sprites, [], 'erde', () => false).changed, []);
});

test('double-click: what is under the point in every visible sprite layer, front first', () => {
    const size = { s: { width: 24, height: 24 }, haus: { width: 96, height: 72 } };
    const layers = [
        { type: 'sprites', properties: {}, sprites: [['s', 12, 0]] },                         // 0: in front
        { type: 'backdrop', properties: {}, rects: [{ left: 0, bottom: 0, width: 999, height: 999 }] },
        { type: 'sprites', properties: { visible: false }, sprites: [['s', 12, 0]] },        // hidden
        { type: 'sprites', properties: { parallax: 0.5 }, sprites: [['haus', 48, 0], ['s', 60, 0]] }, // behind
    ];
    // no camera movement except in layer 3, which moves at half speed
    const point_of = (li) => li === 3 ? [10 - 0, 5] : [10, 5];
    const hits = sel.placed_sprites_at(layers, point_of, ref => size[ref] ?? null);
    assert.deepEqual(hits, [{ layer_index: 0, placed_index: 0 }, { layer_index: 3, placed_index: 0 }]);
    // within a layer the sprite drawn last comes first
    const both = sel.placed_sprites_at(layers, li => li === 3 ? [55, 5] : [999, 999], ref => size[ref] ?? null);
    assert.deepEqual(both, [{ layer_index: 3, placed_index: 1 }, { layer_index: 3, placed_index: 0 }]);
    // a sprite whose drawing is gone is skipped
    assert.deepEqual(sel.placed_sprites_at(layers, () => [10, 5], () => null), []);
});

test('double-click again at the same spot reaches the sprite behind, and round again', () => {
    const hits = [{ layer_index: 0, placed_index: 2 }, { layer_index: 3, placed_index: 0 }];
    assert.deepEqual(sel.next_pick(hits, null), hits[0]);
    assert.deepEqual(sel.next_pick(hits, hits[0]), hits[1]);
    assert.deepEqual(sel.next_pick(hits, hits[1]), hits[0]);
    assert.deepEqual(sel.next_pick(hits, { layer_index: 9, placed_index: 9 }), hits[0]); // gone meanwhile
    assert.equal(sel.next_pick([], hits[0]), null);
});

test('copies go half a grid step beside the originals and never replace a sprite', () => {
    const row = [['a', 0, 0], ['a', 24, 0], ['a', 48, 0]];
    // a whole step would land on the neighbours: half a step does not
    assert.deepEqual(sel.duplicate_offset(row, row, 12, 12), [12, 12]);
    // the originals duplicated once more: the half step is taken by the
    // first copies, the next one is free
    const with_copy = [...row, ['a', 12, 12], ['a', 36, 12], ['a', 60, 12]];
    assert.deepEqual(sel.duplicate_offset(with_copy, row, 12, 12), [24, 24]);
    // a copy of the copy: half a step from the copy
    assert.deepEqual(sel.duplicate_offset(with_copy, with_copy.slice(3), 12, 12), [12, 12]);
    // pasting into a layer where the spot is free: the same spot
    assert.deepEqual(sel.duplicate_offset([['x', 100, 100]], row, 12, 12, 0), [0, 0]);
    assert.deepEqual(sel.duplicate_offset(row, row, 12, 12, 0), [12, 12]);
});

test('dragging puts the selection\'s lower left corner on the grid', () => {
    const grid = { width: 24, height: 24, x: 0, y: 0 };
    const copies = [['a', 12, 12], ['a', 36, 12]];
    // a duplicate dragged by a little: back on the grid
    assert.deepEqual(sel.snapped_selection_delta(copies, [0, 1], 3, -2, grid), [12, -12]);
    assert.deepEqual(sel.snapped_selection_delta(copies, [0, 1], -2, -3, grid), [-12, -12]);
    assert.deepEqual(sel.snapped_selection_delta(copies, [0, 1], 10, 9, grid), [12, 12]);
    // on the grid already: whole steps, as before
    const placed = [['a', 24, 48]];
    assert.deepEqual(sel.snapped_selection_delta(placed, [0], 30, -13, grid), [24, -24]);
    assert.deepEqual(sel.snapped_selection_delta(placed, [0], 11, 11, grid), [0, 0]);
    // a grid with an offset (Gitteroffset) and another size
    assert.deepEqual(sel.snapped_selection_delta([['a', 5, 3]], [0], 0, 0, { width: 16, height: 16, x: 4, y: -13 }), [-1, 0]);
    assert.equal(sel.grid_point(-30, 24, 0), -24);
    assert.equal(sel.grid_point(7, 0, 0), 7);
});

test('arrow keys go to the next grid position in their direction', () => {
    const grid = { width: 24, height: 24, x: 0, y: 0 };
    assert.deepEqual(sel.grid_step_delta([['a', 24, 0]], [0], 1, 0, grid), [24, 0]);
    assert.deepEqual(sel.grid_step_delta([['a', 24, 0]], [0], 0, -1, grid), [0, -24]);
    // off the grid: only as far as the next grid position
    assert.deepEqual(sel.grid_step_delta([['a', 12, 12]], [0], 1, 0, grid), [12, 0]);
    assert.deepEqual(sel.grid_step_delta([['a', 12, 12]], [0], -1, 0, grid), [-12, 0]);
    assert.deepEqual(sel.grid_step_delta([['a', 12, 12]], [0], 0, 1, grid), [0, 12]);
    assert.deepEqual(sel.grid_step_delta([['a', -12, -12]], [0], 0, -1, grid), [0, -12]);
});

test('Rastergröße: 24 unless chosen; an older game drawn in 16 × 16 keeps its grid', () => {
    const { game_grid_size, valid_grid_size, fits_grid } = require('../src/static/level_selection.js');
    assert.equal(game_grid_size({ sprites: [] }), 24);
    assert.equal(game_grid_size({ properties: { grid_size: 16 }, sprites: [{ width: 24, height: 24 }] }), 16);
    assert.equal(game_grid_size({ sprites: [{ width: 24, height: 48 }, { width: 72, height: 24 }, { width: 20, height: 20 }] }), 24);
    assert.equal(game_grid_size({ sprites: [{ width: 16, height: 16 }, { width: 16, height: 32 }, { width: 24, height: 24 }] }), 16);
    assert.equal(game_grid_size({ properties: { grid_size: 'x' } }), 24);
    assert.ok(!valid_grid_size(2) && valid_grid_size(16));
    assert.ok(fits_grid(48, 72, 24) && !fits_grid(30, 24, 24));
});

test('the pen puts a sprite on whole cells: its lower left corner on the grid, as before for one cell', () => {
    const { sprite_grid_point, sprite_grid_step } = require('../src/static/level_selection.js');
    const grid = { width: 24, height: 24, x: 0, y: 0 };
    // one cell: the centre on the grid point of the cell under the pointer (what the editor always did)
    for (const x of [-12, 0, 11.9, 12, 30, -13]) {
        const old = Math.round(Math.floor((x + 12) / 24) * 24);
        assert.deepEqual(sprite_grid_point(x, 30, 24, 24, grid), [old, 24]);
    }
    // two cells wide: its left edge on a grid line, so it lines up with the blocks
    assert.deepEqual(sprite_grid_point(0, 5, 48, 24, grid), [12, 0]);
    assert.deepEqual(sprite_grid_point(13, 5, 48, 24, grid), [36, 0]);
    // a Gitteroffset moves the lines
    assert.deepEqual(sprite_grid_point(0, 5, 24, 24, { ...grid, x: 12 }), [12, 0]);
    // shapes step by whole cells of the sprite
    assert.deepEqual(sprite_grid_step(48, 24, grid), { width: 48, height: 24 });
    assert.deepEqual(sprite_grid_step(30, 20, grid), { width: 48, height: 24 });
});

test('nach vorne / nach hinten: the selected go to the end or the start of the layer, in their order', () => {
    const front = sel.reorder_placed(layer(), [0, 2], 'front');
    assert.deepEqual(front.sprites.map(p => p[0]), ['b', 'd', 'a', 'c']);
    assert.deepEqual(front.selection, [2, 3]);
    const back = sel.reorder_placed(layer(), [3, 1], 'back');
    assert.deepEqual(back.sprites.map(p => p[0]), ['b', 'd', 'a', 'c']);
    assert.deepEqual(back.selection, [0, 1]);
    assert.deepEqual(sel.reorder_placed(layer(), [], 'front').selection, []);
});
