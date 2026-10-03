const test = require('node:test');
const assert = require('node:assert/strict');
const map = require('../src/static/level_minimap.js');

const sizes = { s1: { width: 24, height: 24 }, big: { width: 48, height: 96 } };
const size_of = (ref) => sizes[ref] ?? null;

test('the map covers the sprites of the layers that scroll with the level', () => {
    const layers = [
        { type: 'sprites', properties: { parallax: 0 }, sprites: [['s1', 0, 0], ['s1', 240, 48], ['big', 120, 0]] },
        // a far background: drawn elsewhere, not part of the map's frame
        { type: 'sprites', properties: { parallax: 0.5 }, sprites: [['s1', 5000, 5000]] },
        { type: 'backdrop', properties: {} },
        // unknown sprite: left out
        { type: 'sprites', properties: {}, sprites: [['gone', -900, 0]] },
    ];
    assert.deepEqual(map.minimap_bounds(layers, size_of, 0), { x0: -12, y0: 0, x1: 252, y1: 96 });
    assert.deepEqual(map.minimap_bounds(layers, size_of), { x0: -36, y0: -24, x1: 276, y1: 120 });
    // only parallax layers: then those
    assert.deepEqual(map.minimap_bounds([layers[1]], size_of, 0), { x0: 4988, y0: 5000, x1: 5012, y1: 5024 });
    assert.equal(map.minimap_bounds([{ type: 'sprites', properties: {}, sprites: [] }], size_of), null);
    assert.equal(map.minimap_bounds(undefined, size_of), null);
});

test('the map keeps the level\'s proportions and fits the space', () => {
    const wide = map.minimap_layout({ x0: 0, y0: 0, x1: 2400, y1: 240 }, 200, 120);
    assert.deepEqual([wide.width, wide.height], [200, 24]);   // 20 high, but at least 24
    assert.ok(Math.abs(wide.scale - 200 / 2400) < 1e-9);
    const tall = map.minimap_layout({ x0: 0, y0: 0, x1: 240, y1: 480 }, 200, 120);
    assert.deepEqual([tall.width, tall.height], [60, 120]);
});

test('map and world points convert both ways, centred on the level', () => {
    const bounds = { x0: 0, y0: 0, x1: 2400, y1: 240 };
    const layout = map.minimap_layout(bounds, 200, 120);
    // the middle of the level is the middle of the map (y goes down on the map)
    assert.deepEqual(map.minimap_world_to_map(bounds, layout, 1200, 120), [100, 12]);
    const [mx, my] = map.minimap_world_to_map(bounds, layout, 0, 240);
    assert.ok(Math.abs(mx) < 1e-9 && Math.abs(my - 2) < 1e-9);
    const [x, y] = map.minimap_map_to_world(bounds, layout, mx, my);
    assert.ok(Math.abs(x) < 1e-9 && Math.abs(y - 240) < 1e-9);
});

test('the frame of the view is cut to the map', () => {
    const bounds = { x0: 0, y0: 0, x1: 1000, y1: 500 };
    const layout = map.minimap_layout(bounds, 200, 100);   // 0.2 map pixels per world pixel
    assert.deepEqual(map.minimap_view_frame(bounds, layout, { x0: 100, y0: 100, x1: 600, y1: 400 }),
        { left: 20, top: 20, width: 100, height: 60 });
    // partly outside: only the part on the map
    assert.deepEqual(map.minimap_view_frame(bounds, layout, { x0: 900, y0: -100, x1: 1400, y1: 200 }),
        { left: 180, top: 60, width: 20, height: 40 });
    // all outside: nothing
    const gone = map.minimap_view_frame(bounds, layout, { x0: 2000, y0: 0, x1: 2500, y1: 100 });
    assert.equal(gone.width, 0);
});
